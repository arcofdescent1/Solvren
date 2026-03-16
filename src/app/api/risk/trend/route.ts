/**
 * Area 4 — Risk Trend API
 * GET /api/risk/trend?orgId=...&days=30
 * Returns daily impact sums for charting.
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

  const days = Math.min(parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10) || 30, 90);
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data: rows, error } = await supabase
    .from("risk_events")
    .select("timestamp, impact_amount")
    .eq("org_id", orgId)
    .gte("timestamp", since.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const byDay = new Map<string, number>();
  for (const r of rows ?? []) {
    const ts = (r as { timestamp: string }).timestamp;
    const day = ts.slice(0, 10);
    const impact = Number((r as { impact_amount?: number }).impact_amount) || 0;
    byDay.set(day, (byDay.get(day) ?? 0) + impact);
  }

  const sorted = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, impact]) => ({ date, impact }));

  return NextResponse.json({ ok: true, trend: sorted });
}
