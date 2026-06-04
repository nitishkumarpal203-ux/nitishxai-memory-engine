import type { Metadata } from "next";
import { AuthGuard } from "@/components/auth/auth-guard";
import { MemorySearch } from "@/components/memories/memory-search";

export const metadata: Metadata = {
  description:
    "Browse, search, edit, and delete private Supabase memories with local semantic ranking.",
  title: "Memories"
};

export default function MemoriesPage() {
  return (
    <div className="relative min-h-[calc(100vh-81px)] overflow-hidden bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(20,184,166,0.22),transparent_26rem),radial-gradient(circle_at_86%_8%,rgba(139,92,246,0.2),transparent_24rem),linear-gradient(180deg,#020617_0%,#0f172a_100%)]" />

      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
            Memory Archive
          </p>
          <h1 className="text-3xl font-semibold tracking-normal text-white sm:text-4xl">
            Memories Dashboard
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
            Browse, search, and inspect saved long-term, pinned, temporary, and
            archived memories.
          </p>
        </div>

        <AuthGuard>
          <MemorySearch />
        </AuthGuard>
      </section>
    </div>
  );
}
