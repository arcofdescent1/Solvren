import { NextResponse } from "next/server";
import { authzErrorResponse, requireOrgPermission } from "@/lib/server/authz";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/readiness/release/[id] — Release readiness aggregate (REVIEWER+).
 */
export async function GET(_req: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const { id: releaseId } = await routeContext.params;
    const supabase = await createServerSupabaseClient();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: rel } = await supabase
      .from("releases")
      .select("id, org_id, name, status, target_release_at")
      .eq("id", releaseId)
      .maybeSingle();
    if (!rel) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const orgId = (rel as { org_id: string }).org_id;
    await requireOrgPermission(orgId, "change.approve");

    const { data: score } = await supabase
      .from("readiness_scores")
      .select("*")
      .eq("org_id", orgId)
      .eq("scope_type", "RELEASE")
      .eq("scope_id", releaseId)
      .maybeSingle();

    const { data: rcs } = await supabase
      .from("release_changes")
      .select("change_event_id")
      .eq("release_id", releaseId);

    const changeIds = (rcs ?? []).map((r) => (r as { change_event_id: string }).change_event_id);
    const childScores =
      changeIds.length > 0
        ? await supabase
            .from("readiness_scores")
            .select("scope_id, readiness_score, readiness_level")
            .eq("org_id", orgId)
            .eq("scope_type", "CHANGE")
            .in("scope_id", changeIds)
        : { data: [] as unknown[] };

    return NextResponse.json({
      release: rel,
      readiness: score,
      childChanges: childScores.data ?? [],
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
