import type { SupabaseClient } from "@supabase/supabase-js";
import type { MonthlySummaryKpis } from "@/lib/reports/renderMonthlyExecutiveSummaryHtml";

export async function loadMonthlySummaryKpis(
  admin: SupabaseClient,
  orgId: string,
  periodStart: string,
  periodEnd: string
): Promise<MonthlySummaryKpis> {
  const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).maybeSingle();
  const orgName = String((org as { name?: string } | null)?.name ?? "Organization");

  const { data: mrow } = await admin
    .from("outcome_metrics")
    .select("revenue_protected, incidents_prevented, approval_hours_saved, readiness_points_gained")
    .eq("org_id", orgId)
    .eq("period_type", "MONTH")
    .eq("period_start", periodStart)
    .maybeSingle();
  const mr = mrow as {
    revenue_protected?: number;
    incidents_prevented?: number;
    approval_hours_saved?: number;
    readiness_points_gained?: number;
  } | null;

  const { data: stories } = await admin
    .from("value_stories")
    .select("headline, outcome_type, estimated_value")
    .eq("org_id", orgId)
    .eq("status", "ACTIVE")
    .not("finalized_at", "is", null)
    .gte("finalized_at", `${periodStart}T00:00:00.000Z`)
    .lte("finalized_at", `${periodEnd}T23:59:59.999Z`)
    .order("estimated_value", { ascending: false })
    .limit(8);

  const topStories = (stories ?? []).map((s) => ({
    headline: String((s as { headline?: string }).headline ?? ""),
    outcomeType: String((s as { outcome_type?: string }).outcome_type ?? ""),
    value: Number((s as { estimated_value?: number }).estimated_value ?? 0),
  }));

  return {
    orgName,
    periodLabel: `${periodStart} — ${periodEnd}`,
    revenueProtected: Number(mr?.revenue_protected ?? 0),
    incidentsPrevented: Number(mr?.incidents_prevented ?? 0),
    approvalHoursSaved: Number(mr?.approval_hours_saved ?? 0),
    readinessPoints: Number(mr?.readiness_points_gained ?? 0),
    topStories,
  };
}

export async function loadQuarterlySummaryKpis(
  admin: SupabaseClient,
  orgId: string,
  periodStart: string,
  periodEnd: string
): Promise<MonthlySummaryKpis> {
  const { data: org } = await admin.from("organizations").select("name").eq("id", orgId).maybeSingle();
  const orgName = String((org as { name?: string } | null)?.name ?? "Organization");

  const { data: mrow } = await admin
    .from("outcome_metrics")
    .select("revenue_protected, incidents_prevented, approval_hours_saved, readiness_points_gained")
    .eq("org_id", orgId)
    .eq("period_type", "QUARTER")
    .eq("period_start", periodStart)
    .maybeSingle();
  const mr = mrow as {
    revenue_protected?: number;
    incidents_prevented?: number;
    approval_hours_saved?: number;
    readiness_points_gained?: number;
  } | null;

  const { data: stories } = await admin
    .from("value_stories")
    .select("headline, outcome_type, estimated_value")
    .eq("org_id", orgId)
    .eq("status", "ACTIVE")
    .not("finalized_at", "is", null)
    .gte("finalized_at", `${periodStart}T00:00:00.000Z`)
    .lte("finalized_at", `${periodEnd}T23:59:59.999Z`)
    .order("estimated_value", { ascending: false })
    .limit(8);

  const topStories = (stories ?? []).map((s) => ({
    headline: String((s as { headline?: string }).headline ?? ""),
    outcomeType: String((s as { outcome_type?: string }).outcome_type ?? ""),
    value: Number((s as { estimated_value?: number }).estimated_value ?? 0),
  }));

  return {
    orgName,
    periodLabel: `${periodStart} — ${periodEnd}`,
    revenueProtected: Number(mr?.revenue_protected ?? 0),
    incidentsPrevented: Number(mr?.incidents_prevented ?? 0),
    approvalHoursSaved: Number(mr?.approval_hours_saved ?? 0),
    readinessPoints: Number(mr?.readiness_points_gained ?? 0),
    topStories,
  };
}

export async function buildCsvExportPayload(
  admin: SupabaseClient,
  orgId: string,
  periodStart: string,
  periodEnd: string
): Promise<{ filename: string; csv: string }> {
  const { data: stories } = await admin
    .from("value_stories")
    .select("id, change_event_id, outcome_type, headline, estimated_value, confidence_level, status, finalized_at")
    .eq("org_id", orgId)
    .eq("status", "ACTIVE")
    .not("finalized_at", "is", null)
    .gte("finalized_at", `${periodStart}T00:00:00.000Z`)
    .lte("finalized_at", `${periodEnd}T23:59:59.999Z`)
    .order("finalized_at", { ascending: true });

  const header = [
    "id",
    "change_event_id",
    "outcome_type",
    "headline",
    "estimated_value",
    "confidence_level",
    "finalized_at",
  ].join(",");
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = (stories ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    return [
      row.id,
      row.change_event_id,
      row.outcome_type,
      esc(row.headline),
      row.estimated_value,
      row.confidence_level,
      row.finalized_at,
    ].join(",");
  });
  const csv = [header, ...lines].join("\n");
  return {
    filename: `outcomes-${orgId.slice(0, 8)}-${periodStart}-${periodEnd}.csv`,
    csv,
  };
}
