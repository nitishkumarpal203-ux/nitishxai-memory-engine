"use client";

import {
  CalendarCheck,
  CheckCircle2,
  Circle,
  ClipboardList,
  History,
  Loader2,
  RefreshCw,
  Rocket,
  Route,
  Sparkles,
  Target,
  TrendingUp
} from "lucide-react";
import { useMemo } from "react";
import type { Memory, MemoryInsight } from "@/types/memory";

type AgentTask = {
  detail: string;
  id: string;
  pillar: "Focus" | "Learning" | "Startup" | "Productivity" | "Memory";
  source?: string;
  title: string;
};

type AgentTimelineItem = {
  category: string;
  dateLabel: string;
  id: string;
  importance: number;
  text: string;
};

type AgentPlan = {
  dailyFocus: string;
  learningRoadmap: string[];
  memorySummary: string;
  recentChange: string;
  recurringThemes: string[];
  startupOpportunities: string[];
  tasks: AgentTask[];
  timeline: AgentTimelineItem[];
  weeklyGoals: string[];
};

type AgentPanelProps = {
  completedTaskIds: string[];
  error: string | null;
  insight: MemoryInsight | null;
  isEnabled: boolean;
  isLoading: boolean;
  memories: Memory[];
  onRefresh: () => void;
  onToggleTask: (taskId: string) => void;
};

const taskDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium"
});

const AGENT_STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "because",
  "before",
  "being",
  "could",
  "every",
  "from",
  "have",
  "into",
  "just",
  "like",
  "make",
  "more",
  "need",
  "that",
  "their",
  "there",
  "this",
  "want",
  "what",
  "when",
  "with",
  "would",
  "your"
]);

function summarizeText(text: string, maxLength = 120) {
  const cleaned = text.trim().replace(/\s+/g, " ");

  if (cleaned.length <= maxLength) {
    return cleaned.replace(/[.!?]+$/, "");
  }

  return `${cleaned.slice(0, maxLength - 3).trim().replace(/[.!?]+$/, "")}...`;
}

function tokenize(text: string) {
  return (
    text
      .toLowerCase()
      .match(/[a-z0-9][a-z0-9-]{2,}/g)
      ?.filter((term) => !AGENT_STOP_WORDS.has(term) && !/^\d+$/.test(term)) ?? []
  );
}

function uniqueItems(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function slugText(text: string) {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 46) || "task"
  );
}

function createTask(task: Omit<AgentTask, "id">): AgentTask {
  return {
    ...task,
    id: `${task.pillar.toLowerCase()}-${slugText(task.title)}-${slugText(
      task.detail
    )}`
  };
}

function getDateMs(memory: Memory) {
  const value = new Date(memory.created_at).getTime();

  return Number.isFinite(value) ? value : 0;
}

function sortNewest(memories: Memory[]) {
  return [...memories].sort((a, b) => getDateMs(b) - getDateMs(a));
}

