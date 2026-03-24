/**
 * Phase 8 — GET /api/admin/autonomy/playbooks.
 */
import { NextResponse } from "next/server";
import { listPlaybookDefinitions, getOrgPlaybookConfigs } from "@/modules/autonomy/persistence/playbooks.repository";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function GET() {
  try {
    const ctx = await requireAnyOrgPermission("admin.simulations.manage");

    const [{ data: definitions }, { data: configs }] = await Promise.all([
      listPlaybookDefinitions(ctx.supabase),
      getOrgPlaybookConfigs(ctx.supabase, ctx.orgId),
    ]);

    const configMap = new Map((configs ?? []).map((c) => [c.playbook_definition_id, c]));

    const playbooks = (definitions ?? []).map((d) => ({
      ...d,
      config: configMap.get(d.id) ?? null,
    }));

    return NextResponse.json({ playbooks });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
