export type OutcomeThresholdType =
  | "QUARTERLY_VALUE_MILESTONE"
  | "REVENUE_GROWTH_DELTA"
  | "APPROVAL_TIME_IMPROVEMENT"
  | "READINESS_IMPROVEMENT";

export type OutcomeThresholdEvent = {
  shouldNotify: boolean;
  thresholdType: OutcomeThresholdType;
  headline: string;
  body: string;
  /** Dedupe base without channel suffix */
  dedupeKeyBase: string;
};

export type PeriodMetricsSlice = {
  revenue: number;
  incidents: number;
  hours: number;
  readiness: number;
  periodStart: string;
  periodEnd: string;
};

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Compare current vs prior period metrics; used right after outcome_metrics upsert.
 * Quarter mode: revenue milestones, revenue delta, approval hours. Month mode: readiness only.
 */
export function evaluateOutcomeThresholds(args: {
  orgId: string;
  mode: "QUARTER" | "MONTH";
  current: PeriodMetricsSlice;
  prior: PeriodMetricsSlice | null;
  milestoneUsd: number[];
}): OutcomeThresholdEvent[] {
  const out: OutcomeThresholdEvent[] = [];
  const { orgId, mode, current, prior, milestoneUsd } = args;

  if (mode === "QUARTER") {
    if (prior && prior.revenue > 0) {
      const growth = (current.revenue - prior.revenue) / prior.revenue;
      if (growth >= 0.25) {
        const pct = Math.round(growth * 100);
        out.push({
          shouldNotify: true,
          thresholdType: "REVENUE_GROWTH_DELTA",
          headline: "Revenue protected grew materially",
          body: `Estimated revenue protected increased by about ${pct}% compared to the prior quarter.`,
          dedupeKeyBase: `outcomes:${orgId}:REVENUE_GROWTH_DELTA:${current.periodStart}:${current.periodEnd}`,
        });
      }
    }

    const crossed = milestoneUsd.filter((m) => current.revenue >= m && (!prior || prior.revenue < m));
    const milestoneToAnnounce =
      crossed.length === 0
        ? null
        : prior == null
          ? Math.max(...crossed)
          : null;
    if (prior == null && milestoneToAnnounce != null) {
      out.push({
        shouldNotify: true,
        thresholdType: "QUARTERLY_VALUE_MILESTONE",
        headline: "Quarterly value milestone",
        body: `Solvren helped protect an estimated ${formatMoney(current.revenue)} this quarter, crossing ${formatMoney(milestoneToAnnounce)}.`,
        dedupeKeyBase: `outcomes:${orgId}:QUARTERLY_VALUE_MILESTONE:${milestoneToAnnounce}:${current.periodStart}:${current.periodEnd}`,
      });
    } else if (prior != null) {
      for (const m of crossed) {
        out.push({
          shouldNotify: true,
          thresholdType: "QUARTERLY_VALUE_MILESTONE",
          headline: "Quarterly value milestone",
          body: `Solvren helped protect an estimated ${formatMoney(current.revenue)} this quarter, crossing ${formatMoney(m)}.`,
          dedupeKeyBase: `outcomes:${orgId}:QUARTERLY_VALUE_MILESTONE:${m}:${current.periodStart}:${current.periodEnd}`,
        });
      }
    }

    if (prior && prior.hours > 0) {
      const imp = (prior.hours - current.hours) / prior.hours;
      if (imp >= 0.2) {
        out.push({
          shouldNotify: true,
          thresholdType: "APPROVAL_TIME_IMPROVEMENT",
          headline: "Approval cycle time improved",
          body: `Approval hours saved improved by about ${Math.round(imp * 100)}% compared to the prior quarter.`,
          dedupeKeyBase: `outcomes:${orgId}:APPROVAL_TIME_IMPROVEMENT:${current.periodStart}:${current.periodEnd}`,
        });
      }
    }
  }

  if (mode === "MONTH" && prior && current.readiness - prior.readiness >= 10) {
    const d = Math.round(current.readiness - prior.readiness);
    out.push({
      shouldNotify: true,
      thresholdType: "READINESS_IMPROVEMENT",
      headline: "Readiness gains",
      body: `Average readiness improvement increased by ${d} points compared to the prior month.`,
      dedupeKeyBase: `outcomes:${orgId}:READINESS_IMPROVEMENT:${current.periodStart}:${current.periodEnd}`,
    });
  }

  return out.filter((e) => e.shouldNotify);
}
