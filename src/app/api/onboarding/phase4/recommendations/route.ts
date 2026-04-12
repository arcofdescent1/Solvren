import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPhase4ExpansionRecommendations } from "@/modules/onboarding/phase4/phase4-recommendations.service";
import { requirePhase4OrgContext } from "../_phase4Context";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requirePhase4OrgContext();
  if (!gate.ok) return gate.response;
  const admin = createAdminClient();
  const items = await buildPhase4ExpansionRecommendations(admin, gate.ctx.orgId);
  return NextResponse.json({ recommendations: items });
}
