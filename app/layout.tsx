import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth/auth-provider";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const metadataDescription =
  "A futuristic AI memory system MVP with Supabase Google Auth, private memory CRUD, voice input, and local contextual replies.";

function getMetadataBase() {
  const vercelUrl = process.env.VERCEL_URL;
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (vercelUrl
      ? vercelUrl.startsWith("http")
        ? vercelUrl
        : `https://${vercelUrl}`
      : "https://ai-memory-system.example");

  try {
    return new URL(siteUrl);
  } catch {
    return new URL("https://ai-memory-system.example");
  }
}

export const metadata: Metadata = {
  applicationName: "AI Memory System",
  authors: [{ name: "AI Memory System" }],
  description: metadataDescription,
  keywords: [
    "AI memory",
    "Supabase",
    "Next.js",
    "memory dashboard",
    "voice input",
    "semantic search"
  ],
  metadataBase: getMetadataBase(),
  openGraph: {
    description: metadataDescription,
    siteName: "AI Memory System",
    title: "AI Memory System",
    type: "website",
    url: "/"
  },
  robots: {
    follow: true,
    index: true
  },
  title: {
    default: "AI Memory System",
    template: "%s | AI Memory System"
  },
  twitter: {
    card: "summary_large_image",
    description: metadataDescription,
    title: "AI Memory System"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
