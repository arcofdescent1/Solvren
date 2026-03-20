/**
 * Gap 4 — GET /api/execution/actions/[id] (§13.1).
 * Execution status for action visibility.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActionExecution } from "@/modules/integrations/reliability/repositories/integration-action-executions.repository";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { data: exec, error } = await getActionExecution(supabase, id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!exec) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .eq("org_id", exec.org_id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({
    executionId: exec.id,
    status: exec.execution_status,
    attemptCount: exec.attempt_count,
    maxAttempts: exec.max_attempts,
    lastError: exec.last_error_message,
    lastErrorCode: exec.last_error_code,
    nextRetryAt: exec.next_retry_at ?? undefined,
    executedAt: exec.executed_at ?? undefined,
    provider: exec.provider,
    actionKey: exec.action_key,
    issueId: exec.issue_id,
  });
}
