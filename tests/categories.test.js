import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { categories, categorizeQuote, quoteCategoryMap } from '../categories.js';
import { seedQuotes } from '../quotes.js';

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

describe('seed quote categories', () => {
  const expectedCategories = [
    'creativity', 'resilience', 'self', 'self', 'relationships',
    'relationships', 'relationships', 'relationships', 'resilience',
    'simplicity', 'wisdom', 'perspective', 'courage', 'simplicity', 'self',
    'courage', 'wisdom', 'simplicity', 'wisdom', 'courage', 'simplicity',
    'wisdom', 'resilience', 'relationships', 'courage', 'perspective',
    'wisdom', 'relationships', 'relationships', 'wisdom', 'courage',
    'perspective', 'courage', 'perspective', 'wisdom', 'creativity',
    'perspective', 'simplicity', 'resilience', 'perspective',
    'self', 'courage', 'self', 'perspective', 'perspective',
    'wisdom', 'wisdom', 'self', 'courage', 'courage', 'perspective',
    'wisdom', 'creativity', 'simplicity', 'resilience', 'relationships',
    'perspective', 'wisdom', 'self', 'wisdom', 'relationships', 'wisdom'
  ];

  it('has exactly one valid manual category for every current seed quote', () => {
    const expectedIds = seedQuotes.map((_, index) => `seed-${index}`);

    expect(Object.keys(quoteCategoryMap)).toEqual(expectedIds);
    expect(Object.values(quoteCategoryMap).every((id) => id in categories)).toBe(true);
  });

  it('keeps the reviewed semantic remap aligned with quote order', () => {
    const actual = seedQuotes.map((_, index) => quoteCategoryMap[`seed-${index}`]);
    expect(actual).toEqual(expectedCategories);

    // Any quote edit or reorder changes this signature and forces a deliberate
    // category review instead of silently reusing positional assignments.
    const reviewedAssignments = seedQuotes
      .map((quote, index) => `${quote.text}\0${actual[index]}`)
      .join('\n');
    const signature = createHash('sha256').update(reviewedAssignments).digest('hex');
    expect(signature).toBe('cc41ff0f78f59a97cb449d147b566d566b7eda4c372cccf633b38883732c80a4');
  });
});
