import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function getRevenueAtRisk30d(
  supabase: SupabaseClient,
  args: { orgId: string }
) {
  const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

  const { data, error } = await scopeActiveChangeEvents(supabase.from("change_events").select(
      "estimated_mrr_affected, revenue_risk_score, base_risk_score, exposure_multiplier, revenue_surface, status, submitted_at"
    ))
    .eq("org_id", args.orgId)
    .gte("submitted_at", since);

  if (error) throw new Error(error.message);

  const doneStatuses = new Set(["APPROVED", "REJECTED", "CLOSED", "RESOLVED"]);
  let total = 0;
  const bySurface: Record<string, number> = {};

  for (const c of data ?? []) {
    const status = String((c as { status?: string }).status ?? "");
    if (doneStatuses.has(status)) continue;
    const mrr = Number((c as { estimated_mrr_affected?: number }).estimated_mrr_affected ?? 0);
    const rr = Number((c as { revenue_risk_score?: number }).revenue_risk_score ?? 0);
    const base = Number((c as { base_risk_score?: number }).base_risk_score ?? 0);
    const mult = Number((c as { exposure_multiplier?: number }).exposure_multiplier ?? 1);
    const score = rr > 0 ? rr : base * mult;

    const val = score * mrr;
    total += val;

    const s = String((c as { revenue_surface?: string }).revenue_surface ?? "UNKNOWN");
    bySurface[s] = (bySurface[s] ?? 0) + val;
  }

  return { totalRevenueAtRisk: total, bySurface };
}
