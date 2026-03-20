/**
 * Gap 5 — GET /api/playbooks/performance (§12.3).
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

  const { data: perf, error } = await supabase
    .from("playbook_performance")
    .select("*")
    .eq("org_id", orgId)
    .order("total_recovered_value", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const defIds = [...new Set((perf ?? []).map((p: { playbook_definition_id: string }) => p.playbook_definition_id))];
  const { data: defs } = defIds.length > 0
    ? await supabase.from("playbook_definitions").select("id, playbook_key, display_name").in("id", defIds)
    : { data: [] };
  const defMap = new Map((defs ?? []).map((d: { id: string; playbook_key: string; display_name: string }) => [d.id, d]));

  const performance = (perf ?? []).map((p: Record<string, unknown>) => {
    const def = defMap.get(p.playbook_definition_id as string);
    return {
      playbookId: p.playbook_definition_id,
      playbookKey: def?.playbook_key,
      displayName: def?.display_name,
      executions: p.executions,
      successes: p.successes,
      failures: p.failures,
      totalRecoveredValue: p.total_recovered_value,
      totalAvoidedLoss: p.total_avoided_loss,
      successRate: p.success_rate,
      lastExecutedAt: p.last_executed_at,
    };
  });

  return NextResponse.json({ performance });
}
