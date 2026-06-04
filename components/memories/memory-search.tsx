"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CalendarDays,
  Database,
  Pencil,
  Loader2,
  Save,
  Search,
  SignalHigh,
  Trash2,
  X
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import type { Memory } from "@/types/memory";

type MemoriesResponse = {
  aiSearch?: boolean;
  memories?: Memory[];
  notice?: string;
  error?: string;
  searchMode?: "keyword" | "semantic";
};

type DeleteMemoryResponse = {
  deleted?: boolean;
  error?: string;
};

type UpdateMemoryResponse = {
  memory?: Memory | null;
  updated?: boolean;
  error?: string;
};

const formatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short"
});

export function MemorySearch() {
  const { accessToken } = useAuth();
  const [query, setQuery] = useState("");
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isSemanticSearch, setIsSemanticSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Memory | null>(null);
  const [editingMemory, setEditingMemory] = useState<Memory | null>(null);
  const [editMemoryText, setEditMemoryText] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editImportance, setEditImportance] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchMemories = useCallback(async (searchQuery = "", semanticEnabled = false) => {
    setIsLoading(true);
    setError(null);
    setNotice(null);

    try {
      if (!accessToken) {
        throw new Error("Please sign in to view memories.");
      }

      const params = new URLSearchParams();
      const trimmedQuery = searchQuery.trim();

      if (trimmedQuery) {
        params.set("query", trimmedQuery);
      }

      if (semanticEnabled && trimmedQuery) {
        params.set("semantic", "true");
      }

      const endpoint = params.toString()
        ? `/api/memories?${params.toString()}`
        : "/api/memories";
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      const data = (await response.json()) as MemoriesResponse;

      if (!response.ok || data.error) {
        throw new Error(data.error ?? "Memories could not be loaded.");
      }

      setMemories(data.memories ?? []);
      setNotice(data.notice ?? null);
    } catch (requestError) {
      setMemories([]);
      setNotice(null);
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Memories could not be loaded."
      );
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void fetchMemories();
  }, [fetchMemories]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void fetchMemories(query, isSemanticSearch);
  }

  function handleSemanticSearchToggle() {
    const nextValue = !isSemanticSearch;

    setIsSemanticSearch(nextValue);
    void fetchMemories(query, nextValue);
  }

  function openEditModal(memory: Memory) {
    setError(null);
    setEditingMemory(memory);
    setEditMemoryText(memory.memory_text);
    setEditCategory(memory.category);
    setEditImportance(memory.importance);
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingMemory || updatingId) {
      return;
    }

    if (!accessToken) {
      setError("Please sign in to update memories.");
      return;
    }

    const memoryText = editMemoryText.trim();
    const category = editCategory.trim() || "general";
    const importance = Math.min(5, Math.max(1, Math.round(editImportance)));

    if (!memoryText) {
      setError("Memory text is required.");
      return;
    }

    setUpdatingId(editingMemory.id);
    setError(null);

    try {
      const response = await fetch(`/api/memories/${editingMemory.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          category,
          importance,
          memory_text: memoryText
        })
      });
      const data = (await response.json()) as UpdateMemoryResponse;

      if (!response.ok || data.error || data.updated === false || !data.memory) {
        throw new Error(data.error ?? "Memory could not be updated.");
      }

      setMemories((current) =>
        current.map((memory) =>
          memory.id === data.memory?.id ? data.memory : memory
        )
      );
      setEditingMemory(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Memory could not be updated."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!pendingDelete || deletingId) {
      return;
    }

    if (!accessToken) {
      setError("Please sign in to delete memories.");
      return;
    }

    const memoryToDelete = pendingDelete;

    setPendingDelete(null);
    setDeletingId(memoryToDelete.id);
    setError(null);
    setMemories((current) =>
      current.filter((memory) => memory.id !== memoryToDelete.id)
    );

    try {
      const response = await fetch(`/api/memories/${memoryToDelete.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      const data = (await response.json()) as DeleteMemoryResponse;

      if (!response.ok || data.error || data.deleted === false) {
        throw new Error(data.error ?? "Memory could not be deleted.");
      }
    } catch (requestError) {
      setMemories((current) =>
        current.some((memory) => memory.id === memoryToDelete.id)
          ? current
          : [memoryToDelete, ...current]
      );
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Memory could not be deleted."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="rounded-lg border border-cyan-300/15 bg-slate-900/76 p-4 shadow-2xl shadow-cyan-950/30 backdrop-blur sm:p-5">
      <div className="flex flex-col gap-4 border-b border-cyan-300/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
            <Database className="h-4 w-4 text-cyan-300" aria-hidden="true" />
            Supabase memories
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Keyword or semantic vector search from{" "}
            <span className="text-cyan-300">/api/memories</span>
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex w-full flex-col gap-3 lg:max-w-2xl">
          <label className="sr-only" htmlFor="memory-search">
            Semantic search memories
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input
                id="memory-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  isSemanticSearch
                    ? "Semantic search by meaning, like future tech or business ideas..."
                    : "Search memory_text..."
                }
                className="h-11 w-full rounded-md border border-cyan-300/20 bg-slate-950/80 py-2 pl-10 pr-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:shadow-[0_0_0_3px_rgba(103,232,249,0.12)]"
              />
            </div>
            <button
              type="button"
              onClick={handleSemanticSearchToggle}
              className={`inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md border px-4 text-sm font-semibold transition ${
                isSemanticSearch
                  ? "border-violet-300/50 bg-violet-300 text-slate-950 shadow-[0_0_24px_rgba(196,181,253,0.18)]"
                  : "border-violet-300/20 bg-violet-400/10 text-violet-100 hover:border-violet-300/45 hover:bg-violet-400/20"
              }`}
              aria-pressed={isSemanticSearch}
            >
              <BrainCircuit className="h-4 w-4" aria-hidden="true" />
              Semantic Search
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="h-4 w-4" aria-hidden="true" />
              )}
              Search
            </button>
          </div>
        </form>
      </div>

      {notice ? (
        <div className="mt-5 rounded-md border border-violet-300/20 bg-violet-950/25 px-4 py-3 text-sm leading-6 text-violet-100">
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="mt-5 rounded-md border border-red-300/20 bg-red-950/30 px-4 py-3 text-sm leading-6 text-red-100">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-5 flex min-h-56 items-center justify-center rounded-lg border border-cyan-300/10 bg-slate-950/50 text-sm text-slate-400">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-cyan-300" aria-hidden="true" />
          Loading memories...
        </div>
      ) : memories.length ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {memories.map((memory) => (
            <article
              key={memory.id}
              className="rounded-lg border border-cyan-300/15 bg-slate-950/72 p-4 shadow-xl shadow-slate-950/30 transition hover:border-cyan-300/35"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                    {memory.category}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
                    <SignalHigh className="h-3.5 w-3.5" aria-hidden="true" />
                    {memory.importance}/5
                  </span>
                  {typeof memory.similarity === "number" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-violet-300/20 bg-violet-300/10 px-2.5 py-1 text-xs font-semibold text-violet-200">
                      <BrainCircuit className="h-3.5 w-3.5" aria-hidden="true" />
                      {Math.round(Math.max(0, memory.similarity) * 100)}% match
                    </span>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(memory)}
                    disabled={Boolean(updatingId) || deletingId === memory.id}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-violet-300/20 bg-violet-400/10 text-violet-200 transition hover:border-violet-300/45 hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Edit memory"
                    title="Edit memory"
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete(memory)}
                    disabled={deletingId === memory.id || updatingId === memory.id}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-300/20 bg-red-400/10 text-red-200 transition hover:border-red-300/45 hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Delete memory"
                    title="Delete memory"
                  >
                    {deletingId === memory.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <p className="mt-4 min-h-24 text-sm leading-6 text-slate-100">
                {memory.memory_text}
              </p>

              <div className="mt-5 flex items-center gap-2 border-t border-cyan-300/10 pt-3 text-xs text-slate-500">
                <CalendarDays className="h-3.5 w-3.5 text-violet-300" aria-hidden="true" />
                <time dateTime={memory.created_at}>
                  {formatter.format(new Date(memory.created_at))}
                </time>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-lg border border-dashed border-cyan-300/20 bg-slate-950/50 px-4 py-12 text-center">
          <p className="text-sm font-medium text-slate-200">No memories found.</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Send a chat message first, then refresh this dashboard.
          </p>
        </div>
      )}

      {editingMemory ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-memory-title"
        >
          <form
            onSubmit={handleEditSubmit}
            className="w-full max-w-lg rounded-lg border border-violet-300/20 bg-slate-950 p-4 shadow-2xl shadow-violet-950/40 sm:p-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-violet-300/20 bg-violet-400/10 text-violet-200">
                  <Pencil className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 id="edit-memory-title" className="text-base font-semibold text-white">
                    Edit memory
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Update the saved text, category, and priority.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingMemory(null)}
                disabled={Boolean(updatingId)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-cyan-300/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close edit dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label htmlFor="edit-memory-text" className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                  memory_text
                </label>
                <textarea
                  id="edit-memory-text"
                  value={editMemoryText}
                  onChange={(event) => setEditMemoryText(event.target.value)}
                  disabled={Boolean(updatingId)}
                  className="mt-2 min-h-32 w-full resize-none rounded-md border border-cyan-300/20 bg-slate-900/80 px-3 py-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:shadow-[0_0_0_3px_rgba(103,232,249,0.12)] disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_140px]">
                <div>
                  <label htmlFor="edit-category" className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                    category
                  </label>
                  <input
                    id="edit-category"
                    value={editCategory}
                    onChange={(event) => setEditCategory(event.target.value)}
                    disabled={Boolean(updatingId)}
                    className="mt-2 h-11 w-full rounded-md border border-cyan-300/20 bg-slate-900/80 px-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:shadow-[0_0_0_3px_rgba(103,232,249,0.12)] disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </div>

                <div>
                  <label htmlFor="edit-importance" className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                    importance
                  </label>
                  <input
                    id="edit-importance"
                    type="number"
                    min={1}
                    max={5}
                    value={editImportance}
                    onChange={(event) => setEditImportance(Number(event.target.value))}
                    disabled={Boolean(updatingId)}
                    className="mt-2 h-11 w-full rounded-md border border-cyan-300/20 bg-slate-900/80 px-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/60 focus:shadow-[0_0_0_3px_rgba(103,232,249,0.12)] disabled:cursor-not-allowed disabled:opacity-70"
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setEditingMemory(null)}
                disabled={Boolean(updatingId)}
                className="inline-flex h-11 items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/35 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={Boolean(updatingId) || !editMemoryText.trim()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-violet-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {updatingId ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="h-4 w-4" aria-hidden="true" />
                )}
                Save changes
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {pendingDelete ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-memory-title"
        >
          <div className="w-full max-w-md rounded-lg border border-red-300/20 bg-slate-950 p-4 shadow-2xl shadow-red-950/40 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-red-300/20 bg-red-400/10 text-red-200">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 id="delete-memory-title" className="text-base font-semibold text-white">
                    Delete memory?
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    This will remove the memory from Supabase.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-cyan-300/40 hover:text-white"
                aria-label="Close confirmation dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <p className="mt-4 line-clamp-3 rounded-md border border-cyan-300/10 bg-slate-900/80 p-3 text-sm leading-6 text-slate-200">
              {pendingDelete.memory_text}
            </p>

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="inline-flex h-11 items-center justify-center rounded-md border border-slate-700 bg-slate-900 px-4 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/35 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={Boolean(deletingId)}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-red-400 px-4 text-sm font-semibold text-slate-950 transition hover:bg-red-300 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {deletingId ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                )}
                Delete memory
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
