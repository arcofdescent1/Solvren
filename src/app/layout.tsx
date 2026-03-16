import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

import { ThemeInitScript } from "@/ui";

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
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
