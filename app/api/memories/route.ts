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
