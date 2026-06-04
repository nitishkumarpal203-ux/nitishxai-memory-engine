"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BrainCircuit,
  Database,
  Loader2,
  LogIn,
  LogOut,
  MessageSquare,
  UserCircle
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

const navItems = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/memories", label: "Memories", icon: Database }
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, signOut, user } = useAuth();
  const avatarUrl =
    typeof user?.user_metadata?.avatar_url === "string"
      ? user.user_metadata.avatar_url
      : "";
  const email = user?.email ?? "";

  async function handleLogout() {
    await signOut();
    router.push("/login");
  }

  return (
    <nav className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex flex-wrap items-center gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
              "focus-ring inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium transition",
              active
                ? "bg-cyan-300 text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.18)]"
                : "text-slate-400 hover:bg-slate-900 hover:text-cyan-100"
              ].join(" ")}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        {isLoading ? (
          <span className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            Auth
          </span>
        ) : isAuthenticated ? (
          <>
            <span className="inline-flex h-10 max-w-[220px] items-center gap-2 rounded-md border border-cyan-300/20 bg-slate-950 px-2.5 text-xs font-medium text-cyan-100 shadow-[0_0_20px_rgba(34,211,238,0.12)]">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  className="h-6 w-6 rounded-full border border-cyan-300/30"
                />
              ) : (
                <UserCircle className="h-5 w-5 text-cyan-300" aria-hidden="true" />
              )}
              <span className="truncate">{email}</span>
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="focus-ring inline-flex h-10 items-center gap-2 rounded-md border border-red-300/20 bg-red-400/10 px-3 text-sm font-medium text-red-200 transition hover:border-red-300/45 hover:bg-red-400/20"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Logout
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="focus-ring inline-flex h-10 items-center gap-2 rounded-md bg-cyan-300 px-3 text-sm font-semibold text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.2)] transition hover:bg-cyan-200"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Login
          </Link>
        )}
      </div>
    </nav>
  );
}

export function BrandMark() {
  return (
    <Link href="/chat" className="focus-ring inline-flex items-center gap-3 rounded-md">
      <span className="grid h-10 w-10 place-items-center rounded-md bg-pine text-white shadow-sm">
        <BrainCircuit className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="flex flex-col">
        <span className="text-sm font-semibold text-white">AI Memory System</span>
        <span className="text-xs text-slate-500">Next.js + Supabase MVP</span>
      </span>
    </Link>
  );
}
