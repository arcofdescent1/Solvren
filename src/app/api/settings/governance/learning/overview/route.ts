/**
 * Phase 6 — Drift snapshot, recommendation quality, and recent artifacts (read-only).
 */
import { NextResponse } from "next/server";
import { authzErrorResponse, requireOrgPermission, resolveDefaultOrgForUser } from "@/lib/server/authz";
import { computeDispositionDriftSnapshot } from "@/modules/learning/monitoring/drift-monitor.service";
import { computeRecommendationQuality } from "@/modules/learning/monitoring/recommendation-quality.service";
import { getLearningControls } from "@/modules/learning/learning-settings";
import { listSuggestionsForOrg } from "@/modules/learning/repositories/governance-suggestions.repository";
import { listCalibrationRecommendationsForOrg } from "@/modules/learning/repositories/calibration-recommendations.repository";

export async function GET() {
  try {
    const def = await resolveDefaultOrgForUser();
    const ctx = await requireOrgPermission(def.orgId, "policy.manage");

    const [controls, drift, quality, suggestions, calibrations] = await Promise.all([
      getLearningControls(ctx.supabase, ctx.orgId),
      computeDispositionDriftSnapshot(ctx.supabase, ctx.orgId, 30),
      computeRecommendationQuality(ctx.supabase, ctx.orgId),
      listSuggestionsForOrg(ctx.supabase, ctx.orgId, { limit: 25 }),
      listCalibrationRecommendationsForOrg(ctx.supabase, ctx.orgId, { limit: 25 }),
    ]);

    return NextResponse.json({
      ok: true,
      controls,
      drift: drift.data,
      driftError: drift.error?.message ?? null,
      recommendationQuality: quality.data,
      qualityError: quality.error?.message ?? null,
      suggestions: suggestions.data,
      suggestionsError: suggestions.error?.message ?? null,
      calibrations: calibrations.data,
      calibrationsError: calibrations.error?.message ?? null,
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
