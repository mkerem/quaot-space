import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadQuotes, seedQuotes } from '../quotes.js';

function createLocalStorage(initial = {}) {
  const values = new Map(Object.entries(initial));

  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, String(value))),
    removeItem: vi.fn((key) => values.delete(key)),
    clear: vi.fn(() => values.clear())
  };
}

describe('seed quote migration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refreshes stale seeds while preserving user-added quotes', () => {
    const userQuote = {
      id: 'user-quote',
      text: 'A personal quote',
      attribution: 'Me',
      userAdded: true
    };
    const storage = createLocalStorage({
      'quote-constellation-quotes': JSON.stringify([
        { id: 'seed-9', text: 'An obsolete seed', attribution: null, userAdded: false },
        userQuote
      ])
    });
    vi.stubGlobal('localStorage', storage);

    const quotes = loadQuotes();

    expect(quotes).toHaveLength(seedQuotes.length + 1);
    expect(quotes[9].text).toBe(seedQuotes[9].text);
    expect(quotes.at(-1)).toEqual(userQuote);
    expect(storage.setItem).toHaveBeenCalledWith(
      'quote-constellation-seed-version',
      expect.any(String)
    );
  });
});
