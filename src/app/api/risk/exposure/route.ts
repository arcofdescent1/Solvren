/**
 * Experience 1 — Revenue Exposure API
 * Answers: How much revenue is currently at risk?
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const days = Math.min(parseInt(req.nextUrl.searchParams.get("days") ?? "1", 10) || 1, 90);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: rows, error } = await supabase
    .from("risk_events")
    .select("risk_score, risk_bucket, impact_amount, approved_at")
    .eq("org_id", orgId)
    .gte("timestamp", since.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const events = rows ?? [];
  let totalExposure = 0;
  let highRiskEvents = 0;
  let unapprovedChanges = 0;

  for (const e of events) {
    const impact = Number((e as { impact_amount?: number }).impact_amount);
    if (Number.isFinite(impact)) totalExposure += impact;
    const score = Number((e as { risk_score?: number }).risk_score);
    if (score > 80) highRiskEvents++;
    if (!(e as { approved_at?: string }).approved_at) unapprovedChanges++;
  }

  const approvedCount = events.length - unapprovedChanges;
  const complianceRate = events.length > 0 ? Math.round((approvedCount / events.length) * 100) : 100;

  return NextResponse.json({
    totalExposure,
    highRiskEvents,
    unapprovedChanges,
    complianceRate,
  });
}
