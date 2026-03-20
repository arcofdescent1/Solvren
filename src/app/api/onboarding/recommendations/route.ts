/**
 * Phase 10 + Gap 5 — GET /api/onboarding/recommendations (§18.2, §12.2).
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { getRecommendations } from "@/modules/onboarding/services/recommendation.service";

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

  const { recommendations } = await getRecommendations(supabase, activeOrgId);

  const recs = recommendations.map((r) => ({
    recommendationType: r.type,
    targetKey: r.targetKey ?? "",
    title: r.title,
    description: r.reason,
    confidenceScore: r.priority,
    href: r.href,
  }));

  return NextResponse.json({
    recommendations: recs,
  });
}
