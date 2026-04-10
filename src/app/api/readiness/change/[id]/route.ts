import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { authzErrorResponse, requireOrgMembership } from "@/lib/server/authz";
import { canViewChange } from "@/lib/access/changeAccess";
import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { calculateChangeReadiness } from "@/lib/readiness/calculateChangeReadiness";

/**
 * GET /api/readiness/change/[id] — Live + stored readiness (requires change view access).
 */
export async function GET(_req: Request, routeContext: { params: Promise<{ id: string }> }) {
  try {
    const { id: changeId } = await routeContext.params;
    const supabase = await createServerSupabaseClient();
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: change, error: ceErr } = await scopeActiveChangeEvents(
      supabase.from("change_events").select("id, org_id, domain, status, created_by, is_restricted")
    )
      .eq("id", changeId)
      .maybeSingle();

    if (ceErr || !change) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const orgId = change.org_id as string;
    await requireOrgMembership(orgId);

    const canView = await canViewChange(supabase, userRes.user.id, change);
    if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: settings } = await supabase
      .from("organization_settings")
      .select("readiness_dimension_weights")
      .eq("org_id", orgId)
      .maybeSingle();

    const live = await calculateChangeReadiness(supabase, {
      changeId,
      weightsJson: (settings as { readiness_dimension_weights?: unknown } | null)?.readiness_dimension_weights,
    });

    const { data: stored } = await supabase
      .from("readiness_scores")
      .select("*")
      .eq("org_id", orgId)
      .eq("scope_type", "CHANGE")
      .eq("scope_id", changeId)
      .maybeSingle();

    const { data: preds } = await supabase
      .from("predicted_risk_events")
      .select("*")
      .eq("org_id", orgId)
      .eq("change_event_id", changeId)
      .eq("status", "ACTIVE");

    return NextResponse.json({
      changeId,
      live,
      stored,
      activePredictions: preds ?? [],
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
