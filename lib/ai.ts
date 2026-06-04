import "server-only";

import type { Memory, MemoryDraft } from "@/types/memory";

function summarizeMemory(memory: Memory) {
  const text = memory.memory_text.trim();

  if (text.length <= 140) {
    return text.replace(/[.!?]+$/, "");
  }

  return `${text.slice(0, 137).trim().replace(/[.!?]+$/, "")}...`;
}

export async function generateChatReply(
  message = "",
  relevantMemories: Memory[] = []
) {
  if (!relevantMemories.length) {
    return "Memory saved successfully. I will keep this in mind for future replies.";
  }

  const strongestMemory = summarizeMemory(relevantMemories[0]);
  const extraCount = relevantMemories.length - 1;
  const contextLine = extraCount
    ? ` and ${extraCount} other related ${extraCount === 1 ? "memory" : "memories"}`
    : "";
  const messageHint = message.trim()
    ? "I connected your new note with this saved memory"
    : "I used this saved memory";

  return `Memory saved successfully. ${messageHint}: "${strongestMemory}"${contextLine}. I will tailor future replies around that context.`;
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
