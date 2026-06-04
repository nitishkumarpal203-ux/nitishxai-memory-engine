"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  CalendarDays,
  Filter,
  Loader2,
  Network,
  Pin,
  Search,
  SignalHigh,
  Tags,
  X
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import type { Memory } from "@/types/memory";

type MemoriesResponse = {
  error?: string;
  memories?: Memory[];
};

type GraphNode = Memory & {
  color: string;
  label: string;
  x: number;
  y: number;
};

type GraphEdge = {
  from: string;
  keywordScore: number;
  reasons: string[];
  score: number;
  semanticScore: number;
  to: string;
};

const GRAPH_WIDTH = 1000;
const GRAPH_HEIGHT = 620;
const CATEGORY_COLORS = [
  "#67e8f9",
  "#c4b5fd",
  "#6ee7b7",
  "#fcd34d",
  "#fda4af",
  "#93c5fd",
  "#f0abfc",
  "#5eead4"
];
const STOP_WORDS = new Set([
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
const SEMANTIC_GROUPS = [
  [
    "ai",
    "agent",
    "automation",
    "future",
    "futuristic",
    "software",
    "supabase",
    "tech",
    "technology",
    "tool"
  ],
  [
    "business",
    "customer",
    "idea",
    "launch",
    "market",
    "monetization",
    "revenue",
    "saas",
    "startup"
  ],
  [
    "brand",
    "branding",
    "creative",
    "design",
    "identity",
    "marketing",
    "style",
    "visual"
  ],
  [
    "focus",
    "goal",
    "habit",
    "plan",
    "priority",
    "productivity",
    "routine",
    "week"
  ],
  [
    "book",
    "course",
    "learn",
    "learning",
    "practice",
    "research",
    "skill",
    "study"
  ]
];

const formatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short"
});

