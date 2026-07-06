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
