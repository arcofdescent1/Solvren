/**
 * Phase 5 — Assumption set (§5.9).
 */
export type AssumptionSource = "default" | "org_override" | "derived" | "imported";

export type AssumptionValue = {
  key: string;
  displayName: string;
  value: number | string | boolean;
  valueType: "number" | "string" | "boolean";
  source: AssumptionSource;
  confidenceScore?: number | null;
};

export const DEFAULT_ASSUMPTION_KEYS = [
  "avg_deal_size",
  "mql_to_opportunity_rate",
  "opportunity_to_close_rate",
  "meeting_to_opportunity_rate",
  "lead_response_decay_factor",
  "payment_recovery_rate",
  "avg_subscription_mrr",
  "avg_ltv_multiplier",
  "loaded_labor_cost_per_hour",
  "duplicate_cleanup_minutes_per_record",
  "critical_surface_revenue_share",
] as const;
