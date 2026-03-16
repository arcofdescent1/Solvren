import type { SupabaseClient } from "@supabase/supabase-js";
import { computeRevenueExposureMultiplier } from "@/services/risk/exposure";
import { getLearnedMultiplierForSignals } from "@/services/risk/learnedMultiplier";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export async function scoreRevenueChange(
  supabase: SupabaseClient,
  args: {
    changeId: string;
    orgId: string;
    domain?: string;
    detectedSignals: string[];
    baseRisk: number;
  }
) {
  const { changeId, orgId, domain = "REVENUE", detectedSignals, baseRisk } = args;

  const { data: c, error } = await supabase
    .from("change_events")
    .select(
      "estimated_mrr_affected,percent_customer_base_affected,revenue_surface,revenue_exposure_multiplier"
    )
    .eq("id", changeId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  const exposure =
    c?.revenue_exposure_multiplier != null
      ? Number(c.revenue_exposure_multiplier)
      : computeRevenueExposureMultiplier({
          estimatedMrrAffected: c?.estimated_mrr_affected ?? null,
          percentCustomerBaseAffected: c?.percent_customer_base_affected ?? null,
          revenueSurface: c?.revenue_surface ?? null,
        }).multiplier;

  const learned = await getLearnedMultiplierForSignals(supabase, {
    orgId,
    domain,
    signalKeys: detectedSignals,
    modelVersion: 1,
  });

  const { count: appliedCount } = await supabase
    .from("change_mitigation_actions")
    .select("id", { head: true, count: "exact" })
    .eq("org_id", orgId)
    .eq("change_event_id", changeId)
    .eq("status", "APPLIED");

  const exposureCapped = clamp(exposure, 1, 10);
  const learnedCapped = clamp(learned.multiplier, 0.7, 1.6);
  const baseCapped = clamp(baseRisk, 0, 100);

  const orgCap = 1.8;
  const combined = clamp(learnedCapped * exposureCapped, 1, orgCap);
  const mitigationDampener =
    appliedCount != null && appliedCount > 0 ? 0.92 : 1.0;
  const finalRisk = clamp(
    baseCapped * combined * mitigationDampener,
    0,
    100
  );

  const explanation = {
    model: "revenue_v1",
    baseRisk: baseCapped,
    learnedMultiplier: learnedCapped,
    learnedDetails: learned.details,
    exposureMultiplier: exposureCapped,
    mitigationDampener,
    appliedMitigationsCount: appliedCount ?? 0,
    finalRisk,
  };

  await supabase
    .from("change_events")
    .update({
      risk_explanation: explanation,
      revenue_exposure_multiplier: exposureCapped,
    })
    .eq("id", changeId);

  const { data: assessment } = await supabase
    .from("impact_assessments")
    .select("id")
    .eq("change_event_id", changeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assessment?.id) {
    const bucket = finalRisk >= 75 ? "CRITICAL" : finalRisk >= 50 ? "HIGH" : finalRisk >= 25 ? "MEDIUM" : "LOW";
    await supabase
      .from("impact_assessments")
      .update({
        risk_score_raw: Math.round(finalRisk),
        risk_bucket: bucket,
        domain,
      })
      .eq("id", assessment.id);
  }

  return { finalRisk: Math.round(finalRisk), explanation };
}
