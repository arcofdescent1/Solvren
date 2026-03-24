/**
 * Phase 9 — GET /api/admin/autonomy/pauses (for AutomationPauseBanner).
 */
import { NextRequest, NextResponse } from "next/server";
import { listActivePauseControls } from "@/modules/autonomy-safety/repositories/autonomy-pause-controls.repository";
import {
  authzErrorResponse,
  parseRequestedOrgId,
  requireAnyOrgPermission,
  requireOrgPermission,
} from "@/lib/server/authz";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url ?? "", "http://localhost");
    const orgIdParam = searchParams.get("orgId");

    const ctx = orgIdParam
      ? await requireOrgPermission(parseRequestedOrgId(orgIdParam), "admin.simulations.manage")
      : await requireAnyOrgPermission("admin.simulations.manage");

    const { data: rows, error } = await listActivePauseControls(ctx.supabase, ctx.orgId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const pauses = (rows ?? []).map((r) => ({
      id: r.id,
      pauseType: r.pause_type,
      reason: r.reason,
      scopeType: r.scope_type,
      scopeRef: r.scope_ref,
    }));

    return NextResponse.json({ pauses });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
