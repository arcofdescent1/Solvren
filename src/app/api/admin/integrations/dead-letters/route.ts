/**
 * Phase 4 — GET /api/admin/integrations/dead-letters (§18.4).
 */
import { NextRequest, NextResponse } from "next/server";
import { listDeadLetters } from "@/modules/integrations/reliability/repositories/integration-dead-letters.repository";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAnyOrgPermission("admin.jobs.view");

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider") ?? undefined;
    const status = searchParams.get("status") ?? "OPEN";
    const type = searchParams.get("type") ?? undefined;

    const { data, error } = await listDeadLetters(
      ctx.supabase,
      ctx.orgId,
      { provider, status, type },
      50
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ deadLetters: data ?? [] });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
