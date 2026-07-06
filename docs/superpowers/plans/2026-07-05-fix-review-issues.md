# Fix Code-Review Issues Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the confirmed major bugs from the code review: mobile taps swallowed by category-label hit zones and the focused-mode dead branch, star glow opacity decaying to zero, phantom clicks after orbit drags, the permanently-dead contradiction feature, the double-pushed user quotes, the star y-position double-offset, and keyword miscategorization.

**Architecture:** Extract the interaction/rendering decision logic (opacity, scale, tap detection, click routing) into a new pure-function module `constellation-helpers.js` so it is unit-testable without WebGL; `constellation.js` becomes a thin shell that derives material state from semantic state every frame instead of mutating it incrementally. The contradiction feature is revived by regenerating `public/data/precomputed.json` with the same MiniLM model the runtime uses and fetching it at startup.

**Tech Stack:** Vanilla JS ES modules, three@^0.160 (+OrbitControls), Vite 5, Vitest (new devDependency), @xenova/transformers (Node-side, for the precompute script).

## Global Constraints

- Vanilla JavaScript ES modules only — no TypeScript, no framework.
- Runtime dependencies must not grow: `three` is the only bundled runtime dep; the in-browser embedding model stays a lazy CDN import (`https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/...`).
- Deploy model must keep working: GitHub Pages serves the repo root; `index.html` meta-refreshes into `dist/index-dev.html`; `dist/` is committed. Any file the browser fetches at runtime must resolve relative to `dist/index-dev.html` after `npm run build` (use Vite's `public/` directory for static data).
- Three.js API level: 0.160 (`child.isSprite` is available; `raycaster.setFromCamera` sets `raycaster.camera`, which Sprite raycasting requires).
- Test runner: `npx vitest run` (script: `npm test`). Node is v22.
- Behavior constraints: quote IDs are strings (`seed-N` or UUIDs); star hover/selection UX must keep working with a mouse exactly as before except where a fix is specified.

---

### Task 0: Install dependencies and set up Vitest

**Files:**
- Modify: `package.json`
- Test: `tests/smoke.test.js`

**Interfaces:**
- Produces: working `npm test` command all later tasks use.

- [ ] **Step 1: Add vitest and align @xenova/transformers, remove the unused openai dep**

In `package.json`, change the dependency blocks to exactly:

```json
  "dependencies": {
    "three": "^0.160.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "vitest": "^1.6.0",
    "@xenova/transformers": "^2.17.2"
  }
```

(@xenova/transformers moves to devDependencies because only `scripts/generate-embeddings.js` imports it from node_modules; the browser uses the pinned CDN build. `openai` is removed — Task 6 rewrites the only script that used it.)

Add to `"scripts"`:

```json
    "test": "vitest run"
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: completes without errors; `node_modules/three` and `node_modules/vitest` exist.

- [ ] **Step 3: Write a smoke test proving three imports headlessly**

Create `tests/smoke.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

describe('test harness', () => {
  it('imports three and does vector math headlessly', () => {
    const v = new THREE.Vector3(3, 4, 0);
    expect(v.length()).toBe(5);
  });
});
```

- [ ] **Step 4: Run the test**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json tests/smoke.test.js
git commit -m "chore: add vitest harness, drop unused openai dep"
```

---

### Task 1: Word-boundary keyword matching in categorizeQuote

**Files:**
- Modify: `categories.js:56-75`
- Test: `tests/categories.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: `categorizeQuote(text: string): string` (same signature, fixed matching). No caller changes needed (`main.js` already calls it).

- [ ] **Step 1: Write the failing test**

Create `tests/categories.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { categorizeQuote } from '../categories.js';

describe('categorizeQuote', () => {
  it('does not match keywords as substrings of other words', () => {
    // Substring bug: 'do' (courage keyword) matches inside 'wisdom' and
    // 'freedom', making courage score 3 and win. With word matching,
    // wisdom and courage each score 1 and the earlier category (wisdom) wins.
    expect(categorizeQuote('wisdom and freedom')).toBe('wisdom');
  });

  it('still matches whole-word keywords', () => {
    expect(categorizeQuote('It takes courage to act with courage')).toBe('courage');
    expect(categorizeQuote('Simple things should be simple')).toBe('simplicity');
  });

  it('defaults to wisdom when nothing matches', () => {
    expect(categorizeQuote('zzz qqq')).toBe('wisdom');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/categories.test.js`
Expected: FAIL — first test gets `'courage'` instead of `'wisdom'`.

- [ ] **Step 3: Fix categorizeQuote to match whole words**

In `categories.js`, replace the body of `categorizeQuote` (lines 56-75) with:

```js
// Categorize a quote based on its text
export function categorizeQuote(text) {
  // Whole-word matching: substring matching made e.g. 'do' (courage)
  // match inside 'wisdom' and 'freedom'.
  const words = new Set(text.toLowerCase().split(/[^a-z']+/));
  let bestCategory = 'wisdom'; // default
  let bestScore = 0;

  for (const [categoryId, category] of Object.entries(categories)) {
    let score = 0;
    for (const keyword of category.keywords) {
      if (words.has(keyword)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = categoryId;
    }
  }

  return bestCategory;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/categories.test.js`
Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add categories.js tests/categories.test.js
git commit -m "fix: match category keywords as whole words, not substrings"
```

---

### Task 2: Pure helpers module (opacity, scale, tap detection, click routing)

**Files:**
- Create: `constellation-helpers.js`
- Test: `tests/constellation-helpers.test.js`

**Interfaces:**
- Consumes: nothing (pure functions).
- Produces (used verbatim by Tasks 3 and 4):
  - `computeStarOpacity({ baseOpacity, isSprite, pulse, starCategory, focusedCategory, contradictionMode }): number`
  - `computeStarScale({ introScale, isHovered, starCategory, focusedCategory }): number`
  - `isTap(downX, downY, upX, upY, maxDistance = 10): boolean`
  - `routeClick({ quote, categoryId, focusedCategory }): { action: 'selectQuote'|'focusCategory'|'unfocusCategory'|'none', quote?, categoryId?, alsoFocusStar? }`

- [ ] **Step 1: Write the failing tests**

Create `tests/constellation-helpers.test.js`:

```js
import { describe, it, expect } from 'vitest';
import {
  computeStarOpacity,
  computeStarScale,
  isTap,
  routeClick
} from '../constellation-helpers.js';

describe('computeStarOpacity', () => {
  const base = { baseOpacity: 0.6, isSprite: true, pulse: 1, starCategory: 'wisdom' };

  it('is stable over repeated frames (no compounding decay)', () => {
    let o;
    for (let i = 0; i < 1000; i++) {
      o = computeStarOpacity({ ...base, pulse: 0.9, focusedCategory: null, contradictionMode: false });
    }
    expect(o).toBeCloseTo(0.54); // 0.6 * 0.9 every frame, forever
  });

  it('ignores pulse for non-sprite children (cores)', () => {
    const o = computeStarOpacity({ baseOpacity: 0.9, isSprite: false, pulse: 0.8, starCategory: 'wisdom', focusedCategory: null, contradictionMode: false });
    expect(o).toBe(0.9);
  });

  it('brightens in-category and dims out-of-category stars when focused', () => {
    const inCat = computeStarOpacity({ ...base, focusedCategory: 'wisdom', contradictionMode: false });
    const outCat = computeStarOpacity({ ...base, starCategory: 'courage', focusedCategory: 'wisdom', contradictionMode: false });
    expect(inCat).toBeCloseTo(Math.min(1, 0.6 * 1.4));
    expect(outCat).toBeCloseTo(0.6 * 0.2);
  });

  it('halves opacity in contradiction mode and round-trips when disabled', () => {
    const on = computeStarOpacity({ ...base, focusedCategory: null, contradictionMode: true });
    const off = computeStarOpacity({ ...base, focusedCategory: null, contradictionMode: false });
    expect(on).toBeCloseTo(off / 2);
  });

  it('clamps to 1', () => {
    const o = computeStarOpacity({ baseOpacity: 0.9, isSprite: true, pulse: 1, starCategory: 'wisdom', focusedCategory: 'wisdom', contradictionMode: false });
    expect(o).toBe(1);
  });
});

describe('computeStarScale', () => {
  it('is 1 in the normal state', () => {
    expect(computeStarScale({ introScale: 1, isHovered: false, starCategory: 'wisdom', focusedCategory: null })).toBe(1);
  });
  it('is 1.5 when hovered', () => {
    expect(computeStarScale({ introScale: 1, isHovered: true, starCategory: 'wisdom', focusedCategory: null })).toBe(1.5);
  });
  it('is 1.5 in-category / 0.7 out-of-category when focused, hover does not shrink back', () => {
    expect(computeStarScale({ introScale: 1, isHovered: false, starCategory: 'wisdom', focusedCategory: 'wisdom' })).toBe(1.5);
    expect(computeStarScale({ introScale: 1, isHovered: false, starCategory: 'courage', focusedCategory: 'wisdom' })).toBe(0.7);
    expect(computeStarScale({ introScale: 1, isHovered: true, starCategory: 'courage', focusedCategory: 'wisdom' })).toBe(1.5);
  });
  it('multiplies by introScale for the appear animation', () => {
    expect(computeStarScale({ introScale: 0.5, isHovered: false, starCategory: 'wisdom', focusedCategory: null })).toBe(0.5);
  });
});

describe('isTap', () => {
  it('accepts movement within the threshold', () => {
    expect(isTap(100, 100, 105, 104)).toBe(true);
  });
  it('rejects a drag', () => {
    expect(isTap(100, 100, 140, 100)).toBe(false);
  });
});

describe('routeClick', () => {
  const quote = { id: 'seed-1', category: 'wisdom' };

  it('prefers the star over a category label', () => {
    const r = routeClick({ quote, categoryId: 'wisdom', focusedCategory: null });
    expect(r.action).toBe('selectQuote');
  });

  it('selects a quote and focuses the camera when unfocused', () => {
    const r = routeClick({ quote, categoryId: null, focusedCategory: null });
    expect(r).toEqual({ action: 'selectQuote', quote, alsoFocusStar: true });
  });

  it('selects a quote outside the focused category (no more dead branch)', () => {
    const r = routeClick({ quote, categoryId: null, focusedCategory: 'courage' });
    expect(r).toEqual({ action: 'selectQuote', quote, alsoFocusStar: false });
  });

  it('focuses a category label when no star is hit', () => {
    expect(routeClick({ quote: null, categoryId: 'courage', focusedCategory: null }))
      .toEqual({ action: 'focusCategory', categoryId: 'courage' });
  });

  it('unfocuses when the focused category label is clicked again', () => {
    expect(routeClick({ quote: null, categoryId: 'courage', focusedCategory: 'courage' }))
      .toEqual({ action: 'unfocusCategory' });
  });

  it('unfocuses on empty space when focused, does nothing otherwise', () => {
    expect(routeClick({ quote: null, categoryId: null, focusedCategory: 'courage' }))
      .toEqual({ action: 'unfocusCategory' });
    expect(routeClick({ quote: null, categoryId: null, focusedCategory: null }))
      .toEqual({ action: 'none' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/constellation-helpers.test.js`
Expected: FAIL — module `constellation-helpers.js` not found.

- [ ] **Step 3: Implement the helpers**

Create `constellation-helpers.js`:

```js
// Pure decision logic for the constellation, kept free of THREE/DOM so it
// can be unit tested. constellation.js derives material state from these
// every frame instead of mutating opacity/scale incrementally (the old
// relative updates compounded: opacity *= pulse decayed to 0 in ~2s).

// Final material opacity for one child (glow sprite or core mesh) of a star.
export function computeStarOpacity({
  baseOpacity,
  isSprite,
  pulse,
  starCategory,
  focusedCategory,
  contradictionMode
}) {
  let factor = 1;
  if (focusedCategory) {
    factor = starCategory === focusedCategory ? 1.4 : 0.2;
  }
  if (contradictionMode) {
    factor *= 0.5;
  }
  const p = isSprite ? pulse : 1;
  return Math.min(1, baseOpacity * factor * p);
}

// Final scale for a star group. introScale is the 0..1 appear animation.
export function computeStarScale({ introScale, isHovered, starCategory, focusedCategory }) {
  let scale = 1;
  if (focusedCategory) {
    scale = starCategory === focusedCategory ? 1.5 : 0.7;
  }
  if (isHovered) {
    scale = 1.5;
  }
  return scale * introScale;
}

// A press-release pair is a tap (not a drag) if the pointer moved at most
// maxDistance CSS pixels. Prevents orbit drags from acting as clicks.
export function isTap(downX, downY, upX, upY, maxDistance = 10) {
  const dx = upX - downX;
  const dy = upY - downY;
  return dx * dx + dy * dy <= maxDistance * maxDistance;
}

// Decide what a confirmed tap/click does. Stars win over category labels;
// clicks on stars always open the quote (the old code silently ignored
// stars outside the focused category).
export function routeClick({ quote, categoryId, focusedCategory }) {
  if (quote) {
    return { action: 'selectQuote', quote, alsoFocusStar: !focusedCategory };
  }
  if (categoryId) {
    return categoryId === focusedCategory
      ? { action: 'unfocusCategory' }
      : { action: 'focusCategory', categoryId };
  }
  if (focusedCategory) {
    return { action: 'unfocusCategory' };
  }
  return { action: 'none' };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/constellation-helpers.test.js`
Expected: all passed.

- [ ] **Step 5: Commit**

```bash
git add constellation-helpers.js tests/constellation-helpers.test.js
git commit -m "feat: pure helpers for star opacity/scale, tap detection, click routing"
```

---

### Task 3: Derived rendering state in constellation.js (opacity decay, y-double-offset, scale conflicts)

Fixes three confirmed bugs at once because they share the same root (incremental mutation of render state): the `opacity *= pulse` decay, the star y-position double-offset (children carry absolute positions AND `animate()` moves the group by `basePos.y + offset`, so stars render at ~2× their intended y — which also detaches them from contradiction lines and their labels, and made `focusOnStar` target the wrong point), and the hover/focus scale conflicts.

**Files:**
- Modify: `constellation.js` (`createStar` 90-130, `createCategoryLabel` 134-177, `animateStarIn` 267-285, `setContradictionMode` 378-390, `focusOnCategory` 481-555, `unfocusCategory` 558-585, `highlightStar` 423-429, `onMouseMove` 588-619, `animate` 655-682)
- Test: covered by Task 2's unit tests + manual visual verification (Constellation needs WebGL, so no headless test).

**Interfaces:**
- Consumes: `computeStarOpacity`, `computeStarScale` from `constellation-helpers.js` (signatures in Task 2).
- Produces: `star.userData` now carries `{ quote, originalPosition, introScale }`; each star child carries `child.userData.baseOpacity`; label sprites carry `userData.baseOpacity`. `highlightStar` is deleted (state-derived now). Task 4 relies on these userData fields existing.

- [ ] **Step 1: Add the helper import**

At the top of `constellation.js`, after the categories import:

```js
import { computeStarOpacity, computeStarScale, routeClick, isTap } from './constellation-helpers.js';
```

(`routeClick`/`isTap` are used in Task 4; importing them now keeps this the only import change.)

- [ ] **Step 2: Position the group, not the children, and store base opacities in createStar**

In `createStar`, make the children sit at the group origin and move the group to the quote position. Replace the sprite/core/group assembly (keep the brightness/size/color code above it unchanged):

```js
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(size * 4, size * 4, 1);
    sprite.userData.baseOpacity = 0.6 * brightness;

    // Core point with category tint
    const coreGeometry = new THREE.SphereGeometry(size * 0.3, 16, 16);
    const coreColor = categoryColor.clone().lerp(new THREE.Color(1, 1, 1), 0.7);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: coreColor,
      transparent: true,
      opacity: 0.9
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.userData.baseOpacity = 0.9;

    // Group star elements; children stay at the group origin so animate()
    // can float the group without double-counting the position.
    const group = new THREE.Group();
    group.add(sprite);
    group.add(core);
    group.position.set(position.x, position.y, position.z);
    group.userData = { quote, originalPosition: position, introScale: 1 };

    return group;
```

(This removes `sprite.position.set(...)` and `core.position.copy(sprite.position)`.)

- [ ] **Step 3: Store the label base opacity in createCategoryLabel**

In `createCategoryLabel`, change the userData line to:

```js
    sprite.userData = { categoryId, category, count, baseOpacity: 0.5 + normalizedSize * 0.4 };
```

- [ ] **Step 4: Make the appear animation drive introScale instead of scale**

Replace `addStar`'s animation kickoff (`star.scale.set(0, 0, 0); this.animateStarIn(star);` stays as-is) and replace `animateStarIn` with:

```js
  // Animate star appearing (writes introScale; animate() applies it)
  animateStarIn(star) {
    const startTime = this.clock.getElapsedTime();
    const duration = 0.8;
    star.userData.introScale = 0;

    const animate = () => {
      const elapsed = this.clock.getElapsedTime() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3) * Math.cos(progress * Math.PI * 2);
      star.userData.introScale = eased;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        star.userData.introScale = 1;
      }
    };

    animate();
  }
```

Also delete the `star.scale.set(0, 0, 0);` line in `addStar` (introScale handles it).

- [ ] **Step 5: Strip all opacity/scale mutation from mode changes**

Replace `setContradictionMode` entirely with:

```js
  // Toggle contradiction mode (opacity is derived per-frame in animate())
  setContradictionMode(enabled) {
    this.contradictionMode = enabled;
    this.contradictionGroup.visible = enabled;
  }
```

In `focusOnCategory`, delete the same-category toggle block (`if (this.focusedCategory === categoryId) { this.unfocusCategory(); return; }` — routing handles toggling now), delete the whole `this.stars.forEach(...)` opacity/scale block, and delete the whole `this.categoryLabels.forEach(...)` label-dimming block. Keep `this.focusedCategory = categoryId;` and the camera-zoom animation.

Replace `unfocusCategory` entirely with:

```js
  // Unfocus category - stars and labels restore via derived state
  unfocusCategory() {
    this.focusedCategory = null;
  }
```

Delete the `highlightStar` method (423-429). In `onMouseMove`, replace the two `this.highlightStar(...)` calls: the hover-start branch keeps only `this.hoveredStar = this.stars.get(quote.id);`, and the hover-end branch keeps only `this.hoveredStar = null;`.

- [ ] **Step 6: Derive opacity and scale every frame in animate()**

Replace the two `this.stars.forEach(...)` blocks in `animate()` with:

```js
    // Float, pulse, and derive opacity/scale from semantic state
    this.stars.forEach((star, id) => {
      const basePos = star.userData.originalPosition;
      if (!basePos) return;

      star.position.y = basePos.y + Math.sin(time * 0.5 + id.charCodeAt(0)) * 0.15;

      const pulse = 0.9 + Math.sin(time * 2 + id.charCodeAt(0) * 0.1) * 0.1;
      const starCategory = star.userData.quote?.category;

      for (const child of star.children) {
        if (!child.material) continue;
        child.material.opacity = computeStarOpacity({
          baseOpacity: child.userData.baseOpacity,
          isSprite: child.isSprite === true,
          pulse,
          starCategory,
          focusedCategory: this.focusedCategory,
          contradictionMode: this.contradictionMode
        });
      }

      const scale = computeStarScale({
        introScale: star.userData.introScale ?? 1,
        isHovered: star === this.hoveredStar,
        starCategory,
        focusedCategory: this.focusedCategory
      });
      star.scale.set(scale, scale, scale);
    });

    this.categoryLabels.forEach((label, catId) => {
      label.material.opacity = this.focusedCategory
        ? (catId === this.focusedCategory ? 1 : 0.2)
        : label.userData.baseOpacity;
    });
```

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all tests pass (helpers, categories, smoke).

- [ ] **Step 8: Manual visual verification**

Run: `npm run dev` (opens `/index-dev.html`).
Check, waiting ~10 seconds on each state:
1. Star glows stay visibly pulsing and do NOT fade out over time.
2. Red contradiction-line endpoints and category labels sit ON their clusters (y-offset fix) — note contradiction lines only render after Task 6; for now verify labels sit just above their clusters rather than far from them.
3. Click a star (desktop): camera glides to it — to the star itself, not toward scene center.
4. Toggle the ⚡ button twice: star brightness returns exactly to normal.
5. Hover stars while a category is focused: dimmed stars enlarge on hover and re-dim on hover-out (no stuck scale).

- [ ] **Step 9: Commit**

```bash
git add constellation.js
git commit -m "fix: derive star opacity/scale/position from state each frame

Fixes compounding opacity decay (glows vanished in ~2s), star y rendered
at double offset (detached from labels/lines, wrong focus target), and
hover/focus/contradiction scale+opacity conflicts."
```

---

### Task 4: Fix tap swallowing — label hit-testing, click routing, tap-vs-drag

**Files:**
- Modify: `constellation.js` (`init` event listeners 77-81, `getCategoryAtMouse` 450-478, `onMouseMove` 588-619, `onClick` 621-646)
- Test: `tests/label-raycast.test.js` (headless three raycast) + routing already covered in Task 2.

**Interfaces:**
- Consumes: `routeClick`, `isTap` (imported in Task 3 Step 1); label sprites in `this.labelsGroup` with `userData.categoryId`.
- Produces: `onClick` behavior relied on by manual tests; no new exports.

- [ ] **Step 1: Write the failing headless raycast test**

The old `getCategoryAtMouse` used a hand-rolled 0.25-NDC radius (≈a quarter of the viewport across 8 labels) that swallowed star taps. The fix raycasts the actual label sprite quads. This test pins down that sprite raycasting works headlessly and misses points off the label:

Create `tests/label-raycast.test.js`:

```js
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

// Mirrors the fixed getCategoryAtMouse: raycast label sprite quads instead
// of a 0.25-NDC radius around their centers.
function categoryAt(ndc, camera, labelsGroup) {
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(labelsGroup.children, false);
  return hits.length > 0 ? hits[0].object.userData.categoryId : null;
}

describe('label sprite raycasting', () => {
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1000);
  camera.position.set(0, 0, 80);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();

  const labelsGroup = new THREE.Group();
  const label = new THREE.Sprite(new THREE.SpriteMaterial());
  label.position.set(-40, 55, 0); // wisdom cluster label (y+25)
  label.scale.set(30, 7.5, 1);    // mid-size label
  label.userData = { categoryId: 'wisdom' };
  labelsGroup.add(label);
  labelsGroup.updateMatrixWorld(true);

  const ndcOf = (pos) => {
    const p = pos.clone().project(camera);
    return new THREE.Vector2(p.x, p.y);
  };

  it('hits a tap on the label quad', () => {
    expect(categoryAt(ndcOf(label.position), camera, labelsGroup)).toBe('wisdom');
  });

  it('misses a star 10 world units below the label (old 0.25-NDC zone caught it)', () => {
    const nearStar = new THREE.Vector3(-40, 45, 0);
    expect(categoryAt(ndcOf(nearStar), camera, labelsGroup)).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify current expectations**

Run: `npx vitest run tests/label-raycast.test.js`
Expected: PASS (it tests the new function shape directly — it exists to lock the geometry in before wiring it into constellation.js, and to catch three upgrades breaking headless sprite raycasts).

- [ ] **Step 3: Replace getCategoryAtMouse with a sprite raycast**

In `constellation.js`, replace the whole `getCategoryAtMouse` method with:

```js
  // Get category label at mouse position (raycasts the actual label quad;
  // the old hand-rolled 0.25-NDC radius swallowed taps on nearby stars)
  getCategoryAtMouse() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.labelsGroup.children, false);
    return hits.length > 0 ? hits[0].object.userData.categoryId : null;
  }
```

- [ ] **Step 4: Rewrite the event wiring and onClick with tap detection and routing**

In `init()`, replace the two container listeners (mousemove/click) with:

```js
    this.container.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.container.addEventListener('pointerdown', (e) => {
      this.pointerDownAt = { x: e.clientX, y: e.clientY };
    });
    this.container.addEventListener('click', (e) => this.onClick(e));
```

Add a small coordinate helper next to `onMouseMove` and use it in both handlers:

```js
  setMouseFromEvent(event) {
    this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }
```

In `onMouseMove`, replace the first two lines (the inline `this.mouse.x/y` math) with `this.setMouseFromEvent(event);`.

Replace the whole `onClick` method with:

```js
  onClick(event) {
    // Ignore click events that conclude an orbit drag
    if (this.pointerDownAt && !isTap(this.pointerDownAt.x, this.pointerDownAt.y, event.clientX, event.clientY)) {
      return;
    }
    this.setMouseFromEvent(event);

    const route = routeClick({
      quote: this.getQuoteAtMouse(),
      categoryId: this.getCategoryAtMouse(),
      focusedCategory: this.focusedCategory
    });

    switch (route.action) {
      case 'selectQuote':
        if (route.alsoFocusStar) {
          this.focusOnStar(route.quote.id);
        }
        this.onQuoteSelect?.(route.quote);
        break;
      case 'focusCategory':
        this.focusOnCategory(route.categoryId);
        break;
      case 'unfocusCategory':
        this.unfocusCategory();
        break;
    }
  }
```

Note `focusOnStar` uses `star.position` — correct now that Task 3 moved positions onto the group.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Manual verification (desktop + mobile emulation)**

Run: `npm run dev`. In the browser:
1. Desktop: drag to orbit and release the drag over a star → no quote overlay opens (tap-vs-drag fix).
2. Desktop: click a star near the top of a cluster (just under its label) → the QUOTE opens; the category no longer steals the click.
3. Click a category label → cluster focuses. Now click a star in a DIFFERENT cluster → its quote opens (dead branch fixed). Click the same label again → unfocuses.
4. Mobile: open devtools device emulation (e.g. iPhone 12), reload. Tap stars at cluster tops and while a category is focused → the quote overlay opens every time; tap empty space while focused → unfocus.

- [ ] **Step 7: Commit**

```bash
git add constellation.js tests/label-raycast.test.js
git commit -m "fix: stop category labels and focus state from swallowing taps

Labels hit-test their actual sprite quad instead of a 0.25-NDC radius,
stars win over labels, clicks route through one decision function (no
dead branch when focused), and drags no longer count as clicks."
```

---

### Task 5: Fix user-added quote double-push

**Files:**
- Modify: `constellation.js` (`addStar` 251-264), `main.js:280-281`

**Interfaces:**
- Consumes: nothing new.
- Produces: `addStar(quote, position)` no longer mutates the shared quotes array (App owns it); `window.app` exposed for console verification/debugging.

- [ ] **Step 1: Remove the duplicate push**

In `constellation.js` `addStar`, delete the line `this.quotes.push(quote);` (main.js:246 already pushed the same object into the same array — `updateConstellation` stores it by reference). Keep `this.positions[quote.id] = position;` (idempotent, same key).

- [ ] **Step 2: Expose the app instance for verification**

In `main.js`, change the last line from `new App();` to:

```js
window.app = new App();
```

- [ ] **Step 3: Manual verification**

Run: `npm run dev`. In the browser console:
1. Press `A`, add quote text `test quote alpha`, press Enter.
2. Run: `app.quotes.filter(q => q.text === 'test quote alpha').length`
Expected: `1` (was `2` before the fix).
3. Run: `JSON.parse(localStorage.getItem('quote-constellation-quotes')).filter(q => q.text === 'test quote alpha').length` → `1`.
4. Clean up: `localStorage.clear()` and reload.

- [ ] **Step 4: Run the suite and commit**

Run: `npm test` — all pass.

```bash
git add constellation.js main.js
git commit -m "fix: add user quote to the shared quotes array once, not twice"
```

---

### Task 6: Revive contradiction mode (precomputed embeddings, fetched at startup)

The feature is dead for fresh visitors: embeddings load only from localStorage, the background compute is gated on already having embeddings, and `data/precomputed.json` is an empty placeholder that nothing fetches. The old generator also used OpenAI 1536-dim vectors (incompatible with the runtime's 384-dim MiniLM) and a drifted copy of the seed quotes.

**Files:**
- Modify: `scripts/generate-embeddings.js` (full rewrite), `main.js` (`loadData` 71-115, imports 3-11), `embeddings.js` (`getAllContradictions` 106-143)
- Create: `public/data/precomputed.json` (generated artifact, committed)
- Delete: `data/precomputed.json` (and the now-empty `data/` dir)
- Test: `tests/contradictions.test.js`

**Interfaces:**
- Consumes: `seedQuotes` from `quotes.js`; `getAllContradictions(allQuotes, embeddings, threshold?)` from `embeddings.js`.
- Produces: `public/data/precomputed.json` with shape `{ "embeddings": { "seed-0": number[384], ... }, "model": "Xenova/all-MiniLM-L6-v2", "generated": "<ISO date>" }`; `App.loadPrecomputedEmbeddings(): Promise<Record<string, number[]>>`.

- [ ] **Step 1: Write the failing test for the contradiction floor**

`getAllContradictions` returns `[]` whenever no pair falls under the 0.1 threshold, so even with embeddings the feature can look dead. Give it a floor: always return the 10 most-dissimilar pairs.

Create `tests/contradictions.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { getAllContradictions } from '../embeddings.js';

// 12 quotes on a 2D unit circle: angles spread so some pairs are opposed
// (similarity near -1) and others aligned. None are identical.
const quotes = [];
const embeddings = {};
for (let i = 0; i < 12; i++) {
  const angle = (i / 12) * Math.PI * 2;
  const id = `q-${i}`;
  quotes.push({ id, text: `quote ${i}` });
  embeddings[id] = [Math.cos(angle), Math.sin(angle)];
}

describe('getAllContradictions', () => {
  it('returns the most-dissimilar pairs sorted ascending by similarity', () => {
    const pairs = getAllContradictions(quotes, embeddings);
    expect(pairs.length).toBeGreaterThan(0);
    for (let i = 1; i < pairs.length; i++) {
      expect(pairs[i].similarity).toBeGreaterThanOrEqual(pairs[i - 1].similarity);
    }
    expect(pairs[0].similarity).toBeLessThan(-0.9); // opposite vectors exist
  });

  it('falls back to the 10 lowest-similarity pairs when none clear the threshold', () => {
    // All vectors nearly parallel: no pair under threshold 0.1
    const parallelQuotes = [];
    const parallelEmb = {};
    for (let i = 0; i < 6; i++) {
      const id = `p-${i}`;
      parallelQuotes.push({ id, text: `p ${i}` });
      parallelEmb[id] = [1, i * 0.01]; // similarity ~1 for every pair
    }
    const pairs = getAllContradictions(parallelQuotes, parallelEmb);
    expect(pairs.length).toBe(10); // floor: 10 lowest overall (15 pairs exist)
  });

  it('returns [] with no embeddings', () => {
    expect(getAllContradictions(quotes, {})).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/contradictions.test.js`
Expected: FAIL — the fallback test gets `[]` (threshold filters everything out).

- [ ] **Step 3: Add the floor to getAllContradictions**

In `embeddings.js`, replace `getAllContradictions` in full with:

```js
// Get all contradiction pairs for the constellation
export function getAllContradictions(allQuotes, embeddings, threshold = 0.1) {
  const pairs = [];
  const seen = new Set();

  for (const quote1 of allQuotes) {
    const emb1 = embeddings[quote1.id];
    if (!emb1) continue;

    for (const quote2 of allQuotes) {
      if (quote1.id === quote2.id) continue;

      const pairKey = [quote1.id, quote2.id].sort().join('-');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const emb2 = embeddings[quote2.id];
      if (!emb2) continue;

      pairs.push({ quote1, quote2, similarity: cosineSimilarity(emb1, emb2) });
    }
  }

  // Sort by lowest similarity first (strongest contradictions)
  pairs.sort((a, b) => a.similarity - b.similarity);

  // Take pairs under the threshold, but always keep a floor of the 10
  // most-dissimilar pairs so the mode is never visually empty.
  const below = pairs.filter(p => p.similarity < threshold).length;
  const count = Math.max(Math.min(10, pairs.length), Math.floor(below * 0.2));
  return pairs.slice(0, count);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/contradictions.test.js`
Expected: 3 passed.

- [ ] **Step 5: Rewrite the generator script**

Replace the entire contents of `scripts/generate-embeddings.js` with:

```js
// Generates public/data/precomputed.json: MiniLM embeddings for the seed
// quotes, using the SAME model the browser uses (Xenova/all-MiniLM-L6-v2,
// 384-dim) so runtime-generated embeddings for user quotes are comparable.
//
// Run: npm run generate-embeddings  (downloads the model on first run)
import { pipeline } from '@xenova/transformers';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { seedQuotes } from '../quotes.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

const embeddings = {};
for (let i = 0; i < seedQuotes.length; i++) {
  const output = await extractor(seedQuotes[i].text, { pooling: 'mean', normalize: true });
  embeddings[`seed-${i}`] = Array.from(output.data);
  console.log(`Embedded seed-${i} (${i + 1}/${seedQuotes.length})`);
}

const outDir = join(root, 'public', 'data');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'precomputed.json');
writeFileSync(outPath, JSON.stringify({
  embeddings,
  model: 'Xenova/all-MiniLM-L6-v2',
  generated: new Date().toISOString()
}));
console.log(`Wrote ${Object.keys(embeddings).length} embeddings to ${outPath}`);
```

(This deletes the drifted seed-quote copy and the OpenAI/force-layout code — `seedQuotes` is now the single source of truth. `quotes.js` only touches `localStorage` inside functions, so importing it in Node is safe.)

- [ ] **Step 6: Generate the data**

Run: `npm run generate-embeddings` (needs network for the model download, ~25MB, cached afterward)
Expected: 62 `Embedded seed-N` lines, then `Wrote 62 embeddings to .../public/data/precomputed.json`.
Then: `node -e "const d=require('./public/data/precomputed.json'); console.log(Object.keys(d.embeddings).length, d.embeddings['seed-0'].length)"`
Expected: `62 384`.
Delete the old placeholder: `git rm -r data/`

- [ ] **Step 7: Fetch and merge at startup; drop the chicken-and-egg gate**

In `main.js`:

Trim the imports (also removes dead ones — coordinate with Task 7 if executed out of order; the final import lines must be):

```js
import { Constellation } from './constellation.js';
import { loadQuotes, addQuote, loadEmbeddings, setEmbedding } from './quotes.js';
import { generateEmbedding, getAllContradictions } from './embeddings.js';
import { categories, categorizeQuote, getPositionInCluster, quoteCategoryMap } from './categories.js';
```

Add this method to `App` (below `loadData`):

```js
  // Precomputed seed embeddings shipped as a static asset (public/data/)
  async loadPrecomputedEmbeddings() {
    try {
      const res = await fetch('./data/precomputed.json');
      if (!res.ok) return {};
      const data = await res.json();
      return data.embeddings || {};
    } catch (e) {
      console.warn('Failed to load precomputed embeddings:', e);
      return {};
    }
  }
```

In `loadData`, replace the single line `this.embeddings = loadEmbeddings();` with:

```js
    // Precomputed seed embeddings, overridden by any locally computed ones
    const precomputed = await this.loadPrecomputedEmbeddings();
    this.embeddings = { ...precomputed, ...loadEmbeddings() };
```

And replace the gated background-compute block (the comment lines and `if (quotesNeedingEmbeddings.length > 0 && Object.keys(this.embeddings).length > 0) {...}`) with:

```js
    // Fill any missing embeddings in the background (normally only quotes
    // added before this feature shipped; new quotes embed on add)
    const quotesNeedingEmbeddings = this.quotes.filter(q => !this.embeddings[q.id]);
    if (quotesNeedingEmbeddings.length > 0) {
      this.computeEmbeddingsInBackground(quotesNeedingEmbeddings);
    }
```

- [ ] **Step 8: Run the suite and verify in the browser**

Run: `npm test` — all pass.
Run: `npm run dev`, then in a fresh profile / after `localStorage.clear()`:
1. Network tab: `data/precomputed.json` loads with 200.
2. Click the ⚡ toggle → red contradiction lines appear between stars (and touch the stars, thanks to Task 3's position fix).
3. No model download happens on load (background compute has nothing to do).

- [ ] **Step 9: Commit**

```bash
git add scripts/generate-embeddings.js public/data/precomputed.json main.js embeddings.js tests/contradictions.test.js
git commit -m "fix: revive contradiction mode with precomputed MiniLM embeddings

Generator now shares quotes.js seed data and the runtime's 384-dim model,
output ships via public/, the app fetches it at startup, the background
compute gate no longer requires already-having embeddings, and
getAllContradictions keeps a 10-pair floor."
```

---

### Task 7: Remove confirmed-dead code

**Files:**
- Modify: `embeddings.js` (delete lines 62-103 `findNearestNeighbors`/`findContradictions` and 145-312 `reduceDimensions`/`addToLayout`; delete the line-4 import), `vite.config.js` (delete `optimizeDeps` block and `root: '.'`)

**Interfaces:**
- Consumes: Task 6's final import list in `main.js` (already trimmed there).
- Produces: `embeddings.js` exports exactly `generateEmbedding`, `cosineSimilarity`, `getAllContradictions`.

- [ ] **Step 1: Delete dead exports and imports**

In `embeddings.js`: delete the import on line 4 (`import { loadEmbeddings, ... } from './quotes.js';` — none are used), delete `findNearestNeighbors`, `findContradictions`, `reduceDimensions`, and `addToLayout` in full.

In `vite.config.js`: delete the `optimizeDeps: { exclude: ['@xenova/transformers'] },` block (the package is never bundled) and the `root: '.',` line (default).

- [ ] **Step 2: Verify nothing referenced the deleted symbols**

Run: `grep -rn "findNearestNeighbors\|findContradictions\|reduceDimensions\|addToLayout" main.js constellation.js embeddings.js quotes.js categories.js`
Expected: no output.

- [ ] **Step 3: Test suite + build**

Run: `npm test` — all pass.
Run: `npm run build` — completes without errors.

- [ ] **Step 4: Commit**

```bash
git add embeddings.js vite.config.js
git commit -m "chore: remove dead embedding-layout code and no-op vite config"
```

---

### Task 8: Full verification and dist rebuild

**Files:**
- Modify: `dist/` (rebuilt bundle), `dist/data/precomputed.json` (copied by Vite from public/)

**Interfaces:**
- Consumes: everything above.
- Produces: deployable dist committed.

- [ ] **Step 1: Run the whole suite once more**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Rebuild dist**

Run: `npm run build`
Expected: build succeeds; verify the data file shipped: `ls dist/data/precomputed.json` exists, and `grep -c "seed-60" dist/data/precomputed.json` → `1`.

- [ ] **Step 3: Manual smoke test of the BUILT output**

Run: `npm run preview`, open the served `/index-dev.html`:
1. Stars render clustered under their labels; glows keep pulsing after 30s.
2. Tap targets: click stars at cluster tops → quote opens.
3. ⚡ toggle shows red lines that touch stars; toggling twice restores brightness.
4. Orbit-drag release does not open anything.
5. Device emulation (iPhone): taps on stars open quotes reliably, including after focusing/unfocusing a category.

- [ ] **Step 4: Commit dist**

```bash
git add dist
git commit -m "build: rebuild dist with review fixes"
```

---

## Out of Scope (known, deliberately deferred)

- Per-star glow-texture sharing and `dispose()` on `updateConstellation` (GPU churn — real but not user-visible with one update per load).
- `setEmbedding`'s O(N²) localStorage rewrites (only hit by the legacy background-fill path).
- Consolidating the three copy-pasted rAF tween loops and adding tween cancellation.
- `initPipeline` caching a rejected promise (feature now rarely needs the CDN model at all).
- Migrating the runtime embedding import from CDN to the bundled package.
