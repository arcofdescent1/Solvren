import { NextResponse } from "next/server";
import { runPhase4Sync } from "@/modules/onboarding/phase4/phase4-sync.service";
import { requirePhase4OrgContext } from "../_phase4Context";

export const runtime = "nodejs";

export async function POST() {
  const gate = await requirePhase4OrgContext();
  if (!gate.ok) return gate.response;
  const { error } = await runPhase4Sync(gate.ctx.orgId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
