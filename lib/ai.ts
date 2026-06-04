import "server-only";

import type { Memory, MemoryDraft, MemoryInsight, MemoryType } from "@/types/memory";

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

const CONCEPT_KEYWORDS = {
  aiFocus: [
    "agent",
    "ai",
    "automation",
    "automations",
    "chatbot",
    "gemini",
    "llm",
    "memory",
    "model",
    "openai",
    "prompt",
    "supabase",
    "tool"
  ],
  learning: [
    "book",
    "course",
    "learn",
    "learning",
    "practice",
    "read",
    "research",
    "skill",
    "study",
    "tutorial",
    "training"
  ],
  productivity: [
    "calendar",
    "focus",
    "habit",
    "plan",
    "priority",
    "routine",
    "schedule",
    "system",
    "task",
    "workflow",
    "week"
  ],
  startup: [
    "business",
    "customer",
    "idea",
    "launch",
    "market",
    "monetization",
    "pricing",
    "revenue",
    "saas",
    "startup",
    "user"
  ]
};

const DURABLE_MEMORY_PATTERNS = [
  /\bremember\b/i,
  /\bsave (this|that|as|my)\b/i,
  /\bmy (goal|goals|priority|priorities|interest|interests|preference|preferences)\b/i,
  /\bi (want|need|plan|prefer|like|love|am learning|study|work on|build|ship|launch)\b/i,
  /\b(startup|saas|business|monetization|productivity|learning roadmap|project idea)\b/i
];

const SHORT_QUESTION_PATTERN =
  /^(what|when|where|why|how|who|can|could|should|would|do|does|did|is|are)\b/i;

function summarizeMemory(memory: Memory) {
  const text = memory.memory_text.trim();

  if (text.length <= 140) {
    return text.replace(/[.!?]+$/, "");
  }

  return `${text.slice(0, 137).trim().replace(/[.!?]+$/, "")}...`;
}

function classifyMemoryType(text: string): MemoryType {
  const value = text.toLowerCase();

  if (/\bgoal|goals|priority|priorities|aim|mission|focus\b/.test(value)) {
    return "goal";
  }

  if (/\blearn|learning|study|skill|course|book|practice|roadmap\b/.test(value)) {
    return "learning";
  }

  if (/\bstartup|saas|business|customer|market|monetization|revenue|launch\b/.test(value)) {
    return "startup";
  }

  if (/\bproductivity|habit|routine|schedule|workflow|task|focus block\b/.test(value)) {
    return "productivity";
  }

  return "idea";
}

function getCategoryFromMemoryType(memoryType: MemoryType) {
  if (memoryType === "goal") {
    return "goals";
  }

  return memoryType;
}

function getMemoryConfidence(message: string, memoryType: MemoryType) {
  const text = message.trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  let confidence = 0.42;

  if (/\bremember\b|\bsave\b/i.test(text)) {
    confidence += 0.22;
  }

  if (/\bmy\b|\bi\b/i.test(text)) {
    confidence += 0.12;
  }

  if (memoryType === "goal" || memoryType === "learning" || memoryType === "startup") {
    confidence += 0.12;
  }

  if (wordCount >= 8) {
    confidence += 0.08;
  }

  if (/[?]$/.test(text) || SHORT_QUESTION_PATTERN.test(text)) {
    confidence -= 0.32;
  }

  return Number(Math.min(0.98, Math.max(0, confidence)).toFixed(2));
}

function shouldSaveAsLongTermMemory(message: string) {
  const text = message.trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  if (!text || wordCount < 4) {
    return false;
  }

  if (/[?]$/.test(text) && SHORT_QUESTION_PATTERN.test(text)) {
    return false;
  }

  return DURABLE_MEMORY_PATTERNS.some((pattern) => pattern.test(text));
}

function cleanDurableMemoryText(message: string) {
  return message
    .trim()
    .replace(/^remember\s+(that\s+)?/i, "")
    .replace(/^save\s+(this|that)\s*(as\s+)?/i, "")
    .trim();
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

function getMemoryAgeInDays(memory: Memory) {
  const createdAt = new Date(memory.created_at).getTime();

  if (!Number.isFinite(createdAt)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, (Date.now() - createdAt) / 86_400_000);
}

function getLatestMemories(memories: Memory[], limit: number) {
  return [...memories]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, limit);
}

