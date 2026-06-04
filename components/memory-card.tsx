import { Archive, BrainCircuit, Pin, Timer } from "lucide-react";
import type { Memory } from "@/types/memory";

const formatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short"
});

export function MemoryCard({
  memory,
  compact = false
}: {
  memory: Memory;
  compact?: boolean;
}) {
  return (
    <article className="rounded-md border border-cyan-300/15 bg-slate-950/72 p-3 shadow-lg shadow-slate-950/25">
      <div className="flex items-start justify-between gap-3">
        <p
          className={[
            "font-medium leading-6 text-slate-100",
            compact ? "text-sm" : "text-base"
          ].join(" ")}
        >
          {memory.memory_text}
        </p>
        <span className="shrink-0 rounded-md border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-xs font-semibold text-amber-200">
          {memory.importance}/5
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-xs font-medium text-cyan-200">
          {memory.category}
        </span>
        <span className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-xs font-medium text-emerald-200">
          {memory.memory_type}
        </span>
        <span className="rounded-md border border-slate-500/30 bg-slate-500/10 px-2 py-1 text-xs font-medium text-slate-300">
          {Math.round(memory.confidence * 100)}% confidence
        </span>
        {memory.is_pinned ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-xs font-medium text-amber-200">
            <Pin className="h-3 w-3" aria-hidden="true" />
            pinned
          </span>
        ) : null}
        {memory.is_archived ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-400/20 bg-slate-400/10 px-2 py-1 text-xs font-medium text-slate-300">
            <Archive className="h-3 w-3" aria-hidden="true" />
            archived
          </span>
        ) : null}
        {memory.is_temporary ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-violet-300/20 bg-violet-300/10 px-2 py-1 text-xs font-medium text-violet-200">
            <Timer className="h-3 w-3" aria-hidden="true" />
            temporary
          </span>
        ) : null}
        {typeof memory.similarity === "number" ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-violet-300/20 bg-violet-300/10 px-2 py-1 text-xs font-medium text-violet-200">
            <BrainCircuit className="h-3 w-3" aria-hidden="true" />
            {Math.round(Math.max(0, memory.similarity) * 100)}% match
          </span>
        ) : null}
      </div>

      <div className="mt-3 border-t border-cyan-300/10 pt-3 text-xs leading-5 text-slate-500">
        <p>{formatter.format(new Date(memory.created_at))}</p>
      </div>
    </article>
  );
}
