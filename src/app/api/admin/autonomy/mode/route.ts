/**
 * Phase 9 — PUT /api/admin/autonomy/mode (§17.2).
 */
import { NextRequest, NextResponse } from "next/server";
import { upsertAutonomyModeConfig } from "@/modules/autonomy-safety/repositories/autonomy-mode-configs.repository";
import { ExecutionMode } from "@/modules/autonomy-safety/domain";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

type Body = {
  scopeType: string;
  scopeRef?: string | null;
  requestedMode: string;
};

export async function PUT(req: NextRequest) {
  try {
    const ctx = await requireAnyOrgPermission("admin.simulations.manage");

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.scopeType || typeof body.scopeType !== "string") {
      return NextResponse.json({ error: "scopeType required" }, { status: 400 });
    }
    if (!body.requestedMode || typeof body.requestedMode !== "string") {
      return NextResponse.json({ error: "requestedMode required" }, { status: 400 });
    }

    const validModes = Object.values(ExecutionMode);
    if (!validModes.includes(body.requestedMode as ExecutionMode)) {
      return NextResponse.json({ error: "Invalid requestedMode" }, { status: 400 });
    }

    const { error } = await upsertAutonomyModeConfig(ctx.supabase, {
      orgId: ctx.orgId,
      scopeType: body.scopeType,
      scopeRef: body.scopeRef ?? null,
      requestedMode: body.requestedMode as ExecutionMode,
      createdByUserId: ctx.user.id,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
