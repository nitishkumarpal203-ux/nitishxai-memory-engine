"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/memories")}`);
    }
  }, [isAuthenticated, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-cyan-300/15 bg-slate-900/76 p-6 text-center shadow-2xl shadow-cyan-950/30 backdrop-blur">
        <Loader2
          className="mx-auto h-6 w-6 animate-spin text-cyan-300"
          aria-hidden="true"
        />
        <p className="mt-3 text-sm font-medium text-cyan-100">
          Restoring secure session...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="rounded-lg border border-cyan-300/15 bg-slate-900/76 p-6 text-center shadow-2xl shadow-cyan-950/30 backdrop-blur">
        <ShieldCheck
          className="mx-auto h-6 w-6 text-cyan-300"
          aria-hidden="true"
        />
        <p className="mt-3 text-sm font-medium text-cyan-100">
          Redirecting to Google login...
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
