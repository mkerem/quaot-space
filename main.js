// Quote Constellation - Main Entry Point
import { Constellation } from './constellation.js';
import { loadQuotes, addQuote, loadEmbeddings, saveEmbeddings, setEmbedding } from './quotes.js';
import {
  generateEmbedding,
  reduceDimensions,
  addToLayout,
  findNearestNeighbors,
  getAllContradictions
} from './embeddings.js';
import { categories, categorizeQuote, getPositionInCluster, quoteCategoryMap } from './categories.js';

class App {
  constructor() {
    this.constellation = null;
    this.quotes = [];
    this.embeddings = {};
    this.positions = {};
    this.isAddingQuote = false;
    this.contradictionMode = false;
    this.contradictionPairs = [];

    this.init();
  }

  async init() {
    // Get DOM elements
    this.canvas = document.getElementById('constellation');
    this.quoteOverlay = document.getElementById('quote-overlay');
    this.quoteText = document.getElementById('quote-text');
    this.quoteAttribution = document.getElementById('quote-attribution');
    this.quoteCategory = document.getElementById('quote-category');
    this.addQuoteModal = document.getElementById('add-quote-modal');
    this.quoteInput = document.getElementById('quote-input');
    this.attributionInput = document.getElementById('attribution-input');
    this.contradictionToggle = document.getElementById('contradiction-toggle');
    this.hint = document.getElementById('hint');
    this.loading = document.getElementById('loading');

    // Initialize constellation
    this.constellation = new Constellation(
      this.canvas,
      (quote) => this.onQuoteSelect(quote),
      (quote) => this.onQuoteHover(quote)
    );

    // Track when loading started for minimum display time
    const loadStartTime = Date.now();

    // Load data
    await this.loadData();

    // Setup event listeners
    this.setupEventListeners();

    // Hide loading indicator after minimum 1.5 seconds
    const elapsed = Date.now() - loadStartTime;
    const minDisplayTime = 1500;
    const remainingTime = Math.max(0, minDisplayTime - elapsed);

    setTimeout(() => {
      this.loading.classList.add('hidden');
    }, remainingTime);

    // Fade out hint after 5 seconds
    setTimeout(() => {
      this.hint.classList.add('hidden');
    }, 5000);
  }

  async loadData() {
    // Load quotes
    this.quotes = loadQuotes();
    console.log(`Loaded ${this.quotes.length} quotes`);

    // Load embeddings from localStorage
    this.embeddings = loadEmbeddings();

    // Categorize quotes and position them in themed clusters
    const categoryQuotes = {}; // categoryId -> [quotes]

    for (const quote of this.quotes) {
      // Use pre-mapped category or detect from text
      const categoryId = quoteCategoryMap[quote.id] || categorizeQuote(quote.text);
      quote.category = categoryId;

      if (!categoryQuotes[categoryId]) {
        categoryQuotes[categoryId] = [];
      }
      categoryQuotes[categoryId].push(quote);
    }

    // Position each quote within its category cluster
    for (const [categoryId, quotes] of Object.entries(categoryQuotes)) {
      quotes.forEach((quote, index) => {
        this.positions[quote.id] = getPositionInCluster(categoryId, index, quotes.length);
      });
    }

    // Show constellation immediately with category-based positions
    this.constellation.updateConstellation(this.quotes, this.positions, this.embeddings);
    console.log('Constellation displayed with initial positions');

    // Pre-compute contradictions with whatever embeddings we have
    this.contradictionPairs = getAllContradictions(this.quotes, this.embeddings);
    this.constellation.showContradictions(this.contradictionPairs);

    // Compute embeddings in background (non-blocking) - skip for now to keep it fast
    // The category-based positioning works well without semantic embeddings
    const quotesNeedingEmbeddings = this.quotes.filter(q => !this.embeddings[q.id]);
    if (quotesNeedingEmbeddings.length > 0 && Object.keys(this.embeddings).length > 0) {
      // Only compute if we already have some embeddings cached (returning user)
      this.computeEmbeddingsInBackground(quotesNeedingEmbeddings);
    }
  }

