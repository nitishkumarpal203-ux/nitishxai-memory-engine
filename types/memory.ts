export type Memory = {
  id: string;
  user_id: string;
  memory_text: string;
  category: string;
  importance: number;
  created_at: string;
  similarity?: number | null;
};

export type MemoryDraft = {
  memory_text: string;
  category: string;
  importance: number;
};

export type MemoryUpdate = {
  memory_text: string;
  category: string;
  importance: number;
};

export type MemoryInsight = {
  categories: Array<{
    averageImportance: number;
    count: number;
    name: string;
  }>;
  nextAction: string;
  repeatedThemes: string[];
  summary: string;
  totalMemories: number;
};
