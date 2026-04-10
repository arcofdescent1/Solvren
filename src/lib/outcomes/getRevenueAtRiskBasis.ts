import type { SupabaseClient } from "@supabase/supabase-js";

export type RevenueAtRiskBasis = {
  source: "CHANGE_EVENT_ESTIMATED_MRR";
  monthlyValue: number | null;
  assumedMonths: number;
  basisLabel: string;
};

/**
 * Central source for Phase 6 revenue-at-risk; migrate impact_assessments here later.
 */
export async function getRevenueAtRiskBasis(
  admin: SupabaseClient,
  changeEventId: string
): Promise<RevenueAtRiskBasis> {
  const { data: ce } = await admin
    .from("change_events")
    .select("estimated_mrr_affected")
    .eq("id", changeEventId)
    .maybeSingle();
  const raw = (ce as { estimated_mrr_affected?: number | null } | null)?.estimated_mrr_affected;
  const monthlyValue =
    raw == null || !Number.isFinite(Number(raw)) ? null : Math.max(0, Number(raw));
  return {
    source: "CHANGE_EVENT_ESTIMATED_MRR",
    monthlyValue,
    assumedMonths: 1,
    basisLabel: "Based on estimated monthly revenue at risk recorded on the change.",
  };
}
