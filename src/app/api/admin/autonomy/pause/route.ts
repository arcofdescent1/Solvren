/**
 * Phase 9 — POST /api/admin/autonomy/pause (§17.3).
 */
import { NextRequest, NextResponse } from "next/server";
import { createPauseControl } from "@/modules/autonomy-safety/repositories/autonomy-pause-controls.repository";
import { AutomationPauseType } from "@/modules/autonomy-safety/domain";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

type Body = {
  pauseType: string;
  scopeType: string;
  scopeRef?: string | null;
  reason: string;
};

export async function POST(req: NextRequest) {
  try {
    const ctx = await requireAnyOrgPermission("admin.simulations.manage");

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.pauseType || !body.scopeType || !body.reason) {
      return NextResponse.json({ error: "pauseType, scopeType, reason required" }, { status: 400 });
    }

    const validPauseTypes = Object.values(AutomationPauseType);
    if (!validPauseTypes.includes(body.pauseType as AutomationPauseType)) {
      return NextResponse.json({ error: "Invalid pauseType" }, { status: 400 });
    }

    const { data, error } = await createPauseControl(ctx.supabase, {
      orgId: ctx.orgId,
      pauseType: body.pauseType,
      scopeType: body.scopeType,
      scopeRef: body.scopeRef ?? null,
      reason: body.reason,
      createdByUserId: ctx.user.id,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      pauseId: data?.id,
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
