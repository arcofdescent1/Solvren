"use client";

import { Badge, Stack } from "@/ui";

export type Phase2Milestones = {
  teamOk: boolean;
  workflowOk: boolean;
  alertDeliveredOk: boolean;
  approvalOk: boolean;
  operationalOk: boolean;
  allComplete: boolean;
};

export function MilestoneChecklist(props: { milestones: Phase2Milestones }) {
  const items: { ok: boolean; label: string }[] = [
    { ok: props.milestones.teamOk, label: "Team (2+ members beyond owner)" },
    { ok: props.milestones.workflowOk, label: "Monitoring workflow enabled" },
    { ok: props.milestones.alertDeliveredOk, label: "Alert delivered" },
    { ok: props.milestones.approvalOk, label: "Approval policy active" },
    { ok: props.milestones.operationalOk, label: "First operational signal" },
  ];
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Completion checklist</p>
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
