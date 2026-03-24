/**
 * Phase 3 — Admin: start replay job.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authzErrorResponse, requireOrgPermission, parseRequestedOrgId } from "@/lib/server/authz";
import { startReplay } from "@/modules/integrations/replay/replayOrchestrator";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as {
      orgId: string;
      integrationAccountId?: string;
      scopeType: string;
      scopeJson: Record<string, unknown>;
      safeReprocess?: boolean;
    };

    if (!body.orgId || !body.scopeType || !body.scopeJson) {
      return NextResponse.json({ error: "orgId, scopeType, scopeJson required" }, { status: 400 });
    }

    const ctx = await requireOrgPermission(parseRequestedOrgId(body.orgId), "integrations.manage");
    const admin = createAdminClient();

    const result = await startReplay(admin, {
      orgId: ctx.orgId,
      integrationAccountId: body.integrationAccountId ?? null,
      scopeType: body.scopeType,
      scopeJson: body.scopeJson,
      requestedBy: ctx.user.id,
      safeReprocess: body.safeReprocess ?? true,
    });

    if (result.error) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, replayJobId: result.replayJobId, status: result.status });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
