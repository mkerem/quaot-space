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
