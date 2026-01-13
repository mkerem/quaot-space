#!/usr/bin/env node
/**
 * Generate embeddings for seed quotes using OpenAI's API
 *
 * Usage:
 *   OPENAI_API_KEY=your-key-here node scripts/generate-embeddings.js
 *
 * Or set the environment variable first:
 *   export OPENAI_API_KEY=your-key-here
 *   npm run generate-embeddings
 */

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Seed quotes (same as in quotes.js)
const seedQuotes = [
  { text: "Normalcy is like a paved road; it is comfortable to walk, but no flowers grow.", attribution: "Van Gogh" },
  { text: "When I'm caught between a rock and a hard place, let me be water. Let me be water.", attribution: "John Roedel" },
  { text: "People travel to wonder at the height of the mountains, at the huge waves of the seas, at the long course of the rivers, at the vast compass of the ocean, at the circular motion of the stars, and yet they pass by themselves without wondering.", attribution: "St Augustine" },
  { text: "Loneliness is the poverty of self; solitude is richness of self.", attribution: "May Sarton" },
  { text: "Your task is not to seek for love, but merely to seek and find all the barriers within yourself that you have built against it.", attribution: "Rumi" },
  { text: "If you want to go fast, go alone. If you want to go far, go together.", attribution: "African Proverb" },
  { text: "Life is mostly froth and bubble; two things stand like stone: kindness in another's trouble, courage in our own.", attribution: "Adam Lindsey Gordon" },
  { text: "It's a little embarrassing that after 45 years of research and study, the best advice I can give people is to be a little kinder to each other.", attribution: "Aldous Huxley" },
  { text: "God grant me the serenity to accept the things I cannot change, courage to change the things I can, and wisdom to always tell the difference.", attribution: "Kurt Vonnegut" },
  { text: "Most people overestimate what they can do in one year and underestimate what they can do in ten years.", attribution: "Bill Gates" },
  { text: "Simple things should be simple. Complex things should be possible.", attribution: "Alan Kay" },
  { text: "Keep away from people who try to belittle your ambitions. Small people always do that, but the really great make you feel that you, too, can become great.", attribution: "Mark Twain" },
  { text: "The amount of energy necessary to refute bullshit is an order of magnitude bigger than to produce it.", attribution: "Alberto Brandolini" },
  { text: "The flap of a butterfly's wings in Brazil can set off a tornado in Texas.", attribution: "Philip Merilees" },
  { text: "The great end of life is not knowledge but action.", attribution: "Thomas Huxley" },
  { text: "I wish to do something great and wonderful, but I must start by doing the little things like they were great and wonderful.", attribution: "Albert Einstein" },
  { text: "There is a step beyond thinking of yourself as x but tolerating y: not even to consider yourself an x. The more labels you have for yourself, the dumber they make you.", attribution: "Paul Graham" },
  { text: "Life shrinks or expands in proportion to one's courage.", attribution: "Anais Nin" },
  { text: "I used to think the brain was the most wonderful organ in the body. Then I realized who was telling me this.", attribution: "Emo Phillips" },
  { text: "I'm a big proponent of 'busy is a decision.' You decide what you want to do and the things that are important to you. And you don't find the time to do things - you make the time to do things.", attribution: "Debbie Millman" },
  { text: "I find television very educational. Every time someone switches it on, I go into another room and read a book.", attribution: "Groucho Marx" },
  { text: "We must always take sides. Neutrality helps the oppressor, never the victim. Silence encourages the tormentor, never the tormented.", attribution: "Elie Wiesel" },
  { text: "If you chase two rabbits, you will not catch either one.", attribution: "Confucius" },
  { text: "It is wiser to find out than to suppose.", attribution: "Mark Twain" },
  { text: "Everybody has a plan until they get punched in the mouth.", attribution: "Mike Tyson" },
  { text: "Laugh and the world laughs with you, snore and you sleep alone.", attribution: "Anthony Burgess" },
  { text: "Curiosity is the best remedy for fear.", attribution: "Richard Bandler" },
  { text: "All things belong to the same order of things, for such is the oneness of human perception, the oneness of individuality, the oneness of matter, whatever matter may be. The only real number is one, the rest are mere repetition.", attribution: "Vladimir Nabokov" },
  { text: "Real knowledge is knowing the extent of one's ignorance.", attribution: "Confucius" },
  { text: "Shared joy is double joy. Shared sorrow is half sorrow.", attribution: "Swedish proverb" },
  { text: "All happy families are alike; each unhappy family is unhappy in its own way.", attribution: "Leo Tolstoy" },
  { text: "If you think education is expensive, try ignorance.", attribution: "Robert Orben" },
  { text: "Historically the most terrible things— war, genocide, and slavery—have resulted not from disobedience but from obedience.", attribution: "Howard Zinn" },
  { text: "The world has enough beautiful mountains and meadows, spectacular skies and serene lakes. It has enough lush forests, flowered fields, and sandy beaches. It has plenty of stars and the promise of a new sunrise and sunset every day. What the world needs more of is people to appreciate and enjoy it.", attribution: "Michael Josephson" },
  { text: "Be aggressive in your actions and humble in your experience.", attribution: null },
  { text: "Every established order tends to make its own entirely arbitrary system seem entirely natural.", attribution: "Pierre Bourdieu" },
  { text: "I am not young enough to know everything.", attribution: "Oscar Wilde" },
  { text: "One should use common words to say uncommon things.", attribution: "Arthur Schopenhauer" },
  { text: "If you are distressed by anything external, the pain is not due to the thing itself, but to your estimate of it; and this you have the power to revoke at any moment.", attribution: "Marcus Aurelius" },
  { text: "One does not accumulate but eliminate. It is not daily increase but daily decrease. The height of cultivation always runs to simplicity.", attribution: "Bruce Lee" },
  { text: "What makes a river so restful to people is that it doesn't have any doubt — it is sure to get where it is going, and it doesn't want to go anywhere else.", attribution: "Hal Boyle" },
  { text: "Reality is merely an illusion, albeit a very persistent one.", attribution: "Albert Einstein" },
  { text: "It is amazing what you can accomplish if you do not care who gets the credit.", attribution: "Harry Truman" },
  { text: "The reasonable man adapts himself to the world; the unreasonable one persists in trying to adapt the world to himself. Therefore all progress depends on the unreasonable man.", attribution: "George Bernard Shaw" },
  { text: "If I am not for myself, who will be for me? But if I am only for myself, what am I? And if not now, when?", attribution: "Rabbi Hillel" },
  { text: "It isn't events themselves that disturb people, but only their judgments about them.", attribution: "Epictetus" },
  { text: "Everywhere is walking distance if you have the time.", attribution: "Steven Wright" },
  { text: "As our island of knowledge grows, so does the shore of our ignorance.", attribution: "John Wheeler" },
  { text: "It is better to be roughly right than precisely wrong.", attribution: "Alan Greenspan" },
  { text: "Yesterday I was clever, so I wanted to change the world. Today I am wise, so I am changing myself.", attribution: "Rumi" },
  { text: "Women will ignore precedent and startle civilization with their progress.", attribution: "Nikola Tesla" },
  { text: "Courage is knowing it might hurt, and doing it anyway. Stupidity is the same. That's why life is hard.", attribution: "Jeremy Goldberg" },
  { text: "If you want freedom, you need to have discipline. The more discipline you have, the more you'll be able to do what you want.", attribution: "Jocko Willink" },
  { text: "Discipline equals freedom.", attribution: null },
  { text: "A man said to the universe: 'Sir, I exist!' 'However,' replied the universe, 'That fact has not created in me a sense of obligation.'", attribution: "Stephen Crane" },
  { text: "There is zero correlation between who is the loudest in the room and who is the smartest.", attribution: null },
  { text: "Everything around you that you call life was made up by people that were no smarter than you and you can change it, you can influence it, you can build your own things that other people can use.", attribution: "Steve Jobs" },
  { text: "Everything in moderation, including moderation.", attribution: "Oscar Wilde" },
  { text: "Pain is inevitable. Suffering is optional.", attribution: null },
  { text: "I really don't care that much about 'Beauties.' What I really like are Talkers. To me, good talkers are beautiful because good talk is what I love.", attribution: "Andy Warhol" },
  { text: "If a factory is torn down but the rationality which produced it is left standing, then that rationality will simply produce another factory.", attribution: "Robert Pirsig" }
];

