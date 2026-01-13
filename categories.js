// Thematic categories for quotes
// Each quote is assigned to a category, and categories determine cluster positions

export const categories = {
  wisdom: {
    name: "Wisdom",
    color: 0x88aaff,
    position: { x: -40, y: 30, z: 0 },
    keywords: ["knowledge", "wisdom", "learn", "ignorance", "understand", "think", "mind", "brain", "clever", "smart", "education"]
  },
  courage: {
    name: "Courage",
    color: 0xffaa66,
    position: { x: 40, y: 30, z: 0 },
    keywords: ["courage", "action", "brave", "fear", "do", "act", "change", "progress", "discipline", "freedom", "aggressive"]
  },
  relationships: {
    name: "Connection",
    color: 0xff88aa,
    position: { x: 0, y: -40, z: 30 },
    keywords: ["together", "people", "love", "friend", "family", "share", "joy", "sorrow", "kindness", "help", "talk"]
  },
  perspective: {
    name: "Perspective",
    color: 0x88ffaa,
    position: { x: 0, y: 40, z: -30 },
    keywords: ["reality", "illusion", "view", "see", "perceive", "judge", "estimate", "think", "believe", "world", "universe"]
  },
  simplicity: {
    name: "Focus",
    color: 0xaaffff,
    position: { x: -30, y: -30, z: -30 },
    keywords: ["simple", "focus", "one", "eliminate", "decrease", "moderation", "busy", "time", "chase", "rabbit"]
  },
  resilience: {
    name: "Resilience",
    color: 0xffaaff,
    position: { x: 30, y: -30, z: 30 },
    keywords: ["water", "adapt", "change", "plan", "punch", "pain", "suffer", "accept", "serenity", "river", "flow"]
  },
  self: {
    name: "Identity",
    color: 0xffffaa,
    position: { x: -40, y: 0, z: 40 },
    keywords: ["self", "myself", "yourself", "identity", "label", "who", "am", "solitude", "loneliness", "wonder"]
  },
  creativity: {
    name: "Creativity",
    color: 0xaaaaff,
    position: { x: 40, y: 0, z: -40 },
    keywords: ["create", "build", "great", "wonderful", "ambition", "dream", "flower", "grow", "art", "beauty", "normalcy"]
  }
};

// Categorize a quote based on its text
export function categorizeQuote(text) {
  const lowerText = text.toLowerCase();
  let bestCategory = 'wisdom'; // default
  let bestScore = 0;

  for (const [categoryId, category] of Object.entries(categories)) {
    let score = 0;
    for (const keyword of category.keywords) {
      if (lowerText.includes(keyword)) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = categoryId;
    }
  }

  return bestCategory;
}

// Get position for a quote within its category cluster
export function getPositionInCluster(categoryId, index, total) {
  const category = categories[categoryId];
  const basePos = category.position;

  // Spread quotes in a sphere around the category center
  const radius = 15 + Math.random() * 10;
  const theta = (index / total) * Math.PI * 2 + Math.random() * 0.5;
  const phi = Math.acos(2 * Math.random() - 1);

  return {
    x: basePos.x + radius * Math.sin(phi) * Math.cos(theta),
    y: basePos.y + radius * Math.sin(phi) * Math.sin(theta),
    z: basePos.z + radius * Math.cos(phi)
  };
}

// Pre-categorize all seed quotes
export const quoteCategoryMap = {
  'seed-0': 'creativity',      // normalcy/flowers
  'seed-1': 'resilience',      // be water
  'seed-2': 'self',            // wonder at themselves
  'seed-3': 'self',            // loneliness/solitude
  'seed-4': 'relationships',   // love/barriers
  'seed-5': 'relationships',   // go together
  'seed-6': 'relationships',   // kindness/courage
  'seed-7': 'relationships',   // kinder to each other
  'seed-8': 'resilience',      // serenity/accept
  'seed-9': 'perspective',     // overestimate/underestimate
  'seed-10': 'simplicity',     // simple things
  'seed-11': 'creativity',     // ambitions/great
  'seed-12': 'wisdom',         // refute bullshit
  'seed-13': 'perspective',    // butterfly effect
  'seed-14': 'courage',        // action not knowledge
  'seed-15': 'courage',        // little things great
  'seed-16': 'self',           // labels
  'seed-17': 'courage',        // courage/life expands
  'seed-18': 'wisdom',         // brain telling me
  'seed-19': 'simplicity',     // busy is a decision
  'seed-20': 'wisdom',         // television/book
  'seed-21': 'courage',        // take sides
  'seed-22': 'simplicity',     // chase two rabbits
  'seed-23': 'wisdom',         // find out vs suppose
  'seed-24': 'resilience',     // punched in mouth
  'seed-25': 'relationships',  // laugh together
  'seed-26': 'courage',        // curiosity/fear
  'seed-27': 'perspective',    // oneness
  'seed-28': 'wisdom',         // extent of ignorance
  'seed-29': 'relationships',  // shared joy/sorrow
  'seed-30': 'relationships',  // families
  'seed-31': 'wisdom',         // education expensive
  'seed-32': 'courage',        // obedience
  'seed-33': 'perspective',    // appreciate world
  'seed-34': 'courage',        // aggressive/humble
  'seed-35': 'perspective',    // arbitrary natural
  'seed-36': 'wisdom',         // not young enough
  'seed-37': 'creativity',     // common words uncommon
  'seed-38': 'perspective',    // distressed external
  'seed-39': 'simplicity',     // eliminate not accumulate
  'seed-40': 'resilience',     // river no doubt
  'seed-41': 'perspective',    // reality illusion
  'seed-42': 'relationships',  // credit
  'seed-43': 'courage',        // unreasonable man
  'seed-44': 'self',           // if not for myself
  'seed-45': 'perspective',    // events vs judgments
  'seed-46': 'perspective',    // walking distance
  'seed-47': 'wisdom',         // island of knowledge
  'seed-48': 'wisdom',         // roughly right
  'seed-49': 'self',           // changing myself
  'seed-50': 'courage',        // women progress
  'seed-51': 'courage',        // courage vs stupidity
  'seed-52': 'courage',        // discipline freedom
  'seed-53': 'simplicity',     // discipline equals freedom
  'seed-54': 'perspective',    // universe obligation
  'seed-55': 'wisdom',         // loudest not smartest
  'seed-56': 'creativity',     // build your own things
  'seed-57': 'simplicity',     // moderation
  'seed-58': 'resilience',     // pain/suffering
  'seed-59': 'relationships',  // talkers
  'seed-60': 'perspective'     // factory rationality
};
