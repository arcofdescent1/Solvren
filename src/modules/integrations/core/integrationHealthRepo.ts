/**
 * Phase 1 — integration_health_checks persistence (§8.9, §20.3).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type IntegrationHealthCheckRow = {
  id: string;
  integration_account_id: string;
  provider: string;
  check_type: string;
  status: string;
  summary: string | null;
  details_json: Record<string, unknown>;
  checked_at: string;
};

export async function insertHealthCheck(
  supabase: SupabaseClient,
  row: Omit<IntegrationHealthCheckRow, "id" | "checked_at">
): Promise<{ data: IntegrationHealthCheckRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_health_checks")
    .insert(row)
    .select()
    .single();
  return { data: data as IntegrationHealthCheckRow | null, error: error as Error | null };
}

export async function getHealthChecksByAccountId(
  supabase: SupabaseClient,
  integrationAccountId: string,
  limit = 30
): Promise<{ data: IntegrationHealthCheckRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_health_checks")
    .select("*")
    .eq("integration_account_id", integrationAccountId)
    .order("checked_at", { ascending: false })
    .limit(limit);
  return { data: (data ?? []) as IntegrationHealthCheckRow[], error: error as Error | null };
}
