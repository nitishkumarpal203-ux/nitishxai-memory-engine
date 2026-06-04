import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCallback } from "@/components/auth/auth-callback";

export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false
  },
  title: "Auth Callback"
};

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[calc(100vh-81px)] place-items-center bg-slate-950 px-4 text-cyan-100">
          Completing secure sign in...
        </div>
      }
    >
      <AuthCallback />
    </Suspense>
  );
}
