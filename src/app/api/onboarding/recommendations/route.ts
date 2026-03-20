/**
 * Phase 10 — GET /api/onboarding/recommendations (§18.2).
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { getContextualRecommendations } from "@/modules/onboarding/services/activation-recommendation.service";
import { listActivationRecommendations } from "@/modules/onboarding/repositories/activation-recommendations.repository";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) {
    return NextResponse.json({ error: "No active org" }, { status: 400 });
  }

  const { data: storedRecs } = await listActivationRecommendations(supabase, activeOrgId);
  const { recommendations: contextualRecs } = await getContextualRecommendations(supabase, activeOrgId);

  const recs = storedRecs.length > 0
    ? storedRecs
    : contextualRecs.map((r) => ({
        recommendationType: r.recommendationType,
        targetKey: r.targetKey,
        title: r.title,
        description: r.description,
        confidenceScore: r.confidenceScore,
      }));

  return NextResponse.json({
    recommendations: recs,
  });
}
