import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPhase3Sync } from "@/modules/onboarding/phase3/phase3-sync.service";
import { requirePhase3OrgContext } from "../_phase3Context";

export const runtime = "nodejs";

export async function GET() {
  const gate = await requirePhase3OrgContext();
  if (!gate.ok) return gate.response;
  const { orgId } = gate.ctx;

  await runPhase3Sync(orgId);
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("org_phase3_usage_interactions")
    .select("interaction_type")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(500);

  const byType: Record<string, number> = {};
  for (const r of rows ?? []) {
    const t = String((r as { interaction_type: string }).interaction_type);
    byType[t] = (byType[t] ?? 0) + 1;
  }

  return NextResponse.json({
    byType,
    total: rows?.length ?? 0,
  });
}
