"use client";

import { cn } from "@/lib/cn";

export type VerificationStatus = "pending" | "passed" | "failed" | "not_required";

const VERIFICATION_STYLES: Record<VerificationStatus, string> = {
  pending: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
  passed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  not_required: "bg-slate-100 text-slate-500 dark:bg-slate-800/50 dark:text-slate-400",
};

export function IssueVerificationBadge({
  status,
  className,
}: {
  status: VerificationStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 text-xs font-medium",
        VERIFICATION_STYLES[status] ?? VERIFICATION_STYLES.pending,
        className
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}
