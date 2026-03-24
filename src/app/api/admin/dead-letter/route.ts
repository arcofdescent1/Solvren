/**
 * Phase 3 — GET /api/admin/dead-letter (§15).
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, parseRequestedOrgId, requireOrgPermission } from "@/lib/server/authz";
import { listDeadLetterEvents } from "@/modules/signals/persistence/dead-letter.repository";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const rawOrgId = url.searchParams.get("orgId");
    if (!rawOrgId) {
      return NextResponse.json({ ok: false, error: { code: "bad_request", message: "orgId required" } }, { status: 400 });
    }
    const ctx = await requireOrgPermission(parseRequestedOrgId(rawOrgId), "admin.jobs.view");
    const supabase = ctx.supabase;
    const orgId = ctx.orgId;

    const { data, error } = await listDeadLetterEvents(supabase, {
      orgId,
      status: url.searchParams.get("status") ?? undefined,
      limit: parseInt(url.searchParams.get("limit") ?? "20", 10),
      offset: parseInt(url.searchParams.get("offset") ?? "0", 10),
    });
    if (error) {
      return NextResponse.json({ ok: false, error: { code: "server_error", message: error.message } }, { status: 500 });
    }
    return NextResponse.json({ ok: true, data, meta: { timestamp: new Date().toISOString() } });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
