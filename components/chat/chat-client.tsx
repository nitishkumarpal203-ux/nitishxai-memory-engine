"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Brain, Loader2, Mic, MicOff, Send, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { MemoryCard } from "@/components/memory-card";
import { useSpeechInput } from "@/components/chat/use-speech-input";
import type { Memory } from "@/types/memory";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  relevantMemories?: Memory[];
  savedMemories?: Memory[];
};

type ChatResponse = {
  relevantMemories?: Memory[];
  reply?: string;
  savedMemories?: Memory[];
  saved?: boolean;
  error?: string;
};

const starterMessages: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    text:
      "Tell me something useful to remember, like a project, preference, constraint, or goal. I will search your saved memories first, reply with local context, then save the new memory."
  }
];

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();

    if (!message || isSending) {
      return;
    }

    if (!accessToken) {
      setError("Please sign in with Google before saving memories.");
      return;
    }

    setError(null);
    setInput("");
    setIsSending(true);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: message
    };

    setMessages((current) => [...current, userMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message })
      });

      const data = (await response.json()) as ChatResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "The chat request failed.");
      }

      if (data.error || data.saved === false) {
        throw new Error(data.error ?? "The chat request failed.");
      }

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: data.reply ?? "I could not generate a reply.",
          relevantMemories: data.relevantMemories ?? [],
          savedMemories: data.savedMemories ?? []
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

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="flex min-h-[620px] flex-col overflow-hidden rounded-lg border border-cyan-300/15 bg-slate-900/82 shadow-2xl shadow-cyan-950/30 backdrop-blur">
        <div className="flex items-center justify-between border-b border-cyan-300/10 px-4 py-3 sm:px-5">
          <div>
            <h2 className="text-sm font-semibold text-cyan-100">Conversation</h2>
            <p className="text-xs text-slate-500">Local contextual memory loop</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-md border border-violet-300/20 bg-violet-400/10 px-3 py-1.5 text-xs font-medium text-violet-200">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Mock AI
          </span>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5">
          {messages.map((message) => (
            <article
              key={message.id}
              className={[
                "flex",
                message.role === "user" ? "justify-end" : "justify-start"
              ].join(" ")}
            >
              <div
                className={[
                  "max-w-[820px] rounded-lg px-4 py-3 text-sm leading-6 shadow-sm",
                  message.role === "user"
                    ? "bg-cyan-300 text-slate-950"
                    : "border border-cyan-300/15 bg-slate-950/76 text-slate-100"
                ].join(" ")}
              >
                {message.text}
                {message.role === "assistant" && message.relevantMemories?.length ? (
                  <div className="mt-4 border-t border-cyan-300/10 pt-4">
                    <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                      <Brain className="h-3.5 w-3.5" aria-hidden="true" />
                      Relevant Memories Used
                    </h3>
                    <div className="grid gap-3">
                      {message.relevantMemories.map((memory) => (
                        <MemoryCard key={memory.id} memory={memory} compact />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </article>
          ))}

          {isSending ? (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/15 bg-slate-950/70 px-4 py-3 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin text-cyan-300" aria-hidden="true" />
                Searching context and saving memory...
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
              <span>Sign in to save memories to your private account.</span>
              <Link
                href="/login?next=/chat"
                className="inline-flex h-10 items-center justify-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
              >
                Login
              </Link>
            </div>
          ) : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Share a preference, project detail, goal, or anything the assistant should remember..."
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
            <h2 className="text-sm font-semibold text-cyan-100">Relevant Memories Used</h2>
          </div>
          <div className="space-y-3">
            {latestAssistant?.relevantMemories?.length ? (
              latestAssistant.relevantMemories.map((memory) => (
                <MemoryCard key={memory.id} memory={memory} compact />
              ))
            ) : (
              <p className="rounded-md border border-dashed border-cyan-300/20 bg-slate-950/50 px-3 py-4 text-sm leading-6 text-slate-500">
                Relevant memories from the latest reply will appear here.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-violet-300/15 bg-slate-900/76 p-4 shadow-2xl shadow-violet-950/20 backdrop-blur">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-300" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-violet-100">Newly saved</h2>
          </div>
          <div className="space-y-3">
            {latestAssistant?.savedMemories?.length ? (
              latestAssistant.savedMemories.map((memory) => (
                <MemoryCard key={memory.id} memory={memory} compact />
              ))
            ) : (
              <p className="rounded-md border border-dashed border-violet-300/20 bg-slate-950/50 px-3 py-4 text-sm leading-6 text-slate-500">
                Saved memories from the latest message will appear here.
              </p>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
