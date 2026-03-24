/**
 * Phase 4 — POST /api/admin/integrations/dead-letters/:id/retry (§18.5).
 */
import { NextRequest, NextResponse } from "next/server";
import { getDeadLetter } from "@/modules/integrations/reliability/repositories/integration-dead-letters.repository";
import { markDeadLetterRetried } from "@/modules/integrations/reliability/services/dead-letter.service";
import { authzErrorResponse, resolveResourceInOrg } from "@/lib/server/authz";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const ctx = await resolveResourceInOrg({
      table: "integration_dead_letters",
      resourceId: id,
      permission: "admin.jobs.view",
    });

    const { data: dl } = await getDeadLetter(ctx.supabase, id);
    if (!dl) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (dl.status !== "OPEN") return NextResponse.json({ error: "Already resolved" }, { status: 400 });

    const { error } = await markDeadLetterRetried(ctx.supabase, id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, status: "RETRIED" });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
