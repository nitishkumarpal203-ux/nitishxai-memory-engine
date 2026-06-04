"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

export function LoginPanel() {
  const router = useRouter();
  const { isAuthenticated, isLoading, signInWithGoogle } = useAuth();
  const [error, setError] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/chat");
    }
  }, [isAuthenticated, isLoading, router]);

  async function handleGoogleLogin() {
    setError("");
    setIsSigningIn(true);

    try {
      await signInWithGoogle();
    } catch (loginError) {
      setIsSigningIn(false);
      setError(
        loginError instanceof Error
          ? loginError.message
          : "Google login could not be started."
      );
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-81px)] overflow-hidden bg-slate-950 px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(34,211,238,0.2),transparent_28rem),radial-gradient(circle_at_82%_16%,rgba(168,85,247,0.18),transparent_26rem),linear-gradient(180deg,#020617_0%,#0f172a_100%)]" />

      <main className="relative mx-auto grid min-h-[calc(100vh-161px)] w-full max-w-5xl items-center gap-8 lg:grid-cols-[1fr_420px]">
        <section className="flex flex-col gap-5">
          <span className="inline-flex w-fit items-center gap-2 rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Secure Memory Access
          </span>
          <div>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-normal text-white sm:text-5xl">
              Sign in to unlock your private memory engine.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Your memories are scoped to your Supabase user id, so every chat,
              edit, delete, and search stays tied to your Google-authenticated
              account.
            </p>
          </div>
        </section>

        <section className="rounded-lg border border-cyan-300/15 bg-slate-900/82 p-5 shadow-2xl shadow-cyan-950/30 backdrop-blur sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-md border border-violet-300/20 bg-violet-400/10 text-violet-200">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-white">Google Login</h2>
              <p className="text-sm text-slate-500">Session persists locally.</p>
            </div>
          </div>

          {error ? (
            <div className="mb-4 rounded-md border border-red-300/20 bg-red-950/30 px-3 py-2 text-sm leading-6 text-red-100">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading || isSigningIn}
            className="group relative inline-flex h-12 w-full items-center justify-center gap-3 overflow-hidden rounded-md border border-cyan-200/40 bg-cyan-300 px-5 text-sm font-semibold text-slate-950 shadow-[0_0_34px_rgba(34,211,238,0.28)] transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
          >
            <span className="absolute inset-0 bg-white/20 opacity-0 blur-xl transition group-hover:opacity-100" />
            {isLoading || isSigningIn ? (
              <Loader2 className="relative h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <span className="relative grid h-6 w-6 place-items-center rounded-full bg-white text-sm font-bold text-slate-950">
                G
              </span>
            )}
            <span className="relative">
              {isSigningIn ? "Opening Google..." : "Continue with Google"}
            </span>
            {!isSigningIn && !isLoading ? (
              <LogIn className="relative h-4 w-4" aria-hidden="true" />
            ) : null}
          </button>

          <p className="mt-4 text-xs leading-5 text-slate-500">
            After Google redirects back, Supabase restores your session and the
            app sends your access token to protected memory routes.
          </p>
        </section>
      </main>
    </div>
  );
}
