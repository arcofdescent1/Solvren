/**
 * Phase 3 — POST /api/admin/signals/replay (§15).
 */
import { NextRequest, NextResponse } from "next/server";
import { runReplay } from "@/modules/signals/processing/replay.service";
import { createPrivilegedClient } from "@/lib/server/adminClient";
import {
  authzErrorResponse,
  parseRequestedOrgId,
  requireOrgPermission,
} from "@/lib/server/authz";

export async function POST(req: NextRequest) {
  try {
    let body: {
      orgId: string;
      provider?: string;
      signalKey?: string;
      timeFrom?: string;
      timeTo?: string;
      rawEventIds?: string[];
      limit?: number;
    };
    try {
      body = (await req.json()) as typeof body;
    } catch {
      body = { orgId: "" };
    }
    if (!body.orgId) {
      return NextResponse.json(
        { ok: false, error: { code: "bad_request", message: "orgId required" } },
        { status: 400 }
      );
    }

    const ctx = await requireOrgPermission(
      parseRequestedOrgId(body.orgId),
      "admin.jobs.view"
    );

    const admin = createPrivilegedClient("POST /api/admin/signals/replay");
    const result = await runReplay(admin, {
      orgId: ctx.orgId,
      requestedBy: ctx.user.id,
      provider: body.provider,
      signalKey: body.signalKey,
      timeFrom: body.timeFrom,
      timeTo: body.timeTo,
      rawEventIds: body.rawEventIds,
      limit: body.limit,
    });

    return NextResponse.json({
      ok: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
