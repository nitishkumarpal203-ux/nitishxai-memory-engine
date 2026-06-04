import { NextResponse } from "next/server";
import {
  isAuthRequiredError,
  requireAuthenticatedUser
} from "@/lib/auth/server";
import { isMissingConfigError } from "@/lib/env";
import { listMemories, saveMemories } from "@/lib/memories";
import type { MemoryDraft, MemoryType } from "@/types/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const memoryTypes: MemoryType[] = [
  "goal",
  "learning",
  "startup",
  "productivity",
  "idea"
];

function clampImportance(value: unknown) {
  const importance = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(importance)) {
    return 5;
  }

  return Math.min(5, Math.max(1, Math.round(importance)));
}

function normalizeMemoryType(value: unknown): MemoryType {
  return memoryTypes.includes(value as MemoryType) ? (value as MemoryType) : "idea";
}

function getCreateMemoryDraft(body: unknown): MemoryDraft {
  const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const memoryText =
    typeof record.memory_text === "string" ? record.memory_text.trim() : "";
  const category =
    typeof record.category === "string" && record.category.trim()
      ? record.category.trim()
      : "general";
  const memoryType = normalizeMemoryType(record.memory_type);

  return {
    memory_text: memoryText,
    category,
    confidence: 0.95,
    importance: clampImportance(record.importance),
    is_archived: false,
    is_pinned: Boolean(record.is_pinned),
    is_temporary: false,
    memory_type: memoryType,
    source: "memory"
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query")?.trim() ?? "";
    const requestedStatus = searchParams.get("status");
    const status =
      requestedStatus === "all" ||
      requestedStatus === "archived" ||
      requestedStatus === "pinned" ||
      requestedStatus === "temporary"
        ? requestedStatus
        : "active";
    const useSemanticSearch =
      searchParams.get("semantic") === "true" || searchParams.get("ai") === "true";
    const user = await requireAuthenticatedUser(request);

    try {
      const memories = await listMemories({
        limit: 50,
        query,
        semantic: status === "active" && useSemanticSearch && Boolean(query),
        status,
        userId: user.id
      });

      return NextResponse.json({
        aiSearch: useSemanticSearch && Boolean(query),
        memories,
        searchMode: status === "active" && useSemanticSearch && query
          ? "semantic"
          : "keyword",
        status
      });
    } catch (semanticError) {
      if (!useSemanticSearch || !query) {
        throw semanticError;
      }

      const memories = await listMemories({ query, limit: 50, status, userId: user.id });

      return NextResponse.json({
        aiSearch: false,
        memories,
        notice:
          "Semantic vector search is unavailable right now, so keyword results are shown instead.",
        searchMode: "keyword",
        status
      });
    }
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json(
        {
          error: "Please sign in to view memories.",
          memories: []
        },
        { status: 401 }
      );
    }

    const message = isMissingConfigError(error)
      ? "Missing Supabase configuration. Check .env.local and restart the dev server."
      : "Memories could not be loaded.";

    return NextResponse.json({ error: message, memories: [] }, { status: 200 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const draft = getCreateMemoryDraft(await request.json());

    if (!draft.memory_text) {
      return NextResponse.json(
        {
          created: false,
          error: "Memory text is required."
        },
        { status: 400 }
      );
    }

    const [memory] = await saveMemories(user.id, [draft]);

    return NextResponse.json(
      {
        created: true,
        memory
      },
      { status: 201 }
    );
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json(
        {
          created: false,
          error: "Please sign in to add memories."
        },
        { status: 401 }
      );
    }

    const message = isMissingConfigError(error)
      ? "Missing Supabase configuration. Check .env.local and restart the dev server."
      : "Memory could not be saved.";

    return NextResponse.json(
      {
        created: false,
        error: message
      },
      { status: 500 }
    );
  }
}
