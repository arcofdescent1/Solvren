"use client";

import { Card, CardBody } from "@/ui";
import { getConfidenceBand, getConfidenceLabel } from "@/modules/impact/domain/confidence-score";
import { useRouter } from "next/navigation";

export type Phase5Impact = {
  directRealizedLoss: number | null;
  revenueAtRisk: number | null;
  avoidedLoss: number | null;
  recoveredValue: number | null;
  operationalCost: number | null;
  confidenceScore: number | null;
  impactScore: number | null;
  currencyCode: string;
  lastCalculatedAt: string | null;
  modelKey: string | null;
  modelVersion: string | null;
};

export function IssueImpactCard({
  impact,
  impactUnknown,
  issueId,
  onShowAssumptions,
}: {
  impact: Phase5Impact | null;
  impactUnknown: boolean;
  issueId?: string;
  onShowAssumptions?: () => void;
}) {
  const router = useRouter();

  const formatAmount = (v: number | null | undefined, code = "USD") => {
    if (v == null) return null;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v);
  };

  const formatConfidence = (v: number | null | undefined) => {
    if (v == null) return null;
    const pct = v > 1 ? v : v * 100;
    return `${Math.round(pct)}%`;
  };

  const handleRecalculate = async () => {
    if (!issueId) return;
    try {
      const res = await fetch(`/api/issues/${issueId}/impact/recalculate`, { method: "POST" });
      if (res.ok) router.refresh();
      else console.error("Recalculate failed:", await res.text());
    } catch (e) {
      console.error("Recalculate error:", e);
    }
  };

  if (impactUnknown && !impact) {
    return (
      <Card>
        <CardBody>
          <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Impact</h3>
          <p className="text-sm text-[var(--text-muted)]">Impact not yet assessed.</p>
          {issueId && (
            <button
              type="button"
              onClick={handleRecalculate}
              className="mt-2 text-sm text-[var(--primary)] hover:underline"
            >
              Trigger assessment
            </button>
          )}
        </CardBody>
      </Card>
    );
  }
  if (!impact) return null;

  const revAtRisk = impact.revenueAtRisk ?? 0;
  const directLoss = impact.directRealizedLoss ?? 0;
  const band = impact.confidenceScore != null ? getConfidenceBand(impact.confidenceScore > 1 ? impact.confidenceScore : impact.confidenceScore * 100) : null;
  const label = band ? getConfidenceLabel(band) : null;

  return (
    <Card>
      <CardBody>
        <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Impact</h3>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {directLoss > 0 && (
            <>
              <dt>Direct realized loss</dt>
              <dd>{formatAmount(directLoss, impact.currencyCode)}</dd>
            </>
          )}
          {revAtRisk > 0 && (
            <>
              <dt>Revenue at risk</dt>
              <dd>{formatAmount(revAtRisk, impact.currencyCode)}</dd>
            </>
          )}
          {(impact.avoidedLoss ?? 0) > 0 && (
            <>
              <dt>Avoided loss</dt>
              <dd>{formatAmount(impact.avoidedLoss!, impact.currencyCode)}</dd>
            </>
          )}
          {(impact.recoveredValue ?? 0) > 0 && (
            <>
              <dt>Recovered value</dt>
              <dd>{formatAmount(impact.recoveredValue!, impact.currencyCode)}</dd>
            </>
          )}
          {(impact.operationalCost ?? 0) > 0 && (
            <>
              <dt>Operational cost</dt>
              <dd>{formatAmount(impact.operationalCost!, impact.currencyCode)}</dd>
            </>
          )}
          {impact.confidenceScore != null && (
            <>
              <dt>Confidence</dt>
              <dd>
                {formatConfidence(impact.confidenceScore)}
                {label && <span className="text-[var(--text-muted)] ml-1">({label})</span>}
              </dd>
            </>
          )}
          {impact.impactScore != null && (
            <>
              <dt>Impact score</dt>
              <dd>{impact.impactScore.toFixed(0)}</dd>
            </>
          )}
          {impact.modelKey && (
            <>
              <dt>Model</dt>
              <dd className="font-mono text-xs">{impact.modelKey}</dd>
            </>
          )}
          {impact.lastCalculatedAt && (
            <>
              <dt>Last calculated</dt>
              <dd className="text-xs text-[var(--text-muted)]">
                {new Date(impact.lastCalculatedAt).toLocaleString()}
              </dd>
            </>
          )}
        </dl>
        <div className="mt-3 flex gap-3">
          {issueId && (revAtRisk > 0 || directLoss > 0) && (
            <button
              type="button"
              onClick={handleRecalculate}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              Recalculate impact
            </button>
          )}
          {onShowAssumptions && (
            <button
              type="button"
              onClick={onShowAssumptions}
              className="text-sm text-[var(--primary)] hover:underline"
            >
              View assumptions
            </button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
