/**
 * Admin: AI usage stats (requests today, avg latency, rough cost) for Gap 4 cost control.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { memberships } = await getActiveOrg(supabase, userRes.user.id);
  const active = memberships.find((m) => m.orgId);
  if (!active || !isAdminLikeRole(parseOrgRole(active.role ?? null))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const since = today.toISOString();

  const { data: rows, error } = await supabase
    .from("ai_requests")
    .select("id, latency_ms, status")
    .gte("created_at", since);

  if (error) {
    return NextResponse.json({
      requestsToday: 0,
      averageLatencyMs: null,
      estimatedCostCents: null,
      error: "ai_requests not available",
    });
  }

  const okRows = (rows ?? []).filter((r) => r.status === "ok" && r.latency_ms != null);
  const requestsToday = rows?.length ?? 0;
  const averageLatencyMs =
    okRows.length > 0
      ? Math.round(okRows.reduce((a, r) => a + (r.latency_ms ?? 0), 0) / okRows.length)
      : null;
  // Rough: gpt-4o-mini ~$0.15/1M input, ~$0.60/1M output; assume ~2k tokens/request => ~$0.0015/request
  const estimatedCostCents =
    requestsToday > 0 ? Math.round((requestsToday * 0.0015 * 100)) / 100 : null;

  return NextResponse.json({
    requestsToday,
    averageLatencyMs,
    estimatedCostCents,
  });
}
