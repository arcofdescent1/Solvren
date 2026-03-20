"use client";

import { cn } from "@/lib/cn";

export type IssueStatus =
  | "open"
  | "triaged"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "verified"
  | "dismissed";

const STATUS_STYLES: Record<IssueStatus, string> = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  triaged: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  assigned: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
  in_progress: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-200",
  resolved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  verified: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
  dismissed: "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400",
};

export function IssueStatusBadge({
  status,
  className,
}: {
  status: IssueStatus;
  className?: string;
}) {
  const label = status.replace("_", " ");
  return (
    <span
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700",
        className
      )}
    >
      {label}
    </span>
  );
}
