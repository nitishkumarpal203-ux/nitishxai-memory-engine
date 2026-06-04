import type { Metadata } from "next";
import { AuthGuard } from "@/components/auth/auth-guard";
import { MemoryGraph } from "@/components/graph/memory-graph";

export const metadata: Metadata = {
  description:
    "Explore private Supabase memories as an interactive local relationship graph.",
  title: "Memory Graph"
};

export default function GraphPage() {
  return (
    <div className="relative min-h-[calc(100vh-81px)] overflow-hidden bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(34,211,238,0.18),transparent_28rem),radial-gradient(circle_at_84%_10%,rgba(139,92,246,0.2),transparent_24rem),linear-gradient(180deg,#020617_0%,#0f172a_100%)]" />

      <section className="relative mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
            Memory Topology
          </p>
          <h1 className="text-3xl font-semibold tracking-normal text-white sm:text-4xl">
            AI Memory Graph
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
            Visualize how saved memories cluster by category, keywords, and local
            semantic similarity. Click any node to inspect the memory.
          </p>
        </div>

        <AuthGuard>
          <MemoryGraph />
        </AuthGuard>
      </section>
    </div>
  );
}
