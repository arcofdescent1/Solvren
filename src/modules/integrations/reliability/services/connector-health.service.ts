/**
 * Phase 4 — Connector health computation (§17).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ConnectorHealthState } from "../domain/connector-health-state";
import { insertConnectorHealthSnapshot } from "../repositories/connector-health-snapshots.repository";

export type HealthMetrics = {
  inboundSuccessRate: number;
  outboundSuccessRate: number;
  reconciliationSuccessRate: number;
  deadLetterCount: number;
  averageLatencyMs: number;
};

export type HealthSnapshotInput = {
  orgId: string;
  integrationAccountId: string;
  provider: string;
  metrics: HealthMetrics;
  lastSuccessAt?: string | null;
  lastErrorAt?: string | null;
};

export function computeHealthState(
  metrics: HealthMetrics,
  lastErrorAt?: string | null
): { state: ConnectorHealthState; reasons: string[] } {
  const reasons: string[] = [];
  let state = ConnectorHealthState.HEALTHY;

  if (metrics.inboundSuccessRate < 0.99) {
    reasons.push("Inbound success rate below 99%");
    state = ConnectorHealthState.DEGRADED;
  }
  if (metrics.outboundSuccessRate < 0.97) {
    reasons.push("Outbound success rate below 97%");
    state = state === ConnectorHealthState.HEALTHY ? ConnectorHealthState.DEGRADED : state;
  }
  if (metrics.deadLetterCount > 10) {
    reasons.push("Elevated dead-letter count");
    state = ConnectorHealthState.DEGRADED;
  }
  if (metrics.reconciliationSuccessRate < 0.9 && metrics.reconciliationSuccessRate > 0) {
    reasons.push("Reconciliation success rate below 90%");
    state = ConnectorHealthState.DEGRADED;
  }

  return { state, reasons };
}

export async function refreshConnectorHealth(
  supabase: SupabaseClient,
  input: HealthSnapshotInput
): Promise<{ error: Error | null }> {
  const { state, reasons } = computeHealthState(input.metrics, input.lastErrorAt);
  const { error } = await insertConnectorHealthSnapshot(supabase, {
    org_id: input.orgId,
    integration_account_id: input.integrationAccountId,
    provider: input.provider,
    health_state: state,
    metrics_json: input.metrics,
    reasons_json: reasons,
  });
  return { error };
}
