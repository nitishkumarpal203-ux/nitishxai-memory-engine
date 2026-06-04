export type MemoryType =
  | "goal"
  | "learning"
  | "startup"
  | "productivity"
  | "idea";

export type Memory = {
  id: string;
  user_id: string;
  memory_text: string;
  category: string;
  importance: number;
  created_at: string;
  confidence: number;
  is_archived: boolean;
  is_pinned: boolean;
  is_temporary: boolean;
  memory_type: MemoryType;
  similarity?: number | null;
};

export type MemoryDraft = {
  memory_text: string;
  category: string;
  confidence: number;
  importance: number;
  is_archived?: boolean;
  is_pinned?: boolean;
  is_temporary?: boolean;
  memory_type: MemoryType;
};

export type MemoryUpdate = {
  memory_text: string;
  category: string;
  confidence: number;
  importance: number;
  is_archived: boolean;
  is_pinned: boolean;
  is_temporary: boolean;
  memory_type: MemoryType;
};

export type MemoryInsight = {
  activity: {
    activeDays: number;
    lastMemoryAt: string | null;
    memoriesThisWeek: number;
    streakDays: number;
    totalMemories: number;
  };
  categories: Array<{
    averageImportance: number;
    count: number;
    name: string;
  }>;
  currentGoals: string[];
  focusSuggestions: string[];
  learningRecommendations: string[];
  nextAction: string;
  productivityAdvice: string[];
  projectIdeas: string[];
  repeatedThemes: string[];
  scores: {
    aiFocus: number;
    learning: number;
    productivity: number;
    startup: number;
  };
  suggestedNextStep: string;
  summary: string;
  topInterests: string[];
  totalMemories: number;
  weeklyFocus: string;
};
