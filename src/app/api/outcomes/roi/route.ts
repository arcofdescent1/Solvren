/**
 * Phase 7 — GET /api/outcomes/roi.
 * ROI metrics for Executive dashboard + trend data.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { computeOrgROI } from "@/modules/outcomes";

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

  const { searchParams } = new URL(req.url);
  const sinceDays = Math.min(parseInt(searchParams.get("since") ?? "30", 10) || 30, 365);

  const metrics = await computeOrgROI(supabase, membership.org_id, { sinceDays });

  const { data: outcomes } = await supabase
    .from("outcomes")
    .select("created_at, outcome_type, amount")
    .eq("org_id", membership.org_id)
    .gte("created_at", metrics.periodStart);

  const byDay: Record<string, { recovered: number; avoided: number; savings: number; total: number }> = {};
  for (const o of outcomes ?? []) {
    const d = new Date((o as { created_at: string }).created_at);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    if (!byDay[key]) byDay[key] = { recovered: 0, avoided: 0, savings: 0, total: 0 };
    const amt = Number((o as { amount: number }).amount) || 0;
    const t = (o as { outcome_type: string }).outcome_type;
    if (t === "recovered_revenue") byDay[key].recovered += amt;
    else if (t === "avoided_loss") byDay[key].avoided += amt;
    else byDay[key].savings += amt;
    byDay[key].total += amt;
  }

  const trend = Object.entries(byDay)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, v]) => ({ day, ...v }));

  return NextResponse.json({ ...metrics, trend });
}
