// Embeddings module for Quote Constellation
// Uses Transformers.js for in-browser embedding generation

import { loadEmbeddings, saveEmbeddings, setEmbedding, getEmbedding } from './quotes.js';

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

// Find nearest neighbors for a quote
export function findNearestNeighbors(quoteId, allQuotes, embeddings, k = 5) {
  const sourceEmbedding = embeddings[quoteId];
  if (!sourceEmbedding) return [];

  const similarities = [];

  for (const quote of allQuotes) {
    if (quote.id === quoteId) continue;

    const embedding = embeddings[quote.id];
    if (!embedding) continue;

    const similarity = cosineSimilarity(sourceEmbedding, embedding);
    similarities.push({ quote, similarity });
  }

  similarities.sort((a, b) => b.similarity - a.similarity);
  return similarities.slice(0, k).map(s => s.quote);
}

// Find contradictions (quotes with lowest similarity)
export function findContradictions(quoteId, allQuotes, embeddings, k = 3) {
  const sourceEmbedding = embeddings[quoteId];
  if (!sourceEmbedding) return [];

  const similarities = [];

  for (const quote of allQuotes) {
    if (quote.id === quoteId) continue;

    const embedding = embeddings[quote.id];
    if (!embedding) continue;

    const similarity = cosineSimilarity(sourceEmbedding, embedding);
    similarities.push({ quote, similarity });
  }

  // Sort by lowest similarity (most different)
  similarities.sort((a, b) => a.similarity - b.similarity);
  return similarities.slice(0, k).map(s => s.quote);
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

      const similarity = cosineSimilarity(emb1, emb2);

      // Consider it a contradiction if similarity is below threshold
      if (similarity < threshold) {
        pairs.push({
          quote1,
          quote2,
          similarity
        });
      }
    }
  }

  // Sort by lowest similarity first (strongest contradictions)
  pairs.sort((a, b) => a.similarity - b.similarity);

  // Return top 20% of pairs or at least 10
  const count = Math.max(10, Math.floor(pairs.length * 0.2));
  return pairs.slice(0, count);
}

// Simple t-SNE-like dimension reduction (simplified for browser performance)
// This uses a force-directed approach for 3D positioning
export function reduceDimensions(embeddings, dimensions = 3) {
  const ids = Object.keys(embeddings);
  const n = ids.length;

  if (n === 0) return {};

  // Initialize random positions
  const positions = {};
  for (const id of ids) {
    positions[id] = {
      x: (Math.random() - 0.5) * 100,
      y: (Math.random() - 0.5) * 100,
      z: (Math.random() - 0.5) * 100
    };
  }

  // Pre-compute similarity matrix
  const similarities = {};
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const sim = cosineSimilarity(embeddings[ids[i]], embeddings[ids[j]]);
      const key = `${ids[i]}-${ids[j]}`;
      similarities[key] = sim;
    }
  }

  // Force-directed layout iterations
  const iterations = 200;
  const learningRate = 1;
  const attractionStrength = 0.1;
  const repulsionStrength = 50;

  for (let iter = 0; iter < iterations; iter++) {
    const forces = {};
    for (const id of ids) {
      forces[id] = { x: 0, y: 0, z: 0 };
    }

    // Calculate forces between all pairs
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const id1 = ids[i];
        const id2 = ids[j];
        const p1 = positions[id1];
        const p2 = positions[id2];

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dz = p2.z - p1.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.01;

        const key = `${id1}-${id2}`;
        const similarity = similarities[key] || 0;

        // Target distance: higher similarity = closer together
        const targetDist = (1 - similarity) * 80 + 10;

        // Attraction/repulsion force
        const forceMagnitude = (dist - targetDist) * attractionStrength;

        // Normalize and apply
        const fx = (dx / dist) * forceMagnitude;
        const fy = (dy / dist) * forceMagnitude;
        const fz = (dz / dist) * forceMagnitude;

        forces[id1].x += fx;
        forces[id1].y += fy;
        forces[id1].z += fz;
        forces[id2].x -= fx;
        forces[id2].y -= fy;
        forces[id2].z -= fz;

        // Additional repulsion to prevent overlap
        if (dist < 5) {
          const repulsion = repulsionStrength / (dist * dist);
          forces[id1].x -= (dx / dist) * repulsion;
          forces[id1].y -= (dy / dist) * repulsion;
          forces[id1].z -= (dz / dist) * repulsion;
          forces[id2].x += (dx / dist) * repulsion;
          forces[id2].y += (dy / dist) * repulsion;
          forces[id2].z += (dz / dist) * repulsion;
        }
      }
    }

    // Apply forces with decreasing learning rate
    const lr = learningRate * (1 - iter / iterations);
    for (const id of ids) {
      positions[id].x += forces[id].x * lr;
      positions[id].y += forces[id].y * lr;
      positions[id].z += forces[id].z * lr;
    }
  }

  // Center and scale positions
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const id of ids) {
    minX = Math.min(minX, positions[id].x);
    maxX = Math.max(maxX, positions[id].x);
    minY = Math.min(minY, positions[id].y);
    maxY = Math.max(maxY, positions[id].y);
    minZ = Math.min(minZ, positions[id].z);
    maxZ = Math.max(maxZ, positions[id].z);
  }

  const scale = 50 / Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1);
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;

  for (const id of ids) {
    positions[id].x = (positions[id].x - centerX) * scale;
    positions[id].y = (positions[id].y - centerY) * scale;
    positions[id].z = (positions[id].z - centerZ) * scale;
  }

  return positions;
}

// Add a new quote's embedding to an existing layout
export function addToLayout(newId, newEmbedding, existingPositions, embeddings) {
  // Find the most similar existing quotes
  const similarities = [];

  for (const [id, embedding] of Object.entries(embeddings)) {
    if (id === newId) continue;
    const sim = cosineSimilarity(newEmbedding, embedding);
    similarities.push({ id, sim, pos: existingPositions[id] });
  }

  similarities.sort((a, b) => b.sim - a.sim);

  // Position near the most similar quotes (weighted average)
  const topK = similarities.slice(0, 3);
  let x = 0, y = 0, z = 0, totalWeight = 0;

  for (const { sim, pos } of topK) {
    if (!pos) continue;
    const weight = sim * sim; // Square similarity for stronger attraction to similar
    x += pos.x * weight;
    y += pos.y * weight;
    z += pos.z * weight;
    totalWeight += weight;
  }

  if (totalWeight > 0) {
    x /= totalWeight;
    y /= totalWeight;
    z /= totalWeight;

    // Add small random offset to prevent exact overlap
    x += (Math.random() - 0.5) * 5;
    y += (Math.random() - 0.5) * 5;
    z += (Math.random() - 0.5) * 5;
  } else {
    // No similar quotes found, place randomly
    x = (Math.random() - 0.5) * 50;
    y = (Math.random() - 0.5) * 50;
    z = (Math.random() - 0.5) * 50;
  }

  return { x, y, z };
}
