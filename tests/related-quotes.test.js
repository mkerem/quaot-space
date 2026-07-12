import { describe, it, expect } from 'vitest';
import { getRelatedQuotes } from '../embeddings.js';

// Quotes on a 2D unit circle: similarity to q-0 falls off as the angle grows.
const quotes = [];
const embeddings = {};
for (let i = 0; i < 8; i++) {
  const angle = (i / 8) * Math.PI * 2;
  const id = `q-${i}`;
  quotes.push({ id, text: `quote ${i}` });
  embeddings[id] = [Math.cos(angle), Math.sin(angle)];
}

describe('getRelatedQuotes', () => {
  it('returns the most-similar quotes first, excluding the quote itself', () => {
    const related = getRelatedQuotes(quotes[0], quotes, embeddings);
    expect(related.length).toBe(2); // q-1 and q-7 (cos 45° ≈ 0.71); rest under floor
    expect(related.map(r => r.quote.id).sort()).toEqual(['q-1', 'q-7']);
    for (let i = 1; i < related.length; i++) {
      expect(related[i].similarity).toBeLessThanOrEqual(related[i - 1].similarity);
    }
    expect(related.every(r => r.quote.id !== 'q-0')).toBe(true);
  });

  it('caps results at count even when more clear the floor', () => {
    const parallelQuotes = [];
    const parallelEmb = {};
    for (let i = 0; i < 6; i++) {
      const id = `p-${i}`;
      parallelQuotes.push({ id, text: `p ${i}` });
      parallelEmb[id] = [1, i * 0.01]; // similarity ~1 for every pair
    }
    const related = getRelatedQuotes(parallelQuotes[0], parallelQuotes, parallelEmb, 3);
    expect(related.length).toBe(3);
  });

  it('returns nothing below the similarity floor', () => {
    // q-4 is opposite q-0; only orthogonal-or-worse neighbors for q-2 vs floor 0.99
    const related = getRelatedQuotes(quotes[0], quotes, embeddings, 3, 0.99);
    expect(related).toEqual([]);
  });

  it('returns [] when the quote or candidates lack embeddings', () => {
    expect(getRelatedQuotes({ id: 'missing' }, quotes, embeddings)).toEqual([]);
    expect(getRelatedQuotes(quotes[0], quotes, {})).toEqual([]);
  });
});
