/**
 * Phase 5 — GET /api/reporting/impact/by-detector-pack (§18.4).
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listIssueImpactSummariesForOrg } from "@/modules/impact/persistence/issue-impact-summaries.repository";
import { selectIssues } from "@/modules/issues";

const OPEN_STATUSES = ["open", "triaged", "assigned", "in_progress"];

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!membership?.org_id) return NextResponse.json({ error: "No org" }, { status: 403 });

  const orgId = (membership as { org_id: string }).org_id;
  const { data: issues } = await selectIssues(supabase, {
    org_id: orgId,
    status: OPEN_STATUSES,
    limit: 1000,
  });
  const openIssueIds = new Set((issues ?? []).map((i) => i.id));

  const { data: summaries } = await listIssueImpactSummariesForOrg(supabase, orgId, {
    issueIds: [...openIssueIds],
    limit: 1000,
  });

  const byModel: Record<
    string,
    {
      modelKey: string;
      issueCount: number;
      directRealizedLoss: number;
      revenueAtRisk: number;
      avoidedLoss: number;
      recoveredValue: number;
      operationalCost: number;
    }
  > = {};
  for (const s of summaries ?? []) {
    if (!openIssueIds.has(s.issue_id)) continue;
    const key = s.last_model_key || "unknown";
    if (!byModel[key]) {
      byModel[key] = {
        modelKey: key,
        issueCount: 0,
        directRealizedLoss: 0,
        revenueAtRisk: 0,
        avoidedLoss: 0,
        recoveredValue: 0,
        operationalCost: 0,
      };
    }
    const row = byModel[key];
    row.issueCount += 1;
    row.directRealizedLoss += s.current_direct_realized_loss_amount ?? 0;
    row.revenueAtRisk += s.current_revenue_at_risk_amount ?? 0;
    row.avoidedLoss += s.current_avoided_loss_amount ?? 0;
    row.recoveredValue += s.current_recovered_value_amount ?? 0;
    row.operationalCost += s.current_operational_cost_amount ?? 0;
  }

  return NextResponse.json({
    byDetectorPack: Object.values(byModel),
    currencyCode: "USD",
  });
}
