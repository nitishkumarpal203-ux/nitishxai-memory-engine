import type { Metadata } from "next";
import { ChatClient } from "@/components/chat/chat-client";

export const metadata: Metadata = {
  description:
    "Chat with a local AI memory loop that searches private Supabase memories before saving new context.",
  title: "Chat"
};

export default function ChatPage() {
  return (
    <div className="relative min-h-[calc(100vh-81px)] overflow-hidden bg-slate-950 px-4 py-6 text-slate-100 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(34,211,238,0.18),transparent_28rem),radial-gradient(circle_at_82%_12%,rgba(167,139,250,0.16),transparent_24rem),linear-gradient(180deg,#020617_0%,#0f172a_100%)]" />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-normal text-white sm:text-4xl">
            Chat
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
            Send a message, search saved memories locally, and receive a
            contextual reply without external AI API calls.
          </p>
        </section>
        <ChatClient />
      </div>
    </div>
  );
}
