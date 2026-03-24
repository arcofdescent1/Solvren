/**
 * Phase 8 — PUT /api/admin/autonomy/playbooks/:playbookKey/config.
 */
import { NextRequest, NextResponse } from "next/server";
import { getPlaybookDefinitionByKey, upsertOrgPlaybookConfig } from "@/modules/autonomy/persistence/playbooks.repository";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ playbookKey: string }> }
) {
  try {
    const ctx = await requireAnyOrgPermission("admin.simulations.manage");

    const { playbookKey } = await context.params;
    const { data: playbook } = await getPlaybookDefinitionByKey(ctx.supabase, playbookKey);
    if (!playbook) return NextResponse.json({ error: "Playbook not found" }, { status: 404 });

    let body: { enabled?: boolean; autonomy_mode_override?: string | null; rollout_state?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { error } = await upsertOrgPlaybookConfig(ctx.supabase, ctx.orgId, playbook.id, {
      enabled: body.enabled,
      autonomy_mode_override: body.autonomy_mode_override,
      rollout_state: body.rollout_state,
    });

    if (error) return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
