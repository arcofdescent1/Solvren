/**
 * Phase 3 — GET /api/admin/raw-events/:id (§15).
 */
import { NextRequest, NextResponse } from "next/server";
import { getRawEventById } from "@/modules/signals/persistence/raw-events.repository";
import { authzErrorResponse, resolveResourceInOrg } from "@/lib/server/authz";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const ctx = await resolveResourceInOrg({
      table: "raw_events",
      resourceId: id,
      permission: "admin.jobs.view",
    });

    const { data, error } = await getRawEventById(ctx.supabase, id);
    if (error) {
      return NextResponse.json(
        { ok: false, error: { code: "server_error", message: error.message } },
        { status: 500 }
      );
    }
    if (!data) {
      return NextResponse.json(
        { ok: false, error: { code: "not_found", message: "Not found" } },
        { status: 404 }
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
