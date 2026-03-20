/**
 * Phase 6 Deep Expansion — POST /api/execution/bulk-execute.
 * Execute the same action across multiple issues. Approve once, execute at scale.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getIssueDetail } from "@/modules/issues";
import { createExecutionTask } from "@/modules/execution";
import { getAction } from "@/modules/execution/registry/action-registry";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.org_id) return NextResponse.json({ error: "No org" }, { status: 403 });

  let body: {
    issueIds: string[];
    actionKey: string;
    provider: string;
    params: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { issueIds, actionKey, provider, params } = body;
  if (!issueIds?.length || !actionKey || !provider) {
    return NextResponse.json({ error: "issueIds, actionKey, provider required" }, { status: 400 });
  }

  const actionDef = getAction(actionKey, provider);
  if (!actionDef) return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  if (!actionDef.supportsBulk) {
    return NextResponse.json({ error: "Action does not support bulk execution" }, { status: 400 });
  }

  const limit = 50;
  const ids = issueIds.slice(0, limit);

  const results: Array<{ issueId: string; ok: boolean; taskId?: string; error?: string }> = [];

  for (const issueId of ids) {
    const { issue } = await getIssueDetail(supabase, issueId);
    if (!issue || issue.org_id !== membership.org_id) {
      results.push({ issueId, ok: false, error: "Not found or forbidden" });
      continue;
    }

    const result = await createExecutionTask(supabase, {
      orgId: issue.org_id,
      issueId,
      taskType: actionDef.actionKey,
      externalSystem: provider,
      requestedByUserId: userRes.user.id,
      params: params ?? {},
      executeImmediately: true,
    });

    results.push({
      issueId,
      ok: result.ok,
      taskId: result.ok ? result.taskId : undefined,
      error: !result.ok ? result.error : undefined,
    });
  }

  const successCount = results.filter((r) => r.ok).length;
  const failedCount = results.filter((r) => !r.ok).length;

  return NextResponse.json({
    total: ids.length,
    successCount,
    failedCount,
    results,
  });
}
