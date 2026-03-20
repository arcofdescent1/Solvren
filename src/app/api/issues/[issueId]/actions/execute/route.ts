/**
 * Phase 6 — POST /api/issues/:issueId/actions/execute (§16).
 * Execute a write-back action (create Jira issue, post to Slack, etc.).
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getIssueDetail } from "@/modules/issues";
import { createExecutionTask } from "@/modules/execution";
import { getAction } from "@/modules/execution/registry/action-registry";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ issueId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { issueId } = await context.params;
  const { issue } = await getIssueDetail(supabase, issueId);
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  let body: { actionKey: string; provider: string; params: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { actionKey, provider, params: actionParams } = body;
  if (!actionKey || !provider) {
    return NextResponse.json({ error: "actionKey and provider required" }, { status: 400 });
  }

  const actionDef = getAction(actionKey, provider);
  if (!actionDef) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const result = await createExecutionTask(supabase, {
    orgId: issue.org_id,
    issueId,
    taskType: actionDef.actionKey,
    externalSystem: provider,
    requestedByUserId: userRes.user.id,
    params: actionParams ?? {},
    executeImmediately: true,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });

  return NextResponse.json({
    ok: true,
    taskId: result.taskId,
    actionId: result.actionId,
    externalId: result.externalId,
  });
}
