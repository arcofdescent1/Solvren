/**
 * Phase 0 — Issue APIs: get by id.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getIssueDetail } from "@/modules/issues";

async function getOrgId(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return null;
  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return membership?.org_id ?? null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ issueId: string }> }
) {
  const { issueId } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const orgId = await getOrgId(supabase);
  if (!orgId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await getIssueDetail(supabase, issueId);
  if (result.error)
    return NextResponse.json({ error: result.error }, { status: 500 });
  if (!result.issue)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const i = result.issue;
  if (i.org_id !== orgId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({
    id: i.id,
    issueKey: i.issue_key,
    sourceType: i.source_type,
    sourceRef: i.source_ref,
    domainKey: i.domain_key,
    title: i.title,
    description: i.description,
    summary: i.summary,
    status: i.status,
    verificationStatus: i.verification_status,
    severity: i.severity,
    priorityScore: i.priority_score,
    impactScore: i.impact_score,
    confidenceScore: i.confidence_score,
    owner: {
      userId: i.owner_user_id,
      teamKey: i.owner_team_key,
    },
    impact: null,
    links: { changes: [], entities: [], tasks: [] },
    timestamps: {
      openedAt: i.opened_at,
      updatedAt: i.updated_at,
      triagedAt: i.triaged_at,
      assignedAt: i.assigned_at,
      inProgressAt: i.in_progress_at,
      resolvedAt: i.resolved_at,
      verifiedAt: i.verified_at,
      dismissedAt: i.dismissed_at,
    },
  });
}
