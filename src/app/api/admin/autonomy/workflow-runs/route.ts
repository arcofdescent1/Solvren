/**
 * Phase 8 — GET /api/admin/autonomy/workflow-runs.
 */
import { NextRequest, NextResponse } from "next/server";
import { listWorkflowRunsForOrg } from "@/modules/autonomy/persistence/workflow-runs.repository";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAnyOrgPermission("admin.simulations.manage");

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") ?? undefined;
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10) || 50, 100);

    const { data: runs, error } = await listWorkflowRunsForOrg(ctx.supabase, ctx.orgId, { status, limit });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const runIds = (runs ?? []).map((r) => r.id);
    const playbookMap = new Map<string, { playbook_key: string; display_name: string }>();
    if (runIds.length > 0) {
      const { data: wrWithPb } = await ctx.supabase
        .from("workflow_runs")
        .select("id, playbook_definitions(playbook_key, display_name)")
        .in("id", runIds);
      for (const r of wrWithPb ?? []) {
        const raw = (r as { id: string; playbook_definitions?: unknown }).playbook_definitions;
        const pb =
          Array.isArray(raw) && raw[0] != null
            ? (raw[0] as { playbook_key: string; display_name: string })
            : raw != null && typeof raw === "object" && !Array.isArray(raw)
              ? (raw as { playbook_key: string; display_name: string })
              : undefined;
        if (pb) playbookMap.set((r as { id: string }).id, pb);
      }
    }

    const enriched = (runs ?? []).map((r) => ({
      ...r,
      playbook_key: playbookMap.get(r.id)?.playbook_key,
      playbook_display_name: playbookMap.get(r.id)?.display_name,
    }));

    return NextResponse.json({ runs: enriched });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
