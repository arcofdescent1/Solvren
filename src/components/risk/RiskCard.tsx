"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

export type RiskCardProps = {
  id: string;
  provider: string;
  object: string;
  riskType: string;
  impactAmount: number | null;
  riskScore?: number;
  riskBucket?: string;
  status: "Approved" | "Pending" | "Missing" | "Unapproved";
  changeEventId?: string | null;
  className?: string;
};

function formatMoney(n: number | null) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function humanRiskType(rt: string) {
  return rt.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function riskLevel(score?: number, bucket?: string): "High" | "Medium" | "Low" {
  const b = (bucket ?? "").toUpperCase();
  if (b === "CRITICAL" || b === "HIGH" || (score != null && score > 80)) return "High";
  if (b === "MODERATE" || (score != null && score > 50)) return "Medium";
  return "Low";
}

export function RiskCard(props: RiskCardProps) {
  const {
    id, provider, object, riskType, impactAmount, riskScore, riskBucket,
    status, changeEventId, className,
  } = props;

  const level = riskLevel(riskScore, riskBucket);

  const levelStyles: Record<string, string> = {
    High: "border-[var(--danger)]/60 bg-[color:color-mix(in_oklab,var(--danger)_8%,var(--bg-surface))]",
    Medium: "border-[var(--warning)]/50 bg-[color:color-mix(in_oklab,var(--warning)_6%,var(--bg-surface))]",
    Low: "border-[var(--border)] bg-[var(--bg-surface)]",
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-all duration-200 hover:shadow-md hover:border-[var(--primary)]/40",
        levelStyles[level],
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "shrink-0 rounded px-2 py-0.5 text-xs font-semibold",
            level === "High" && "bg-[var(--danger)]/20 text-[var(--danger)]",
            level === "Medium" && "bg-[var(--warning)]/20 text-[var(--warning)]",
            level === "Low" && "bg-[var(--text-muted)]/20 text-[var(--text-muted)]"
          )}
        >
          {level} Risk
        </span>
        <span
          className={cn(
            "rounded px-2 py-0.5 text-xs font-medium",
            status === "Approved" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
            status === "Pending" && "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
            (status === "Missing" || status === "Unapproved") && "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
          )}
        >
          {status === "Missing" ? "Approval Missing" : status}
        </span>
      </div>
      <h4 className="mt-2 font-semibold text-[var(--text)]">{humanRiskType(riskType)} Detected</h4>
      <p className="mt-1 text-sm text-[var(--text-muted)]">System: {provider} · {object || "—"}</p>
      <p className="mt-1 text-sm font-medium text-[var(--primary)]">Impact: {formatMoney(impactAmount)}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={`/risk/event/${id}`}
          className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text)] hover:bg-[var(--bg-surface-2)]"
        >
          Review Event
        </Link>
        {!changeEventId && (
          <Link
            href={`/changes/new?linkRiskId=${id}`}
            className="inline-flex h-8 items-center justify-center rounded-md bg-[var(--primary)] px-3 text-xs font-medium text-[var(--primary-contrast)] hover:bg-[var(--primary-hover)]"
          >
            Create Change Request
          </Link>
        )}
        {changeEventId && (
          <Link
            href={`/changes/${changeEventId}`}
            className="inline-flex h-8 items-center justify-center rounded-md border border-[var(--primary)] px-3 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary)]/10"
          >
            View Change Request
          </Link>
        )}
      </div>
    </div>
  );
}
