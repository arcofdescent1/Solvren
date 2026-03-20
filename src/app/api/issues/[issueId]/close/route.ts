/**
 * Phase 1 — POST /api/issues/:issueId/close
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { closeIssue, getMissingClosureRequirements } from "@/modules/issues/lifecycle/services/issue-closure.service";
import { LifecycleCloseSchema } from "@/modules/issues/api/schemas";
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
  const parsed = LifecycleCloseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await closeIssue(supabase, issueId, parsed.data, {
    actorType: "user",
    actorUserId: auth.userId,
    eventReason: parsed.data.terminalClassification.outcomeSummary,
    eventPayload: parsed.data.terminalClassification.outcomePayload,
  });

  if (!result.success) {
    if (result.validation.reasonCode === "lifecycle_version_conflict") {
      return NextResponse.json(
        { error: result.validation.message, reasonCode: result.validation.reasonCode },
        { status: 409 }
      );
    }
    if (result.validation.reasonCode === "issue_already_closed") {
      return NextResponse.json(
        { error: result.validation.message, reasonCode: result.validation.reasonCode },
        { status: 409 }
      );
    }
    const missing = await getMissingClosureRequirements(supabase, issueId);
    return NextResponse.json(
      {
        error: result.validation.message,
        reasonCode: result.validation.reasonCode,
        missingRequirements: missing,
      },
      { status: 400 }
    );
  }

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
