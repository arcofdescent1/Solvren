"use client";

/**
 * Phase 10 — Playbook performance card (§19.5).
 */
import Link from "next/link";
import { Badge } from "@/ui/primitives/badge";

type Props = {
  playbookKey: string;
  displayName: string;
  healthState: string;
  performanceScore: number;
  recoveredAmount: number;
  avoidedAmount: number;
  savingsAmount: number;
  runCount: number;
  verificationSuccessRate?: number | null;
  lastActivity?: string | null;
};

export function PlaybookPerformanceCard(props: Props) {
  const healthVariant =
    props.healthState === "HEALTHY"
      ? "success"
      : props.healthState === "DEGRADED"
        ? "warning"
        : props.healthState === "BLOCKED"
          ? "danger"
          : "secondary";

  return (
    <Link
      href={`/admin/autonomy/playbooks/${props.playbookKey}/performance`}
      className="block rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4 transition hover:border-[var(--primary)]/30"
    >
      <div className="flex items-start justify-between">
        <h4 className="text-sm font-semibold text-[var(--text)]">{props.displayName}</h4>
        <Badge variant={healthVariant}>{props.healthState}</Badge>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-[var(--text-muted)]">Score</span>
          <p className="font-medium">{props.performanceScore}</p>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Runs</span>
          <p className="font-medium">{props.runCount}</p>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Recovered</span>
          <p className="font-medium">${props.recoveredAmount.toLocaleString()}</p>
        </div>
        <div>
          <span className="text-[var(--text-muted)]">Avoided</span>
          <p className="font-medium">${props.avoidedAmount.toLocaleString()}</p>
        </div>
      </div>
      {props.verificationSuccessRate != null && (
        <p className="mt-2 text-xs text-[var(--text-muted)]">
          Verification: {(props.verificationSuccessRate * 100).toFixed(0)}%
        </p>
      )}
    </Link>
  );
}
