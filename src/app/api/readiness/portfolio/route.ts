import { NextRequest, NextResponse } from "next/server";
import {
  authzErrorResponse,
  parseRequestedOrgId,
  requireOrgPermission,
  resolveDefaultOrgForUser,
} from "@/lib/server/authz";

/**
 * GET /api/readiness/portfolio?orgId= — Detailed portfolio breakdown (REVIEWER+).
 */
export async function GET(req: NextRequest) {
  try {
    const orgParam = new URL(req.url).searchParams.get("orgId");
    const ctx = orgParam
      ? await requireOrgPermission(parseRequestedOrgId(orgParam), "change.approve")
      : await requireOrgPermission((await resolveDefaultOrgForUser()).orgId, "change.approve");

    const { orgId, supabase } = ctx;

    const { data: portfolio } = await supabase
      .from("readiness_scores")
      .select("*")
      .eq("org_id", orgId)
      .eq("scope_type", "PORTFOLIO")
      .eq("scope_id", orgId)
      .maybeSingle();

    const { data: changeScores } = await supabase
      .from("readiness_scores")
      .select("scope_id, readiness_score, readiness_level, calculated_at, explanation_json")
      .eq("org_id", orgId)
      .eq("scope_type", "CHANGE");

    const { data: releaseScores } = await supabase
      .from("readiness_scores")
      .select("scope_id, readiness_score, readiness_level, calculated_at, explanation_json")
      .eq("org_id", orgId)
      .eq("scope_type", "RELEASE");

    return NextResponse.json({
      orgId,
      portfolio,
      changes: changeScores ?? [],
      releases: releaseScores ?? [],
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
