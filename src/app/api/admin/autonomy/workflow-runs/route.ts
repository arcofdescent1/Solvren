/**
 * Phase 8 — GET /api/admin/autonomy/workflow-runs.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listWorkflowRunsForOrg } from "@/modules/autonomy/persistence/workflow-runs.repository";

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
  const status = searchParams.get("status") ?? undefined;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 100);

  const { data: runs, error } = await listWorkflowRunsForOrg(supabase, membership.org_id, { status, limit });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const runIds = (runs ?? []).map((r) => r.id);
  let playbookMap = new Map<string, { playbook_key: string; display_name: string }>();
  if (runIds.length > 0) {
    const { data: wrWithPb } = await supabase
      .from("workflow_runs")
      .select("id, playbook_definitions(playbook_key, display_name)")
      .in("id", runIds);
    for (const r of wrWithPb ?? []) {
      const pb = (r as { playbook_definitions?: { playbook_key: string; display_name: string } }).playbook_definitions;
      if (pb) playbookMap.set((r as { id: string }).id, pb);
    }
  }

  const enriched = (runs ?? []).map((r) => ({
    ...r,
    playbook_key: playbookMap.get(r.id)?.playbook_key,
    playbook_display_name: playbookMap.get(r.id)?.display_name,
  }));

  return NextResponse.json({ runs: enriched });
}
