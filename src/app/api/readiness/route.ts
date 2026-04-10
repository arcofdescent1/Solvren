import { NextRequest, NextResponse } from "next/server";
import {
  authzErrorResponse,
  parseRequestedOrgId,
  requireOrgPermission,
  resolveDefaultOrgForUser,
} from "@/lib/server/authz";
/**
 * GET /api/readiness?orgId= — Canonical portfolio summary (REVIEWER+).
 */
export async function GET(req: NextRequest) {
  try {
    const orgParam = new URL(req.url).searchParams.get("orgId");
    const ctx = orgParam
      ? await requireOrgPermission(parseRequestedOrgId(orgParam), "change.approve")
      : await requireOrgPermission((await resolveDefaultOrgForUser()).orgId, "change.approve");

    const supabase = ctx.supabase;
    const orgId = ctx.orgId;

    const { data: portfolio } = await supabase
      .from("readiness_scores")
      .select("readiness_score, readiness_level, calculated_at, explanation_json")
      .eq("org_id", orgId)
      .eq("scope_type", "PORTFOLIO")
      .eq("scope_id", orgId)
      .maybeSingle();

    const { data: releases } = await supabase
      .from("readiness_scores")
      .select("scope_id, readiness_score, readiness_level")
      .eq("org_id", orgId)
      .eq("scope_type", "RELEASE")
      .order("readiness_score", { ascending: true })
      .limit(8);

    const { data: changes } = await supabase
      .from("readiness_scores")
      .select("scope_id, readiness_score, readiness_level")
      .eq("org_id", orgId)
      .eq("scope_type", "CHANGE")
      .order("readiness_score", { ascending: true })
      .limit(12);

    const { data: preds } = await supabase
      .from("predicted_risk_events")
      .select("id, change_event_id, prediction_type, confidence_score, status, explanation_json, created_at")
      .eq("org_id", orgId)
      .eq("status", "ACTIVE")
      .order("confidence_score", { ascending: false })
      .limit(15);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: trend } = await supabase
      .from("readiness_snapshots")
      .select("readiness_score, captured_at")
      .eq("org_id", orgId)
      .eq("scope_type", "PORTFOLIO")
      .eq("scope_id", orgId)
      .gte("captured_at", thirtyDaysAgo)
      .order("captured_at", { ascending: true });

    return NextResponse.json({
      orgId,
      portfolio: portfolio ?? null,
      topReleases: releases ?? [],
      topAtRiskChanges: changes ?? [],
      activePredictions: preds ?? [],
      trend: trend ?? [],
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
