import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canReviewDomain, canViewChange } from "@/lib/access/changeAccess";
import { runCoordinationPlanGeneration } from "@/services/coordination/runCoordinationPlanGeneration";

export async function POST(
  req: Request,
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
  if (!canReview && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let regenerate = true;
  try {
    const body = (await req.json()) as { regenerate?: boolean };
    if (typeof body.regenerate === "boolean") regenerate = body.regenerate;
  } catch {
    regenerate = true;
  }

  const { saved } = await runCoordinationPlanGeneration({
    supabase,
    orgId: String(change.org_id),
    changeId,
    actorUserId: userRes.user.id,
    regenerate,
  });

  return NextResponse.json({
    ok: true,
    plan: saved.plan_json,
    version: saved.version,
    generated_by: saved.generated_by,
    generated_at: saved.created_at,
    stale: false,
  });
}
