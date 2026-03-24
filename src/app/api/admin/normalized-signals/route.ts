/**
 * Phase 3 — GET /api/admin/normalized-signals (§15).
 */
import { NextRequest, NextResponse } from "next/server";
import { listNormalizedSignals } from "@/modules/signals/persistence/normalized-signals.repository";
import {
  authzErrorResponse,
  parseRequestedOrgId,
  requireOrgPermission,
} from "@/lib/server/authz";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const orgId = url.searchParams.get("orgId");
    if (!orgId) {
      return NextResponse.json(
        { ok: false, error: { code: "bad_request", message: "orgId required" } },
        { status: 400 }
      );
    }

    const ctx = await requireOrgPermission(
      parseRequestedOrgId(orgId),
      "admin.jobs.view"
    );

    const { data, error } = await listNormalizedSignals(ctx.supabase, {
      orgId: ctx.orgId,
      signalKey: url.searchParams.get("signalKey") ?? undefined,
      provider: url.searchParams.get("provider") ?? undefined,
      primaryEntityId: url.searchParams.get("primaryEntityId") ?? undefined,
      fromTime: url.searchParams.get("fromTime") ?? undefined,
      toTime: url.searchParams.get("toTime") ?? undefined,
      limit: parseInt(url.searchParams.get("limit") ?? "20", 10),
      offset: parseInt(url.searchParams.get("offset") ?? "0", 10),
    });
    if (error) {
      return NextResponse.json(
        { ok: false, error: { code: "server_error", message: error.message } },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ok: true,
      data,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
