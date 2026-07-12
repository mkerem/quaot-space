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

// Most-similar quotes for the resonance threads. The floor keeps weak
// kinship invisible: better no thread than a misleading one.
export function getRelatedQuotes(quote, allQuotes, embeddings, count = 3, floor = 0.25) {
  const emb = embeddings[quote.id];
  if (!emb) return [];

  const scored = [];
  for (const other of allQuotes) {
    if (other.id === quote.id) continue;

    const otherEmb = embeddings[other.id];
    if (!otherEmb) continue;

    const similarity = cosineSimilarity(emb, otherEmb);
    if (similarity >= floor) {
      scored.push({ quote: other, similarity });
    }
  }

  scored.sort((a, b) => b.similarity - a.similarity);
  return scored.slice(0, count);
}
