import "server-only";

import {
  cosineSimilarity,
  generateEmbedding,
  tryGenerateEmbedding
} from "@/lib/embeddings";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Memory, MemoryDraft, MemoryUpdate } from "@/types/memory";

type MemoryRow = {
  id: string;
  user_id: string;
  memory_text: string;
  category: string | null;
  importance: number | null;
  created_at: string;
  similarity?: number | null;
};

type MemoryInsert = {
  user_id: string;
  memory_text: string;
  category: string;
  importance: number;
  embedding?: number[];
};

type MemoryPatch = {
  memory_text: string;
  category: string;
  importance: number;
  embedding?: number[];
};

type SaveMemoryOptions = {
  withEmbedding?: boolean;
};

const LOCAL_SEARCH_LIMIT = 75;
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

function normalizeMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    user_id: row.user_id,
    memory_text: row.memory_text,
    category: row.category ?? "general",
    importance: row.importance ?? 5,
    created_at: row.created_at,
    similarity: row.similarity ?? null
  };
}

async function semanticSearchMemories(
  query: string,
  limit: number,
  userId: string
): Promise<Memory[]> {
  const embedding = await generateEmbedding(query);

  try {
    const { data, error } = await getSupabaseAdmin().rpc("match_memories", {
      match_count: limit,
      match_user_id: userId,
      query_embedding: embedding
    });

    if (error) {
      throw error;
    }

    const memories = (data ?? []).map((row: MemoryRow) => normalizeMemory(row));

    if (memories.length) {
      return memories;
    }
  } catch {
    // Fall back to local ranking when pgvector or the RPC is not available.
  }

  return rankMemoriesByLocalSimilarity(query, embedding, limit, userId);
}

export async function listMemories({
  userId,
  query,
  limit = 50,
  semantic = false
}: {
  userId: string;
  query?: string;
  limit?: number;
  semantic?: boolean;
}): Promise<Memory[]> {
  if (query?.trim() && semantic) {
    return semanticSearchMemories(query.trim(), limit, userId);
  }

  let request = getSupabaseAdmin()
    .from("memories")
    .select("id, user_id, memory_text, category, importance, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (query?.trim()) {
    request = request.ilike("memory_text", `%${query.trim()}%`);
  }

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return (data ?? []).map((row: MemoryRow) => normalizeMemory(row));
}

function getSearchTerms(text: string) {
  const matches = text.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [];
  const terms = new Set(
    matches.filter((term) => !STOP_WORDS.has(term) && !/^\d+$/.test(term))
  );

  return Array.from(terms);
}

function scoreMemoryAgainstMessage(message: string, memory: Memory) {
  return (
    getKeywordScore(message, memory) +
    getImportanceScore(memory) +
    getRecencyScore(memory)
  );
}

function getKeywordScore(message: string, memory: Memory) {
  const terms = getSearchTerms(message);

  if (!terms.length) {
    return 0;
  }

  const memoryText = memory.memory_text.toLowerCase();
  const category = memory.category.toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (memoryText.includes(term)) {
      score += 2;
    }

    if (category.includes(term)) {
      score += 1;
    }
  }

  if (memoryText.includes(message.toLowerCase().trim())) {
    score += 4;
  }

  return score;
}

function getImportanceScore(memory: Memory) {
  return (Math.min(Math.max(memory.importance, 1), 5) / 5) * 1.25;
}

function getRecencyScore(memory: Memory) {
  const createdAt = new Date(memory.created_at).getTime();

  if (!Number.isFinite(createdAt)) {
    return 0;
  }

  const ageInDays = Math.max(0, (Date.now() - createdAt) / 86_400_000);

  return Math.max(0, 1 - ageInDays / 30);
}

