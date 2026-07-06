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
