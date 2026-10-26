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
  // Whole-word matching: substring matching made e.g. 'do' (courage)
  // match inside 'wisdom' and 'freedom'.
  const words = new Set(text.toLowerCase().split(/[^a-z']+/));
  let bestCategory = 'wisdom'; // default
  let bestScore = 0;

  for (const [categoryId, category] of Object.entries(categories)) {
    let score = 0;
    for (const keyword of category.keywords) {
      if (words.has(keyword)) {
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
  'seed-9': 'simplicity',       // simple things should be simple
  'seed-10': 'wisdom',         // effort required to refute bullshit
  'seed-11': 'perspective',    // butterfly effect
  'seed-12': 'courage',        // action over knowledge
  'seed-13': 'simplicity',     // focus on making small tasks great
  'seed-14': 'self',           // identity labels
  'seed-15': 'courage',        // courage expands life
  'seed-16': 'wisdom',         // brain judging itself
  'seed-17': 'simplicity',     // time and priorities
  'seed-18': 'wisdom',         // television and books
  'seed-19': 'courage',        // take sides
  'seed-20': 'simplicity',     // chase one rabbit
  'seed-21': 'wisdom',         // find out rather than suppose
  'seed-22': 'resilience',     // plans meet adversity
  'seed-23': 'relationships',  // laugh together
  'seed-24': 'courage',        // curiosity over fear
  'seed-25': 'perspective',    // oneness and perception
  'seed-26': 'wisdom',         // know the extent of ignorance
  'seed-27': 'relationships',  // shared joy and sorrow
  'seed-28': 'relationships',  // families
  'seed-29': 'wisdom',         // education and ignorance
  'seed-30': 'courage',        // moral disobedience
  'seed-31': 'perspective',    // appreciate the world
  'seed-32': 'courage',        // aggressive action, humble experience
  'seed-33': 'perspective',    // arbitrary systems appear natural
  'seed-34': 'wisdom',         // not young enough to know everything
  'seed-35': 'creativity',     // common words, uncommon things
  'seed-36': 'perspective',    // distress follows interpretation
  'seed-37': 'simplicity',     // eliminate rather than accumulate
  'seed-38': 'resilience',     // river without doubt
  'seed-39': 'perspective',    // time as illusion
  'seed-40': 'self',           // identity without attachment to credit
  'seed-41': 'courage',        // unreasonable people create progress
  'seed-42': 'self',           // self-interest and identity
  'seed-43': 'perspective',    // judgments, not events
  'seed-44': 'perspective',    // walking distance reframed by time
  'seed-45': 'wisdom',         // knowledge exposes ignorance
  'seed-46': 'wisdom',         // roughly right over precisely wrong
  'seed-47': 'self',           // change oneself
  'seed-48': 'courage',        // ignore precedent and progress
  'seed-49': 'courage',        // courage despite pain
  'seed-50': 'perspective',    // the indifferent universe
  'seed-51': 'wisdom',         // loudness is not intelligence
  'seed-52': 'creativity',     // build and influence the world
  'seed-53': 'simplicity',     // moderation
  'seed-54': 'resilience',     // pain and suffering
  'seed-55': 'relationships',  // the beauty of conversation
  'seed-56': 'perspective',    // systems reproduce their rationality
  'seed-57': 'wisdom',         // illusion of knowledge
  'seed-58': 'self',           // know oneself
  'seed-59': 'wisdom',         // do not fool yourself
  'seed-60': 'relationships',  // attention as generosity
  'seed-61': 'wisdom'          // patience with unresolved questions
};
