"use client";

import { cn } from "@/lib/cn";

export type IssueSourceType =
  | "change"
  | "detector"
  | "integration_event"
  | "incident"
  | "manual"
  | "system_health"
  | "verification_failure";

const SOURCE_LABELS: Record<IssueSourceType, string> = {
  change: "Change",
  detector: "Detector",
  integration_event: "Integration",
  incident: "Incident",
  manual: "Manual",
  system_health: "System health",
  verification_failure: "Verification",
};

export function IssueSourceBadge({
  sourceType,
  className,
}: {
  sourceType: IssueSourceType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded border border-[var(--border)] bg-[var(--bg-surface-2)] px-1.5 py-0.5 text-xs font-medium text-[var(--text)]",
        className
      )}
    >
      {SOURCE_LABELS[sourceType] ?? sourceType}
    </span>
  );
}
