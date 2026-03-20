/**
 * Phase 5 — GET /api/reporting/impact/by-system (§18.4).
 * Groups by domain_key (issue domain) as proxy for system; can be extended later.
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
  const issueMap = new Map((issues ?? []).map((i) => [i.id, i]));
  const openIssueIds = [...issueMap.keys()];

  const { data: summaries } = await listIssueImpactSummariesForOrg(supabase, orgId, {
    issueIds: openIssueIds,
    limit: 1000,
  });

  const bySystem: Record<
    string,
    {
      systemKey: string;
      issueCount: number;
      directRealizedLoss: number;
      revenueAtRisk: number;
      operationalCost: number;
    }
  > = {};
  for (const s of summaries ?? []) {
    const issue = issueMap.get(s.issue_id);
    const systemKey = issue?.domain_key ?? "unknown";
    if (!bySystem[systemKey]) {
      bySystem[systemKey] = {
        systemKey,
        issueCount: 0,
        directRealizedLoss: 0,
        revenueAtRisk: 0,
        operationalCost: 0,
      };
    }
    const row = bySystem[systemKey];
    row.issueCount += 1;
    row.directRealizedLoss += s.current_direct_realized_loss_amount ?? 0;
    row.revenueAtRisk += s.current_revenue_at_risk_amount ?? 0;
    row.operationalCost += s.current_operational_cost_amount ?? 0;
  }

  return NextResponse.json({
    bySystem: Object.values(bySystem),
    currencyCode: "USD",
  });
}
