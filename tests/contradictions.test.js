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
