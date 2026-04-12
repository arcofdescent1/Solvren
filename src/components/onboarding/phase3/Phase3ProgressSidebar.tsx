"use client";

import { cn } from "@/lib/cn";

const STEPS: { key: string; label: string }[] = [
  { key: "expand_coverage", label: "Expand coverage" },
  { key: "invite_more_teams", label: "Invite more teams" },
  { key: "executive_visibility", label: "Executive visibility" },
  { key: "prove_value", label: "Prove value" },
  { key: "build_habit", label: "Build habit" },
];

export function Phase3ProgressSidebar(props: { currentStepKey: string | null | undefined }) {
  const key = props.currentStepKey ?? "expand_coverage";
  const idx = Math.max(0, STEPS.findIndex((s) => s.key === key));
  return (
    <nav className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Adoption</p>
      <ol className="space-y-2">
        {STEPS.map((s, i) => (
          <li
            key={s.key}
            className={cn(
              "text-sm",
              i < idx && "text-[var(--text-muted)] line-through decoration-[var(--text-muted)]",
              i === idx && "font-semibold text-[var(--primary)]",
              i > idx && "text-[var(--text-muted)]"
            )}
          >
            {i + 1}. {s.label}
          </li>
        ))}
      </ol>
    </nav>
  );
}
