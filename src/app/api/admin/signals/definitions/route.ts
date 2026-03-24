/**
 * Phase 3 — GET /api/admin/signals/definitions (§15).
 */
import { NextRequest, NextResponse } from "next/server";
import { listSignalDefinitions } from "@/modules/signals/persistence/signal-definitions.repository";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAnyOrgPermission("admin.jobs.view");

    const url = new URL(req.url);
    const { data, error } = await listSignalDefinitions(ctx.supabase, {
      category: url.searchParams.get("category") ?? undefined,
      enabled:
        url.searchParams.get("enabled") === "true"
          ? true
          : url.searchParams.get("enabled") === "false"
            ? false
            : undefined,
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
