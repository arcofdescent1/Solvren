import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConfidenceLevel } from "@/lib/outcomes/types";
import { confidenceMeetsRollupThreshold } from "@/lib/outcomes/types";
import { evaluateOutcomeThresholds } from "@/lib/outcomes/evaluateOutcomeThresholds";
import type { PeriodMetricsSlice } from "@/lib/outcomes/evaluateOutcomeThresholds";
import { createOutcomeNotifications } from "@/lib/outcomes/createOutcomeNotifications";

/** Calendar quarter */
function calendarQuarterBounds(ref: Date): { start: Date; end: Date } {
  const cq = Math.floor(ref.getUTCMonth() / 3);
  const start = new Date(Date.UTC(ref.getUTCFullYear(), cq * 3, 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), cq * 3 + 3, 0, 23, 59, 59, 999));
  return { start, end };
}

function monthBounds(ref: Date): { start: Date; end: Date } {
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return { start, end };
}

/** Fiscal year starts month `fiscalStartMonth` (1–12). Quarters are Jul–Sep, etc. when fs=7. */
function fiscalQuarterBounds(ref: Date, fiscalStartMonth: number): { start: Date; end: Date } {
  const y = ref.getUTCFullYear();
  const m = ref.getUTCMonth() + 1;
  const fy = m >= fiscalStartMonth ? y : y - 1;
  const monthInFy = m >= fiscalStartMonth ? m - fiscalStartMonth : m + 12 - fiscalStartMonth;
  const q = Math.min(3, Math.floor(monthInFy / 3));
  let sy = fy;
  let sm = fiscalStartMonth - 1 + q * 3;
  while (sm >= 12) {
    sm -= 12;
    sy += 1;
  }
  const start = new Date(Date.UTC(sy, sm, 1));
  const end = new Date(Date.UTC(sy, sm + 3, 0, 23, 59, 59, 999));
  return { start, end };
}

export function periodRange(
  kind: "MONTH" | "QUARTER",
  ref: Date,
  fiscalStartMonth: number | null
): { start: Date; end: Date } {
  if (kind === "MONTH") return monthBounds(ref);
  if (fiscalStartMonth != null && fiscalStartMonth >= 1 && fiscalStartMonth <= 12) {
    return fiscalQuarterBounds(ref, fiscalStartMonth);
  }
  return calendarQuarterBounds(ref);
}

/** Period start keys aligned with outcome_metrics upsert (fiscal quarter when configured). */
export function outcomeMetricPeriodStartKeys(ref: Date, fiscalYearStartMonth: number | null): {
  monthStart: string;
  quarterStart: string;
} {
  const m = periodRange("MONTH", ref, fiscalYearStartMonth);
  const q = periodRange("QUARTER", ref, fiscalYearStartMonth);
  return {
    monthStart: m.start.toISOString().slice(0, 10),
    quarterStart: q.start.toISOString().slice(0, 10),
  };
}

/**
 * Recompute and upsert outcome_metrics for a period (idempotent).
 */
