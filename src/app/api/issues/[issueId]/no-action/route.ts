/**
 * Phase 1 — POST /api/issues/:issueId/no-action
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { recordNoActionDecision } from "@/modules/issues/lifecycle/services/issue-lifecycle.service";
import { closeIssue } from "@/modules/issues/lifecycle/services/issue-closure.service";
import { LifecycleNoActionSchema } from "@/modules/issues/api/schemas";
import { selectIssueById } from "@/modules/issues/infrastructure/issueRepository";

async function getAuth(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return null;
  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return { userId: userRes.user.id, orgId: membership?.org_id ?? null };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const auth = await getAuth(supabase);
  if (!auth?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: issue } = await selectIssueById(supabase, issueId);
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (issue.org_id !== auth.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const parsed = LifecycleNoActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await recordNoActionDecision(supabase, issueId, {
    reason: parsed.data.reason,
    notes: parsed.data.notes,
    requiresApproval: false,
    approvedByUserId: auth.userId,
  }, {
    actorType: "user",
    actorUserId: auth.userId,
    eventReason: parsed.data.reason,
  });

  if (!result.success) {
    if (result.validation.reasonCode === "duplicate_no_action_decision") {
      return NextResponse.json(
        { error: result.validation.message, reasonCode: result.validation.reasonCode },
        { status: 409 }
      );
    }
    if (result.validation.reasonCode === "lifecycle_version_conflict") {
      return NextResponse.json(
        { error: result.validation.message, reasonCode: result.validation.reasonCode },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: result.validation.message, reasonCode: result.validation.reasonCode },
      { status: 400 }
    );
  }

  const { data: updatedIssue } = await selectIssueById(supabase, issueId);
  const version = (updatedIssue as { lifecycle_version?: number })?.lifecycle_version ?? parsed.data.expectedLifecycleVersion + 1;
  const closeResult = await closeIssue(supabase, issueId, {
    expectedLifecycleVersion: version,
    terminalClassification: {
      classificationType: "no_action_closed",
      outcomeSummary: `No action taken: ${parsed.data.reason}`,
      outcomePayload: { reason: parsed.data.reason, notes: parsed.data.notes },
    },
  }, {
    actorType: "user",
    actorUserId: auth.userId,
  });

  if (!closeResult.success && closeResult.validation.reasonCode === "lifecycle_version_conflict") {
    return NextResponse.json(
      { success: true, noActionRecorded: true, closePending: true },
    );
  }

  return NextResponse.json({ success: true, noActionRecorded: true, closed: closeResult.success });
}
