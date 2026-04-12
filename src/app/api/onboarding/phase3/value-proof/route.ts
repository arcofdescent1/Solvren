import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgOnboardingState } from "@/modules/onboarding/repositories/org-onboarding-states.repository";
import { runPhase3Sync } from "@/modules/onboarding/phase3/phase3-sync.service";
import { requirePhase3OrgContext } from "../_phase3Context";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requirePhase3OrgContext();
  if (!gate.ok) return gate.response;
  const { orgId } = gate.ctx;

  await runPhase3Sync(orgId);
  const admin = createAdminClient();
  const { data: row } = await getOrgOnboardingState(admin, orgId);
  const storyId = row?.first_value_story_id ?? null;
  if (!storyId) {
    return NextResponse.json({
      status: "WAITING",
      story: null,
    });
  }

  const { data: story, error } = await admin
    .from("value_stories")
    .select("id, headline, story_text, estimated_value, evidence_json, outcome_type")
    .eq("id", storyId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (error || !story) {
    return NextResponse.json({ status: "WAITING", story: null });
  }

  const s = story as {
    id: string;
    headline: string;
    story_text: string;
    estimated_value: number | null;
    evidence_json: Record<string, unknown> | null;
    outcome_type: string;
  };

  const ev = s.evidence_json ?? {};
  const timeSavedHours = typeof ev.timeSavedHours === "number" ? ev.timeSavedHours : undefined;
  const estimatedRevenueProtected =
    typeof ev.estimatedRevenueProtected === "number"
      ? ev.estimatedRevenueProtected
      : s.estimated_value != null
        ? Number(s.estimated_value)
        : undefined;

  return NextResponse.json({
    status: "READY",
    story: {
      id: s.id,
      title: s.headline,
      description: s.story_text || s.headline,
      impact: {
        timeSavedHours,
        estimatedRevenueProtected,
      },
      ctaUrl: `/outcomes/value-stories/${s.id}`,
    },
  });
}
