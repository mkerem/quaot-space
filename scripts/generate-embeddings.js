// Generates public/data/precomputed.json: MiniLM embeddings for the seed
// quotes, using the SAME model the browser uses (Xenova/all-MiniLM-L6-v2,
// 384-dim) so runtime-generated embeddings for user quotes are comparable.
//
// Run: npm run generate-embeddings  (downloads the model on first run)
import { pipeline } from '@xenova/transformers';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { seedQuotes } from '../quotes.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

const embeddings = {};
for (let i = 0; i < seedQuotes.length; i++) {
  const output = await extractor(seedQuotes[i].text, { pooling: 'mean', normalize: true });
  embeddings[`seed-${i}`] = Array.from(output.data);
  console.log(`Embedded seed-${i} (${i + 1}/${seedQuotes.length})`);
}

const outDir = join(root, 'public', 'data');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'precomputed.json');
writeFileSync(outPath, JSON.stringify({
  embeddings,
  model: 'Xenova/all-MiniLM-L6-v2',
  generated: new Date().toISOString()
}));
console.log(`Wrote ${Object.keys(embeddings).length} embeddings to ${outPath}`);