function truncateText(text: string, maxLength: number) {
  const trimmed = text.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1).trim()}...`;
}

function normalizeTerm(term: string) {
  if (term.length > 4 && term.endsWith("ies")) {
    return `${term.slice(0, -3)}y`;
  }

  if (term.length > 4 && term.endsWith("ing")) {
    return term.slice(0, -3);
  }

  if (term.length > 4 && term.endsWith("ed")) {
    return term.slice(0, -2);
  }

  if (term.length > 3 && term.endsWith("s")) {
    return term.slice(0, -1);
  }

  return term;
}

function tokenize(text: string) {
  const matches = text.toLowerCase().match(/[a-z0-9][a-z0-9-]{2,}/g) ?? [];

  return Array.from(
    new Set(
      matches
        .map((term) => normalizeTerm(term))
        .filter((term) => !STOP_WORDS.has(term) && !/^\d+$/.test(term))
    )
  );
}

function getKeywordOverlap(a: string[], b: string[]) {
  if (!a.length || !b.length) {
    return 0;
  }

  const bSet = new Set(b);
  const shared = a.filter((term) => bSet.has(term)).length;
  const union = new Set([...a, ...b]).size;

  return union ? shared / union : 0;
}

function getSemanticProfile(memory: Memory) {
  const terms = new Set(
    tokenize(`${memory.memory_text} ${memory.category} ${memory.memory_type}`)
  );

  return SEMANTIC_GROUPS.map((group) =>
    group.reduce((score, keyword) => score + (terms.has(keyword) ? 1 : 0), 0)
  );
}

function cosine(a: number[], b: number[]) {
  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    magnitudeA += a[index] * a[index];
    magnitudeB += b[index] * b[index];
  }

  if (!magnitudeA || !magnitudeB) {
    return 0;
  }

  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

function getAgeInDays(memory: Memory) {
  const createdAt = new Date(memory.created_at).getTime();

  if (!Number.isFinite(createdAt)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, (Date.now() - createdAt) / 86_400_000);
}

function getCategoryColor(category: string, categories: string[]) {
  const index = Math.max(0, categories.indexOf(category));

  return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

function buildGraph(memories: Memory[]) {
  const categories = Array.from(new Set(memories.map((memory) => memory.category)));
  const tokenMap = new Map<string, string[]>();
  const semanticMap = new Map<string, number[]>();
  const centerX = GRAPH_WIDTH / 2;
  const centerY = GRAPH_HEIGHT / 2;
  const radiusX = GRAPH_WIDTH * 0.36;
  const radiusY = GRAPH_HEIGHT * 0.35;
  const nodes: GraphNode[] = memories.map((memory, index) => {
    const angle = memories.length
      ? (index / memories.length) * Math.PI * 2 - Math.PI / 2
      : 0;
    const categoryIndex = Math.max(0, categories.indexOf(memory.category));
    const ringOffset = categoryIndex % 2 === 0 ? 0 : 38;

    tokenMap.set(
      memory.id,
      tokenize(`${memory.memory_text} ${memory.category} ${memory.memory_type}`)
    );
    semanticMap.set(memory.id, getSemanticProfile(memory));

    return {
      ...memory,
      color: getCategoryColor(memory.category, categories),
      label: truncateText(memory.memory_text, 28),
      x: centerX + Math.cos(angle) * (radiusX - ringOffset),
      y: centerY + Math.sin(angle) * (radiusY - ringOffset)
    };
  });
  const edges: GraphEdge[] = [];

  for (let first = 0; first < memories.length; first += 1) {
    for (let second = first + 1; second < memories.length; second += 1) {
      const a = memories[first];
      const b = memories[second];
      const keywordScore = getKeywordOverlap(
        tokenMap.get(a.id) ?? [],
        tokenMap.get(b.id) ?? []
      );
      const semanticScore = cosine(
        semanticMap.get(a.id) ?? [],
        semanticMap.get(b.id) ?? []
      );
      const sameCategoryScore = a.category === b.category ? 0.42 : 0;
      const score = Math.max(sameCategoryScore, keywordScore, semanticScore);
      const reasons: string[] = [];

      if (sameCategoryScore) {
        reasons.push("same category");
      }

      if (keywordScore >= 0.16) {
        reasons.push("similar keywords");
      }

      if (semanticScore >= 0.32) {
        reasons.push("semantic similarity");
      }

      if (score >= 0.16 && reasons.length) {
        edges.push({
          from: a.id,
          keywordScore,
          reasons,
          score,
          semanticScore,
          to: b.id
        });
      }
    }
  }

  edges.sort((a, b) => b.score - a.score);

  return {
    categories,
    edges: edges.slice(0, 90),
    nodes
  };
}

function getConnectedNodeIds(selectedId: string | null, edges: GraphEdge[]) {
  if (!selectedId) {
    return new Set<string>();
  }

  const ids = new Set([selectedId]);

  for (const edge of edges) {
    if (edge.from === selectedId) {
      ids.add(edge.to);
    }

    if (edge.to === selectedId) {
      ids.add(edge.from);
    }
  }

  return ids;
}

export function MemoryGraph() {
  const { accessToken } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [minImportance, setMinImportance] = useState(1);
  const [recentDays, setRecentDays] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMemories = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (!accessToken) {
        throw new Error("Please sign in to view the memory graph.");
      }

      const response = await fetch("/api/memories", {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      const data = (await response.json()) as MemoriesResponse;

      if (!response.ok || data.error) {
        throw new Error(data.error ?? "Memories could not be loaded.");
      }

      setMemories(data.memories ?? []);
    } catch (requestError) {
      setMemories([]);
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

  const categories = useMemo(
    () => Array.from(new Set(memories.map((memory) => memory.category))).sort(),
    [memories]
  );
  const filteredMemories = useMemo(() => {
    return memories.filter((memory) => {
      const matchesCategory =
        categoryFilter === "all" || memory.category === categoryFilter;
      const matchesImportance = memory.importance >= minImportance;
      const matchesRecent =
        recentDays === "all" || getAgeInDays(memory) <= Number(recentDays);

      return matchesCategory && matchesImportance && matchesRecent;
    });
  }, [categoryFilter, memories, minImportance, recentDays]);
  const graph = useMemo(() => buildGraph(filteredMemories), [filteredMemories]);
  const nodeById = useMemo(
    () => new Map(graph.nodes.map((node) => [node.id, node])),
    [graph.nodes]
  );
  const connectedNodeIds = useMemo(
    () => getConnectedNodeIds(selectedNodeId, graph.edges),
    [graph.edges, selectedNodeId]
  );
  const selectedEdges = useMemo(() => {
    if (!selectedMemory) {
      return [];
    }

    return graph.edges
      .filter(
        (edge) => edge.from === selectedMemory.id || edge.to === selectedMemory.id
      )
      .slice(0, 6);
  }, [graph.edges, selectedMemory]);

  function openMemory(memory: Memory) {
    setSelectedMemory(memory);
    setSelectedNodeId(memory.id);
  }

  function closeMemory() {
    setSelectedMemory(null);
    setSelectedNodeId(null);
  }

  return (
    <section className="rounded-lg border border-cyan-300/15 bg-slate-900/76 p-4 shadow-2xl shadow-cyan-950/30 backdrop-blur sm:p-5">
      <div className="flex flex-col gap-4 border-b border-cyan-300/10 pb-5 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
            <Network className="h-4 w-4 text-cyan-300" aria-hidden="true" />
            Interactive Memory Graph
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Nodes are memories. Lines connect matching categories, overlapping
            keywords, and local semantic similarity signals.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:w-[620px]">
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
            Category
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-11 rounded-md border border-cyan-300/20 bg-slate-950/80 px-3 text-sm font-medium normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/60"
            >
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
            Importance
            <select
              value={minImportance}
              onChange={(event) => setMinImportance(Number(event.target.value))}
              className="h-11 rounded-md border border-cyan-300/20 bg-slate-950/80 px-3 text-sm font-medium normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/60"
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}+ importance
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
            Recent
            <select
              value={recentDays}
              onChange={(event) => setRecentDays(event.target.value)}
              className="h-11 rounded-md border border-cyan-300/20 bg-slate-950/80 px-3 text-sm font-medium normal-case tracking-normal text-slate-100 outline-none transition focus:border-cyan-300/60"
            >
              <option value="all">All memories</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-h-[420px] overflow-hidden rounded-lg border border-cyan-300/10 bg-slate-950/70">
          {isLoading ? (
            <div className="flex min-h-[420px] items-center justify-center text-sm text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-cyan-300" aria-hidden="true" />
              Loading graph...
            </div>
          ) : error ? (
            <div className="flex min-h-[420px] items-center justify-center px-4 text-center text-sm leading-6 text-red-100">
              {error}
            </div>
          ) : graph.nodes.length ? (
            <svg
              viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
              className="h-[520px] w-full touch-pan-y"
              role="img"
              aria-label="Interactive memory graph"
            >
              <defs>
                <radialGradient id="nodeGlow">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.72" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect width={GRAPH_WIDTH} height={GRAPH_HEIGHT} fill="#020617" />
              <g opacity="0.35">
                {Array.from({ length: 10 }).map((_, index) => (
                  <circle
                    key={index}
                    cx={GRAPH_WIDTH / 2}
                    cy={GRAPH_HEIGHT / 2}
                    r={70 + index * 45}
                    fill="none"
                    stroke="#164e63"
                    strokeWidth="1"
                  />
                ))}
              </g>

              <g>
                {graph.edges.map((edge) => {
                  const from = nodeById.get(edge.from);
                  const to = nodeById.get(edge.to);

                  if (!from || !to) {
                    return null;
                  }

                  const isActive =
                    !selectedNodeId ||
                    edge.from === selectedNodeId ||
                    edge.to === selectedNodeId;

                  return (
                    <line
                      key={`${edge.from}-${edge.to}`}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke={edge.semanticScore >= 0.32 ? "#c4b5fd" : "#67e8f9"}
                      strokeOpacity={isActive ? 0.52 : 0.12}
                      strokeWidth={1 + edge.score * 3}
                    />
                  );
                })}
              </g>

              <g>
                {graph.nodes.map((node) => {
                  const isSelected = selectedNodeId === node.id;
                  const isConnected =
                    !selectedNodeId || connectedNodeIds.has(node.id);
                  const radius = 18 + node.importance * 3;

                  return (
                    <g
                      key={node.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open memory: ${node.memory_text}`}
                      className="cursor-pointer outline-none"
                      onClick={() => openMemory(node)}
                      onFocus={() => setSelectedNodeId(node.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openMemory(node);
                        }
                      }}
                    >
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={radius + 12}
                        fill={node.color}
                        opacity={isSelected ? 0.22 : 0.08}
                      />
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={radius}
                        fill="#0f172a"
                        stroke={node.color}
                        strokeOpacity={isConnected ? 0.95 : 0.25}
                        strokeWidth={isSelected ? 4 : 2}
                      />
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={Math.max(6, radius * 0.32)}
                        fill={node.color}
                        opacity={isConnected ? 0.9 : 0.35}
                      />
                      <text
                        x={node.x}
                        y={node.y + radius + 18}
                        textAnchor="middle"
                        fill={isConnected ? "#e2e8f0" : "#64748b"}
                        fontSize="13"
                        fontWeight="600"
                      >
                        {node.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          ) : (
            <div className="flex min-h-[420px] flex-col items-center justify-center px-4 text-center">
              <Search className="h-8 w-8 text-cyan-300" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-slate-200">
                No graph nodes match these filters.
              </p>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
                Save memories in chat or loosen the filters to reveal the graph.
              </p>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-cyan-300/15 bg-slate-950/70 p-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-cyan-300" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-cyan-100">Graph Stats</h3>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-cyan-300/10 bg-cyan-300/10 p-3">
                <p className="text-xs text-slate-500">Nodes</p>
                <p className="mt-1 text-xl font-semibold text-cyan-100">
                  {graph.nodes.length}
                </p>
              </div>
              <div className="rounded-md border border-violet-300/10 bg-violet-300/10 p-3">
                <p className="text-xs text-slate-500">Links</p>
                <p className="mt-1 text-xl font-semibold text-violet-100">
                  {graph.edges.length}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-cyan-300/15 bg-slate-950/70 p-4">
            <h3 className="text-sm font-semibold text-cyan-100">Legend</h3>
            <div className="mt-3 space-y-2">
              {graph.categories.map((category) => (
                <div key={category} className="flex items-center gap-2 text-sm text-slate-300">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: getCategoryColor(category, graph.categories)
                    }}
                  />
                  <span className="truncate">{category}</span>
                </div>
              ))}
              {!graph.categories.length ? (
                <p className="text-sm leading-6 text-slate-500">
                  Categories appear once memories are loaded.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-cyan-300/15 bg-slate-950/70 p-4">
            <h3 className="text-sm font-semibold text-cyan-100">Relationship Rules</h3>
            <div className="mt-3 space-y-2 text-sm leading-6 text-slate-400">
              <p>Same category creates a baseline link.</p>
              <p>Shared normalized keywords strengthen links.</p>
              <p>Local semantic groups add similarity scoring when available.</p>
            </div>
          </div>
        </aside>
      </div>

      {selectedMemory ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/82 px-4 py-6 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="memory-graph-detail-title"
        >
          <div className="w-full max-w-xl rounded-lg border border-cyan-300/20 bg-slate-950 p-4 shadow-2xl shadow-cyan-950/40 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
                  <BrainCircuit className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 id="memory-graph-detail-title" className="text-base font-semibold text-white">
                    Memory Detail
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Connections are calculated locally from category, keywords,
                    and semantic concept overlap.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeMemory}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-700 bg-slate-900 text-slate-300 transition hover:border-cyan-300/40 hover:text-white"
                aria-label="Close memory detail"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <p className="mt-5 rounded-md border border-cyan-300/10 bg-slate-900/80 p-3 text-sm leading-6 text-slate-100">
              {selectedMemory.memory_text}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                {selectedMemory.category}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
                <SignalHigh className="h-3.5 w-3.5" aria-hidden="true" />
                {selectedMemory.importance}/5
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                <Tags className="h-3.5 w-3.5" aria-hidden="true" />
                {selectedMemory.memory_type}
              </span>
              <span className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
                source: {selectedMemory.source}
              </span>
              <span className="rounded-md border border-slate-500/30 bg-slate-500/10 px-2.5 py-1 text-xs font-semibold text-slate-300">
                {Math.round(selectedMemory.confidence * 100)}% confidence
              </span>
              {selectedMemory.is_pinned ? (
                <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
                  <Pin className="h-3.5 w-3.5" aria-hidden="true" />
                  pinned
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5 rounded-md border border-violet-300/20 bg-violet-300/10 px-2.5 py-1 text-xs font-semibold text-violet-200">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                {formatter.format(new Date(selectedMemory.created_at))}
              </span>
            </div>

            <div className="mt-5 border-t border-cyan-300/10 pt-4">
              <h4 className="text-sm font-semibold text-cyan-100">Strongest Links</h4>
              <div className="mt-3 space-y-2">
                {selectedEdges.length ? (
                  selectedEdges.map((edge) => {
                    const otherId =
                      edge.from === selectedMemory.id ? edge.to : edge.from;
                    const otherMemory = nodeById.get(otherId);

                    if (!otherMemory) {
                      return null;
                    }

                    return (
                      <button
                        key={`${edge.from}-${edge.to}`}
                        type="button"
                        onClick={() => openMemory(otherMemory)}
                        className="w-full rounded-md border border-cyan-300/10 bg-slate-900/80 p-3 text-left transition hover:border-cyan-300/35"
                      >
                        <p className="text-sm leading-6 text-slate-200">
                          {truncateText(otherMemory.memory_text, 120)}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {edge.reasons.join(", ")} - overall{" "}
                          {Math.round(edge.score * 100)}%, semantic{" "}
                          {Math.round(edge.semanticScore * 100)}%, keyword{" "}
                          {Math.round(edge.keywordScore * 100)}%
                        </p>
                      </button>
                    );
                  })
                ) : (
                  <p className="rounded-md border border-dashed border-cyan-300/20 bg-slate-900/70 px-3 py-4 text-sm leading-6 text-slate-500">
                    This memory has no strong links under the current filters.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