  // Non-blocking background embedding computation
  async computeEmbeddingsInBackground(quotes) {
    console.log(`Computing embeddings for ${quotes.length} quotes in background...`);

    for (const quote of quotes) {
      try {
        const embedding = await generateEmbedding(quote.text);
        this.embeddings[quote.id] = embedding;
        setEmbedding(quote.id, embedding);
      } catch (e) {
        console.warn(`Failed to generate embedding for quote ${quote.id}:`, e);
        break; // Stop on first error to avoid repeated failures
      }
    }

    // Update contradictions with new embeddings
    if (Object.keys(this.embeddings).length > 0) {
      this.contradictionPairs = getAllContradictions(this.quotes, this.embeddings);
      this.constellation.showContradictions(this.contradictionPairs);
    }
  }

  setupEventListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.onKeyDown(e));

    // Quote input handlers
    this.quoteInput.addEventListener('keydown', (e) => this.onQuoteInputKeyDown(e));

    // Contradiction toggle
    this.contradictionToggle.addEventListener('click', () => this.toggleContradictionMode());

    // Close quote overlay on click
    this.quoteOverlay.addEventListener('click', (e) => {
      if (e.target === this.quoteOverlay) {
        this.closeQuoteOverlay();
      }
    });

    // Close add quote modal on outside click
    this.addQuoteModal.addEventListener('click', (e) => {
      if (e.target === this.addQuoteModal) {
        this.closeAddQuoteModal();
      }
    });
  }

  onKeyDown(e) {
    // Ignore if typing in input
    if (e.target === this.quoteInput || e.target === this.attributionInput) {
      return;
    }

    if (e.key === 'a' || e.key === 'A') {
      this.openAddQuoteModal();
    } else if (e.key === 'Escape') {
      if (!this.addQuoteModal.classList.contains('hidden')) {
        this.closeAddQuoteModal();
      } else if (!this.quoteOverlay.classList.contains('hidden')) {
        this.closeQuoteOverlay();
      }
    }
  }

  onQuoteInputKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.submitNewQuote();
    } else if (e.key === 'Escape') {
      this.closeAddQuoteModal();
    }
  }

  onQuoteSelect(quote) {
    if (!quote) return;

    // Show quote overlay with category
    const category = categories[quote.category];
    this.quoteCategory.textContent = category ? category.name : '';
    this.quoteText.textContent = quote.text;
    this.quoteAttribution.textContent = quote.attribution || '';
    this.quoteOverlay.classList.remove('hidden');
  }

  onQuoteHover(quote) {
    // Hover highlighting is handled by the constellation
  }

  closeQuoteOverlay() {
    this.quoteOverlay.classList.add('hidden');
  }

  openAddQuoteModal() {
    this.addQuoteModal.classList.remove('hidden');
    this.quoteInput.value = '';
    this.attributionInput.value = '';
    this.quoteInput.focus();
  }

  closeAddQuoteModal() {
    this.addQuoteModal.classList.add('hidden');
  }

  async submitNewQuote() {
    const text = this.quoteInput.value.trim();
    if (!text) return;

    const attribution = this.attributionInput.value.trim() || null;

    // Add quote to storage
    const newQuote = addQuote(text, attribution);

    // Categorize the new quote
    newQuote.category = categorizeQuote(text);

    // Close modal
    this.closeAddQuoteModal();

    // Show loading state briefly
    this.loading.querySelector('span').textContent = 'Finding its place...';
    this.loading.classList.remove('hidden');

    try {
      // Position in the appropriate category cluster
      const categoryQuotes = this.quotes.filter(q => q.category === newQuote.category);
      const position = getPositionInCluster(newQuote.category, categoryQuotes.length, categoryQuotes.length + 1);
      this.positions[newQuote.id] = position;

      // Update quotes list
      this.quotes.push(newQuote);

      // Add star to constellation with animation
      this.constellation.addStar(newQuote, position);

      // Try to generate embedding in background (for semantic features)
      try {
        const embedding = await generateEmbedding(text);
        setEmbedding(newQuote.id, embedding);
        this.embeddings[newQuote.id] = embedding;

        // Update contradictions
        this.contradictionPairs = getAllContradictions(this.quotes, this.embeddings);
        if (this.contradictionMode) {
          this.constellation.showContradictions(this.contradictionPairs);
        }
      } catch (e) {
        console.warn('Could not generate embedding for new quote:', e);
      }
    } catch (e) {
      console.error('Failed to add quote:', e);
      alert('Failed to add quote. Please try again.');
    }

    this.loading.classList.add('hidden');
  }

  toggleContradictionMode() {
    this.contradictionMode = !this.contradictionMode;
    this.contradictionToggle.classList.toggle('active', this.contradictionMode);
    this.constellation.setContradictionMode(this.contradictionMode);
  }
}

// Start the app
new App();
