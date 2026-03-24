/**
 * Phase 4 — GET /api/admin/integrations/executions (§18.2).
 */
import { NextRequest, NextResponse } from "next/server";
import { listActionExecutions } from "@/modules/integrations/reliability/repositories/integration-action-executions.repository";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function GET(req: NextRequest) {
  try {
    const ctx = await requireAnyOrgPermission("admin.jobs.view");

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const issueId = searchParams.get("issueId") ?? undefined;
    const reconciliationStatus = searchParams.get("reconciliationStatus") ?? undefined;

    const { data, error } = await listActionExecutions(
      ctx.supabase,
      ctx.orgId,
      { provider, status, issueId, reconciliationStatus },
      50
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ executions: data ?? [] });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
