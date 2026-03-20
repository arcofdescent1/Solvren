"use client";

import { cn } from "@/lib/cn";

export function IssuePriorityBadge({
  score,
  className,
}: {
  score: number | null;
  className?: string;
}) {
  if (score == null) return null;
  const tier = score >= 80 ? "high" : score >= 50 ? "medium" : "low";
  const styles = {
    high: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    low: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 text-xs font-medium tabular-nums",
        styles[tier],
        className
      )}
    >
      P{Math.round(score)}
    </span>
  );
}
