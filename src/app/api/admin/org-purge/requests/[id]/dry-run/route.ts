import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, requireOrgPermission } from "@/lib/server/authz";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import { getPurgeRequest, updatePurgeRequest } from "@/modules/org-purge/org-purge.repository";
import { buildOrgPurgePlan } from "@/modules/org-purge/org-purge-planner.service";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const admin = createPrivilegedClient("org-purge:dry-run");
    const { data: reqRow, error } = await getPurgeRequest(admin, id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!reqRow) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await requireOrgPermission(reqRow.target_org_id, "domains.manage");

    const plan = await buildOrgPurgePlan(admin, {
      orgId: reqRow.target_org_id,
      legalHoldActive: reqRow.legal_hold_active,
    });

    const now = new Date().toISOString();
    await updatePurgeRequest(admin, id, {
      last_dry_run_at: now,
      last_dry_run_json: plan as unknown as Record<string, unknown>,
    });

    return NextResponse.json({ plan });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
