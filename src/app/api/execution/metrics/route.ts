/**
 * Phase 6 Deep Expansion — GET /api/execution/metrics.
 * Observability: actions executed, success rate, failure rate, retry count.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  const since = searchParams.get("since") ?? "7d";
  const days = since === "24h" ? 1 : since === "7d" ? 7 : 30;

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);
  const sinceIso = sinceDate.toISOString();

  const { data: issueIds } = await supabase
    .from("issues")
    .select("id")
    .eq("org_id", membership.org_id);
  const ids = (issueIds ?? []).map((i: { id: string }) => i.id);
  if (ids.length === 0) {
    return NextResponse.json({
      totalExecuted: 0,
      successCount: 0,
      failedCount: 0,
      successRate: 0,
      byProvider: {},
      byActionType: {},
    });
  }

  const { data: actionRows } = await supabase
    .from("issue_actions")
    .select("action_status, action_type, external_system")
    .in("issue_id", ids)
    .gte("created_at", sinceIso);

  const rows = (actionRows ?? []) as Array<{ action_status: string; action_type: string; external_system: string }>;
  const total = rows.length;
  const successCount = rows.filter((r) => r.action_status === "done").length;
  const failedCount = rows.filter((r) => r.action_status === "failed").length;
  const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;

  const byProvider: Record<string, { total: number; success: number; failed: number }> = {};
  const byActionType: Record<string, { total: number; success: number; failed: number }> = {};

  for (const r of rows) {
    const p = r.external_system ?? "unknown";
    if (!byProvider[p]) byProvider[p] = { total: 0, success: 0, failed: 0 };
    byProvider[p].total++;
    if (r.action_status === "done") byProvider[p].success++;
    else if (r.action_status === "failed") byProvider[p].failed++;

    const t = r.action_type ?? "unknown";
    if (!byActionType[t]) byActionType[t] = { total: 0, success: 0, failed: 0 };
    byActionType[t].total++;
    if (r.action_status === "done") byActionType[t].success++;
    else if (r.action_status === "failed") byActionType[t].failed++;
  }

  return NextResponse.json({
    totalExecuted: total,
    successCount,
    failedCount,
    successRate,
    since,
    byProvider,
    byActionType,
  });
}
