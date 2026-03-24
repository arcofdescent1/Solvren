/**
 * Phase 4 — GET /api/admin/integrations/executions/:executionId (§18.3).
 */
import { NextRequest, NextResponse } from "next/server";
import { getActionExecution } from "@/modules/integrations/reliability/repositories/integration-action-executions.repository";
import { listExecutionTargets } from "@/modules/integrations/reliability/repositories/integration-action-execution-targets.repository";
import { listReconciliationChecksForExecution } from "@/modules/integrations/reliability/repositories/integration-reconciliation-checks.repository";
import { authzErrorResponse, resolveResourceInOrg } from "@/lib/server/authz";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  try {
    const { executionId } = await params;

    const ctx = await resolveResourceInOrg({
      table: "integration_action_executions",
      resourceId: executionId,
      permission: "admin.jobs.view",
    });

    const { data: execution } = await getActionExecution(ctx.supabase, executionId);
    if (!execution) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [{ data: targets }, { data: reconChecks }] = await Promise.all([
      listExecutionTargets(ctx.supabase, executionId),
      listReconciliationChecksForExecution(ctx.supabase, executionId),
    ]);

    return NextResponse.json({
      execution,
      targets: targets ?? [],
      reconciliationChecks: reconChecks ?? [],
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
