// Embeddings module for Quote Constellation
// Uses Transformers.js for in-browser embedding generation

let pipeline = null;
let pipelinePromise = null;

// Initialize the embedding pipeline (lazy loading)
async function initPipeline() {
  if (pipeline) return pipeline;

  if (!pipelinePromise) {
    pipelinePromise = (async () => {
      // Use the ESM build from jsdelivr
      const { pipeline: createPipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/transformers.min.js');

      // Configure to use remote models from Hugging Face
      env.allowLocalModels = false;
      env.useBrowserCache = true;

      console.log('Loading embedding model...');
      pipeline = await createPipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        progress_callback: (progress) => {
          if (progress.status === 'downloading') {
            console.log(`Downloading: ${progress.file} - ${Math.round(progress.progress)}%`);
          }
        }
      });
      console.log('Embedding model loaded!');
      return pipeline;
    })();
  }

  return pipelinePromise;
}

// Generate embedding for a single text
export async function generateEmbedding(text) {
  const pipe = await initPipeline();
  const output = await pipe(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

// Compute cosine similarity between two vectors
export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Get all contradiction pairs for the constellation
export function getAllContradictions(allQuotes, embeddings, threshold = 0.1) {
  const pairs = [];
  const seen = new Set();

  for (const quote1 of allQuotes) {
    const emb1 = embeddings[quote1.id];
    if (!emb1) continue;

    for (const quote2 of allQuotes) {
      if (quote1.id === quote2.id) continue;

      const pairKey = [quote1.id, quote2.id].sort().join('-');
      if (seen.has(pairKey)) continue;
      seen.add(pairKey);

      const emb2 = embeddings[quote2.id];
      if (!emb2) continue;

      pairs.push({ quote1, quote2, similarity: cosineSimilarity(emb1, emb2) });
    }
  }

  // Sort by lowest similarity first (strongest contradictions)
  pairs.sort((a, b) => a.similarity - b.similarity);

  // Take pairs under the threshold, but always keep a floor of the 10
  // most-dissimilar pairs so the mode is never visually empty.
  const below = pairs.filter(p => p.similarity < threshold).length;
  const count = Math.max(Math.min(10, pairs.length), Math.floor(below * 0.2));
  return pairs.slice(0, count);
}
