/**
 * Phase 3 — GET /api/admin/raw-events (§15).
 */
import { NextRequest, NextResponse } from "next/server";
import { listRawEvents } from "@/modules/signals/persistence/raw-events.repository";
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

    const { data, error } = await listRawEvents(ctx.supabase, {
      orgId: ctx.orgId,
      provider: url.searchParams.get("provider") ?? undefined,
      processingStatus: url.searchParams.get("processingStatus") ?? undefined,
      limit: parseInt(url.searchParams.get("limit") ?? "20", 10),
      offset: parseInt(url.searchParams.get("offset") ?? "0", 10),
      fromReceived: url.searchParams.get("fromReceived") ?? undefined,
      toReceived: url.searchParams.get("toReceived") ?? undefined,
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
