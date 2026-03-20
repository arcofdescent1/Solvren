/**
 * Phase 5 — Impact engine (§6, §15).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getImpactModelForDetector } from "../persistence/impact-models.repository";
import { insertImpactAssessment } from "../persistence/impact-assessments.repository";
import { upsertIssueImpactSummary } from "../persistence/issue-impact-summaries.repository";
import { assembleImpactInputs } from "./impact-input-assembler.service";
import { computeConfidenceScore } from "./confidence-scorer.service";
import { computeImpactScore } from "./impact-score.service";
import { getImpactModel } from "../registry/impact-model-registry";

export type AssessImpactInput = {
  orgId: string;
  issueId?: string | null;
  findingId?: string | null;
  detectorKey?: string | null;
};

export type AssessImpactResult =
  | { ok: true; assessmentId: string }
  | { ok: false; error: string };

export async function assessImpact(
  supabase: SupabaseClient,
  input: AssessImpactInput
): Promise<AssessImpactResult> {
  const assembled = await assembleImpactInputs(supabase, {
    orgId: input.orgId,
    issueId: input.issueId,
    findingId: input.findingId,
  });
  if (!assembled) return { ok: false, error: "Could not assemble inputs" };

  const detectorKey = input.detectorKey ?? assembled.detectorKey;
  if (!detectorKey) return { ok: false, error: "No detector key for impact model selection" };

  const { data: modelDef, error: modelErr } = await getImpactModelForDetector(supabase, detectorKey);
  if (modelErr || !modelDef) return { ok: false, error: "No impact model for detector" };

  const model = getImpactModel(modelDef.model_key);
  if (!model) return { ok: false, error: "Impact model implementation not found" };

  const ctx = {
    orgId: assembled.orgId,
    issueId: assembled.issueId,
    findingId: assembled.findingId,
    detectorKey,
    evidenceBundle: assembled.evidenceBundle,
    signals: assembled.signals,
    assumptions: assembled.assumptions,
    modelDefinition: modelDef,
  };

  const result = await model.evaluate(ctx);

  const { score: confidenceScore, explanation: confidenceExplanation } = computeConfidenceScore({
    hasDirectAmount: (result.directRealizedLossAmount ?? 0) > 0 || hasDirectAmountInEvidence(assembled.evidenceBundle),
    hasOrgAssumptions: Object.keys(assembled.assumptions).length > 0,
    signalQuality: assembled.signals.length > 0 ? 0.8 : 0.5,
    entityLinkConfidence: 0.8,
  });

  const impactScore = computeImpactScore({
    directRealizedLoss: result.directRealizedLossAmount,
    revenueAtRisk: result.revenueAtRiskAmount,
    operationalCost: result.operationalCostAmount,
    affectedCustomerCount: result.affectedCustomerCount,
    confidenceScore: result.confidenceScore > 0 ? result.confidenceScore : confidenceScore,
  });

  const finalConfidence = result.confidenceScore > 0 ? result.confidenceScore : confidenceScore;

  const { data: assessment, error: insErr } = await insertImpactAssessment(supabase, {
    org_id: input.orgId,
    issue_id: input.issueId ?? null,
    finding_id: input.findingId ?? null,
    impact_model_id: modelDef.id,
    model_key: modelDef.model_key,
    model_version: modelDef.model_version,
    assessment_status: result.assessmentStatus,
    direct_realized_loss_amount: result.directRealizedLossAmount,
    revenue_at_risk_amount: result.revenueAtRiskAmount,
    avoided_loss_amount: result.avoidedLossAmount,
    recovered_value_amount: result.recoveredValueAmount,
    operational_cost_amount: result.operationalCostAmount,
    affected_customer_count: result.affectedCustomerCount,
    affected_record_count: result.affectedRecordCount,
    confidence_score: finalConfidence,
    impact_score: impactScore,
    currency_code: "USD",
    inputs_snapshot_json: result.inputsSnapshot,
    assumptions_snapshot_json: result.assumptionsSnapshot,
    calculation_breakdown_json: result.calculationBreakdown,
    confidence_explanation_json: result.confidenceExplanation?.reason
      ? result.confidenceExplanation
      : confidenceExplanation,
    superseded_by_assessment_id: null,
  });

  if (insErr || !assessment) return { ok: false, error: insErr?.message ?? "Insert failed" };

  if (input.issueId) {
    await upsertIssueImpactSummary(supabase, {
      issue_id: input.issueId,
      org_id: input.orgId,
      latest_assessment_id: assessment.id,
      current_direct_realized_loss_amount: result.directRealizedLossAmount,
      current_revenue_at_risk_amount: result.revenueAtRiskAmount,
      current_avoided_loss_amount: result.avoidedLossAmount,
      current_recovered_value_amount: result.recoveredValueAmount,
      current_operational_cost_amount: result.operationalCostAmount,
      current_confidence_score: finalConfidence,
      current_impact_score: impactScore,
      currency_code: "USD",
      last_calculated_at: new Date().toISOString(),
      last_model_key: modelDef.model_key,
      last_model_version: modelDef.model_version,
    });
  }

  return { ok: true, assessmentId: assessment.id };
}

function hasDirectAmountInEvidence(eb: Record<string, unknown>): boolean {
  const timeline = eb.timeline as Array<{ detail?: string }> | undefined;
  if (Array.isArray(timeline)) {
    return timeline.some((t) => t.detail && String(t.detail).includes("$"));
  }
  return false;
}
