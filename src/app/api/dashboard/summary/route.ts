/**
 * GET /api/dashboard/summary
 * Gap 1: Hero metrics for the Overview dashboard.
 * Returns: totalExposure, highRiskEvents, unapprovedChanges, complianceRate
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) {
    return NextResponse.json({
      totalExposure: 0,
      highRiskEvents: 0,
      unapprovedChanges: 0,
      complianceRate: 100,
    });
  }

  const since = new Date();
  since.setDate(since.getDate() - 7);

  const { data: riskRows } = await supabase
    .from("risk_events")
    .select("id, impact_amount, risk_score, approved_at")
    .eq("org_id", activeOrgId)
    .gte("timestamp", since.toISOString());

  let totalExposure = 0;
  let highRiskEvents = 0;
  let unapprovedChanges = 0;
  for (const e of riskRows ?? []) {
    const impact = Number(e.impact_amount);
    if (Number.isFinite(impact)) totalExposure += impact;
    if (Number(e.risk_score) > 80) highRiskEvents++;
    if (!e.approved_at) unapprovedChanges++;
  }
  const total = (riskRows ?? []).length;
  const complianceRate = total > 0 ? Math.round(((total - unapprovedChanges) / total) * 100) : 100;

  return NextResponse.json({
    totalExposure,
    highRiskEvents,
    unapprovedChanges,
    complianceRate,
  });
}
