import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginPanel } from "@/components/auth/login-panel";

export const metadata: Metadata = {
  description:
    "Sign in with Supabase Google Auth to access private AI memory storage.",
  title: "Login"
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-[calc(100vh-81px)] place-items-center bg-slate-950 px-4 text-cyan-100">
          Restoring login panel...
        </div>
      }
    >
      <LoginPanel />
    </Suspense>
  );
}
