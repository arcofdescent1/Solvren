import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPhase2LiveResult } from "@/modules/onboarding/phase2/phase2-live-result.service";
import { syncPhase2ProgressToOrgState } from "@/modules/onboarding/phase2/phase2-milestones.service";
import { requirePhase2OrgContext } from "../_phase2Context";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requirePhase2OrgContext();
  if (!gate.ok) return gate.response;
  const { orgId } = gate.ctx;

  await syncPhase2ProgressToOrgState(orgId);
  const admin = createAdminClient();
  const event = await getPhase2LiveResult(admin, orgId);

  if (!event) {
    return NextResponse.json({ status: "WAITING", event: null });
  }

  return NextResponse.json({ status: "READY", event });
}
