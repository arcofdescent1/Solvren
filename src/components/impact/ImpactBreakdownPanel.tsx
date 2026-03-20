"use client";

import { Card, CardBody } from "@/ui";

export type ImpactBreakdownPanelProps = {
  modelKey: string;
  modelVersion: string;
  calculationBreakdown: Record<string, unknown> | null;
  confidenceExplanation: Record<string, unknown> | null;
};

export function ImpactBreakdownPanel({
  modelKey,
  modelVersion,
  calculationBreakdown,
  confidenceExplanation,
}: ImpactBreakdownPanelProps) {
  if (!calculationBreakdown && !confidenceExplanation) return null;

  const formula = calculationBreakdown?.formula as string | undefined;
  const entries = calculationBreakdown
    ? Object.entries(calculationBreakdown).filter(([k]) => k !== "formula")
    : [];
  const reason = (confidenceExplanation?.reason as string) ?? undefined;

  return (
    <Card>
      <CardBody>
        <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Calculation breakdown</h3>
        <p className="font-mono text-xs text-[var(--text-muted)] mb-2">
          {modelKey} v{modelVersion}
        </p>
        {formula && (
          <div className="rounded bg-[var(--bg-surface-2)] p-2 font-mono text-xs mb-3">
            {formula}
          </div>
        )}
        {entries.length > 0 && (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            {entries.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <dt className="text-[var(--text-muted)]">{k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase())}</dt>
                <dd className="font-mono text-right">{typeof v === "number" ? v.toLocaleString() : String(v)}</dd>
              </div>
            ))}
          </dl>
        )}
        {reason && (
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            <strong>Confidence:</strong> {reason}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
