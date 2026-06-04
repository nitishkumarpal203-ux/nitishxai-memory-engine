import { NextResponse } from "next/server";
import {
  isAuthRequiredError,
  requireAuthenticatedUser
} from "@/lib/auth/server";
import { isMissingConfigError } from "@/lib/env";
import { listMemories } from "@/lib/memories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("query")?.trim() ?? "";
    const useAiSearch = searchParams.get("ai") === "true";
    const user = await requireAuthenticatedUser(request);

    try {
      const memories = await listMemories({
        limit: 50,
        query,
        semantic: useAiSearch && Boolean(query),
        userId: user.id
      });

      return NextResponse.json({
        aiSearch: useAiSearch && Boolean(query),
        memories,
        searchMode: useAiSearch && query ? "semantic" : "keyword"
      });
    } catch (semanticError) {
      if (!useAiSearch || !query) {
        throw semanticError;
      }

      const memories = await listMemories({ query, limit: 50, userId: user.id });

      return NextResponse.json({
        aiSearch: false,
        memories,
        notice:
          "AI Semantic Search is unavailable right now, so keyword results are shown instead.",
        searchMode: "keyword"
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
