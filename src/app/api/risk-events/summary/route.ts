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

  const days = Math.min(parseInt(req.nextUrl.searchParams.get("days") ?? "7", 10) || 7, 90);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: rows, error } = await supabase
    .from("risk_events")
    .select("risk_score, risk_bucket, impact_amount, approved_at, provider")
    .eq("org_id", orgId)
    .gte("timestamp", since.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const events = rows ?? [];
  let totalImpact = 0;
  let highRiskCount = 0;
  let unapprovedCount = 0;
  const byProvider = new Map<string, number>();

  for (const e of events) {
    const impact = Number((e as { impact_amount?: number }).impact_amount);
    if (Number.isFinite(impact)) totalImpact += impact;
    const bucket = (e as { risk_bucket?: string }).risk_bucket;
    if (bucket === "HIGH" || bucket === "CRITICAL") highRiskCount++;
    if (!(e as { approved_at?: string }).approved_at) unapprovedCount++;
    const p = (e as { provider?: string }).provider ?? "unknown";
    byProvider.set(p, (byProvider.get(p) ?? 0) + 1);
  }

  const approvedCount = events.length - unapprovedCount;
  const compliancePct = events.length > 0 ? Math.round((approvedCount / events.length) * 100) : 100;

  return NextResponse.json({
    ok: true,
    summary: {
      totalEvents: events.length,
      totalRevenueImpact: totalImpact,
      highRiskCount,
      unapprovedCount,
      compliancePct,
      byProvider: Object.fromEntries(byProvider),
    },
    days,
  });
}
