/**
 * Phase 6 — Metric value source. Fetches raw metric values per org for snapshot building.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type OrgMetricValue = {
  orgId: string;
  value: number;
  hasData: boolean;
};

/**
 * Fetch metric values for a set of orgs. Returns values only for orgs with valid data.
 * Stub implementation - extend with real data sources per metric (outcomes, integration_action_executions, etc).
 */
export async function fetchMetricValuesForOrgs(
  supabase: SupabaseClient,
  metricKey: string,
  orgIds: string[],
  _windowStart: Date,
  _windowEnd: Date
): Promise<OrgMetricValue[]> {
  const results: OrgMetricValue[] = [];

  if (metricKey === "payment_recovery_rate") {
    const admin = (await import("@/lib/supabase/admin")).createAdminClient();
    for (const orgId of orgIds) {
      const { data: execs } = await admin
        .from("integration_action_executions")
        .select("execution_status")
        .eq("org_id", orgId)
        .in("execution_status", ["SUCCESS", "PARTIAL_SUCCESS", "VERIFIED", "FAILED", "DEAD_LETTERED"]);
      const list = (execs ?? []) as { execution_status: string }[];
      const total = list.length;
      const success = list.filter(
        (e) =>
          e.execution_status === "SUCCESS" ||
          e.execution_status === "PARTIAL_SUCCESS" ||
          e.execution_status === "VERIFIED"
      ).length;
      const rate = total > 0 ? success / total : 0;
      results.push({
        orgId,
        value: rate,
        hasData: total >= 5,
      });
    }
    return results;
  }

  if (metricKey === "auto_recovered_revenue_ratio") {
    const admin = (await import("@/lib/supabase/admin")).createAdminClient();
    for (const orgId of orgIds) {
      const { data: outcomes } = await admin
        .from("outcomes")
        .select("amount, outcome_type")
        .eq("org_id", orgId);
      const list = (outcomes ?? []) as { amount: number; outcome_type: string }[];
      const totalRecovered = list
        .filter((o) => o.outcome_type === "recovered_revenue")
        .reduce((s, o) => s + o.amount, 0);
      const total = list.reduce((s, o) => s + o.amount, 0);
      const ratio = total > 0 ? totalRecovered / total : 0;
      results.push({
        orgId,
        value: ratio,
        hasData: list.length >= 3,
      });
    }
    return results;
  }

  for (const orgId of orgIds) {
    results.push({ orgId, value: 0, hasData: false });
  }
  return results;
}
