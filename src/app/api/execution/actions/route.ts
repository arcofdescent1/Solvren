/**
 * Gap 4 — GET /api/execution/actions?issueId=... (§14.1).
 * List action executions for an issue.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listActionExecutions } from "@/modules/integrations/reliability/repositories/integration-action-executions.repository";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const issueId = searchParams.get("issueId");
  const status = searchParams.get("status");
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50", 10) || 50);

  if (!issueId) return NextResponse.json({ error: "issueId required" }, { status: 400 });

  const { data: issue } = await supabase
    .from("issues")
    .select("org_id")
    .eq("id", issueId)
    .maybeSingle();
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .eq("org_id", issue.org_id)
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: executions, error } = await listActionExecutions(supabase, issue.org_id, {
    issueId,
    status: status ?? undefined,
  }, limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    executions: executions.map((e) => ({
      id: e.id,
      status: e.execution_status,
      attemptCount: e.attempt_count,
      maxAttempts: e.max_attempts,
      lastError: e.last_error_message,
      lastErrorCode: e.last_error_code,
      nextRetryAt: e.next_retry_at ?? undefined,
      executedAt: e.executed_at ?? undefined,
      createdAt: e.created_at,
      provider: e.provider,
      actionKey: e.action_key,
    })),
  });
}