// Cosine similarity
function cosineSimilarity(a, b) {
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

// Force-directed layout for 3D positioning
function computePositions(embeddings) {
  const ids = Object.keys(embeddings);
  const n = ids.length;

  console.log(`Computing positions for ${n} quotes...`);

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
      similarities[`${ids[i]}-${ids[j]}`] = sim;
    }
  }

  // Force-directed iterations
  const iterations = 300;
  const attractionStrength = 0.1;

  for (let iter = 0; iter < iterations; iter++) {
    const forces = {};
    for (const id of ids) {
      forces[id] = { x: 0, y: 0, z: 0 };
    }

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
        const targetDist = (1 - similarity) * 80 + 10;

        const forceMagnitude = (dist - targetDist) * attractionStrength;
        const fx = (dx / dist) * forceMagnitude;
        const fy = (dy / dist) * forceMagnitude;
        const fz = (dz / dist) * forceMagnitude;

        forces[id1].x += fx;
        forces[id1].y += fy;
        forces[id1].z += fz;
        forces[id2].x -= fx;
        forces[id2].y -= fy;
        forces[id2].z -= fz;

        if (dist < 5) {
          const repulsion = 50 / (dist * dist);
          forces[id1].x -= (dx / dist) * repulsion;
          forces[id1].y -= (dy / dist) * repulsion;
          forces[id1].z -= (dz / dist) * repulsion;
          forces[id2].x += (dx / dist) * repulsion;
          forces[id2].y += (dy / dist) * repulsion;
          forces[id2].z += (dz / dist) * repulsion;
        }
      }
    }

    const lr = 1 * (1 - iter / iterations);
    for (const id of ids) {
      positions[id].x += forces[id].x * lr;
      positions[id].y += forces[id].y * lr;
      positions[id].z += forces[id].z * lr;
    }

    if (iter % 50 === 0) {
      console.log(`  Iteration ${iter}/${iterations}`);
    }
  }

  // Center and scale
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

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error('Error: OPENAI_API_KEY environment variable is not set.');
    console.error('');
    console.error('Usage:');
    console.error('  OPENAI_API_KEY=your-key-here node scripts/generate-embeddings.js');
    console.error('');
    console.error('Or:');
    console.error('  export OPENAI_API_KEY=your-key-here');
    console.error('  npm run generate-embeddings');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });

  console.log('Generating embeddings for seed quotes...');
  console.log(`Total quotes: ${seedQuotes.length}`);
  console.log('');

  const embeddings = {};
  const batchSize = 20;

  for (let i = 0; i < seedQuotes.length; i += batchSize) {
    const batch = seedQuotes.slice(i, i + batchSize);
    const texts = batch.map(q => q.text);

    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(seedQuotes.length / batchSize)}...`);

    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts
      });

      for (let j = 0; j < batch.length; j++) {
        const quoteIndex = i + j;
        const id = `seed-${quoteIndex}`;
        embeddings[id] = response.data[j].embedding;
      }
    } catch (error) {
      console.error(`Error generating embeddings for batch:`, error.message);
      process.exit(1);
    }
  }

  console.log('');
  console.log('All embeddings generated successfully!');
  console.log('');

  // Compute positions
  const positions = computePositions(embeddings);

  // Save to file
  const outputPath = path.join(__dirname, '..', 'data', 'precomputed.json');
  const output = {
    embeddings,
    positions,
    generated: new Date().toISOString()
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`Saved to ${outputPath}`);
  console.log('');
  console.log('Done! The app will now use pre-computed embeddings for seed quotes.');
}

main();
