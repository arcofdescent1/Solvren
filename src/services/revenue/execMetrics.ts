import type { SupabaseClient } from "@supabase/supabase-js";

export type ExecMetrics = {
  since: string;
  revenue_at_risk: number;
  by_surface: Array<{
    revenue_surface: string;
    revenue_at_risk: number;
    count: number;
  }>;
  trend: Array<{ day: string; revenue_at_risk: number }>;
  critical_pending: number;
  overdue_count: number;
};

export async function fetchExecMetrics(
  supabase: SupabaseClient,
  args: { orgId: string; days?: number }
): Promise<ExecMetrics> {
  const { data, error } = await supabase.rpc("exec_revenue_metrics", {
    p_org_id: args.orgId,
    p_days: args.days ?? 30,
  });

  if (error) throw new Error(error.message);
  return data as ExecMetrics;
}
