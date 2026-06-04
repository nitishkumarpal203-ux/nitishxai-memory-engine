import "server-only";

import {
  cosineSimilarity,
  generateEmbedding,
  tryGenerateEmbedding
} from "@/lib/embeddings";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { Memory, MemoryDraft, MemoryType, MemoryUpdate } from "@/types/memory";

type MemoryRow = {
  id: string;
  user_id: string;
  memory_text: string;
  category: string | null;
  confidence?: number | null;
  importance: number | null;
  is_archived?: boolean | null;
  is_pinned?: boolean | null;
  is_temporary?: boolean | null;
  memory_type?: MemoryType | null;
  created_at: string;
  similarity?: number | null;
};

type MemoryInsert = {
  user_id: string;
  memory_text: string;
  category: string;
  confidence?: number;
  importance: number;
  is_archived?: boolean;
  is_pinned?: boolean;
  is_temporary?: boolean;
  memory_type?: MemoryType;
  embedding?: number[];
};

type MemoryPatch = {
  memory_text: string;
  category: string;
  confidence: number;
  importance: number;
  is_archived: boolean;
  is_pinned: boolean;
  is_temporary: boolean;
  memory_type: MemoryType;
  embedding?: number[];
};

type MemoryEmbeddingBackfillRow = {
  id: string;
  memory_text: string;
  category: string | null;
};

type SaveMemoryOptions = {
  withEmbedding?: boolean;
};

type MemoryListStatus = "active" | "all" | "archived" | "pinned" | "temporary";

const MEMORY_SELECT =
  "id, user_id, memory_text, category, importance, confidence, memory_type, is_pinned, is_archived, is_temporary, created_at";
const LEGACY_MEMORY_SELECT =
  "id, user_id, memory_text, category, importance, created_at";
const LOCAL_SEARCH_LIMIT = 75;
const EMBEDDING_BACKFILL_LIMIT = 100;
const MEMORY_TYPES: MemoryType[] = [
  "goal",
  "learning",
  "startup",
  "productivity",
  "idea"
];
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

function clampConfidence(value: unknown) {
  const score = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(score)) {
    return 0.7;
  }

  return Number(Math.min(1, Math.max(0, score)).toFixed(2));
}

function normalizeMemoryType(value: unknown): MemoryType {
  return MEMORY_TYPES.includes(value as MemoryType) ? (value as MemoryType) : "idea";
}

function normalizeMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    user_id: row.user_id,
    memory_text: row.memory_text,
    category: row.category ?? "general",
    confidence: clampConfidence(row.confidence),
    importance: row.importance ?? 5,
    is_archived: Boolean(row.is_archived),
    is_pinned: Boolean(row.is_pinned),
    is_temporary: Boolean(row.is_temporary),
    memory_type: normalizeMemoryType(row.memory_type),
    created_at: row.created_at,
    similarity: row.similarity ?? null
  };
}

async function backfillMissingEmbeddings(userId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("memories")
    .select("id, memory_text, category")
    .eq("user_id", userId)
    .is("embedding", null)
    .order("created_at", { ascending: false })
    .limit(EMBEDDING_BACKFILL_LIMIT);

  if (error || !data?.length) {
    return;
  }

  for (const memory of data as MemoryEmbeddingBackfillRow[]) {
    const embedding = await tryGenerateEmbedding(
      `${memory.memory_text} ${memory.category ?? "general"}`
    );

    if (!embedding) {
      continue;
    }

    await getSupabaseAdmin()
      .from("memories")
      .update({ embedding })
      .eq("id", memory.id)
      .eq("user_id", userId)
      .is("embedding", null);
  }
}

function rankSemanticMatches(
  query: string,
  memories: Memory[],
  limit: number
) {
  const ranked = memories
    .filter(getActiveMemoryFilter)
    .map((memory) => {
      const similarity = typeof memory.similarity === "number" ? memory.similarity : 0;

      return {
        memory,
        rankScore: getSemanticRankScore(query, memory, similarity)
      };
    });

  return sortRankedMemories(ranked)
    .slice(0, limit)
    .map((result) => result.memory);
}

