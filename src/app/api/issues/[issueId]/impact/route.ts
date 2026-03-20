/**
 * Phase 5 — GET /api/issues/:issueId/impact (§18.3).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getIssueDetail } from "@/modules/issues";
import { getIssueImpactSummary } from "@/modules/impact/persistence/issue-impact-summaries.repository";
import { getLatestAssessmentForIssue } from "@/modules/impact/persistence/impact-assessments.repository";
import { getConfidenceBand, getConfidenceLabel } from "@/modules/impact/domain/confidence-score";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { issueId } = await params;
  const { issue } = await getIssueDetail(supabase, issueId);
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  const { data: summary } = await getIssueImpactSummary(supabase, issueId);
  if (!summary) {
    return NextResponse.json({
      hasImpact: false,
      message: "Impact not yet calculated",
    });
  }

  const band = getConfidenceBand(summary.current_confidence_score);
  const base = {
    hasImpact: true,
    directRealizedLoss: summary.current_direct_realized_loss_amount,
    revenueAtRisk: summary.current_revenue_at_risk_amount,
    avoidedLoss: summary.current_avoided_loss_amount,
    recoveredValue: summary.current_recovered_value_amount,
    operationalCost: summary.current_operational_cost_amount,
    confidenceScore: summary.current_confidence_score,
    confidenceBand: band,
    confidenceLabel: getConfidenceLabel(band),
    impactScore: summary.current_impact_score,
    currencyCode: summary.currency_code,
    lastCalculatedAt: summary.last_calculated_at,
    lastModelKey: summary.last_model_key,
    lastModelVersion: summary.last_model_version,
  };

  const { searchParams } = new URL(req.url);
  if (searchParams.get("expand") === "breakdown,assumptions") {
    const { data: assessment } = await getLatestAssessmentForIssue(supabase, issue.org_id, issueId);
    return NextResponse.json({
      ...base,
      calculationBreakdown: (assessment as { calculation_breakdown_json?: Record<string, unknown> } | null)?.calculation_breakdown_json ?? null,
      assumptionsSnapshot: (assessment as { assumptions_snapshot_json?: Record<string, unknown> } | null)?.assumptions_snapshot_json ?? null,
      confidenceExplanation: (assessment as { confidence_explanation_json?: Record<string, unknown> } | null)?.confidence_explanation_json ?? null,
    });
  }

  return NextResponse.json(base);
}
