import { BrainCircuit } from "lucide-react";
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
