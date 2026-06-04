"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Brain,
  Bot,
  CalendarCheck,
  Layers,
  Lightbulb,
  Loader2,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Target,
  Wand2
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
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

function createMessageId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

export function ChatClient() {
  const { accessToken, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(starterMessages);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    isListening,
    isSupported: isVoiceSupported,
    status: voiceStatus,
    toggleListening
  } = useSpeechInput({
    onChange: setInput,
    value: input
  });

  const latestAssistant = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages]
  );

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

      if (!response.ok || data.error || data.saved === false) {
        throw new Error(data.error ?? "The chat request failed.");
      }

      setMessages((current) => [
        ...current,
        {
          id: createMessageId(),
          insight: data.insight ?? null,
          mode: data.mode ?? mode,
          relevantMemories: data.relevantMemories ?? [],
          role: "assistant",
          savedMemories: data.savedMemories ?? [],
          text: data.reply ?? "I could not generate a local reply."
        }
      ]);
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
          <span className="inline-flex w-fit items-center gap-2 rounded-md border border-violet-300/20 bg-violet-400/10 px-3 py-1.5 text-xs font-medium text-violet-200">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            No external AI APIs
          </span>
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
                  <p className="whitespace-pre-wrap">{message.text}</p>

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
                disabled={isSending || !isVoiceSupported}
                className={[
                  "relative inline-flex min-h-12 w-14 items-center justify-center overflow-visible rounded-md border text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
                  isListening
                    ? "border-cyan-200 bg-cyan-300 text-slate-950 shadow-[0_0_32px_rgba(34,211,238,0.55)]"
                    : "border-cyan-300/25 bg-cyan-300/10 text-cyan-100 hover:border-cyan-300/55 hover:bg-cyan-300/20"
                ].join(" ")}
                aria-label={isListening ? "Stop voice input" : "Start voice input"}
                title={isListening ? "Stop voice input" : "Start voice input"}
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
        </form>
      </section>

      <aside className="flex flex-col gap-4">
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
                The latest saved chat memory will appear here.
              </p>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