function getTopTerms(memories: Memory[], limit = 5) {
  const counts = new Map<string, number>();

  for (const memory of memories) {
    for (const term of tokenize(`${memory.memory_text} ${memory.category}`)) {
      counts.set(term, (counts.get(term) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([term]) => term);
}

function getRecentMemories(memories: Memory[], dayWindow: number) {
  const cutoff = Date.now() - dayWindow * 86_400_000;

  return memories.filter((memory) => getDateMs(memory) >= cutoff);
}

function getRecentChange(memories: Memory[]) {
  const recent = getRecentMemories(memories, 14);
  const older = memories.filter((memory) => !recent.includes(memory));

  if (!recent.length) {
    return "No new memories were saved in the last two weeks. The agent is holding the existing plan steady.";
  }

  const recentCategories = uniqueItems(recent.map((memory) => memory.category));
  const olderCategories = new Set(older.map((memory) => memory.category));
  const newCategories = recentCategories.filter(
    (category) => !olderCategories.has(category)
  );
  const recentTerms = getTopTerms(recent, 4);
  const olderTerms = new Set(getTopTerms(older, 20));
  const freshThemes = recentTerms.filter((term) => !olderTerms.has(term));

  if (newCategories.length || freshThemes.length) {
    return `Recently, the strongest shift is toward ${uniqueItems([
      ...newCategories,
      ...freshThemes
    ])
      .slice(0, 3)
      .join(", ")}. ${recent.length} new ${
      recent.length === 1 ? "memory" : "memories"
    } support that change.`;
  }

  return `${recent.length} recent ${
    recent.length === 1 ? "memory repeats" : "memories repeat"
  } your existing direction: ${recentCategories.slice(0, 3).join(", ")}.`;
}

function getTimeline(memories: Memory[]): AgentTimelineItem[] {
  return sortNewest(memories)
    .slice(0, 6)
    .map((memory) => {
      const date = new Date(memory.created_at);

      return {
        category: memory.category,
        dateLabel: Number.isFinite(date.getTime())
          ? taskDateFormatter.format(date)
          : "Unknown date",
        id: memory.id,
        importance: memory.importance,
        text: summarizeText(memory.memory_text, 92)
      };
    });
}

function buildAgentPlan(memories: Memory[], insight: MemoryInsight | null): AgentPlan {
  const topCategory = insight?.categories[0]?.name ?? memories[0]?.category ?? "general";
  const topTheme =
    insight?.topInterests[0] ??
    insight?.repeatedThemes[0] ??
    topCategory ??
    "memory system";
  const newestMemory = sortNewest(memories)[0];
  const highImpactMemory = [...memories].sort((a, b) => {
    if (b.importance !== a.importance) {
      return b.importance - a.importance;
    }

    return getDateMs(b) - getDateMs(a);
  })[0];
  const memorySummary =
    insight?.summary ??
    (memories.length
      ? `I found ${memories.length} saved memories. The clearest local signal is ${topCategory}.`
      : "No saved memories are available yet.");
  const dailyFocus =
    insight?.suggestedNextStep ??
    "Save one current priority, then ask the assistant for a focused next step.";
  const weeklyGoals = uniqueItems([
    ...(insight?.focusSuggestions ?? []),
    ...(insight?.currentGoals ?? [])
  ]).slice(0, 4);
  const learningRoadmap = (
    insight?.learningRecommendations.length
      ? insight.learningRecommendations
      : [
          `Map one skill connected to "${topTheme}".`,
          "Practice it in a tiny project.",
          "Save the result as a memory."
        ]
  ).slice(0, 4);
  const startupOpportunities = (
    insight?.projectIdeas.length
      ? insight.projectIdeas
      : [
          `Turn "${topTheme}" into a one-screen workflow prototype.`,
          `Look for a repeated problem inside your "${topCategory}" memories.`
        ]
  ).slice(0, 4);
  const recurringThemes = uniqueItems([
    ...(insight?.repeatedThemes ?? []),
    ...(insight?.topInterests ?? [])
  ]).slice(0, 6);
  const tasks = [
    createTask({
      detail: dailyFocus,
      pillar: "Focus",
      title: "Act on today's focus"
    }),
    createTask({
      detail:
        weeklyGoals[0] ??
        `Review "${topCategory}" memories and choose one concrete weekly goal.`,
      pillar: "Productivity",
      title: "Lock the weekly goal"
    }),
    createTask({
      detail: learningRoadmap[0] ?? `Create a practice loop for "${topTheme}".`,
      pillar: "Learning",
      title: "Start the learning loop"
    }),
    createTask({
      detail:
        startupOpportunities[0] ??
        `Prototype one small opportunity around "${topTheme}".`,
      pillar: "Startup",
      title: "Prototype an opportunity"
    }),
    createTask({
      detail: newestMemory
        ? `Summarize what changed after: "${summarizeText(
            newestMemory.memory_text,
            86
          )}".`
        : "Save a short recap of what changed this week.",
      pillar: "Memory",
      source: newestMemory?.category,
      title: "Save a recent-change recap"
    })
  ];

  if (highImpactMemory) {
    tasks.push(
      createTask({
        detail: `Convert this high-importance memory into an outcome: "${summarizeText(
          highImpactMemory.memory_text,
          86
        )}".`,
        pillar: "Focus",
        source: highImpactMemory.category,
        title: "Convert high-signal memory"
      })
    );
  }

  return {
    dailyFocus,
    learningRoadmap,
    memorySummary,
    recentChange: getRecentChange(memories),
    recurringThemes,
    startupOpportunities,
    tasks,
    timeline: getTimeline(memories),
    weeklyGoals
  };
}

function AgentList({
  emptyText,
  items
}: {
  emptyText: string;
  items: string[];
}) {
  if (!items.length) {
    return <p className="text-xs leading-5 text-slate-500">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.slice(0, 4).map((item) => (
        <li key={item} className="text-xs leading-5 text-slate-300">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function AgentPanel({
  completedTaskIds,
  error,
  insight,
  isEnabled,
  isLoading,
  memories,
  onRefresh,
  onToggleTask
}: AgentPanelProps) {
  const plan = useMemo(() => buildAgentPlan(memories, insight), [insight, memories]);
  const completedSet = useMemo(
    () => new Set(completedTaskIds),
    [completedTaskIds]
  );
  const completedCount = plan.tasks.filter((task) => completedSet.has(task.id)).length;
  const progress = plan.tasks.length
    ? Math.round((completedCount / plan.tasks.length) * 100)
    : 0;

  return (
    <section className="rounded-lg border border-cyan-300/15 bg-slate-900/76 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-cyan-100">AI Tasks</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            {isEnabled
              ? "Autonomous local planning from saved memories."
              : "Agent mode is paused."}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-cyan-300/20 bg-cyan-300/10 text-cyan-100 transition hover:border-cyan-300/45 hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Refresh autonomous agent"
          title="Refresh autonomous agent"
        >
          <RefreshCw
            className={["h-4 w-4", isLoading ? "animate-spin" : ""].join(" ")}
            aria-hidden="true"
          />
        </button>
      </div>

      {isLoading ? (
        <div className="mb-4 inline-flex w-full items-center gap-2 rounded-md border border-cyan-300/15 bg-slate-950/60 px-3 py-3 text-sm text-cyan-100">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Scanning memory history...
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 rounded-md border border-red-300/20 bg-red-950/30 px-3 py-3 text-sm leading-6 text-red-100">
          {error}
        </div>
      ) : null}

      <div
        className={[
          "space-y-4 transition",
          isEnabled ? "opacity-100" : "opacity-60"
        ].join(" ")}
      >
        <div className="rounded-md border border-cyan-300/15 bg-cyan-300/10 p-3">
          <div className="mb-2 flex items-center gap-2">
            <Target className="h-4 w-4 text-cyan-300" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
              Daily Focus
            </p>
          </div>
          <p className="text-sm leading-6 text-slate-100">{plan.dailyFocus}</p>
        </div>

        <div className="rounded-md border border-emerald-300/15 bg-emerald-300/10 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ClipboardList
                className="h-4 w-4 text-emerald-300"
                aria-hidden="true"
              />
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
                Task Completion
              </p>
            </div>
            <span className="text-xs font-semibold text-emerald-100">
              {completedCount}/{plan.tasks.length}
            </span>
          </div>
          <div className="mb-3 h-2 overflow-hidden rounded-full bg-slate-950">
            <div
              className="h-full rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(110,231,183,0.35)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="space-y-2">
            {plan.tasks.map((task) => {
              const isComplete = completedSet.has(task.id);

              return (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onToggleTask(task.id)}
                  disabled={!isEnabled}
                  className="flex w-full items-start gap-3 rounded-md border border-emerald-300/10 bg-slate-950/55 px-3 py-3 text-left transition hover:border-emerald-300/30 hover:bg-emerald-300/10 disabled:cursor-not-allowed"
                >
                  {isComplete ? (
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300"
                      aria-hidden="true"
                    />
                  ) : (
                    <Circle
                      className="mt-0.5 h-4 w-4 shrink-0 text-slate-500"
                      aria-hidden="true"
                    />
                  )}
                  <span className="min-w-0">
                    <span
                      className={[
                        "block text-xs font-semibold",
                        isComplete ? "text-emerald-200 line-through" : "text-slate-100"
                      ].join(" ")}
                    >
                      {task.title}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-400">
                      {task.detail}
                    </span>
                    <span className="mt-2 inline-flex rounded-md border border-cyan-300/15 bg-cyan-300/10 px-2 py-1 text-[11px] font-semibold text-cyan-100">
                      {task.source ?? task.pillar}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
          <div className="rounded-md border border-violet-300/10 bg-slate-950/60 p-3">
            <div className="mb-2 flex items-center gap-2">
              <CalendarCheck
                className="h-4 w-4 text-violet-300"
                aria-hidden="true"
              />
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-200">
                Weekly Goals
              </p>
            </div>
            <AgentList
              emptyText="Save more goal memories to generate weekly goals."
              items={plan.weeklyGoals}
            />
          </div>

          <div className="rounded-md border border-cyan-300/10 bg-slate-950/60 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Route className="h-4 w-4 text-cyan-300" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
                Learning Roadmap
              </p>
            </div>
            <AgentList
              emptyText="Learning recommendations will appear after more memories."
              items={plan.learningRoadmap}
            />
          </div>

          <div className="rounded-md border border-violet-300/10 bg-slate-950/60 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Rocket className="h-4 w-4 text-violet-300" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-200">
                Startup Opportunities
              </p>
            </div>
            <AgentList
              emptyText="Startup opportunities will improve as memory patterns grow."
              items={plan.startupOpportunities}
            />
          </div>

          <div className="rounded-md border border-cyan-300/10 bg-slate-950/60 p-3">
            <div className="mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-cyan-300" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
                What Changed Recently
              </p>
            </div>
            <p className="text-xs leading-5 text-slate-300">{plan.recentChange}</p>
          </div>
        </div>

        <div className="rounded-md border border-violet-300/10 bg-slate-950/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-200">
            Automatic Memory Summary
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-200">
            {plan.memorySummary}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {plan.recurringThemes.length ? (
              plan.recurringThemes.map((theme) => (
                <span
                  key={theme}
                  className="rounded-md border border-violet-300/20 bg-violet-400/10 px-2 py-1 text-xs text-violet-100"
                >
                  {theme}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500">
                No recurring themes yet.
              </span>
            )}
          </div>
        </div>

        <div className="rounded-md border border-cyan-300/10 bg-slate-950/60 p-3">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-cyan-300" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
              Timeline
            </p>
          </div>
          {plan.timeline.length ? (
            <div className="space-y-3">
              {plan.timeline.map((item) => (
                <div
                  key={item.id}
                  className="border-l border-cyan-300/20 pl-3 text-xs leading-5"
                >
                  <div className="flex flex-wrap items-center gap-2 text-cyan-100">
                    <span>{item.dateLabel}</span>
                    <span className="rounded-md border border-cyan-300/15 bg-cyan-300/10 px-2 py-0.5">
                      {item.category}
                    </span>
                    <span className="text-slate-500">Imp {item.importance}/5</span>
                  </div>
                  <p className="mt-1 text-slate-400">{item.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs leading-5 text-slate-500">
              Memory history will appear after your first saved memory.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
