/**
 * Gap 5: Executive metrics API.
 * GET /api/metrics/executive
 * Returns revenueExposure, unapprovedChanges, governanceCoverage, openRiskEvents.
 * Optional ?provenance=1 to include calculation details and source event IDs.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { computeExecutiveMetrics } from "@/lib/metrics/executive";

export async function GET(req: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) {
    return NextResponse.json(
      { revenueExposure: 0, unapprovedChanges: 0, governanceCoverage: 100, openRiskEvents: 0 }
    );
  }

  const url = new URL(req.url);
  const includeProvenance = url.searchParams.get("provenance") === "1";
  const storeProvenance = url.searchParams.get("store") === "1";

  const { metrics, provenance } = await computeExecutiveMetrics(supabase, activeOrgId, {
    storeProvenance: storeProvenance || false,
    actorId: userRes.user.id,
  });

  const body: Record<string, unknown> = {
    revenueExposure: metrics.revenueExposure,
    unapprovedChanges: metrics.unapprovedChanges,
    governanceCoverage: metrics.governanceCoverage,
    openRiskEvents: metrics.openRiskEvents,
  };
  if (includeProvenance) body.provenance = provenance;

  return NextResponse.json(body);
}
