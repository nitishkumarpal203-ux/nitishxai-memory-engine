"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { BrainCircuit, Loader2, Mic, MicOff } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { MemoryCard } from "@/components/memory-card";
import { useSpeechInput } from "@/components/chat/use-speech-input";
import type { Memory } from "@/types/memory";

type ChatResponse = {
  relevantMemories?: Memory[];
  reply?: string;
  savedMemories?: Memory[];
  saved?: boolean;
  error?: string;
};

export default function HomePage() {
  const { accessToken, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [relevantMemories, setRelevantMemories] = useState<Memory[]>([]);
  const [savedMemories, setSavedMemories] = useState<Memory[]>([]);
  const [savedMessage, setSavedMessage] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const {
    isListening,
    isSupported: isVoiceSupported,
    status: voiceStatus,
    toggleListening
  } = useSpeechInput({
    onChange: setMessage,
    value: message
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedMessage = message.trim();

    if (!trimmedMessage || isSending) {
      return;
    }

    if (!accessToken) {
      setError("Please sign in with Google before saving memories.");
      return;
    }

    setIsSending(true);
    setError("");
    setReply("");
    setRelevantMemories([]);
    setSavedMemories([]);
    setSavedMessage("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ message: trimmedMessage })
      });

      const data = (await response.json()) as ChatResponse;

      if (!response.ok) {
        throw new Error(data.error ?? "The chat API failed.");
      }

      if (data.error || data.saved === false) {
        throw new Error(data.error ?? "The chat API failed.");
      }

      setReply(data.reply ?? "");
      setRelevantMemories(data.relevantMemories ?? []);
      setSavedMemories(data.savedMemories ?? []);
      setSavedMessage("Memory saved successfully.");

      setMessage("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Something went wrong while sending the message."
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-81px)] overflow-hidden bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(20,184,166,0.22),transparent_28rem),radial-gradient(circle_at_80%_10%,rgba(249,115,91,0.18),transparent_24rem),linear-gradient(180deg,#020617_0%,#0f172a_100%)]" />

      <main className="relative mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[1fr_340px]">
        <section className="overflow-hidden rounded-lg border border-cyan-300/15 bg-slate-900/80 shadow-2xl shadow-cyan-950/30 backdrop-blur">
          <div className="border-b border-cyan-300/10 px-5 py-5 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
              Memory Console
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal text-white sm:text-4xl">
              AI Memory Chat
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Send a message to the memory engine. Saved memories are searched
              locally before each contextual reply, then your new memory is stored.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-5 sm:p-6">
            {isAuthLoading ? (
              <div className="inline-flex w-full items-center gap-2 rounded-md border border-cyan-300/15 bg-slate-950/70 px-3 py-3 text-sm text-cyan-100">
                <Loader2 className="h-4 w-4 animate-spin text-cyan-300" aria-hidden="true" />
                Restoring secure session...
              </div>
            ) : null}
            {!isAuthLoading && !isAuthenticated ? (
              <div className="flex flex-col gap-3 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-3 text-sm leading-6 text-cyan-100 sm:flex-row sm:items-center sm:justify-between">
                <span>Sign in to save memories to your private account.</span>
                <Link
                  href="/login?next=/chat"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                >
                  Login
                </Link>
              </div>
            ) : null}
            <label htmlFor="message" className="block text-sm font-medium text-slate-200">
              User message
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Example: Remember that I prefer concise technical explanations and I am building a Supabase memory app."
              className="min-h-40 w-full resize-none rounded-md border border-cyan-300/20 bg-slate-950/80 px-4 py-3 text-sm leading-6 text-slate-100 outline-none ring-0 transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:shadow-[0_0_0_3px_rgba(103,232,249,0.12)]"
            />
            {voiceStatus ? (
              <div className="inline-flex items-center gap-2 rounded-md border border-cyan-300/15 bg-slate-950/60 px-3 py-2 text-xs font-medium text-cyan-100">
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

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Voice input and private memory saves stay available after sign in.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={isSending || !isVoiceSupported}
                  className={[
                    "relative inline-flex h-11 w-14 items-center justify-center overflow-visible rounded-md border transition disabled:cursor-not-allowed disabled:opacity-50",
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
                    isSending ||
                    isAuthLoading ||
                    !isAuthenticated ||
                    !message.trim()
                  }
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-md bg-cyan-300 px-5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 sm:flex-none"
                >
                  {isSending ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </form>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-emerald-300/15 bg-emerald-950/30 p-4 shadow-xl shadow-emerald-950/20 backdrop-blur">
            <h2 className="text-sm font-semibold text-emerald-200">Memory status</h2>
            <p className="mt-2 text-sm leading-6 text-emerald-50/80">
              {isSending
                ? "Sending message to the memory engine..."
                : savedMessage || "Success confirmations will appear here."}
            </p>
          </section>

          <section className="rounded-lg border border-red-300/15 bg-red-950/20 p-4 shadow-xl shadow-red-950/20 backdrop-blur">
            <h2 className="text-sm font-semibold text-red-200">API error</h2>
            <p className="mt-2 text-sm leading-6 text-red-50/80">
              {error || "API failures will appear here."}
            </p>
          </section>

          <section className="rounded-lg border border-violet-300/15 bg-slate-900/70 p-4 shadow-xl shadow-violet-950/20 backdrop-blur">
            <h2 className="text-sm font-semibold text-violet-200">Local response</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
              {reply || "The local reply will appear after a successful send."}
            </p>
          </section>

          <section className="rounded-lg border border-cyan-300/15 bg-slate-900/70 p-4 shadow-xl shadow-cyan-950/20 backdrop-blur">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-cyan-300" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-cyan-100">
                Relevant Memories Used
              </h2>
            </div>
            <div className="mt-3 space-y-3">
              {relevantMemories.length ? (
                relevantMemories.map((memory) => (
                  <MemoryCard key={memory.id} memory={memory} compact />
                ))
              ) : (
                <p className="rounded-md border border-dashed border-cyan-300/20 bg-slate-950/50 px-3 py-4 text-sm leading-6 text-slate-500">
                  Matching saved memories will appear here when the local search finds context.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-violet-300/15 bg-slate-900/70 p-4 shadow-xl shadow-violet-950/20 backdrop-blur">
            <h2 className="text-sm font-semibold text-violet-200">Newly saved</h2>
            <div className="mt-3 space-y-3">
              {savedMemories.length ? (
                savedMemories.map((memory) => (
                  <MemoryCard key={memory.id} memory={memory} compact />
                ))
              ) : (
                <p className="rounded-md border border-dashed border-violet-300/20 bg-slate-950/50 px-3 py-4 text-sm leading-6 text-slate-500">
                  The latest saved memory will appear here.
                </p>
              )}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