function uniqueItems(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function countConceptMatches(memories: Memory[], keywords: string[]) {
  const haystack = memories
    .map((memory) => `${memory.memory_text} ${memory.category}`.toLowerCase())
    .join(" ");

  return keywords.reduce(
    (count, keyword) => count + (haystack.includes(keyword) ? 1 : 0),
    0
  );
}

function getAverageImportance(memories: Memory[]) {
  if (!memories.length) {
    return 0;
  }

  return (
    memories.reduce((total, memory) => total + memory.importance, 0) /
    memories.length
  );
}

function getRecentMemoryCount(memories: Memory[], dayWindow: number) {
  return memories.filter((memory) => getMemoryAgeInDays(memory) <= dayWindow).length;
}

function scoreConcept(memories: Memory[], keywords: string[]) {
  if (!memories.length) {
    return 0;
  }

  const matches = countConceptMatches(memories, keywords);
  const averageImportance = getAverageImportance(memories);
  const recentCount = getRecentMemoryCount(memories, 14);
  const density = Math.min(1, matches / Math.max(1, keywords.length / 2));
  const recentBoost = Math.min(20, recentCount * 4);

  return Math.min(
    100,
    Math.round(density * 52 + averageImportance * 7 + recentBoost)
  );
}

function getDayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, amount: number) {
  const nextDate = new Date(date);

  nextDate.setUTCDate(nextDate.getUTCDate() + amount);

  return nextDate;
}

function getActivityInsight(memories: Memory[]) {
  const validDates = memories
    .map((memory) => new Date(memory.created_at))
    .filter((date) => Number.isFinite(date.getTime()));
  const dayKeys = uniqueItems(validDates.map((date) => getDayKey(date))).sort(
    (a, b) => b.localeCompare(a)
  );
  const today = getDayKey(new Date());
  const daySet = new Set(dayKeys);
  let streakDays = 0;

  if (daySet.has(today)) {
    let cursor = new Date();

    while (daySet.has(getDayKey(cursor))) {
      streakDays += 1;
      cursor = addDays(cursor, -1);
    }
  }

  const weekAgo = Date.now() - 7 * 86_400_000;
  const memoriesThisWeek = validDates.filter(
    (date) => date.getTime() >= weekAgo
  ).length;
  const latest = getLatestMemories(memories, 1)[0];

  return {
    activeDays: dayKeys.length,
    lastMemoryAt: latest?.created_at ?? null,
    memoriesThisWeek,
    streakDays,
    totalMemories: memories.length
  };
}

function getCurrentGoals(memories: Memory[]) {
  const goalPattern =
    /\bgoal|goals|build|launch|learn|focus|project|startup|ship|grow|monetize|monetization|finish|create\b/i;

  return getLatestMemories(
    memories
      .filter((memory) => goalPattern.test(memory.memory_text))
      .sort((a, b) => b.importance - a.importance),
    5
  ).map((memory) => summarizeMemory(memory));
}

function getTopInterests(repeatedThemes: string[], categories: string[]) {
  return uniqueItems([...repeatedThemes, ...categories]).slice(0, 6);
}

function getFirstSignal(items: string[], fallback: string) {
  return items[0] ?? fallback;
}

