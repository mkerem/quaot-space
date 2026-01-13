# Quote Constellation

A personal philosophy garden where wisdom lives as a navigable constellation of meaning.

## Quick Start

```bash
# Install dependencies
npm install

# Generate pre-computed embeddings (requires OpenAI API key)
OPENAI_API_KEY=your-key-here npm run generate-embeddings

# Run development server
npm run dev
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Generate Embeddings (Recommended)

Pre-computing embeddings makes the initial load much faster:

```bash
OPENAI_API_KEY=your-key-here npm run generate-embeddings
```

This creates `data/precomputed.json` with embeddings and positions for all seed quotes.

**Note:** If you skip this step, the app will compute embeddings in the browser using Transformers.js. This works but takes longer on first load.

### 3. Run the App

```bash
npm run dev
```

Open http://localhost:5173 in your browser.

## Usage

- **Navigate**: Scroll to zoom, click and drag to pan
- **Read**: Click any star to see the full quote
- **Add**: Press 'A' to add your own quote
- **Contradictions**: Click the ⚡ button to see opposing ideas

## Build for Production

```bash
npm run build
```

The built files will be in the `dist/` folder, ready to deploy to any static hosting.

## How It Works

- Quotes are positioned in 3D space based on semantic similarity
- Similar quotes cluster together, different ones drift apart
- New quotes find their position by analyzing their meaning
- Everything is stored in localStorage (no server needed)

---

*"Simple things should be simple. Complex things should be possible." - Alan Kay*
