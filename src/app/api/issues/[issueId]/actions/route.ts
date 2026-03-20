/**
 * Phase 6 — GET /api/issues/:issueId/actions (§16).
 * Gap 4 — Includes integration_action_executions for status, retries, errors.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getIssueDetail } from "@/modules/issues";
import { listIssueActions } from "@/modules/execution/persistence/issue-actions.repository";
import { listExecutionTasksForIssue } from "@/modules/execution/persistence/execution-tasks.repository";
import { listActionExecutions } from "@/modules/integrations/reliability/repositories/integration-action-executions.repository";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { issueId } = await params;
  const { issue } = await getIssueDetail(supabase, issueId);
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  const [{ data: actions }, { data: tasks }, { data: executions }] = await Promise.all([
    listIssueActions(supabase, issueId),
    listExecutionTasksForIssue(supabase, issueId),
    listActionExecutions(supabase, issue.org_id, { issueId }, 50),
  ]);

  return NextResponse.json({
    actions: (actions ?? []).map((a) => ({
      id: a.id,
      actionType: a.action_type,
      actionStatus: a.action_status,
      externalSystem: a.external_system,
      targetRef: a.target_ref,
      requestedBy: a.requested_by,
      createdAt: a.created_at,
      executedAt: a.executed_at,
      error: a.error_json,
    })),
    tasks: (tasks ?? []).map((t) => ({
      id: t.id,
      externalSystem: t.external_system,
      externalTaskId: t.external_task_id,
      taskType: t.task_type,
      status: t.status,
      dueAt: t.due_at,
      createdAt: t.created_at,
    })),
    executions: (executions ?? []).map((e) => ({
      id: e.id,
      status: e.execution_status,
      attemptCount: e.attempt_count,
      maxAttempts: e.max_attempts,
      lastError: e.last_error_message,
      lastErrorCode: e.last_error_code,
      nextRetryAt: e.next_retry_at ?? undefined,
      executedAt: e.executed_at ?? undefined,
      provider: e.provider,
      actionKey: e.action_key,
      createdAt: e.created_at,
    })),
  });
}
