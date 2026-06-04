import "server-only";

import type { Memory, MemoryDraft, MemoryInsight } from "@/types/memory";

const INSIGHT_STOP_WORDS = new Set([
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
  "like",
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

function summarizeMemory(memory: Memory) {
  const text = memory.memory_text.trim();

  if (text.length <= 140) {
    return text.replace(/[.!?]+$/, "");
  }

  return `${text.slice(0, 137).trim().replace(/[.!?]+$/, "")}...`;
}

function getMessageIntent(message: string) {
  const text = message.toLowerCase();

  if (/\bgoal|goals|aim|mission\b/.test(text)) {
    return "goals";
  }

  if (/\bproject|build|idea|ship|create\b/.test(text)) {
    return "project";
  }

  if (/\bfocus|week|priority|prioritize|next\b/.test(text)) {
    return "focus";
  }

  if (/\bsummarize|summary|memories|remember\b/.test(text)) {
    return "summary";
  }

  return "general";
}

function formatMemoryList(memories: Memory[], maxItems = 3) {
  return memories
    .slice(0, maxItems)
    .map((memory) => summarizeMemory(memory))
    .filter(Boolean);
}

function getCategoryLabel(memories: Memory[]) {
  const counts = new Map<string, number>();

  for (const memory of memories) {
    counts.set(memory.category, (counts.get(memory.category) ?? 0) + 1);
  }

  return (
    Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    "general"
  );
}

function tokenizeInsightText(text: string) {
  return (
    text
      .toLowerCase()
      .match(/[a-z0-9][a-z0-9-]{2,}/g)
      ?.filter((term) => !INSIGHT_STOP_WORDS.has(term) && !/^\d+$/.test(term)) ??
    []
  );
}

export function generateMemoryInsights(memories: Memory[]): MemoryInsight {
  if (!memories.length) {
    return {
      categories: [],
      nextAction:
        "Save one concrete goal, one current project, and one preference so the assistant can build a useful memory profile.",
      repeatedThemes: [],
      summary: "No saved memories are available yet.",
      totalMemories: 0
    };
  }

  const categoryStats = new Map<string, { count: number; importanceTotal: number }>();
  const themeCounts = new Map<string, number>();

  for (const memory of memories) {
    const category = memory.category || "general";
    const current = categoryStats.get(category) ?? {
      count: 0,
      importanceTotal: 0
    };

    categoryStats.set(category, {
      count: current.count + 1,
      importanceTotal: current.importanceTotal + memory.importance
    });

    for (const term of tokenizeInsightText(memory.memory_text)) {
      themeCounts.set(term, (themeCounts.get(term) ?? 0) + 1);
    }
  }

  const categories = Array.from(categoryStats.entries())
    .map(([name, stats]) => ({
      averageImportance: Number((stats.importanceTotal / stats.count).toFixed(1)),
      count: stats.count,
      name
    }))
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }

      return b.averageImportance - a.averageImportance;
    });

  const repeatedThemes = Array.from(themeCounts.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([theme]) => theme);
  const topCategory = categories[0]?.name ?? "general";
  const topTheme = repeatedThemes[0] ?? topCategory;

  return {
    categories,
    nextAction: `Turn "${topTheme}" into one concrete next step this week, then save the result as a new memory so your assistant can track momentum.`,
    repeatedThemes,
    summary: `I found ${memories.length} saved ${memories.length === 1 ? "memory" : "memories"}, with the strongest signal around "${topCategory}".`,
    totalMemories: memories.length
  };
}

export function generateMemoryInsightReply(memories: Memory[]) {
  const insight = generateMemoryInsights(memories);

  if (!insight.totalMemories) {
    return {
      insight,
      reply:
        "I do not have enough saved memory yet to find patterns. Start by saving a current goal, a project idea, and a personal preference."
    };
  }

  const categories = insight.categories
    .slice(0, 3)
    .map((category) => `${category.name} (${category.count})`)
    .join(", ");
  const themes = insight.repeatedThemes.length
    ? insight.repeatedThemes.join(", ")
    : "no repeated themes yet";

  return {
    insight,
    reply: `${insight.summary} Your main categories are ${categories}. Repeated themes: ${themes}. Suggested next action: ${insight.nextAction}`
  };
}

export async function generateChatReply(
  message = "",
  relevantMemories: Memory[] = []
) {
  if (!relevantMemories.length) {
    return "I do not have strong saved context for this yet, so I will answer locally and keep this new note in memory for future replies.";
  }

  const intent = getMessageIntent(message);
  const context = formatMemoryList(relevantMemories);
  const strongestMemory = context[0];
  const category = getCategoryLabel(relevantMemories);

  if (intent === "goals") {
    return `From your saved memories, your goals seem tied to ${category}. The clearest signal is: "${strongestMemory}". I would treat that as the anchor and keep the next step small enough to act on this week.`;
  }

  if (intent === "project") {
    return `A project idea that fits your memory profile: build around "${strongestMemory}". It matches the ${category} thread in your notes, and you could start by turning it into a one-screen MVP or a short workflow prototype.`;
  }

  if (intent === "focus") {
    return `This week, focus on the highest-signal memory I found: "${strongestMemory}". Keep the scope narrow: choose one outcome, one blocker to remove, and one visible deliverable by the end of the week.`;
  }

  if (intent === "summary") {
    return `Here is the pattern I see from the memories I used: ${context
      .map((item) => `"${item}"`)
      .join("; ")}. The common direction points toward ${category}.`;
  }

  if (relevantMemories.length === 1) {
    return `I found one relevant memory before answering: "${strongestMemory}". I will use that as the personal backdrop here.`;
  }

  return `I found relevant context before answering: "${strongestMemory}". I will use that as the personal backdrop here, along with ${relevantMemories.length - 1} other ${relevantMemories.length === 2 ? "memory" : "memories"} when helpful.`;
}

export async function extractLongTermMemories(message: string): Promise<MemoryDraft[]> {
  return [
    {
      memory_text: message,
      category: "general",
      importance: 5
    }
  ];
}

export function searchMemoriesBeforeReply(memories: Memory[]) {
  return memories;
}
