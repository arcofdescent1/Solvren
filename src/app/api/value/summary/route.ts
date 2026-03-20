/**
 * Gap 5 — GET /api/value/summary (§12.4).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = req.nextUrl.searchParams.get("orgId") ?? (await getActiveOrg(supabase, userRes.user.id)).activeOrgId;
  if (!orgId) return NextResponse.json({ error: "No active org" }, { status: 400 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .eq("org_id", orgId)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const since = req.nextUrl.searchParams.get("since");
  const limit = Math.min(100, parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10) || 50);

  let eventsQuery = supabase
    .from("value_events")
    .select("value_type, amount, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (since) eventsQuery = eventsQuery.gte("created_at", since);

  const { data: events, error } = await eventsQuery;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (events ?? []) as Array<{ value_type: string; amount: number; created_at: string }>;
  const totalRecovered = rows.filter((r) => r.value_type === "recovered").reduce((s, r) => s + Number(r.amount || 0), 0);
  const totalAvoided = rows.filter((r) => r.value_type === "avoided").reduce((s, r) => s + Number(r.amount || 0), 0);

  return NextResponse.json({
    totalRecovered,
    totalAvoided,
    totalValue: totalRecovered + totalAvoided,
    eventCount: rows.length,
    recentEvents: rows.slice(0, 10).map((r) => ({
      type: r.value_type,
      amount: r.amount,
      at: r.created_at,
    })),
  });
}
