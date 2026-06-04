"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { getSupabaseBrowser } from "@/lib/supabase/browser";

export function AuthCallback() {
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function finishSignIn() {
      const supabase = getSupabaseBrowser();

      try {
        const { data, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!data.session) {
          throw new Error(
            "Google sign in completed, but Supabase did not return a session. Please try again."
          );
        }

        window.location.replace(`${window.location.origin}/chat`);
      } catch (callbackError) {
        if (!isMounted) return;

        setError(
          callbackError instanceof Error
            ? callbackError.message
            : "Google sign in could not be completed."
        );
      }
    }

    void finishSignIn();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="relative min-h-[calc(100vh-81px)] overflow-hidden bg-slate-950 px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.2),transparent_28rem),radial-gradient(circle_at_82%_14%,rgba(168,85,247,0.16),transparent_26rem),linear-gradient(180deg,#020617_0%,#0f172a_100%)]" />
      <main className="relative mx-auto flex min-h-[calc(100vh-161px)] w-full max-w-xl items-center justify-center">
        <section className="w-full rounded-lg border border-cyan-300/15 bg-slate-900/82 p-5 text-center shadow-2xl shadow-cyan-950/30 backdrop-blur sm:p-6">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-md border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
            {error ? (
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            )}
          </span>
          <h1 className="mt-4 text-xl font-semibold text-white">
            {error ? "Sign in needs attention" : "Completing Google sign in"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {error ||
              "Hold tight while Supabase restores your authenticated session."}
          </p>
        </section>
      </main>
    </div>
  );
}
