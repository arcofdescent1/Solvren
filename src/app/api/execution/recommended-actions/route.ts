/**
 * Phase 6 Deep Expansion — GET /api/execution/recommended-actions?issueId=...
 * Returns recommended actions for an issue with impact, confidence, risk.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getIssueDetail } from "@/modules/issues";
import { listAllActions } from "@/modules/execution/registry/action-registry";
import { getPlaybooksForDomain } from "@/modules/execution/playbooks/playbook-registry";
import { getAccountsByOrg } from "@/modules/integrations/core/integrationAccountsRepo";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const issueId = searchParams.get("issueId");
  if (!issueId) return NextResponse.json({ error: "issueId required" }, { status: 400 });

  const { issue } = await getIssueDetail(supabase, issueId);
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  const { data: accounts } = await getAccountsByOrg(supabase, issue.org_id);
  const connected = new Set(
    (accounts ?? []).filter((a) => a.provider && (a.status === "connected" || a.status === "degraded")).map((a) => a.provider)
  );

  const allActions = listAllActions();
  const filtered = allActions.filter((a) => connected.has(a.provider));

  const { data: impactRow } = await supabase
    .from("issue_impact_summaries")
    .select("current_revenue_at_risk_amount, current_impact_score, current_confidence_score")
    .eq("issue_id", issueId)
    .maybeSingle();

  const impact = impactRow as { current_revenue_at_risk_amount?: number; current_impact_score?: number; current_confidence_score?: number } | null;
  const revenueAtRisk = impact?.current_revenue_at_risk_amount ?? 0;
  const impactScore = impact?.current_impact_score ?? 0;
  const confidenceScore = impact?.current_confidence_score ?? 0.7;

  const recommended = filtered.map((a) => {
    const autoEligible = a.executionMode === "auto" && a.riskLevel === "low";
    const suggested = a.executionMode === "suggested" || autoEligible;
    return {
      ...a,
      impact: revenueAtRisk,
      confidence: confidenceScore,
      riskLevel: a.riskLevel,
      autoEligible,
      suggested,
    };
  });

  const playbooks = getPlaybooksForDomain(issue.domain_key ?? "revenue");

  return NextResponse.json({
    recommended,
    playbooks,
    impact: { revenueAtRisk, impactScore, confidenceScore },
  });
}
