/**
 * Phase 5 — GET /api/reporting/impact/executive-summary (§18.4).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listIssueImpactSummariesForOrg } from "@/modules/impact/persistence/issue-impact-summaries.repository";
import { selectIssues, type IssueStatus } from "@/modules/issues";

const OPEN_STATUSES: IssueStatus[] = ["open", "triaged", "assigned", "in_progress"];

export async function GET(req: NextRequest) {
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
  const openIssueIds = (issues ?? []).map((i) => i.id);

  const { data: summaries } = await listIssueImpactSummariesForOrg(supabase, orgId, {
    issueIds: openIssueIds,
    limit: 1000,
  });

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const totalDirectRealizedLoss = sum(
    (summaries ?? []).map((s) => s.current_direct_realized_loss_amount ?? 0)
  );
  const totalRevenueAtRisk = sum(
    (summaries ?? []).map((s) => s.current_revenue_at_risk_amount ?? 0)
  );
  const totalAvoidedLoss = sum(
    (summaries ?? []).map((s) => s.current_avoided_loss_amount ?? 0)
  );
  const totalRecoveredValue = sum(
    (summaries ?? []).map((s) => s.current_recovered_value_amount ?? 0)
  );
  const totalOperationalCost = sum(
    (summaries ?? []).map((s) => s.current_operational_cost_amount ?? 0)
  );

  return NextResponse.json({
    orgId,
    openIssueCount: openIssueIds.length,
    impactedIssueCount: summaries?.length ?? 0,
    totalDirectRealizedLoss,
    totalRevenueAtRisk,
    totalAvoidedLoss,
    totalRecoveredValue,
    totalOperationalCost,
    currencyCode: "USD",
    asOf: new Date().toISOString(),
  });
}