async function semanticSearchMemories(
  query: string,
  limit: number,
  userId: string
): Promise<Memory[]> {
  const embedding = await generateEmbedding(query);

  try {
    await backfillMissingEmbeddings(userId);

    const { data, error } = await getSupabaseAdmin().rpc("match_memories", {
      match_count: Math.max(limit, 50),
      match_user_id: userId,
      query_embedding: embedding
    });

    if (error) {
      throw error;
    }

    const memories = (data ?? []).map((row: MemoryRow) => normalizeMemory(row));

    if (memories.length) {
      return rankSemanticMatches(query, memories, limit);
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
  semantic = false,
  status = "active"
}: {
  userId: string;
  query?: string;
  limit?: number;
  semantic?: boolean;
  status?: MemoryListStatus;
}): Promise<Memory[]> {
  if (query?.trim() && semantic) {
    return semanticSearchMemories(query.trim(), limit, userId);
  }

  await backfillMissingEmbeddings(userId);

  let request = getSupabaseAdmin()
    .from("memories")
    .select(MEMORY_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status === "active") {
    request = request.eq("is_archived", false).eq("is_temporary", false);
  } else if (status === "archived") {
    request = request.eq("is_archived", true);
  } else if (status === "temporary") {
    request = request.eq("is_temporary", true);
  } else if (status === "pinned") {
    request = request
      .eq("is_pinned", true)
      .eq("is_archived", false)
      .eq("is_temporary", false);
  }

  if (query?.trim()) {
    request = request.ilike("memory_text", `%${query.trim()}%`);
  }

  const { data, error } = await request;

  if (error) {
    let fallbackRequest = getSupabaseAdmin()
      .from("memories")
      .select(LEGACY_MEMORY_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (query?.trim()) {
      fallbackRequest = fallbackRequest.ilike("memory_text", `%${query.trim()}%`);
    }

    const { data: fallbackData, error: fallbackError } = await fallbackRequest;

    if (fallbackError) {
      throw fallbackError;
    }

    return (fallbackData ?? []).map((row: MemoryRow) => normalizeMemory(row));
  }

  return (data ?? []).map((row: MemoryRow) => normalizeMemory(row));
}

export async function listAllLongTermMemories({
  limit = 150,
  userId
}: {
  limit?: number;
  userId: string;
}) {
  return listMemories({ limit, status: "active", userId });
}

export async function listAllMemoryStates({
  limit = 150,
  userId
}: {
  limit?: number;
  userId: string;
}) {
  return listMemories({ limit, status: "all", userId });
}

async function listActiveMemoriesForSearch(userId: string, limit = LOCAL_SEARCH_LIMIT) {
  return listMemories({ limit, status: "active", userId });
}

function isShortQuestionMemory(memory: Memory) {
  const wordCount = memory.memory_text.trim().split(/\s+/).filter(Boolean).length;

  return wordCount <= 6 || /[?]$/.test(memory.memory_text.trim());
}

function getMemoryQualityScore(memory: Memory) {
  const pinnedBoost = memory.is_pinned ? 1.6 : 0;
  const confidenceBoost = memory.confidence * 1.4;
  const interestBoost = /\binterest|interests|prefer|preference|like|love\b/i.test(
    `${memory.memory_text} ${memory.category}`
  )
    ? 0.85
    : 0;
  const typeBoost =
    memory.memory_type === "goal"
      ? 1.35
      : memory.memory_type === "learning" || memory.memory_type === "startup"
        ? 0.9
        : memory.memory_type === "productivity"
          ? 0.75
          : 0.55;
  const shortQuestionPenalty = isShortQuestionMemory(memory) ? -1.4 : 0;

  return (
    getImportanceScore(memory) +
    getRecencyScore(memory) +
    confidenceBoost +
    interestBoost +
    pinnedBoost +
    typeBoost +
    shortQuestionPenalty
  );
}

function getIntentTypeBoost(message: string, memory: Memory) {
  const text = message.toLowerCase();

  if (/\bgoal|goals|aim|mission|focus|priority\b/.test(text)) {
    return memory.memory_type === "goal" ? 2.5 : 0;
  }

  if (/\binterest|interests|prefer|preference|like|love\b/.test(text)) {
    return /\binterest|interests|prefer|preference|like|love\b/i.test(
      `${memory.memory_text} ${memory.category}`
    )
      ? 2
      : 0;
  }

  if (/\blearn|learning|study|skill|roadmap\b/.test(text)) {
    return memory.memory_type === "learning" ? 2 : 0;
  }

  if (/\bstartup|business|saas|customer|monetize|revenue\b/.test(text)) {
    return memory.memory_type === "startup" ? 2 : 0;
  }

  if (/\bproject|idea|build|create|ship\b/.test(text)) {
    return memory.memory_type === "idea" || memory.memory_type === "startup"
      ? 1.8
      : 0;
  }

  if (/\btask|habit|routine|schedule|productivity|week\b/.test(text)) {
    return memory.memory_type === "productivity" || memory.memory_type === "goal"
      ? 1.6
      : 0;
  }

  return 0;
}

function getActiveMemoryFilter(memory: Memory) {
  return !memory.is_archived && !memory.is_temporary;
}

function getMemorySemanticText(memory: Memory) {
  return `${memory.memory_text} ${memory.category} ${memory.memory_type}`;
}

function normalizeDraft(memory: MemoryDraft): MemoryDraft {
  return {
    memory_text: memory.memory_text.trim(),
    category: memory.category.trim() || memory.memory_type || "general",
    confidence: clampConfidence(memory.confidence),
    importance: Math.min(5, Math.max(1, Math.round(memory.importance))),
    is_archived: Boolean(memory.is_archived),
    is_pinned: Boolean(memory.is_pinned),
    is_temporary: Boolean(memory.is_temporary),
    memory_type: normalizeMemoryType(memory.memory_type)
  };
}

function getFallbackInsert(row: MemoryInsert) {
  return {
    user_id: row.user_id,
    memory_text: row.memory_text,
    category: row.category,
    importance: row.importance
  };
}

function getFallbackPatch(patch: MemoryPatch) {
  return {
    memory_text: patch.memory_text,
    category: patch.category,
    importance: patch.importance
  };
}

function normalizeUpdatedMemory(memory: MemoryUpdate): MemoryUpdate {
  return {
    memory_text: memory.memory_text.trim(),
    category: memory.category.trim() || memory.memory_type || "general",
    confidence: clampConfidence(memory.confidence),
    importance: Math.min(5, Math.max(1, Math.round(memory.importance))),
    is_archived: Boolean(memory.is_archived),
    is_pinned: Boolean(memory.is_pinned),
    is_temporary: Boolean(memory.is_temporary),
    memory_type: normalizeMemoryType(memory.memory_type)
  };
}

function mergeLegacyUpdateFallback(
  fallbackData: MemoryRow,
  requested: MemoryUpdate
) {
  return normalizeMemory({
    ...fallbackData,
    confidence: requested.confidence,
    is_archived: requested.is_archived,
    is_pinned: requested.is_pinned,
    is_temporary: requested.is_temporary,
    memory_type: requested.memory_type
  });
}

function mergeLegacyInsertFallback(fallbackData: MemoryRow, requested: MemoryDraft) {
  return normalizeMemory({
    ...fallbackData,
    confidence: requested.confidence,
    is_archived: requested.is_archived,
    is_pinned: requested.is_pinned,
    is_temporary: requested.is_temporary,
    memory_type: requested.memory_type
  });
}

function getInsertedRow(memory: MemoryDraft, userId: string, embedding: number[] | null) {
  const row: MemoryInsert = {
    user_id: userId,
    memory_text: memory.memory_text,
    category: memory.category,
    confidence: memory.confidence,
    importance: memory.importance,
    is_archived: Boolean(memory.is_archived),
    is_pinned: Boolean(memory.is_pinned),
    is_temporary: Boolean(memory.is_temporary),
    memory_type: memory.memory_type
  };

  if (embedding && !memory.is_archived && !memory.is_temporary) {
    row.embedding = embedding;
  }

  return row;
}

function getUpdatedPatch(memory: MemoryUpdate, embedding: number[] | null) {
  const patch: MemoryPatch = {
    memory_text: memory.memory_text,
    category: memory.category,
    confidence: memory.confidence,
    importance: memory.importance,
    is_archived: memory.is_archived,
    is_pinned: memory.is_pinned,
    is_temporary: memory.is_temporary,
    memory_type: memory.memory_type
  };

  if (embedding && !memory.is_archived && !memory.is_temporary) {
    patch.embedding = embedding;
  }

  return patch;
}

function getNoEmbeddingPatch(memory: MemoryPatch) {
  const { embedding: _embedding, ...patch } = memory;

  return patch;
}

function getNoEmbeddingInsert(memory: MemoryInsert) {
  const { embedding: _embedding, ...row } = memory;

  return row;
}

function getQualityBoost(memory: Memory) {
  return Math.max(0, getMemoryQualityScore(memory)) * 0.018;
}

function getPinnedTieBreak(memory: Memory) {
  return memory.is_pinned ? 1 : 0;
}

function getMemoryRankDate(memory: Memory) {
  return new Date(memory.created_at).getTime();
}

function getQuestionPenalty(memory: Memory) {
  return isShortQuestionMemory(memory) ? -0.08 : 0;
}

function applyMemoryRankTieBreak(a: Memory, b: Memory) {
  if (getPinnedTieBreak(b) !== getPinnedTieBreak(a)) {
    return getPinnedTieBreak(b) - getPinnedTieBreak(a);
  }

  return getMemoryRankDate(b) - getMemoryRankDate(a);
}

function getSemanticRankScore(
  query: string,
  memory: Memory,
  similarity: number,
  keywordBoostMultiplier = 0.025
) {
  const keywordBoost = Math.min(getKeywordScore(query, memory), 8) * keywordBoostMultiplier;
  const recencyBoost = getRecencyScore(memory) * 0.015;

  return (
    similarity +
    keywordBoost +
    getQualityBoost(memory) +
    recencyBoost +
    getQuestionPenalty(memory)
  );
}

function getLocalRankScore(message: string, memory: Memory) {
  return (
    getKeywordScore(message, memory) +
    getMemoryQualityScore(memory) +
    getIntentTypeBoost(message, memory)
  );
}

function getMemoryDraftEmbeddingText(memory: MemoryDraft) {
  return `${memory.memory_text} ${memory.category} ${memory.memory_type}`;
}

function getMemoryUpdateEmbeddingText(memory: MemoryUpdate) {
  return `${memory.memory_text} ${memory.category} ${memory.memory_type}`;
}

function isEmbeddableMemory(memory: Pick<MemoryDraft, "is_archived" | "is_temporary">) {
  return !memory.is_archived && !memory.is_temporary;
}

function isEmbeddableUpdate(memory: MemoryUpdate) {
  return !memory.is_archived && !memory.is_temporary;
}

function prepareMemoryForStorage(memory: MemoryDraft) {
  return normalizeDraft(memory);
}

function prepareMemoryUpdateForStorage(memory: MemoryUpdate) {
  return normalizeUpdatedMemory(memory);
}

function sortRankedMemories(ranked: Array<{ memory: Memory; rankScore: number }>) {
  return ranked.sort((a, b) => {
    if (b.rankScore !== a.rankScore) {
      return b.rankScore - a.rankScore;
    }

    return applyMemoryRankTieBreak(a.memory, b.memory);
  });
}

function getSearchTerms(text: string) {
  const matches = text.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [];
  const terms = new Set(
    matches.filter((term) => !STOP_WORDS.has(term) && !/^\d+$/.test(term))
  );

  return Array.from(terms);
}

function scoreMemoryAgainstMessage(message: string, memory: Memory) {
  return getLocalRankScore(message, memory);
}

function getKeywordScore(message: string, memory: Memory) {
  const terms = getSearchTerms(message);

  if (!terms.length) {
    return 0;
  }

  const memoryText = memory.memory_text.toLowerCase();
  const category = memory.category.toLowerCase();
  const memoryType = memory.memory_type.toLowerCase();
  let score = 0;

  for (const term of terms) {
    if (memoryText.includes(term)) {
      score += 2;
    }

    if (category.includes(term)) {
      score += 1;
    }

    if (memoryType.includes(term)) {
      score += 1.25;
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
  const memories = await listActiveMemoriesForSearch(userId);
  const queryTerms = getSearchTerms(query);
  const ranked: Array<{ memory: Memory; rankScore: number }> = [];

  for (const memory of memories) {
    const memoryEmbedding = await generateEmbedding(
      getMemorySemanticText(memory)
    );
    const similarity = cosineSimilarity(queryEmbedding, memoryEmbedding);
    const hasAnyTerm = queryTerms.some((term) =>
      getMemorySemanticText(memory).toLowerCase().includes(term)
    );
    const rankScore = getSemanticRankScore(query, memory, similarity);

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

  return sortRankedMemories(ranked)
    .slice(0, limit)
    .map((result) => result.memory);
}

export async function findRelevantMemories(
  userId: string,
  message: string,
  limit = 5
): Promise<Memory[]> {
  const trimmedMessage = message.trim();

  if (trimmedMessage) {
    try {
      const semanticMatches = await semanticSearchMemories(
        trimmedMessage,
        limit,
        userId
      );

      if (semanticMatches.length) {
        return semanticMatches;
      }
    } catch {
      // Keep chat stable with keyword retrieval when semantic search is unavailable.
    }
  }

  const memories = await listActiveMemoriesForSearch(userId);
  const ranked = memories
    .map((memory) => {
      const keywordScore = getKeywordScore(message, memory);
      const typeBoost = getIntentTypeBoost(message, memory);

      return {
        memory,
        keywordScore,
        score: scoreMemoryAgainstMessage(message, memory),
        typeBoost
      };
    })
    .filter(
      (result) =>
        result.keywordScore > 0 || result.typeBoost > 0 || result.memory.is_pinned
    )
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      if (b.keywordScore !== a.keywordScore) {
        return b.keywordScore - a.keywordScore;
      }

      return applyMemoryRankTieBreak(a.memory, b.memory);
    });

  return ranked.slice(0, limit).map((result) => result.memory);
}

export async function saveMemory(
  userId: string,
  message: string,
  options: SaveMemoryOptions = {}
) {
  return saveMemoryDraft(
    {
      memory_text: message,
      category: "general",
      confidence: 0.7,
      importance: 5,
      memory_type: "idea"
    },
    userId,
    options
  );
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
  const cleanMemory = prepareMemoryForStorage(memory);
  const embedding =
    withEmbedding && isEmbeddableMemory(cleanMemory)
      ? await tryGenerateEmbedding(getMemoryDraftEmbeddingText(cleanMemory))
      : null;
  const row = getInsertedRow(cleanMemory, userId, embedding);

  const { data, error } = await getSupabaseAdmin()
    .from("memories")
    .insert(row)
    .select(MEMORY_SELECT)
    .single();

  if (error) {
    const { data: fallbackData, error: fallbackError } = await getSupabaseAdmin()
      .from("memories")
      .insert(getFallbackInsert(getNoEmbeddingInsert(row)))
      .select(LEGACY_MEMORY_SELECT)
      .single();

    if (fallbackError) {
      throw fallbackError;
    }

    return mergeLegacyInsertFallback(fallbackData as MemoryRow, cleanMemory);
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
  const cleanMemory = prepareMemoryUpdateForStorage(memory);
  const embedding = isEmbeddableUpdate(cleanMemory)
    ? await tryGenerateEmbedding(getMemoryUpdateEmbeddingText(cleanMemory))
    : null;
  const patch = getUpdatedPatch(cleanMemory, embedding);

  const { data, error } = await getSupabaseAdmin()
    .from("memories")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select(MEMORY_SELECT)
    .maybeSingle();

  if (error) {
    const { data: fallbackData, error: fallbackError } = await getSupabaseAdmin()
      .from("memories")
      .update(getFallbackPatch(getNoEmbeddingPatch(patch)))
      .eq("id", id)
      .eq("user_id", userId)
      .select(LEGACY_MEMORY_SELECT)
      .maybeSingle();

    if (fallbackError) {
      throw fallbackError;
    }

    return fallbackData
      ? mergeLegacyUpdateFallback(fallbackData as MemoryRow, cleanMemory)
      : null;
  }

  return data ? normalizeMemory(data as MemoryRow) : null;
}
