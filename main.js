// Quote Constellation - Main Entry Point
import { Constellation } from './constellation.js';
import { loadQuotes, addQuote, updateQuote, loadEmbeddings, setEmbedding } from './quotes.js';
import {
  generateEmbedding,
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
    this.selectedQuote = null;
    this.editingQuoteId = null;
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
    this.saveQuoteButton = document.getElementById('save-quote-button');
    this.contradictionToggle = document.getElementById('contradiction-toggle');
    this.editHint = document.getElementById('quote-edit-hint');
    this.addQuoteHint = document.getElementById('add-quote-hint');
    this.hint = document.getElementById('hint');
    this.statusToast = document.getElementById('status-toast');
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
    this.attributionInput.addEventListener('keydown', (e) => this.onQuoteInputKeyDown(e));
    this.saveQuoteButton.addEventListener('click', () => this.submitNewQuote());

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
    } else if ((e.key === 'e' || e.key === 'E') && this.selectedQuote?.userAdded) {
      this.openAddQuoteModal(this.selectedQuote);
    } else if (e.key === 'Escape') {
      if (!this.addQuoteModal.classList.contains('hidden')) {
        this.closeAddQuoteModal();
      } else if (!this.quoteOverlay.classList.contains('hidden')) {
        this.closeQuoteOverlay();
      }
    }
  }

  onQuoteInputKeyDown(e) {
    const isAttributionInput = e.target === this.attributionInput;
    const shouldSubmitFromTextarea = e.target === this.quoteInput && e.key === 'Enter' && !e.shiftKey;
    const shouldSubmitFromAttribution = isAttributionInput && e.key === 'Enter';

    if (shouldSubmitFromTextarea || shouldSubmitFromAttribution) {
      e.preventDefault();
      this.submitNewQuote();
    } else if (e.key === 'Escape') {
      this.closeAddQuoteModal();
    }
  }

  onQuoteSelect(quote) {
    if (!quote) return;
    this.selectedQuote = quote;

    // Show quote overlay with category
    const category = categories[quote.category];
    this.quoteCategory.textContent = category ? category.name : '';
    this.quoteText.textContent = quote.text;
    this.quoteAttribution.textContent = quote.attribution || '';
    this.editHint.classList.toggle('hidden', !quote.userAdded);
    this.quoteOverlay.classList.remove('hidden');
  }

  onQuoteHover(quote) {
    // Hover highlighting is handled by the constellation
  }

  closeQuoteOverlay() {
    this.selectedQuote = null;
    this.quoteOverlay.classList.add('hidden');
  }

  openAddQuoteModal(quoteToEdit = null) {
    this.editingQuoteId = quoteToEdit?.id || null;
    this.addQuoteModal.classList.remove('hidden');
    this.quoteInput.value = quoteToEdit?.text || '';
    this.attributionInput.value = quoteToEdit?.attribution || '';
    this.addQuoteHint.textContent = this.editingQuoteId
      ? 'Press Enter to save changes • Shift+Enter for line break • ESC to cancel'
      : 'Press Enter to add • Shift+Enter for line break • ESC to cancel';
    this.quoteInput.focus();
  }

  closeAddQuoteModal() {
    this.editingQuoteId = null;
    this.addQuoteModal.classList.add('hidden');
  }

  showStatusMessage(message, duration = 3200) {
    this.statusToast.textContent = message;
    this.statusToast.classList.remove('hidden');

    clearTimeout(this.statusToastTimeout);
    this.statusToastTimeout = setTimeout(() => {
      this.statusToast.classList.add('hidden');
    }, duration);
  }

  recalculatePositions() {
    const categoryQuotes = {};
    this.positions = {};

    for (const quote of this.quotes) {
      const categoryId = quoteCategoryMap[quote.id] || categorizeQuote(quote.text);
      quote.category = categoryId;

      if (!categoryQuotes[categoryId]) {
        categoryQuotes[categoryId] = [];
      }
      categoryQuotes[categoryId].push(quote);
    }

    for (const [categoryId, quotes] of Object.entries(categoryQuotes)) {
      quotes.forEach((quote, index) => {
        this.positions[quote.id] = getPositionInCluster(categoryId, index, quotes.length);
      });
    }
  }

  async submitNewQuote() {
    const text = this.quoteInput.value.trim();
    if (!text) return;

    const attribution = this.attributionInput.value.trim() || null;
    const isEditing = Boolean(this.editingQuoteId);

    // Close modal
    this.closeAddQuoteModal();

    // Show loading state briefly
    this.loading.querySelector('span').textContent = 'Finding its place...';
    this.loading.classList.remove('hidden');

    try {
      let activeQuote;

      if (isEditing) {
        const updatedQuote = updateQuote(this.editingQuoteId, text, attribution);
        if (!updatedQuote) {
          throw new Error('Quote not found for editing');
        }

        this.quotes = this.quotes.map((quote) => (
          quote.id === updatedQuote.id ? { ...quote, ...updatedQuote } : quote
        ));
        activeQuote = updatedQuote;
      } else {
        const newQuote = addQuote(text, attribution);
        this.quotes.push(newQuote);
        activeQuote = newQuote;
      }

      this.recalculatePositions();
      this.constellation.updateConstellation(this.quotes, this.positions, this.embeddings);

      const category = categories[activeQuote.category];
      const categoryName = category ? category.name : 'Uncategorized';
      const actionVerb = isEditing ? 'updated in' : 'landed in';
      this.showStatusMessage(`✨ Your quote ${actionVerb} “${categoryName}.”`);

      // Try to generate embedding in background (for semantic features)
      try {
        const embedding = await generateEmbedding(text);
        setEmbedding(activeQuote.id, embedding);
        this.embeddings[activeQuote.id] = embedding;

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
