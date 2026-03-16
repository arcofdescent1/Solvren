/**
 * Gap 5: Executive metrics export (CSV).
 * GET /api/metrics/executive/export?format=csv
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
    return NextResponse.json({ error: "No organization" }, { status: 400 });
  }

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "csv").toLowerCase();

  const { metrics, provenance } = await computeExecutiveMetrics(supabase, activeOrgId);

  const timestamp = new Date().toISOString();

  if (format === "csv") {
    const rows = [
      "metric,value,calculation_summary",
      `revenue_exposure,${metrics.revenueExposure},"${(provenance.revenueExposure.formula ?? "").replace(/"/g, '""')}"`,
      `unapproved_changes,${metrics.unapprovedChanges},"${(provenance.unapprovedChanges.formula ?? "").replace(/"/g, '""')}"`,
      `governance_coverage,${metrics.governanceCoverage},"${(provenance.governanceCoverage.formula ?? "").replace(/"/g, '""')}"`,
      `open_risk_events,${metrics.openRiskEvents},"${(provenance.openRiskEvents.formula ?? "").replace(/"/g, '""')}"`,
      "",
      "exported_at",
      timestamp,
      "source_event_count",
      String(provenance.revenueExposure.sourceEventIds.length),
    ];
    return new NextResponse(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="executive-metrics-${timestamp.slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json({
    metrics: { ...metrics },
    provenance: {
      revenueExposure: { formula: provenance.revenueExposure.formula, sourceEventCount: provenance.revenueExposure.sourceEventIds.length },
      unapprovedChanges: { formula: provenance.unapprovedChanges.formula },
      governanceCoverage: provenance.governanceCoverage,
      openRiskEvents: { formula: provenance.openRiskEvents.formula, sourceEventCount: provenance.openRiskEvents.sourceEventIds.length },
    },
    exportedAt: timestamp,
  });
}
