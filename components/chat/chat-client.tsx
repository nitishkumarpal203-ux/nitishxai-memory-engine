"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AudioLines,
  BookOpen,
  Brain,
  Bot,
  CalendarCheck,
  Gauge,
  Layers,
  Lightbulb,
  Loader2,
  Mic,
  MicOff,
  RefreshCw,
  Rocket,
  Send,
  Sparkles,
  Target,
  Volume2,
  VolumeX,
  Wand2
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { AgentPanel } from "@/components/chat/agent-panel";
import { useSpeechInput } from "@/components/chat/use-speech-input";
import { MemoryCard } from "@/components/memory-card";
import type { Memory, MemoryInsight } from "@/types/memory";

type ChatMode = "chat" | "insight";

type ChatMessage = {
  id: string;
  insight?: MemoryInsight | null;
  mode?: ChatMode;
  relevantMemories?: Memory[];
  role: "user" | "assistant";
  savedMemories?: Memory[];
  text: string;
};

type ChatResponse = {
  error?: string;
  insight?: MemoryInsight | null;
  mode?: ChatMode;
  relevantMemories?: Memory[];
  reply?: string;
  saved?: boolean;
  savedMemories?: Memory[];
};

type InsightsResponse = {
  error?: string;
  insight?: MemoryInsight | null;
};

type MemoriesResponse = {
  error?: string;
  memories?: Memory[];
};

type QuickPrompt = {
  icon: LucideIcon;
  mode?: ChatMode;
  prompt: string;
};

const quickPrompts: QuickPrompt[] = [
  {
    icon: Target,
    prompt: "What are my goals?"
  },
  {
    icon: Lightbulb,
    prompt: "Suggest a project for me"
  },
  {
    icon: CalendarCheck,
    prompt: "What should I focus on this week?"
  },
  {
    icon: Layers,
    mode: "insight",
    prompt: "Summarize my memories"
  }
];

const starterMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    text:
      "I can answer like a local ChatGPT-style assistant using your saved long-term memories. Ask a question, dictate with the mic, or try a quick prompt."
  }
];

const insightDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium"
});

function createMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function AssistantVoiceOrb({
  isListening,
  isSending,
  isSpeaking,
  isVoiceMode
}: {
  isListening: boolean;
  isSending: boolean;
  isSpeaking: boolean;
  isVoiceMode: boolean;
}) {
  const isActive = isListening || isSpeaking || isSending;
  const label = isSpeaking
    ? "Speaking"
    : isListening
      ? "Listening"
      : isSending
        ? "Thinking"
        : isVoiceMode
          ? "Voice ready"
          : "Voice off";

  return (
    <div className="inline-flex items-center gap-3 rounded-md border border-cyan-300/15 bg-slate-950/60 px-3 py-2">
      <span
        className={[
          "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border",
          isActive
            ? "border-cyan-200 bg-cyan-300 text-slate-950 shadow-[0_0_30px_rgba(34,211,238,0.45)]"
            : "border-cyan-300/25 bg-cyan-300/10 text-cyan-100"
        ].join(" ")}
        aria-hidden="true"
      >
        {isActive ? (
          <span className="absolute inset-0 rounded-full bg-cyan-300/30 blur-md animate-pulse" />
        ) : null}
        {isSpeaking ? (
          <span className="absolute -inset-1 rounded-full border border-cyan-200/40 animate-ping" />
        ) : null}
        <AudioLines className="relative h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-cyan-100">
          Voice Assistant
        </span>
        <span className="block text-xs text-slate-500">{label}</span>
      </span>
    </div>
  );
}

