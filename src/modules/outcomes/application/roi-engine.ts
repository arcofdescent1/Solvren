/**
 * Phase 7 — ROI Engine (§14).
 * ROI = (Recovered + Avoided + Savings) / Cost
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ROIMetrics = {
  totalRecovered: number;
  totalAvoided: number;
  totalSavings: number;
  totalValue: number;
  totalCost: number;
  roiMultiple: number | null;
  outcomeCount: number;
  periodStart: string;
  periodEnd: string;
};

export async function computeOrgROI(
  supabase: SupabaseClient,
  orgId: string,
  params?: { sinceDays?: number }
): Promise<ROIMetrics> {
  const days = params?.sinceDays ?? 30;
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  const { data: outcomes } = await supabase
    .from("outcomes")
    .select("outcome_type, amount")
    .eq("org_id", orgId)
    .gte("created_at", sinceIso);

  let totalRecovered = 0;
  let totalAvoided = 0;
  let totalSavings = 0;

  for (const o of outcomes ?? []) {
    const amt = Number((o as { amount: number }).amount) || 0;
    switch ((o as { outcome_type: string }).outcome_type) {
      case "recovered_revenue":
        totalRecovered += amt;
        break;
      case "avoided_loss":
        totalAvoided += amt;
        break;
      case "operational_savings":
        totalSavings += amt;
        break;
    }
  }

  const totalValue = totalRecovered + totalAvoided + totalSavings;

  const { data: costRow } = await supabase
    .from("organizations")
    .select("plan, metadata_json")
    .eq("id", orgId)
    .maybeSingle();

  const planCost = (costRow as { plan?: string; metadata_json?: { monthly_cost?: number } } | null)?.metadata_json?.monthly_cost;
  const totalCost = typeof planCost === "number" && planCost > 0 ? planCost : 1;
  const roiMultiple = totalCost > 0 ? Math.round((totalValue / totalCost) * 100) / 100 : null;

  const periodEnd = new Date().toISOString();

  return {
    totalRecovered,
    totalAvoided,
    totalSavings,
    totalValue,
    totalCost,
    roiMultiple,
    outcomeCount: (outcomes ?? []).length,
    periodStart: sinceIso,
    periodEnd,
  };
}
