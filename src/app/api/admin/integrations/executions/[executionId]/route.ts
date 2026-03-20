/**
 * Phase 4 — GET /api/admin/integrations/executions/:executionId (§18.3).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActionExecution } from "@/modules/integrations/reliability/repositories/integration-action-executions.repository";
import { listExecutionTargets } from "@/modules/integrations/reliability/repositories/integration-action-execution-targets.repository";
import { listReconciliationChecksForExecution } from "@/modules/integrations/reliability/repositories/integration-reconciliation-checks.repository";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  const { executionId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: execution } = await getActionExecution(supabase, executionId);
  if (!execution) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .eq("org_id", execution.org_id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [{ data: targets }, { data: reconChecks }] = await Promise.all([
    listExecutionTargets(supabase, executionId),
    listReconciliationChecksForExecution(supabase, executionId),
  ]);

  return NextResponse.json({
    execution,
    targets: targets ?? [],
    reconciliationChecks: reconChecks ?? [],
  });
}
