import "server-only";

export const MOCK_EMBEDDING_DIMENSIONS = 1536;

type SemanticConcept = {
  name: string;
  keywords: string[];
  phrases?: string[];
  weight: number;
};

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "before",
  "being",
  "could",
  "every",
  "from",
  "have",
  "into",
  "just",
  "make",
  "more",
  "need",
  "next",
  "that",
  "their",
  "there",
  "this",
  "want",
  "what",
  "when",
  "with",
  "would",
  "your"
]);

const SEMANTIC_CONCEPTS: SemanticConcept[] = [
  {
    name: "future_tech_ai",
    keywords: [
      "agent",
      "agents",
      "ai",
      "automation",
      "automations",
      "automate",
      "brand",
      "branding",
      "digital",
      "future",
      "futuristic",
      "innovation",
      "intelligent",
      "modern",
      "productivity",
      "software",
      "tech",
      "technology",
      "tool",
      "tools"
    ],
    phrases: ["ai automation", "ai tools", "future tech", "futuristic branding"],
    weight: 3.4
  },
  {
    name: "business_ideas_startup",
    keywords: [
      "business",
      "customer",
      "customers",
      "founder",
      "growth",
      "idea",
      "ideas",
      "launch",
      "market",
      "monetization",
      "monetize",
      "pricing",
      "revenue",
      "saas",
      "sales",
      "startup",
      "startups"
    ],
    phrases: ["business ideas", "startup idea", "saas product"],
    weight: 3.5
  },
  {
    name: "creative_branding",
    keywords: [
      "aesthetic",
      "brand",
      "branding",
      "copy",
      "creative",
      "design",
      "identity",
      "logo",
      "marketing",
      "positioning",
      "style",
      "visual",
      "voice"
    ],
    phrases: ["brand identity", "futuristic branding"],
    weight: 2.6
  },
  {
    name: "engineering_product",
    keywords: [
      "api",
      "app",
      "architecture",
      "build",
      "code",
      "database",
      "feature",
      "nextjs",
      "postgres",
      "product",
      "supabase",
      "system"
    ],
    phrases: ["memory system", "supabase app"],
    weight: 2.4
  }
];

function hashText(text: string) {
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function getVectorIndex(key: string) {
  return hashText(key) % MOCK_EMBEDDING_DIMENSIONS;
}

function addWeight(vector: number[], key: string, weight: number) {
  const primary = getVectorIndex(key);
  const secondary = getVectorIndex(`${key}:semantic`);

  vector[primary] += weight;
  vector[secondary] += weight * 0.42;
}

function normalizeTerm(term: string) {
  if (term.length > 4 && term.endsWith("ies")) {
    return `${term.slice(0, -3)}y`;
  }

  if (term.length > 4 && term.endsWith("ing")) {
    return term.slice(0, -3);
  }

  if (term.length > 4 && term.endsWith("ed")) {
    return term.slice(0, -2);
  }

  if (term.length > 3 && term.endsWith("s")) {
    return term.slice(0, -1);
  }

  return term;
}

function tokenize(text: string) {
  const matches = text.toLowerCase().match(/[a-z0-9][a-z0-9-]{1,}/g) ?? [];
  const terms = new Set<string>();

  for (const match of matches) {
    const term = normalizeTerm(match);

    if (!STOP_WORDS.has(term) && !/^\d+$/.test(term)) {
      terms.add(term);
    }
  }

  return Array.from(terms);
}

function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(
    vector.reduce((total, value) => total + value * value, 0)
  );

  if (!magnitude) {
    return vector;
  }

  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

function addSemanticConcepts(vector: number[], text: string, terms: string[]) {
  const termSet = new Set(terms);
  const normalizedText = ` ${text.toLowerCase().replace(/\s+/g, " ")} `;

  for (const concept of SEMANTIC_CONCEPTS) {
    let conceptScore = 0;

    for (const keyword of concept.keywords) {
      if (termSet.has(normalizeTerm(keyword))) {
        conceptScore += 1;
      }
    }

    for (const phrase of concept.phrases ?? []) {
      if (normalizedText.includes(` ${phrase} `)) {
        conceptScore += 1.8;
      }
    }

    if (conceptScore > 0) {
      const weight = concept.weight * Math.log2(conceptScore + 1);

      addWeight(vector, `concept:${concept.name}`, weight);
      addWeight(vector, `concept:${concept.name}:context`, weight * 0.65);
    }
  }
}

export async function generateEmbedding(input: string) {
  const text = input.trim();

  if (!text) {
    throw new Error("Cannot generate a mock embedding for empty text.");
  }

  const vector = Array.from({ length: MOCK_EMBEDDING_DIMENSIONS }, () => 0);
  const terms = tokenize(text);

  for (const term of terms) {
    addWeight(vector, `term:${term}`, 1);
  }

  for (let index = 0; index < terms.length - 1; index += 1) {
    addWeight(vector, `pair:${terms[index]}:${terms[index + 1]}`, 0.7);
  }

  addSemanticConcepts(vector, text, terms);

  return normalizeVector(vector);
}

export async function tryGenerateEmbedding(input: string) {
  try {
    return await generateEmbedding(input);
  } catch {
    return null;
  }
}

export function cosineSimilarity(a: number[], b: number[]) {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < length; index += 1) {
    dot += a[index] * b[index];
    magnitudeA += a[index] * a[index];
    magnitudeB += b[index] * b[index];
  }

  if (!magnitudeA || !magnitudeB) {
    return 0;
  }

  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}
