import { NextResponse } from "next/server";
import {
  isAuthRequiredError,
  requireAuthenticatedUser
} from "@/lib/auth/server";
import { isMissingConfigError } from "@/lib/env";
import { deleteMemory, updateMemory } from "@/lib/memories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanMemoryPayload(body: unknown) {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const memoryText =
    typeof record.memory_text === "string" ? record.memory_text.trim() : "";
  const category =
    typeof record.category === "string" && record.category.trim()
      ? record.category.trim()
      : "general";
  const rawImportance =
    typeof record.importance === "number"
      ? record.importance
      : Number(record.importance);
  const importance = Number.isFinite(rawImportance)
    ? Math.min(5, Math.max(1, Math.round(rawImportance)))
    : 5;

  return {
    category,
    importance,
    memory_text: memoryText
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id?.trim();

    if (!id) {
      return NextResponse.json(
        {
          error: "Memory id is required.",
          memory: null,
          updated: false
        },
        { status: 400 }
      );
    }

    const user = await requireAuthenticatedUser(request);
    const payload = cleanMemoryPayload(await request.json());

    if (!payload.memory_text) {
      return NextResponse.json(
        {
          error: "Memory text is required.",
          memory: null,
          updated: false
        },
        { status: 400 }
      );
    }

    const memory = await updateMemory(user.id, id, payload);

    if (!memory) {
      return NextResponse.json(
        {
          error: "Memory not found.",
          memory: null,
          updated: false
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        memory,
        updated: true
      },
      { status: 200 }
    );
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json(
        {
          error: "Please sign in to update memories.",
          memory: null,
          updated: false
        },
        { status: 401 }
      );
    }

    const message = isMissingConfigError(error)
      ? "Missing Supabase configuration. Check .env.local and restart the dev server."
      : "Memory could not be updated.";

    return NextResponse.json(
      {
        error: message,
        memory: null,
        updated: false
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id?.trim();

    if (!id) {
      return NextResponse.json(
        {
          deleted: false,
          error: "Memory id is required."
        },
        { status: 400 }
      );
    }

    const user = await requireAuthenticatedUser(request);
    const deleted = await deleteMemory(user.id, id);

    if (!deleted) {
      return NextResponse.json(
        {
          deleted: false,
          error: "Memory not found."
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        deleted: true,
        id
      },
      { status: 200 }
    );
  } catch (error) {
    if (isAuthRequiredError(error)) {
      return NextResponse.json(
        {
          deleted: false,
          error: "Please sign in to delete memories."
        },
        { status: 401 }
      );
    }

    const message = isMissingConfigError(error)
      ? "Missing Supabase configuration. Check .env.local and restart the dev server."
      : "Memory could not be deleted.";

    return NextResponse.json(
      {
        deleted: false,
        error: message
      },
      { status: 500 }
    );
  }
}
