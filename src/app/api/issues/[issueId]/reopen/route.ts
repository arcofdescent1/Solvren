import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { reopenIssue as reopenIssueLegacy } from "@/modules/issues";
import { reopenIssue as reopenIssuePhase1 } from "@/modules/issues/lifecycle/services/issue-reopen.service";
import { ReopenIssueSchema } from "@/modules/issues/api/schemas";
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

  const body = await req.json().catch(() => ({}));
  const parsed = ReopenIssueSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });

  const { data: issue } = await selectIssueById(supabase, issueId);
  if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (issue.org_id !== auth.orgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const lifecycleState = (issue as { lifecycle_state?: string }).lifecycle_state;
  const lifecycleVersion = (issue as { lifecycle_version?: number }).lifecycle_version ?? 1;

  if (lifecycleState === "CLOSED") {
    const version = parsed.data.expectedLifecycleVersion ?? lifecycleVersion;
    const result = await reopenIssuePhase1(supabase, issueId, {
      expectedLifecycleVersion: version,
      reason: parsed.data.reason,
      notes: parsed.data.notes,
    }, {
      actorType: "user",
      actorUserId: auth.userId,
    });
    if (!result.success) {
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
    const { data: updated } = await selectIssueById(supabase, issueId);
    const i = updated!;
    return NextResponse.json({
      id: i.id,
      issueKey: i.issue_key,
      status: i.status,
      verificationStatus: i.verification_status,
      lifecycleState: (i as { lifecycle_state?: string }).lifecycle_state,
      reopenCount: (i as { reopen_count?: number }).reopen_count ?? 0,
      updatedAt: i.updated_at,
    });
  }

  const result = await reopenIssueLegacy(supabase, issueId, auth.userId, parsed.data);
  if (result.error) {
    if (result.error === "Not found") return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const i = result.issue!;
  return NextResponse.json({
    id: i.id,
    issueKey: i.issue_key,
    status: i.status,
    verificationStatus: i.verification_status,
    reopenCount: i.reopen_count,
    updatedAt: i.updated_at,
  });
}