async function rankMemoriesByLocalSimilarity(
  query: string,
  queryEmbedding: number[],
  limit: number,
  userId: string
) {
  const memories = await listMemories({ limit: LOCAL_SEARCH_LIMIT, userId });
  const queryTerms = getSearchTerms(query);
  const ranked: Array<{ memory: Memory; rankScore: number }> = [];

  for (const memory of memories) {
    const memoryEmbedding = await generateEmbedding(
      `${memory.memory_text} ${memory.category}`
    );
    const similarity = cosineSimilarity(queryEmbedding, memoryEmbedding);
    const keywordBoost = Math.min(getKeywordScore(query, memory), 8) * 0.025;
    const importanceBoost = getImportanceScore(memory) * 0.03;
    const recencyBoost = getRecencyScore(memory) * 0.015;
    const hasAnyTerm = queryTerms.some((term) =>
      `${memory.memory_text} ${memory.category}`.toLowerCase().includes(term)
    );
    const rankScore = similarity + keywordBoost + importanceBoost + recencyBoost;

    if (similarity >= 0.14 || hasAnyTerm) {
      ranked.push({
        memory: {
          ...memory,
          similarity: Number(Math.max(0, similarity).toFixed(3))
        },
        rankScore
      });
    }
  }

  ranked.sort((a, b) => {
    if (b.rankScore !== a.rankScore) {
      return b.rankScore - a.rankScore;
    }

    return (
      new Date(b.memory.created_at).getTime() -
      new Date(a.memory.created_at).getTime()
    );
  });

  return ranked.slice(0, limit).map((result) => result.memory);
}

export async function findRelevantMemories(
  userId: string,
  message: string,
  limit = 5
): Promise<Memory[]> {
  const memories = await listMemories({ limit: LOCAL_SEARCH_LIMIT, userId });
  const ranked = memories
    .map((memory) => ({
      memory,
      keywordScore: getKeywordScore(message, memory),
      score: scoreMemoryAgainstMessage(message, memory)
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      if (b.keywordScore !== a.keywordScore) {
        return b.keywordScore - a.keywordScore;
      }

      return (
        new Date(b.memory.created_at).getTime() -
        new Date(a.memory.created_at).getTime()
      );
    });

  return ranked.slice(0, limit).map((result) => result.memory);
}

export async function saveMemory(
  userId: string,
  message: string,
  options: SaveMemoryOptions = {}
) {
  return saveMemoryDraft({
    memory_text: message,
    category: "general",
    importance: 5
  }, userId, options);
}

export async function saveMemories(userId: string, memories: MemoryDraft[]) {
  if (!memories.length) {
    return [];
  }

  const saved: Memory[] = [];

  for (const memory of memories) {
    saved.push(await saveMemoryDraft(memory, userId));
  }

  return saved;
}

async function saveMemoryDraft(
  memory: MemoryDraft,
  userId: string,
  { withEmbedding = true }: SaveMemoryOptions = {}
) {
  const embedding = withEmbedding
    ? await tryGenerateEmbedding(memory.memory_text)
    : null;
  const row: MemoryInsert = {
    user_id: userId,
    memory_text: memory.memory_text,
    category: memory.category,
    importance: memory.importance
  };

  if (embedding) {
    row.embedding = embedding;
  }

  const { data, error } = await getSupabaseAdmin()
    .from("memories")
    .insert(row)
    .select("id, user_id, memory_text, category, importance, created_at")
    .single();

  if (error && row.embedding) {
    const { data: fallbackData, error: fallbackError } = await getSupabaseAdmin()
      .from("memories")
      .insert({
        user_id: row.user_id,
        memory_text: row.memory_text,
        category: row.category,
        importance: row.importance
      })
      .select("id, user_id, memory_text, category, importance, created_at")
      .single();

    if (fallbackError) {
      throw fallbackError;
    }

    return normalizeMemory(fallbackData as MemoryRow);
  }

  if (error) {
    throw error;
  }

  return normalizeMemory(data as MemoryRow);
}

export async function deleteMemory(userId: string, id: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("memories")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

export async function updateMemory(
  userId: string,
  id: string,
  memory: MemoryUpdate
) {
  const embedding = await tryGenerateEmbedding(memory.memory_text);
  const patch: MemoryPatch = {
    memory_text: memory.memory_text,
    category: memory.category,
    importance: memory.importance
  };

  if (embedding) {
    patch.embedding = embedding;
  }

  const { data, error } = await getSupabaseAdmin()
    .from("memories")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select("id, user_id, memory_text, category, importance, created_at")
    .maybeSingle();

  if (error && patch.embedding) {
    const { data: fallbackData, error: fallbackError } = await getSupabaseAdmin()
      .from("memories")
      .update({
        memory_text: patch.memory_text,
        category: patch.category,
        importance: patch.importance
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select("id, user_id, memory_text, category, importance, created_at")
      .maybeSingle();

    if (fallbackError) {
      throw fallbackError;
    }

    return fallbackData ? normalizeMemory(fallbackData as MemoryRow) : null;
  }

  if (error) {
    throw error;
  }

  return data ? normalizeMemory(data as MemoryRow) : null;
}
