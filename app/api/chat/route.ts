import { NextResponse } from "next/server";
import {
  isAuthRequiredError,
  requireAuthenticatedUser
} from "@/lib/auth/server";
import { generateChatReply } from "@/lib/ai";
import { isMissingConfigError } from "@/lib/env";
import { findRelevantMemories, saveMemory } from "@/lib/memories";
import type { Memory } from "@/types/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: unknown };
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

    try {
      relevantMemories = await findRelevantMemories(user.id, message, 3);
    } catch {
      relevantMemories = [];
    }

    const reply = await generateChatReply(message, relevantMemories);
    const savedMemory = await saveMemory(user.id, message);

    return NextResponse.json(
      {
        relevantMemories,
        reply,
        savedMemories: [savedMemory],
        saved: true
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