export function generateMemoryInsights(memories: Memory[]): MemoryInsight {
  const longTermMemories = memories.filter(
    (memory) => !memory.is_archived && !memory.is_temporary
  );

  if (!longTermMemories.length) {
    return {
      activity: {
        activeDays: 0,
        lastMemoryAt: null,
        memoriesThisWeek: 0,
        streakDays: 0,
        totalMemories: 0
      },
      categories: [],
      currentGoals: [],
      focusSuggestions: [
        "Save one goal, one current project, and one skill you want to improve."
      ],
      learningRecommendations: [
        "Start by adding a memory about what you are learning right now."
      ],
      nextAction:
        "Save one concrete goal, one current project, and one preference so the assistant can build a useful memory profile.",
      productivityAdvice: [
        "Use the chat to capture decisions and weekly priorities as memories."
      ],
      projectIdeas: [
        "Create a first project memory so the assistant can suggest better ideas."
      ],
      repeatedThemes: [],
      scores: {
        aiFocus: 0,
        learning: 0,
        productivity: 0,
        startup: 0
      },
      suggestedNextStep:
        "Add three useful memories: a goal, a project, and a work preference.",
      summary: "No saved memories are available yet.",
      topInterests: [],
      totalMemories: 0,
      weeklyFocus: "Build your first useful memory profile."
    };
  }

  const categoryStats = new Map<string, { count: number; importanceTotal: number }>();
  const themeCounts = new Map<string, number>();

  for (const memory of longTermMemories) {
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
  const categoryNames = categories.map((category) => category.name);
  const topInterests = getTopInterests(repeatedThemes, categoryNames);
  const currentGoals = getCurrentGoals(longTermMemories);
  const activity = getActivityInsight(longTermMemories);
  const scores = {
    aiFocus: scoreConcept(longTermMemories, CONCEPT_KEYWORDS.aiFocus),
    learning: scoreConcept(longTermMemories, CONCEPT_KEYWORDS.learning),
    productivity: scoreConcept(longTermMemories, CONCEPT_KEYWORDS.productivity),
    startup: scoreConcept(longTermMemories, CONCEPT_KEYWORDS.startup)
  };
  const topCategory = categories[0]?.name ?? "general";
  const topTheme = getFirstSignal(topInterests, topCategory);
  const topGoal = getFirstSignal(currentGoals, `make progress on ${topTheme}`);
  const weeklyFocus = `This week, focus on ${topGoal}. Keep it visible, narrow, and attached to one deliverable.`;
  const suggestedNextStep = `Choose one action connected to "${topTheme}", finish it, then save what changed as a new memory.`;
  const focusSuggestions = [
    weeklyFocus,
    `Review the "${topCategory}" memories and pick the highest-impact one.`,
    `Spend one focused block improving "${topTheme}" before adding new tasks.`
  ];
  const learningRecommendations = [
    `Learn one practical skill connected to "${topTheme}" and capture the takeaway as a memory.`,
    `Turn one repeated theme into a short reading or practice plan.`,
    `Compare your newest memory with an older one to spot what changed.`
  ];
  const projectIdeas = [
    `Prototype a small workflow around "${topTheme}" that you can demo in one screen.`,
    `Create a lightweight tracker for your "${topCategory}" memories and weekly outcomes.`,
    `Package one repeated problem from your memories into a simple SaaS-style feature.`
  ];
  const productivityAdvice = [
    `Protect one weekly priority: ${topGoal}.`,
    `Convert high-importance memories into tasks, then archive anything vague.`,
    `End each work session by saving one decision, blocker, or next step.`
  ];

  return {
    activity,
    categories,
    currentGoals,
    focusSuggestions,
    learningRecommendations,
    nextAction: suggestedNextStep,
    productivityAdvice,
    projectIdeas,
    repeatedThemes,
    scores,
    suggestedNextStep,
    summary: `I found ${longTermMemories.length} saved long-term ${longTermMemories.length === 1 ? "memory" : "memories"}, with the strongest signal around "${topCategory}".`,
    topInterests,
    totalMemories: longTermMemories.length,
    weeklyFocus
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
    reply: `${insight.summary} Your main categories are ${categories}. Repeated themes: ${themes}. Weekly focus: ${insight.weeklyFocus} Suggested next action: ${insight.suggestedNextStep}`
  };
}

export async function generateChatReply(
  message = "",
  relevantMemories: Memory[] = []
) {
  if (!relevantMemories.length) {
    return "I do not have strong saved memory context for this yet, so I will answer locally without adding this chat prompt to long-term memory.";
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
  if (!shouldSaveAsLongTermMemory(message)) {
    return [];
  }

  const memoryText = cleanDurableMemoryText(message);
  const memoryType = classifyMemoryType(memoryText);
  const confidence = getMemoryConfidence(message, memoryType);

  if (confidence < 0.55) {
    return [];
  }

  return [
    {
      memory_text: memoryText,
      category: getCategoryFromMemoryType(memoryType),
      confidence,
      importance: memoryType === "goal" ? 5 : 4,
      is_archived: false,
      is_pinned: memoryType === "goal",
      is_temporary: false,
      memory_type: memoryType,
      source: "memory"
    }
  ];
}

export function searchMemoriesBeforeReply(memories: Memory[]) {
  return memories;
}
