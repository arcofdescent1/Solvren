/**
 * Phase 8 — POST /api/admin/autonomy/playbooks/:playbookKey/run.
 */
import { NextRequest, NextResponse } from "next/server";
import { getIssueDetail } from "@/modules/issues";
import { startWorkflow } from "@/modules/autonomy/engine/orchestration-engine.service";
import { authzErrorResponse, requireAnyOrgPermission } from "@/lib/server/authz";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ playbookKey: string }> }
) {
  try {
    const ctx = await requireAnyOrgPermission("admin.simulations.manage");

    const { playbookKey } = await context.params;

    let body: { issueId: string; autonomyMode?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body.issueId) return NextResponse.json({ error: "issueId required" }, { status: 400 });

    const { issue } = await getIssueDetail(ctx.supabase, body.issueId);
    if (!issue) return NextResponse.json({ error: "Issue not found" }, { status: 404 });
    if (issue.org_id !== ctx.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: member } = await ctx.supabase
      .from("organization_members")
      .select("role")
      .eq("org_id", ctx.orgId)
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    const actorRoleKeys = member?.role ? [String((member as { role: string }).role)] : undefined;

    const result = await startWorkflow(ctx.supabase, {
      orgId: ctx.orgId,
      playbookKey,
      issueId: body.issueId,
      autonomyMode: body.autonomyMode ?? "approve_then_execute",
      actorUserId: ctx.user.id,
      actorRoleKeys,
      governanceIssue: {
        issueId: issue.id,
        severity: issue.severity,
        impactAmount: issue.impact_score ?? undefined,
        confidence: issue.confidence_score ?? undefined,
      },
    });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, runId: result.runId });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
