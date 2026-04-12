"use client";

import { Badge, Stack } from "@/ui";

export type Phase3Milestones = {
  expansionOk: boolean;
  deptOk: boolean;
  execOk: boolean;
  valueOk: boolean;
  habitOk: boolean;
  allComplete: boolean;
};

export function AdoptionMilestoneChecklist(props: { milestones: Phase3Milestones }) {
  const items: { ok: boolean; label: string }[] = [
    { ok: props.milestones.expansionOk, label: "Additional expansion (2+ integrations or workflows beyond baseline)" },
    { ok: props.milestones.deptOk, label: "Multi-team usage (3+ active departments, 14d)" },
    { ok: props.milestones.execOk, label: "Executive engagement (dashboard or delivered summary)" },
    { ok: props.milestones.valueOk, label: "Proven value (canonical value story)" },
    { ok: props.milestones.habitOk, label: "Habit (5+ interactions across 2+ ISO weeks)" },
  ];
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Phase 3 exit criteria</p>
      <Stack gap={2}>
        {items.map((it) => (
          <div key={it.label} className="flex items-center justify-between gap-2 text-sm">
            <span>{it.label}</span>
            <Badge variant={it.ok ? "secondary" : "outline"}>{it.ok ? "Done" : "Pending"}</Badge>
          </div>
        ))}
      </Stack>
    </div>
  );
}
