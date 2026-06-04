import { NextResponse } from "next/server";
import {
  isAuthRequiredError,
  requireAuthenticatedUser
} from "@/lib/auth/server";
import {
  extractLongTermMemories,
  generateChatReply,
  generateMemoryInsightReply
} from "@/lib/ai";
import { isMissingConfigError } from "@/lib/env";
import { findRelevantMemories, listMemories, saveMemories } from "@/lib/memories";
import type { Memory } from "@/types/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isInsightRequest(message: string, mode?: unknown) {
  if (mode === "insight") {
    return true;
  }

  return /memory insight|summarize my memories|summarise my memories|summary of my memories/i.test(
    message
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: unknown; mode?: unknown };
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json(
        {
          error: "Send a non-empty message.",
          saved: false
        },
        { status: 400 }
      );
    }

    let relevantMemories: Memory[] = [];
    const user = await requireAuthenticatedUser(request);
    const useInsightMode = isInsightRequest(message, body.mode);

    try {
      relevantMemories = await findRelevantMemories(user.id, message, 5);
    } catch {
      relevantMemories = [];
    }

    let reply = await generateChatReply(message, relevantMemories);
    let insight = null;

    if (useInsightMode) {
      let memoriesForInsight: Memory[] = [];

      try {
        memoriesForInsight = await listMemories({ limit: 100, userId: user.id });
      } catch {
        memoriesForInsight = relevantMemories;
      }

      const insightResult = generateMemoryInsightReply(memoriesForInsight);

      insight = insightResult.insight;
      reply = insightResult.reply;
      relevantMemories = relevantMemories.length
        ? relevantMemories
        : memoriesForInsight.slice(0, 5);
    }

    const memoryDrafts = await extractLongTermMemories(message);
    const savedMemories = await saveMemories(user.id, memoryDrafts);

    return NextResponse.json(
      {
        insight,
        mode: useInsightMode ? "insight" : "chat",
        relevantMemories,
        reply,
        saved: savedMemories.length > 0,
        savedMemories
      },
      { status: 200 }
    );
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json(
        {
          error: "Please sign in to save memories.",
          saved: false
        },
        { status: 401 }
      );
    }

    const message = isMissingConfigError(error)
      ? "Missing Supabase configuration. Check .env.local and restart the dev server."
      : "Memory could not be saved. Check your Supabase memories table.";

    return NextResponse.json(
      {
        error: message,
        saved: false
      },
      { status: 200 }
    );
  }
}
