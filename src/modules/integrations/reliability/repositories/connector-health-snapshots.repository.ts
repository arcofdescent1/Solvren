/**
 * Phase 4 — Connector health snapshots.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type ConnectorHealthSnapshotRow = {
  id: string;
  org_id: string;
  integration_account_id: string;
  provider: string;
  health_state: string;
  metrics_json: Record<string, unknown>;
  reasons_json: unknown[];
  snapshot_time: string;
};

export async function insertConnectorHealthSnapshot(
  supabase: SupabaseClient,
  input: {
    org_id: string;
    integration_account_id: string;
    provider: string;
    health_state: string;
    metrics_json?: Record<string, unknown>;
    reasons_json?: unknown[];
  }
): Promise<{ data: ConnectorHealthSnapshotRow | null; error: Error | null }> {
  const row = {
    org_id: input.org_id,
    integration_account_id: input.integration_account_id,
    provider: input.provider,
    health_state: input.health_state,
    metrics_json: input.metrics_json ?? {},
    reasons_json: input.reasons_json ?? [],
  };
  const { data, error } = await supabase
    .from("connector_health_snapshots")
    .insert(row)
    .select()
    .single();
  if (error) return { data: null, error: error as Error };
  return { data: data as ConnectorHealthSnapshotRow, error: null };
}

export async function getLatestConnectorHealth(
  supabase: SupabaseClient,
  integrationAccountId: string
): Promise<{ data: ConnectorHealthSnapshotRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("connector_health_snapshots")
    .select("*")
    .eq("integration_account_id", integrationAccountId)
    .order("snapshot_time", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data: data as ConnectorHealthSnapshotRow | null, error: error as Error | null };
}
