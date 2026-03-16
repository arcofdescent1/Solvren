import type { SupabaseClient } from "@supabase/supabase-js";
import { applyExposure } from "./exposureMultiplier";
import { getSurfaceWeight } from "@/services/domains/surfaceWeights";

/**
 * Recompute and persist revenue exposure fields on a change.
 * Uses domain_surface_weights when available for per-domain surface weights.
 */
export async function recomputeAndPersistRevenueFields(
  supabase: SupabaseClient,
  args: { changeId: string }
) {
  const { changeId } = args;

  const { data: c, error } = await supabase
    .from("change_events")
    .select(
      "id, domain, estimated_mrr_affected, percent_customer_base_affected, revenue_surface"
    )
    .eq("id", changeId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!c) throw new Error("Change not found");

  const { data: output } = await supabase
    .from("risk_assessment_outputs")
    .select("base_risk_score")
    .eq("change_event_id", changeId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: assessment } = await supabase
    .from("impact_assessments")
    .select("risk_score_raw")
    .eq("change_event_id", changeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const baseFromOutput =
    output?.base_risk_score != null ? Number(output.base_risk_score) : null;
  const riskScore =
    assessment?.risk_score_raw == null
      ? 0
      : Number(assessment.risk_score_raw);
  const baseRiskScore =
    baseFromOutput != null ? baseFromOutput / 100 : riskScore / 100;
  const estimatedMrr =
    c.estimated_mrr_affected == null
      ? null
      : Number(c.estimated_mrr_affected);
  const pct =
    c.percent_customer_base_affected == null
      ? null
      : Number(c.percent_customer_base_affected);
  const surface = (c.revenue_surface ?? null) as string | null;
  const domainKey = (c.domain ?? "REVENUE") as string;

  let surfaceWeight: number | null = null;
  try {
    surfaceWeight = await getSurfaceWeight(supabase, {
      domainKey,
      revenueSurface: surface ?? "SUBSCRIPTION",
    });
  } catch {
    surfaceWeight = null;
  }

  const exp = applyExposure({
    baseRiskScore,
    revenueSurface: surface,
    surfaceWeight,
    estimatedMrrAffected: estimatedMrr,
    percentCustomerBaseAffected: pct,
  });

  const revenueAtRisk =
    estimatedMrr == null
      ? 0
      : Math.max(0, estimatedMrr * exp.revenueRiskScore);

  const { error: updErr } = await supabase
    .from("change_events")
    .update({
      base_risk_score: baseRiskScore,
      exposure_multiplier: exp.exposureMultiplier,
      revenue_risk_score: exp.revenueRiskScore,
      exposure_components: (exp.exposureComponents ?? {}) as Record<string, unknown>,
      revenue_exposure_multiplier: exp.exposureMultiplier,
      revenue_exposure_normalized: Math.min(1, exp.revenueRiskScore),
      revenue_exposure_explanation: (exp.exposureComponents ?? {}) as Record<string, unknown>,
      revenue_at_risk: revenueAtRisk,
    })
    .eq("id", changeId);

  if (updErr) throw new Error(updErr.message);

  return {
    exposureMultiplier: exp.exposureMultiplier,
    normalizedExposure: Math.min(1, exp.revenueRiskScore),
    explanation: exp.exposureComponents,
    revenueAtRisk,
    baseRiskScore,
    revenueRiskScore: exp.revenueRiskScore,
  };
}
