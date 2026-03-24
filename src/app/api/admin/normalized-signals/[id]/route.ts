/**
 * Phase 3 — GET /api/admin/normalized-signals/:id (§15).
 */
import { NextRequest, NextResponse } from "next/server";
import { getNormalizedSignalById } from "@/modules/signals/persistence/normalized-signals.repository";
import { getSignalEntityLinksBySignalId } from "@/modules/signals/persistence/signal-entity-links.repository";
import { authzErrorResponse, resolveResourceInOrg } from "@/lib/server/authz";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await resolveResourceInOrg({
      table: "normalized_signals",
      resourceId: id,
      permission: "admin.jobs.view",
    });

    const [signalRes, linksRes] = await Promise.all([
      getNormalizedSignalById(ctx.supabase, id),
      getSignalEntityLinksBySignalId(ctx.supabase, id),
    ]);
    if (signalRes.error) {
      return NextResponse.json(
        { ok: false, error: { code: "server_error", message: signalRes.error.message } },
        { status: 500 }
      );
    }
    if (!signalRes.data) {
      return NextResponse.json(
        { ok: false, error: { code: "not_found", message: "Not found" } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      data: { ...signalRes.data, entityLinks: linksRes.data ?? [] },
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
