import type { SupabaseClient } from "@supabase/supabase-js";
import type { OutcomeType } from "@/lib/outcomes/types";
import { outcomeTypeFromPrediction } from "@/lib/outcomes/predictionOutcomeMap";

const MAJOR_CANDIDATE_PREDICTIONS = new Set([
  "ROLLBACK_RISK",
  "DEPLOYMENT_BLOCKER_RISK",
  "HISTORICAL_FAILURE_MATCH",
  "READINESS_DETERIORATING",
  "DEPENDENCY_DELAY_RISK",
]);

type OrgMajorSettings = {
  major_outage_revenue_threshold_usd: number;
  major_outage_customer_threshold: number;
  production_critical_domains: string[] | null;
};

function impliedCustomerPercentFloor(thresholdCustomers: number): number {
  const assumedBase = 5000;
  return Math.min(100, Math.max(1, (thresholdCustomers / assumedBase) * 100));
}

/**
 * True when change severity / exposure plausibly maps to major-outage risk (Phase 6 gap spec).
 */
export async function isMajorOutageEligibleChange(
  admin: SupabaseClient,
  args: {
    orgId: string;
    changeEventId: string;
    predictionType: string;
  }
): Promise<boolean> {
  const { orgId, changeEventId, predictionType } = args;

  const { data: settings } = await admin
    .from("organization_settings")
    .select("major_outage_revenue_threshold_usd, major_outage_customer_threshold, production_critical_domains")
    .eq("org_id", orgId)
    .maybeSingle();
  const st = settings as OrgMajorSettings | null;
  const revThreshold = Number(st?.major_outage_revenue_threshold_usd ?? 100_000);
  const custThreshold = Number(st?.major_outage_customer_threshold ?? 1000);
  const critDomains = (st?.production_critical_domains ?? null) as string[] | null;

  const { data: ce } = await admin
    .from("change_events")
    .select("domain, estimated_mrr_affected, percent_customer_base_affected, rollback_time_estimate_hours")
    .eq("id", changeEventId)
    .maybeSingle();
  const change = ce as {
    domain?: string | null;
    estimated_mrr_affected?: number | null;
    percent_customer_base_affected?: number | null;
    rollback_time_estimate_hours?: number | null;
  } | null;
  if (!change) return false;

  const { data: latestAssess } = await admin
    .from("impact_assessments")
    .select("risk_bucket")
    .eq("change_event_id", changeEventId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const bucket = String((latestAssess as { risk_bucket?: string } | null)?.risk_bucket ?? "").toUpperCase();
  if (bucket === "CRITICAL") return true;

  const mrr = Number(change.estimated_mrr_affected ?? 0);
  if (Number.isFinite(mrr) && mrr >= revThreshold) return true;

  const pct = change.percent_customer_base_affected;
  if (pct != null && Number.isFinite(pct) && pct >= impliedCustomerPercentFloor(custThreshold)) return true;

  const dom = String(change.domain ?? "");
  if (critDomains && critDomains.length > 0 && dom && critDomains.includes(dom)) return true;

  if (
    predictionType === "ROLLBACK_RISK" &&
    (change.rollback_time_estimate_hours == null || Number(change.rollback_time_estimate_hours) <= 0)
  ) {
    return true;
  }

  return false;
}

/**
 * Resolves outcome_type for a resolved prediction, preferring MAJOR_OUTAGE_AVOIDED when eligible.
 */
export async function resolveOutcomeTypeForResolvedPrediction(
  admin: SupabaseClient,
  args: { orgId: string; changeEventId: string; predictionType: string }
): Promise<OutcomeType | null> {
  const { predictionType } = args;
  if (MAJOR_CANDIDATE_PREDICTIONS.has(predictionType)) {
    const majorOk = await isMajorOutageEligibleChange(admin, args);
    if (majorOk) return "MAJOR_OUTAGE_AVOIDED";
  }
  return outcomeTypeFromPrediction(predictionType);
}

export function isMajorOutageCandidatePredictionType(predictionType: string): boolean {
  return MAJOR_CANDIDATE_PREDICTIONS.has(predictionType);
}
