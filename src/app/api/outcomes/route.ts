import { NextRequest, NextResponse } from "next/server";
import {
  authzErrorResponse,
  parseRequestedOrgId,
  requireOrgPermission,
  resolveDefaultOrgForUser,
} from "@/lib/server/authz";
import { outcomeMetricPeriodStartKeys } from "@/lib/outcomes/calculateOutcomeMetrics";

/**
 * GET /api/outcomes?orgId= — Executive outcomes summary (REVIEWER+ / change.approve).
 * Metrics rows are maintained by POST /api/cron/outcomes/metrics.
 */
export async function GET(req: NextRequest) {
  try {
    const orgParam = req.nextUrl.searchParams.get("orgId");
    const ctx = orgParam
      ? await requireOrgPermission(parseRequestedOrgId(orgParam), "change.approve")
      : await requireOrgPermission((await resolveDefaultOrgForUser()).orgId, "change.approve");

    const { supabase, orgId } = ctx;

    const { data: settings } = await supabase
      .from("organization_settings")
      .select("value_tracking_enabled, fiscal_year_start_month")
      .eq("org_id", orgId)
      .maybeSingle();
    if ((settings as { value_tracking_enabled?: boolean } | null)?.value_tracking_enabled === false) {
      return NextResponse.json({
        orgId,
        disabled: true,
        revenueProtectedMonth: 0,
        revenueProtectedQuarter: 0,
        incidentsPreventedMonth: 0,
        approvalHoursSavedMonth: 0,
        readinessGainedMonth: 0,
        topStories: [],
      });
    }

    const ref = new Date();
    const fiscal = (settings as { fiscal_year_start_month?: number | null } | null)
      ?.fiscal_year_start_month;
    const { monthStart, quarterStart: qStart } = outcomeMetricPeriodStartKeys(
      ref,
      fiscal != null && fiscal >= 1 && fiscal <= 12 ? fiscal : null
    );

    const { data: mRow } = await supabase
      .from("outcome_metrics")
      .select("*")
      .eq("org_id", orgId)
      .eq("period_type", "MONTH")
      .eq("period_start", monthStart)
      .maybeSingle();

    const { data: qRow } = await supabase
      .from("outcome_metrics")
      .select("*")
      .eq("org_id", orgId)
      .eq("period_type", "QUARTER")
      .eq("period_start", qStart)
      .maybeSingle();

    const { data: stories } = await supabase
      .from("value_stories")
      .select("id, headline, outcome_type, estimated_value, confidence_level, status, finalized_at")
      .eq("org_id", orgId)
      .eq("status", "ACTIVE")
      .order("finalized_at", { ascending: false })
      .limit(8);

    const m = mRow as {
      revenue_protected?: number;
      incidents_prevented?: number;
      approval_hours_saved?: number;
      readiness_points_gained?: number;
    } | null;
    const q = qRow as { revenue_protected?: number } | null;

    return NextResponse.json({
      orgId,
      disabled: false,
      revenueProtectedMonth: Number(m?.revenue_protected ?? 0),
      revenueProtectedQuarter: Number(q?.revenue_protected ?? 0),
      incidentsPreventedMonth: Number(m?.incidents_prevented ?? 0),
      approvalHoursSavedMonth: Number(m?.approval_hours_saved ?? 0),
      readinessGainedMonth: Number(m?.readiness_points_gained ?? 0),
      topStories: stories ?? [],
    });
  } catch (e) {
    return authzErrorResponse(e);
  }
}
