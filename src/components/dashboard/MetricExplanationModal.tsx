"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
} from "@/ui/primitives/dialog";
import { Button } from "@/ui/primitives/button";

export type MetricKey =
  | "revenue_exposure"
  | "unapproved_changes"
  | "governance_coverage"
  | "open_risk_events";

type Provenance = {
  revenueExposure?: { sourceEventIds: string[]; formula: string };
  unapprovedChanges?: { count: number; formula: string };
  governanceCoverage?: { approved: number; total: number; formula: string };
  openRiskEvents?: { sourceEventIds: string[]; count: number; formula: string };
};

const METRIC_LABELS: Record<MetricKey, string> = {
  revenue_exposure: "Revenue Exposure",
  unapproved_changes: "Unapproved Changes",
  governance_coverage: "Governance Coverage",
  open_risk_events: "Open Risk Events",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metricKey: MetricKey;
  displayValue: string;
  showCalculationDetails?: boolean;
};

export function MetricExplanationModal({
  open,
  onOpenChange,
  metricKey,
  displayValue,
  showCalculationDetails = false,
}: Props) {
  const [provenance, setProvenance] = useState<Provenance | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setProvenance(null);
    fetch("/api/metrics/executive?provenance=1")
      .then((r) => r.json())
      .then((j) => setProvenance(j.provenance ?? null))
      .catch(() => setProvenance(null))
      .finally(() => setLoading(false));
  }, [open]);

  const keyMap: Record<MetricKey, keyof Provenance> = {
    revenue_exposure: "revenueExposure",
    unapproved_changes: "unapprovedChanges",
    governance_coverage: "governanceCoverage",
    open_risk_events: "openRiskEvents",
  };
  const p = provenance?.[keyMap[metricKey]];
  const label = METRIC_LABELS[metricKey];
  const formula =
    p && typeof p === "object" && "formula" in p
      ? (p as { formula: string }).formula
      : p && "approved" in p && "total" in p
        ? `${(p as { approved: number }).approved} approved / ${(p as { total: number }).total} total risk events`
        : "";

  const sourceIds: string[] =
    p && typeof p === "object" && "sourceEventIds" in p
      ? (p as { sourceEventIds: string[] }).sourceEventIds ?? []
      : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Explain: {label}</DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <p className="text-2xl font-semibold text-[var(--text)]">{displayValue}</p>
          <p className="text-sm text-[var(--text-muted)]">
            This number represents the {label.toLowerCase()} for your organization in the current
            window (last 7 days).
          </p>
          {loading ? (
            <p className="text-sm text-[var(--text-muted)]">Loading calculation details…</p>
          ) : (
            <>
              {(showCalculationDetails || formula) && formula && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Calculation
                  </h4>
                  <p className="mt-1 text-sm text-[var(--text)]">{formula}</p>
                </div>
              )}
              {sourceIds.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Source events ({sourceIds.length})
                  </h4>
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm">
                    {sourceIds.slice(0, 20).map((id) => (
                      <li key={id}>
                        <Link
                          href={`/risk/event/${id}`}
                          className="text-[var(--primary)] hover:underline"
                        >
                          Risk event {id.slice(0, 8)}…
                        </Link>
                      </li>
                    ))}
                    {sourceIds.length > 20 && (
                      <li className="text-[var(--text-muted)]">
                        … and {sourceIds.length - 20} more.{" "}
                        <Link href="/risk/audit" className="text-[var(--primary)] hover:underline">
                          View all
                        </Link>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Link href="/risk/audit">
            <Button onClick={() => onOpenChange(false)}>View risk events</Button>
          </Link>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
