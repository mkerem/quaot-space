# Resonance Threads — Design

**Date:** 2026-07-11
**Status:** Approved

## Problem

The ⚡ contradiction toggle draws lines between quote pairs with the *lowest*
embedding cosine similarity. Low similarity means *unrelated*, not *opposed*,
so the lines connect random-feeling pairs (noise), while true contradictions
(same topic, opposite polarity) have high similarity and can never be found.
The feature is broken by construction.

## Decision

Remove contradiction mode entirely. Replace it with **resonance on select**:
when a quote is selected, softly illuminate threads to its most-similar
quotes, with hop navigation between them. Same embedding machinery, used for
what it is actually good at — kinship.

## Scope

### Remove
- `#contradiction-toggle` button markup and CSS.
- `getAllContradictions` (embeddings.js).
- `contradictionMode` / `contradictionPairs` / `toggleContradictionMode` and
  call sites (main.js).
- `contradictionGroup`, `showContradictions`, `clearContradictions`,
  `setContradictionMode` (constellation.js) and the `contradictionMode`
  opacity parameter (constellation-helpers.js).
- `tests/contradictions.test.js`.

### Add
1. **Semantic layer** — `getRelatedQuotes(quote, allQuotes, embeddings,
   count = 3, floor = 0.25)` in embeddings.js: top-N most-similar quotes
   above the floor, excluding self and quotes without embeddings.
2. **Visual layer** — on select, draw soft threads from the selected star to
   related stars and gently brighten them. Threads use the silver/gold
   selected-star language, not red. Cleared on deselect via the existing
   `clearSelection()` path.
3. **Hop navigation** — the quote overlay gains a "Resonates with" list
   (attribution, or short excerpt when unattributed). Clicking an entry
   selects that quote: overlay and threads update, camera gently turns
   toward the new star. Stars remain directly clickable in 3D.
4. **Toggle** — a ✨ button in the same bottom-right position as the old ⚡
   toggle enables/disables the resonance visuals. Default ON. Active state
   glows gold.

## Edge cases
- Fewer than N related quotes above the floor → show what exists; zero →
  threads and overlay section simply absent.
- Selected or candidate quote lacks an embedding (fresh quote still
  embedding) → treated as no relations; feature degrades silently.
- No persistence or schema changes; toggle state is per-session.

## Testing
- Unit tests for `getRelatedQuotes`: ordering (highest similarity first),
  respects count and floor, excludes self, skips missing embeddings.
- Existing suite stays green.