export async function recomputeOutcomeMetricsForPeriod(args: {
  admin: SupabaseClient;
  orgId: string;
  periodType: "MONTH" | "QUARTER";
  refDate?: Date;
}): Promise<{ revenue: number; incidents: number; hours: number; readiness: number }> {
  const ref = args.refDate ?? new Date();
  const { data: settings } = await args.admin
    .from("organization_settings")
    .select(
      "value_tracking_enabled, revenue_confidence_threshold_in_rollups, fiscal_year_start_month, value_milestone_usd_thresholds"
    )
    .eq("org_id", args.orgId)
    .maybeSingle();
  const st = settings as {
    value_tracking_enabled?: boolean;
    revenue_confidence_threshold_in_rollups?: ConfidenceLevel;
    fiscal_year_start_month?: number | null;
    value_milestone_usd_thresholds?: number[] | null;
  } | null;
  if (st?.value_tracking_enabled === false) {
    return { revenue: 0, incidents: 0, hours: 0, readiness: 0 };
  }

  const threshold = (st?.revenue_confidence_threshold_in_rollups ?? "HIGH_CONFIDENCE") as ConfidenceLevel;
  const fiscal = st?.fiscal_year_start_month ?? null;
  const { start, end } = periodRange(args.periodType, ref, fiscal);
  const startIso = start.toISOString().slice(0, 10);
  const endIso = end.toISOString().slice(0, 10);

  const { data: stories } = await args.admin
    .from("value_stories")
    .select("id, estimated_value, outcome_type, confidence_level, finalized_at, status")
    .eq("org_id", args.orgId)
    .eq("status", "ACTIVE")
    .not("finalized_at", "is", null)
    .gte("finalized_at", start.toISOString())
    .lte("finalized_at", end.toISOString());

  const seen = new Set<string>();
  let revenue = 0;
  let incidents = 0;
  let hours = 0;
  let readinessSum = 0;
  let readinessW = 0;

  for (const row of stories ?? []) {
    const r = row as {
      id: string;
      estimated_value: number;
      outcome_type: string;
      confidence_level: ConfidenceLevel;
    };
    if (seen.has(r.id)) continue;
    seen.add(r.id);

    const ot = r.outcome_type;
    if (
      (ot === "REVENUE_INCIDENT_AVOIDED" ||
        ot === "MAJOR_OUTAGE_AVOIDED" ||
        ot === "RELEASE_BLOCKER_AVOIDED" ||
        ot === "APPROVAL_DELAY_AVOIDED") &&
      confidenceMeetsRollupThreshold(r.confidence_level, threshold)
    ) {
      revenue += Number(r.estimated_value ?? 0);
    }
    if (ot === "REVENUE_INCIDENT_AVOIDED" || ot === "MAJOR_OUTAGE_AVOIDED") {
      incidents += 1;
    }
    if (ot === "APPROVAL_TIME_SAVED") {
      hours += Number(r.estimated_value ?? 0);
    }
    if (ot === "READINESS_IMPROVED") {
      const pts = Number(r.estimated_value ?? 0);
      readinessSum += pts;
      readinessW += 1;
    }
  }

  const revenueRounded = Math.round(revenue);
  const readinessAvg = readinessW > 0 ? readinessSum / readinessW : 0;

  await args.admin.from("outcome_metrics").upsert(
    {
      org_id: args.orgId,
      period_type: args.periodType,
      period_start: startIso,
      period_end: endIso,
      revenue_protected: revenueRounded,
      incidents_prevented: incidents,
      approval_hours_saved: hours,
      readiness_points_gained: Math.round(readinessAvg * 100) / 100,
      calculated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,period_type,period_start" }
  );

  const milestones = Array.isArray(st?.value_milestone_usd_thresholds)
    ? st!.value_milestone_usd_thresholds!
    : [50_000, 100_000, 250_000, 1_000_000];

  const currentSlice: PeriodMetricsSlice = {
    revenue: revenueRounded,
    incidents,
    hours,
    readiness: readinessAvg,
    periodStart: startIso,
    periodEnd: endIso,
  };

  const priorRef = new Date(start.getTime() - 86400000);
  const priorBounds = periodRange(args.periodType, priorRef, fiscal);
  const priorStartIso = priorBounds.start.toISOString().slice(0, 10);
  const { data: priorRow } = await args.admin
    .from("outcome_metrics")
    .select("revenue_protected, incidents_prevented, approval_hours_saved, readiness_points_gained, period_start, period_end")
    .eq("org_id", args.orgId)
    .eq("period_type", args.periodType)
    .eq("period_start", priorStartIso)
    .maybeSingle();
  const pr = priorRow as {
    revenue_protected?: number;
    incidents_prevented?: number;
    approval_hours_saved?: number;
    readiness_points_gained?: number;
    period_start?: string;
    period_end?: string;
  } | null;
  const priorSlice: PeriodMetricsSlice | null = pr
    ? {
        revenue: Number(pr.revenue_protected ?? 0),
        incidents: Number(pr.incidents_prevented ?? 0),
        hours: Number(pr.approval_hours_saved ?? 0),
        readiness: Number(pr.readiness_points_gained ?? 0),
        periodStart: String(pr.period_start ?? priorStartIso),
        periodEnd: String(pr.period_end ?? ""),
      }
    : null;

  const events = evaluateOutcomeThresholds({
    orgId: args.orgId,
    mode: args.periodType === "QUARTER" ? "QUARTER" : "MONTH",
    current: currentSlice,
    prior: priorSlice,
    milestoneUsd: milestones,
  });
  if (events.length > 0) {
    await createOutcomeNotifications(args.admin, args.orgId, events);
  }

  return {
    revenue: revenueRounded,
    incidents,
    hours,
    readiness: readinessAvg,
  };
}
