/**
 * Phase 8 — POST /api/admin/autonomy/playbooks/:playbookKey/run.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getIssueDetail } from "@/modules/issues";
import { startWorkflow } from "@/modules/autonomy/engine/orchestration-engine.service";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ playbookKey: string }> }
) {
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

  const { playbookKey } = await context.params;

  let body: { issueId: string; autonomyMode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.issueId) return NextResponse.json({ error: "issueId required" }, { status: 400 });

  const { issue } = await getIssueDetail(supabase, body.issueId);
  if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });
  if (issue.org_id !== membership.org_id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const result = await startWorkflow(supabase, {
    orgId: membership.org_id,
    playbookKey,
    issueId: body.issueId,
    autonomyMode: body.autonomyMode ?? "approve_then_execute",
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true, runId: result.runId });
}
