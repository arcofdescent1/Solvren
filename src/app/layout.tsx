import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

import { ThemeInitScript } from "@/ui";

export const runtime = "nodejs";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** SB Admin Pro baseline: Inter as fallback (add /public/fonts/metropolis/ for Metropolis). */
const sbProSans = Inter({
  variable: "--font-sbpro-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Solvren — Know the Financial Risk of Every Revenue System Change",
    template: "%s | Solvren",
  },
  description:
    "Solvren helps teams govern pricing, billing, and revenue-impacting changes with risk intelligence, automated coordination, evidence enforcement, and executive visibility.",
  icons: {
    icon: [{ url: "/images/Solvren.svg", type: "image/svg+xml" }],
  },
};

/**
 * Root layout: html and body only. Shell ownership is determined by route groups:
 * - (public) → PublicShell
 * - (app) → AppShell + auth guard
 * - docs → docs layout
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${sbProSans.variable} ${geistMono.variable}`}
    >
      <head>
        <ThemeInitScript />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__SUPABASE_ENV__={url:${JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")},key:${JSON.stringify(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "")}};`,
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
