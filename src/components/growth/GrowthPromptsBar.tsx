"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * Phase 6 — Inline expansion prompt (E3) using top insight from GET /api/insights.
 */
export function GrowthPromptsBar() {
  const [prompt, setPrompt] = useState<{
    title: string;
    description: string;
    href?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/insights")
      .then((r) => r.json())
      .then((j: { growthPrompts?: Array<{ title: string; description: string; href?: string }> }) => {
        const p = j.growthPrompts?.[0];
        if (p) setPrompt({ title: p.title, description: p.description, href: p.href });
      })
      .catch(() => {});
  }, []);

  if (!prompt) return null;

  return (
    <div
      className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 text-sm"
      data-testid="growth-prompts-bar"
    >
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[var(--text)]">{prompt.title}</p>
        <p className="text-[var(--text-muted)]">{prompt.description}</p>
      </div>
      {prompt.href ? (
        <Link
          href={prompt.href}
          className="shrink-0 font-semibold text-[var(--primary)] hover:underline"
        >
          Act →
        </Link>
      ) : null}
    </div>
  );
}
