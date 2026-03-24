import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { addTimelineEvent } from "@/services/timeline/addTimelineEvent";
import { canReviewDomain, canViewChange } from "@/lib/access/changeAccess";
import { applyApprovalSuggestions } from "@/services/coordination/applyApprovalSuggestions";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: changeId } = await ctx.params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: change, error: chErr } = await scopeActiveChangeEvents(supabase.from("change_events").select("id, org_id, domain, status, created_by, is_restricted"))
    .eq("id", changeId)
    .maybeSingle();
  if (chErr) return NextResponse.json({ error: chErr.message }, { status: 500 });
  if (!change) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canView = await canViewChange(supabase, userRes.user.id, change);
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const canReview = await canReviewDomain(
    supabase,
    userRes.user.id,
    String(change.org_id),
    change.domain ?? "REVENUE"
  );
  const isOwner = change.created_by === userRes.user.id;
  if (!canReview && !isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: current } = await supabase
    .from("coordination_plans")
    .select("plan_json")
    .eq("change_id", changeId)
    .eq("is_current", true)
    .maybeSingle();
  if (!current) return NextResponse.json({ error: "No coordination plan" }, { status: 400 });

  const result = await applyApprovalSuggestions({
    supabase,
    orgId: String(change.org_id),
    changeId,
    domain: String(change.domain ?? "REVENUE"),
    plan: current.plan_json as Parameters<typeof applyApprovalSuggestions>[0]["plan"],
  });

  await addTimelineEvent({
    supabase,
    orgId: String(change.org_id),
    changeEventId: changeId,
    actorUserId: userRes.user.id,
    eventType: "COORDINATION_APPROVERS_APPLIED",
    title: "Coordination approver suggestions applied",
    description: `${result.inserted} approver(s) added`,
    metadata: { inserted: result.inserted },
  });

  return NextResponse.json({ ok: true, inserted: result.inserted });
}
