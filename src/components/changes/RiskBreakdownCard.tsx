"use client";

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
  const base = props.baseRiskScore != null
    ? props.baseRiskScore
    : Number(e.baseRisk ?? 0);
  const learned = Number(e.learnedMultiplier ?? 1);
  const exposure = props.exposureMultiplier != null
    ? props.exposureMultiplier
    : Number(e.exposureMultiplier ?? 1);
  const revenueRisk = props.revenueRiskScore != null
    ? props.revenueRiskScore
    : Number(e.finalRisk ?? e.baseRisk ?? base);

  const hasExposureBreakdown =
    exposureComponents.surface != null ||
    exposureComponents.surfaceWeight != null ||
    exposureComponents.mrrFactor != null ||
    exposureComponents.pctFactor != null;

  const basePct = base > 1 ? Math.round(base) : Math.round(base * 100);
  const revRiskPct = revenueRisk > 1 ? Math.round(revenueRisk) : Math.round(revenueRisk * 100);

  return (
    <div className="rounded-2xl border p-4 shadow-sm">
      <div className="text-lg font-semibold">Risk Breakdown</div>
      <div className="text-sm text-neutral-600">
        Explainable, revenue-aware scoring.
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
        <Stat label="Base risk" value={`${basePct}%`} />
        <Stat label="Learned" value={`${learned.toFixed(2)}×`} />
        <Stat label="Exposure multiplier" value={`${exposure.toFixed(2)}×`} />
        <Stat label="Revenue risk" value={`${revRiskPct}%`} />
      </div>

      {hasExposureBreakdown && (
        <div className="mt-3 rounded-xl border bg-white p-3 text-xs text-neutral-600">
          Surface {exposureComponents.surface ?? "—"} (×{Number(exposureComponents.surfaceWeight ?? 1.2).toFixed(2)}) •{" "}
          MRR factor (×{Number(exposureComponents.mrrFactor ?? 1).toFixed(2)}) •{" "}
          Customer impact (×{Number(exposureComponents.pctFactor ?? 1).toFixed(2)})
        </div>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer select-none text-sm font-semibold">
          Why this score?
        </summary>
        <pre className="mt-2 overflow-auto rounded-xl border bg-white p-3 text-xs">
          {JSON.stringify(props.riskExplanation ?? props, null, 2)}
        </pre>
      </details>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="text-xs text-neutral-600">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
