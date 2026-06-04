import { NextResponse } from "next/server";
import {
  isAuthRequiredError,
  requireAuthenticatedUser
} from "@/lib/auth/server";
import { generateMemoryInsights } from "@/lib/ai";
import { isMissingConfigError } from "@/lib/env";
import { listMemories } from "@/lib/memories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireAuthenticatedUser(request);
    const memories = await listMemories({ limit: 150, userId: user.id });
    const insight = generateMemoryInsights(memories);

    return NextResponse.json({ insight }, { status: 200 });
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json(
        {
          error: "Please sign in to view AI insights.",
          insight: null
        },
        { status: 401 }
      );
    }

    const message = isMissingConfigError(error)
      ? "Missing Supabase configuration. Check your environment variables."
      : "AI insights could not be loaded.";

    return NextResponse.json(
      {
        error: message,
        insight: null
      },
      { status: 200 }
    );
  }
}
