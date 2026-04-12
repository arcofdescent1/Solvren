/**
 * Guided Phase 1 — normalized integration cards for onboarding UI.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { listOnboardingIntegrationCards } from "@/modules/onboarding/services/guided-phase1-integrations";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) return NextResponse.json({ error: "No active org" }, { status: 400 });

  const { cards, error } = await listOnboardingIntegrationCards(supabase, activeOrgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ integrations: cards });
}
