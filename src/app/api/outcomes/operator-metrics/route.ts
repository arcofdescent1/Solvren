/**
 * Phase 7 — GET /api/outcomes/operator-metrics.
 * Operator dashboard: success rate, recovery time.
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
  const sinceDays = Math.min(parseInt(searchParams.get("since") ?? "30", 10) || 30, 365);
  const since = new Date();
  since.setDate(since.getDate() - sinceDays);
  const sinceIso = since.toISOString();

  const { data: issueIds } = await supabase
    .from("issues")
    .select("id, opened_at, status, verification_status")
    .eq("org_id", membership.org_id)
    .gte("opened_at", sinceIso);

  const ids = (issueIds ?? []).map((i: { id: string }) => i.id);
  if (ids.length === 0) {
    return NextResponse.json({
      successRate: 0,
      resolvedCount: 0,
      totalCount: 0,
      avgRecoveryHours: null,
    });
  }

  const { data: actions } = await supabase
    .from("issue_actions")
    .select("issue_id, action_status, executed_at, created_at")
    .in("issue_id", ids);

  const rows = (actions ?? []) as Array<{ issue_id: string; action_status: string; executed_at: string | null; created_at: string }>;
  const total = rows.length;
  const successCount = rows.filter((r) => r.action_status === "done").length;
  const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;

  const resolvedIssues = (issueIds ?? []).filter(
    (i: { status: string }) => ["resolved", "verified", "closed"].includes(i.status)
  );
  let totalRecoveryMs = 0;
  let recoveryCount = 0;
  for (const i of resolvedIssues) {
    const openedAt = (i as { opened_at: string }).opened_at;
    const { data: history } = await supabase
      .from("issue_history")
      .select("created_at, new_state_json")
      .eq("issue_id", (i as { id: string }).id)
      .in("event_type", ["status_changed", "resolved"])
      .order("created_at", { ascending: false })
      .limit(1);
    const resolvedAt = (history?.[0] as { created_at: string } | undefined)?.created_at ?? openedAt;
    const ms = new Date(resolvedAt).getTime() - new Date(openedAt).getTime();
    if (ms > 0) {
      totalRecoveryMs += ms;
      recoveryCount++;
    }
  }
  const avgRecoveryHours = recoveryCount > 0 ? Math.round(totalRecoveryMs / recoveryCount / (1000 * 60 * 60) * 10) / 10 : null;

  return NextResponse.json({
    successRate,
    successCount,
    totalCount: total,
    resolvedCount: resolvedIssues.length,
    avgRecoveryHours,
  });
}
