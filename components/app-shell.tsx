import { AppNav, BrandMark } from "@/components/app-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-cyan-300/10 bg-slate-950/88 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <BrandMark />
          <AppNav />
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
