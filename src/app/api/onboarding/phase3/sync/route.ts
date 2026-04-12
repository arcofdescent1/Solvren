import { NextResponse } from "next/server";
import { runPhase3Sync } from "@/modules/onboarding/phase3/phase3-sync.service";
import { requirePhase3OrgContext } from "../_phase3Context";

export const runtime = "nodejs";

export async function POST() {
  const gate = await requirePhase3OrgContext();
  if (!gate.ok) return gate.response;
  const { orgId } = gate.ctx;
  const { flags, error } = await runPhase3Sync(orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, milestones: flags });
}
