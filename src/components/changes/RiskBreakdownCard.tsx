"use client";

import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/ui";

type ExposureComponents = {
  surface?: string;
  surfaceWeight?: number;
  mrrFactor?: number;
  pctFactor?: number;
  mrr?: number;
  pct?: number;
};

export function RiskBreakdownCard(props: {
  riskExplanation?: unknown;
  baseRiskScore?: number | null;
  exposureMultiplier?: number | null;
  revenueRiskScore?: number | null;
  exposureComponents?: ExposureComponents | null;
}) {
  const e = (props.riskExplanation ?? {}) as Record<string, unknown>;
  const exposureComponents = (props.exposureComponents ?? e.exposureComponents ?? {}) as ExposureComponents;
  const base = props.baseRiskScore != null ? props.baseRiskScore : Number(e.baseRisk ?? 0);
  const learned = Number(e.learnedMultiplier ?? 1);
  const exposure = props.exposureMultiplier != null ? props.exposureMultiplier : Number(e.exposureMultiplier ?? 1);
  const revenueRisk = props.revenueRiskScore != null ? props.revenueRiskScore : Number(e.finalRisk ?? e.baseRisk ?? base);
  const hasExposureBreakdown =
    exposureComponents.surface != null ||
    exposureComponents.surfaceWeight != null ||
    exposureComponents.mrrFactor != null ||
    exposureComponents.pctFactor != null;
  const basePct = base > 1 ? Math.round(base) : Math.round(base * 100);
  const revRiskPct = revenueRisk > 1 ? Math.round(revenueRisk) : Math.round(revenueRisk * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk score details</CardTitle>
        <CardDescription>System-level scoring details for operators and auditors.</CardDescription>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <Stat label="Base risk" value={`${basePct}%`} />
          <Stat label="Learned factor" value={`${learned.toFixed(2)}x`} />
          <Stat label="Exposure factor" value={`${exposure.toFixed(2)}x`} />
          <Stat label="Revenue risk" value={`${revRiskPct}%`} />
        </div>
        {hasExposureBreakdown ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 text-xs text-[var(--text-muted)]">
            Surface {exposureComponents.surface ?? "-"} (x{Number(exposureComponents.surfaceWeight ?? 1.2).toFixed(2)}) |
            MRR factor (x{Number(exposureComponents.mrrFactor ?? 1).toFixed(2)}) |
            Customer impact (x{Number(exposureComponents.pctFactor ?? 1).toFixed(2)})
          </div>
        ) : null}
        <details>
          <summary className="cursor-pointer select-none text-sm font-semibold">Raw scoring record</summary>
          <pre className="mt-2 overflow-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 text-xs">
            {JSON.stringify(props.riskExplanation ?? props, null, 2)}
          </pre>
        </details>
      </CardBody>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}
