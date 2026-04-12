"use client";

import { cn } from "@/lib/cn";

const STEPS: { key: string; label: string }[] = [
  { key: "team_setup", label: "Team setup" },
  { key: "risk_priorities", label: "Risk priorities" },
  { key: "workflow_alerts", label: "Workflows & alerts" },
  { key: "approval_rules", label: "Approval rules" },
  { key: "first_live_result", label: "First live result" },
];

export function Phase2ProgressSidebar(props: { currentStepKey: string | null | undefined }) {
  const idx = Math.max(
    0,
    STEPS.findIndex((s) => s.key === (props.currentStepKey ?? "team_setup"))
  );
  return (
    <nav className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Activation</p>
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