function MemoryInsightPanel({ insight }: { insight: MemoryInsight }) {
  return (
    <div className="mt-4 rounded-md border border-violet-300/15 bg-violet-400/10 p-3">
      <div className="mb-3 flex items-center gap-2">
        <Wand2 className="h-4 w-4 text-violet-200" aria-hidden="true" />
        <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-100">
          Memory Insight Mode
        </h3>
      </div>

      <p className="text-sm leading-6 text-slate-200">{insight.summary}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-cyan-300/10 bg-slate-950/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
            Categories
          </p>
          <div className="mt-2 space-y-2">
            {insight.categories.length ? (
              insight.categories.slice(0, 4).map((category) => (
                <div
                  key={category.name}
                  className="flex items-center justify-between gap-3 text-xs text-slate-300"
                >
                  <span className="truncate">{category.name}</span>
                  <span className="shrink-0 text-cyan-200">
                    {category.count} - {category.averageImportance}/5
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs leading-5 text-slate-500">No categories yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-md border border-cyan-300/10 bg-slate-950/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
            Repeated Themes
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {insight.repeatedThemes.length ? (
              insight.repeatedThemes.map((theme) => (
                <span
                  key={theme}
                  className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-xs text-cyan-100"
                >
                  {theme}
                </span>
              ))
            ) : (
              <p className="text-xs leading-5 text-slate-500">No repeats yet.</p>
            )}
          </div>
        </div>

        <div className="rounded-md border border-cyan-300/10 bg-slate-950/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
            Next Action
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-300">
            {insight.nextAction}
          </p>
        </div>
      </div>
    </div>
  );
}

function MemoriesUsed({ memories }: { memories?: Memory[] }) {
  return (
    <div className="mt-4 border-t border-cyan-300/10 pt-4">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
        <Brain className="h-3.5 w-3.5" aria-hidden="true" />
        Memories Used
      </h3>
      {memories?.length ? (
        <div className="grid gap-3">
          {memories.map((memory) => (
            <MemoryCard key={memory.id} memory={memory} compact />
          ))}
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-cyan-300/20 bg-slate-950/50 px-3 py-4 text-sm leading-6 text-slate-500">
          No strong memory match was used for this response.
        </p>
      )}
    </div>
  );
}

function ScoreBar({
  label,
  value
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-slate-300">{label}</span>
        <span className="font-semibold text-cyan-200">{value}/100</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-950">
        <div
          className="h-full rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(34,211,238,0.35)]"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

function InsightList({ items }: { items: string[] }) {
  if (!items.length) {
    return <p className="text-xs leading-5 text-slate-500">Not enough signal yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.slice(0, 3).map((item) => (
        <li key={item} className="text-xs leading-5 text-slate-300">
          {item}
        </li>
      ))}
    </ul>
  );
}

function ProactiveInsightsPanel({
  error,
  insight,
  isLoading,
  onRefresh
}: {
  error: string | null;
  insight: MemoryInsight | null;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className="rounded-lg border border-violet-300/15 bg-slate-900/76 p-4 shadow-2xl shadow-violet-950/20 backdrop-blur">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-violet-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-violet-100">AI Insights</h2>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Proactive local recommendations from your memory graph.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-violet-300/20 bg-violet-400/10 text-violet-100 transition hover:border-violet-300/45 hover:bg-violet-400/20 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Refresh AI insights"
          title="Refresh AI insights"
        >
          <RefreshCw
            className={["h-4 w-4", isLoading ? "animate-spin" : ""].join(" ")}
            aria-hidden="true"
          />
        </button>
      </div>

      {isLoading ? (
        <div className="inline-flex w-full items-center gap-2 rounded-md border border-violet-300/15 bg-slate-950/60 px-3 py-3 text-sm text-violet-100">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Analyzing memories...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-red-300/20 bg-red-950/30 px-3 py-3 text-sm leading-6 text-red-100">
          {error}
        </div>
      ) : null}

      {!isLoading && !error && !insight ? (
        <p className="rounded-md border border-dashed border-violet-300/20 bg-slate-950/50 px-3 py-4 text-sm leading-6 text-slate-500">
          Insights will appear after your secure session is ready.
        </p>
      ) : null}

      {insight ? (
        <div className="space-y-4">
          <div className="rounded-md border border-cyan-300/15 bg-cyan-300/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
              Weekly Focus
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-100">
              {insight.weeklyFocus}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="rounded-md border border-cyan-300/10 bg-slate-950/60 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
                  Top Interests
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {insight.topInterests.length ? (
                  insight.topInterests.slice(0, 6).map((interest) => (
                    <span
                      key={interest}
                      className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-2 py-1 text-xs text-cyan-100"
                    >
                      {interest}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">No interests yet.</span>
                )}
              </div>
            </div>

            <div className="rounded-md border border-cyan-300/10 bg-slate-950/60 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Target className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
                  Current Goals
                </p>
              </div>
              <InsightList items={insight.currentGoals} />
            </div>

            <div className="rounded-md border border-cyan-300/10 bg-slate-950/60 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
                  Activity
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                <span>{insight.activity.streakDays} day streak</span>
                <span>{insight.activity.memoriesThisWeek} this week</span>
                <span>{insight.activity.activeDays} active days</span>
                <span>{insight.activity.totalMemories} total</span>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Last memory:{" "}
                {insight.activity.lastMemoryAt
                  ? insightDateFormatter.format(new Date(insight.activity.lastMemoryAt))
                  : "none yet"}
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-violet-300/10 bg-slate-950/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-200">
              Dynamic Scores
            </p>
            <ScoreBar label="Learning" value={insight.scores.learning} />
            <ScoreBar label="Productivity" value={insight.scores.productivity} />
            <ScoreBar label="Startup" value={insight.scores.startup} />
            <ScoreBar label="AI Focus" value={insight.scores.aiFocus} />
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-md border border-cyan-300/10 bg-slate-950/60 p-3">
              <div className="mb-2 flex items-center gap-2">
                <CalendarCheck className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
                  Focus Suggestions
                </p>
              </div>
              <InsightList items={insight.focusSuggestions} />
            </div>

            <div className="rounded-md border border-cyan-300/10 bg-slate-950/60 p-3">
              <div className="mb-2 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
                  Learning
                </p>
              </div>
              <InsightList items={insight.learningRecommendations} />
            </div>

            <div className="rounded-md border border-cyan-300/10 bg-slate-950/60 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Rocket className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
                  Startup Ideas
                </p>
              </div>
              <InsightList items={insight.projectIdeas} />
            </div>

            <div className="rounded-md border border-cyan-300/10 bg-slate-950/60 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">
                  Productivity
                </p>
              </div>
              <InsightList items={insight.productivityAdvice} />
            </div>
          </div>

          <div className="rounded-md border border-emerald-300/15 bg-emerald-300/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-200">
              Suggested Next Step
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-100">
              {insight.suggestedNextStep}
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function ChatClient() {
  const {
    accessToken,
    isAuthenticated,
    isLoading: isAuthLoading,
    user
  } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [agentMemories, setAgentMemories] = useState<Memory[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [isAgentMemoryLoading, setIsAgentMemoryLoading] = useState(false);
  const [isAgentMode, setIsAgentMode] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isInsightLoading, setIsInsightLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSpeechSynthesisSupported, setIsSpeechSynthesisSupported] =
    useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(true);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [insightError, setInsightError] = useState<string | null>(null);
  const [proactiveInsight, setProactiveInsight] = useState<MemoryInsight | null>(
    null
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeTypingRef = useRef<{ fullText: string; id: string } | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const {
    isListening,
    isSupported: isVoiceSupported,
    status: voiceStatus,
    toggleListening
  } = useSpeechInput({
    onAutoSubmit: (spokenMessage) => {
      if (isVoiceMode) {
        void sendMessage(spokenMessage);
      }
    },
    onChange: setInput,
    value: input
  });

  const taskStorageKey = useMemo(
    () => (user?.id ? `ai-memory-agent-tasks:${user.id}` : null),
    [user?.id]
  );

  const stopTyping = useCallback((completeActiveMessage = false) => {
    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    if (completeActiveMessage && activeTypingRef.current) {
      const { fullText, id } = activeTypingRef.current;

      setMessages((current) =>
        current.map((message) =>
          message.id === id ? { ...message, text: fullText } : message
        )
      );
    }

    activeTypingRef.current = null;
  }, []);

  const streamAssistantText = useCallback(
    (id: string, fullText: string) => {
      stopTyping(true);

      if (!fullText) {
        return;
      }

      activeTypingRef.current = { fullText, id };
      let visibleCharacters = 0;

      typingTimerRef.current = setInterval(() => {
        visibleCharacters = Math.min(fullText.length, visibleCharacters + 4);
        const visibleText = fullText.slice(0, visibleCharacters);

        setMessages((current) =>
          current.map((message) =>
            message.id === id ? { ...message, text: visibleText } : message
          )
        );

        if (visibleCharacters >= fullText.length) {
          stopTyping(false);
        }
      }, 18);
    },
    [stopTyping]
  );

  const speakReply = useCallback(
    (reply: string) => {
      if (
        !isVoiceMode ||
        !isSpeechSynthesisSupported ||
        typeof window === "undefined"
      ) {
        return;
      }

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(reply);
      utterance.rate = 1;
      utterance.pitch = 1.02;
      utterance.volume = 0.95;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [isSpeechSynthesisSupported, isVoiceMode]
  );

  const latestAssistant = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages]
  );

  useEffect(() => {
    const canSpeak =
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      "SpeechSynthesisUtterance" in window;

    setIsSpeechSynthesisSupported(canSpeak);

    return () => {
      stopTyping(false);

      if (canSpeak) {
        window.speechSynthesis.cancel();
      }
    };
  }, [stopTyping]);

  useEffect(() => {
    if (
      !isVoiceMode &&
      isSpeechSynthesisSupported &&
      typeof window !== "undefined"
    ) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [isSpeechSynthesisSupported, isVoiceMode]);

  useEffect(() => {
    if (!taskStorageKey || typeof window === "undefined") {
      setCompletedTaskIds([]);
      return;
    }

    try {
      const savedTasks = window.localStorage.getItem(taskStorageKey);
      const parsedTasks = savedTasks ? JSON.parse(savedTasks) : [];

      setCompletedTaskIds(Array.isArray(parsedTasks) ? parsedTasks : []);
    } catch {
      setCompletedTaskIds([]);
    }
  }, [taskStorageKey]);

  const toggleAgentTask = useCallback(
    (taskId: string) => {
      setCompletedTaskIds((current) => {
        const nextTasks = current.includes(taskId)
          ? current.filter((id) => id !== taskId)
          : [...current, taskId];

        if (taskStorageKey && typeof window !== "undefined") {
          window.localStorage.setItem(taskStorageKey, JSON.stringify(nextTasks));
        }

        return nextTasks;
      });
    },
    [taskStorageKey]
  );

  const fetchInsights = useCallback(async () => {
    if (!accessToken) {
      setProactiveInsight(null);
      setInsightError(null);
      return;
    }

    setIsInsightLoading(true);
    setInsightError(null);

    try {
      const response = await fetch("/api/insights", {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      const data = (await response.json()) as InsightsResponse;

      if (!response.ok || data.error || !data.insight) {
        throw new Error(data.error ?? "AI insights could not be loaded.");
      }

      setProactiveInsight(data.insight);
    } catch (requestError) {
      setProactiveInsight(null);
      setInsightError(
        requestError instanceof Error
          ? requestError.message
          : "AI insights could not be loaded."
      );
    } finally {
      setIsInsightLoading(false);
    }
  }, [accessToken]);

  const fetchAgentMemories = useCallback(async () => {
    if (!accessToken) {
      setAgentMemories([]);
      setAgentError(null);
      return;
    }

    setIsAgentMemoryLoading(true);
    setAgentError(null);

    try {
      const response = await fetch("/api/memories", {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      const data = (await response.json()) as MemoriesResponse;

      if (!response.ok || data.error) {
        throw new Error(data.error ?? "Agent memories could not be loaded.");
      }

      setAgentMemories(data.memories ?? []);
    } catch (requestError) {
      setAgentMemories([]);
      setAgentError(
        requestError instanceof Error
          ? requestError.message
          : "Agent memories could not be loaded."
      );
    } finally {
      setIsAgentMemoryLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      setProactiveInsight(null);
      setInsightError(null);
      setAgentMemories([]);
      setAgentError(null);
      return;
    }

    void fetchInsights();
    void fetchAgentMemories();
  }, [accessToken, fetchAgentMemories, fetchInsights, isAuthenticated]);

  async function sendMessage(rawMessage: string, mode: ChatMode = "chat") {
    const message = rawMessage.trim();

    if (!message || isSending) {
      return;
    }

    if (!accessToken) {
      setError("Please sign in with Google before using the assistant.");
      return;
    }

    setError(null);
    setInput("");
    setIsSending(true);

    const userMessage: ChatMessage = {
      id: createMessageId(),
      mode,
      role: "user",
      text: message
    };

    setMessages((current) => [...current, userMessage]);

    try {
      const response = await fetch("/api/chat", {
        body: JSON.stringify({ message, mode }),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        method: "POST"
      });
      const data = (await response.json()) as ChatResponse;

      if (!response.ok || data.error) {
        throw new Error(data.error ?? "The chat request failed.");
      }

      const assistantMessageId = createMessageId();
      const assistantReply = data.reply ?? "I could not generate a local reply.";

      setMessages((current) => [
        ...current,
        {
          id: assistantMessageId,
          insight: data.insight ?? null,
          mode: data.mode ?? mode,
          relevantMemories: data.relevantMemories ?? [],
          role: "assistant",
          savedMemories: data.savedMemories ?? [],
          text: ""
        }
      ]);
      streamAssistantText(assistantMessageId, assistantReply);
      speakReply(assistantReply);
      void fetchInsights();
      void fetchAgentMemories();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The chat request failed."
      );
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="flex min-h-[calc(100vh-220px)] flex-col overflow-hidden rounded-lg border border-cyan-300/15 bg-slate-900/82 shadow-2xl shadow-cyan-950/30 backdrop-blur">
        <div className="flex flex-col gap-3 border-b border-cyan-300/10 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
              <Bot className="h-4 w-4 text-cyan-300" aria-hidden="true" />
              AI Assistant
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Local replies powered by your saved long-term memories
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <AssistantVoiceOrb
                isListening={isListening}
                isSending={isSending}
                isSpeaking={isSpeaking}
                isVoiceMode={isVoiceMode}
              />
              <button
                type="button"
                onClick={() => setIsVoiceMode((current) => !current)}
                className={[
                  "inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold transition",
                  isVoiceMode
                    ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-100 hover:border-cyan-300/60"
                    : "border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-500"
                ].join(" ")}
                aria-pressed={isVoiceMode}
              >
                {isVoiceMode ? (
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <VolumeX className="h-4 w-4" aria-hidden="true" />
                )}
                {isVoiceMode ? "Voice On" : "Voice Off"}
              </button>
              <button
                type="button"
                onClick={() => setIsAgentMode((current) => !current)}
                className={[
                  "inline-flex min-h-10 items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold transition",
                  isAgentMode
                    ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-100 hover:border-emerald-300/60"
                    : "border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-500"
                ].join(" ")}
                aria-pressed={isAgentMode}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {isAgentMode ? "Agent On" : "Agent Off"}
              </button>
            </div>
            <span className="inline-flex w-fit items-center gap-2 rounded-md border border-violet-300/20 bg-violet-400/10 px-3 py-1.5 text-xs font-medium text-violet-200">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              No external AI APIs
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
          {messages.map((message) => {
            const isAssistantReply =
              message.role === "assistant" && message.id !== "welcome";

            return (
              <article
                key={message.id}
                className={[
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                ].join(" ")}
              >
                <div
                  className={[
                    "w-fit max-w-[920px] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm",
                    message.role === "user"
                      ? "bg-cyan-300 text-slate-950"
                      : "border border-cyan-300/15 bg-slate-950/76 text-slate-100"
                  ].join(" ")}
                >
                  <p className="whitespace-pre-wrap">
                    {message.text}
                    {activeTypingRef.current?.id === message.id ? (
                      <span className="ml-1 inline-block h-4 w-1 translate-y-0.5 animate-pulse rounded-full bg-cyan-300" />
                    ) : null}
                  </p>

                  {message.insight ? (
                    <MemoryInsightPanel insight={message.insight} />
                  ) : null}

                  {isAssistantReply ? (
                    <MemoriesUsed memories={message.relevantMemories} />
                  ) : null}
                </div>
              </article>
            );
          })}

          {isSending ? (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/15 bg-slate-950/70 px-4 py-3 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-cyan-300" aria-hidden="true" />
                Searching memories and composing a local reply...
              </div>
            </div>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-cyan-300/10 bg-slate-950/70 p-3 sm:p-4">
          {error ? (
            <div className="mb-3 rounded-md border border-red-300/20 bg-red-950/30 px-3 py-2 text-sm text-red-100">
              {error}
            </div>
          ) : null}
          {isAuthLoading ? (
            <div className="mb-3 inline-flex w-full items-center gap-2 rounded-md border border-cyan-300/15 bg-slate-950/70 px-3 py-3 text-sm text-cyan-100">
              <Loader2 className="h-4 w-4 animate-spin text-cyan-300" aria-hidden="true" />
              Restoring secure session...
            </div>
          ) : null}
          {!isAuthLoading && !isAuthenticated ? (
            <div className="mb-3 flex flex-col gap-3 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-3 text-sm leading-6 text-cyan-100 sm:flex-row sm:items-center sm:justify-between">
              <span>Sign in to use your private memory assistant.</span>
              <Link
                href="/login"
                className="inline-flex h-10 items-center justify-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                Login
              </Link>
            </div>
          ) : null}

          <div className="mb-3 flex flex-wrap gap-2">
            {quickPrompts.map((quickPrompt) => {
              const Icon = quickPrompt.icon;

              return (
                <button
                  key={quickPrompt.prompt}
                  type="button"
                  onClick={() =>
                    void sendMessage(quickPrompt.prompt, quickPrompt.mode ?? "chat")
                  }
                  disabled={isSending || isAuthLoading || !isAuthenticated}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-cyan-300/15 bg-slate-900/80 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:border-cyan-300/45 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {quickPrompt.prompt}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask anything, or say what you want the assistant to remember..."
              className="min-h-28 flex-1 resize-none rounded-md border border-cyan-300/20 bg-slate-950/80 px-3 py-3 text-sm leading-6 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:shadow-[0_0_0_3px_rgba(103,232,249,0.12)]"
            />
            <div className="flex gap-3 sm:self-end">
              <button
                type="button"
                onClick={toggleListening}
                disabled={
                  isSending || isAuthLoading || !isAuthenticated || !isVoiceSupported
                }
                className={[
                  "relative inline-flex min-h-12 w-14 items-center justify-center overflow-visible rounded-md border text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
                  isListening
                    ? "border-cyan-200 bg-cyan-300 text-slate-950 shadow-[0_0_32px_rgba(34,211,238,0.55)]"
                    : "border-cyan-300/25 bg-cyan-300/10 text-cyan-100 hover:border-cyan-300/55 hover:bg-cyan-300/20"
                ].join(" ")}
                aria-label={isListening ? "Stop voice input" : "Start voice input"}
                title={
                  isListening
                    ? "Stop voice input"
                    : isVoiceMode
                      ? "Start voice input and auto-send"
                      : "Start voice input"
                }
              >
                {isListening ? (
                  <span className="absolute inset-0 rounded-md bg-cyan-300/25 blur-md animate-pulse" />
                ) : null}
                {isListening ? (
                  <MicOff className="relative h-5 w-5" aria-hidden="true" />
                ) : (
                  <Mic className="relative h-5 w-5" aria-hidden="true" />
                )}
              </button>
              <button
                type="submit"
                disabled={
                  isSending || isAuthLoading || !isAuthenticated || !input.trim()
                }
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-md bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 sm:flex-none"
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                Send
              </button>
            </div>
          </div>
          {voiceStatus ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-cyan-300/15 bg-slate-950/60 px-3 py-2 text-xs font-medium text-cyan-100">
              <span
                className={[
                  "h-2 w-2 rounded-full",
                  isListening ? "animate-pulse bg-cyan-300" : "bg-slate-600"
                ].join(" ")}
                aria-hidden="true"
              />
              {voiceStatus}
            </div>
          ) : null}
          {isVoiceMode && !isSpeechSynthesisSupported ? (
            <div className="mt-3 rounded-md border border-amber-300/20 bg-amber-950/30 px-3 py-2 text-xs leading-5 text-amber-100">
              Voice replies are not supported in this browser, but chat and memory
              search still work.
            </div>
          ) : null}
        </form>
      </section>

      <aside className="flex flex-col gap-4">
        <AgentPanel
          completedTaskIds={completedTaskIds}
          error={agentError}
          insight={proactiveInsight}
          isEnabled={isAgentMode}
          isLoading={isAgentMemoryLoading || isInsightLoading}
          memories={agentMemories}
          onRefresh={() => {
            void fetchAgentMemories();
            void fetchInsights();
          }}
          onToggleTask={toggleAgentTask}
        />

        <ProactiveInsightsPanel
          error={insightError}
          insight={proactiveInsight}
          isLoading={isInsightLoading}
          onRefresh={() => void fetchInsights()}
        />

        <section className="rounded-lg border border-cyan-300/15 bg-slate-900/76 p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur">
          <div className="mb-3 flex items-center gap-2">
            <Brain className="h-4 w-4 text-cyan-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-cyan-100">Latest Memories Used</h2>
          </div>
          <div className="space-y-3">
            {latestAssistant?.relevantMemories?.length ? (
              latestAssistant.relevantMemories.map((memory) => (
                <MemoryCard key={memory.id} memory={memory} compact />
              ))
            ) : (
              <p className="rounded-md border border-dashed border-cyan-300/20 bg-slate-950/50 px-3 py-4 text-sm leading-6 text-slate-500">
                Memory context from the latest assistant reply will appear here.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-violet-300/15 bg-slate-900/76 p-4 shadow-2xl shadow-violet-950/20 backdrop-blur">
          <div className="mb-3 flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-violet-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-violet-100">Memory Insight</h2>
          </div>
          <p className="mb-3 text-sm leading-6 text-slate-400">
            Summarize categories, repeated themes, and your next local action.
          </p>
          <button
            type="button"
            onClick={() => void sendMessage("Summarize my memories", "insight")}
            disabled={isSending || isAuthLoading || !isAuthenticated}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-violet-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Run Insight Mode
          </button>
        </section>

        <section className="rounded-lg border border-emerald-300/15 bg-slate-900/76 p-4 shadow-2xl shadow-emerald-950/20 backdrop-blur">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-emerald-100">Newly Saved</h2>
          </div>
          <div className="space-y-3">
            {latestAssistant?.savedMemories?.length ? (
              latestAssistant.savedMemories.map((memory) => (
                <MemoryCard key={memory.id} memory={memory} compact />
              ))
            ) : (
              <p className="rounded-md border border-dashed border-emerald-300/20 bg-slate-950/50 px-3 py-4 text-sm leading-6 text-slate-500">
                Durable saved memories from chat will appear here. Questions stay
                as chat messages only.
              </p>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
