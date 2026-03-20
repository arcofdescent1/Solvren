"use client";

import { cn } from "@/lib/cn";

export type IssueSeverity = "low" | "medium" | "high" | "critical";

const SEVERITY_STYLES: Record<IssueSeverity, string> = {
  low: "bg-slate-100 text-slate-800 dark:bg-slate-800/50 dark:text-slate-200",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
};

export function IssueSeverityBadge({
  severity,
  className,
}: {
  severity: IssueSeverity;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 text-xs font-medium",
        SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.medium,
        className
      )}
    >
      {severity}
    </span>
  );
}
