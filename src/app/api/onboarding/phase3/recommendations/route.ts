import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPhase3Recommendations } from "@/modules/onboarding/phase3/phase3-recommendations.service";
import { requirePhase3OrgContext } from "../_phase3Context";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requirePhase3OrgContext();
  if (!gate.ok) return gate.response;
  const admin = createAdminClient();
  const items = await listPhase3Recommendations(admin, gate.ctx.orgId);
  return NextResponse.json({ recommendations: items });
}
