/**
 * Phase 7 — Risk Event Store
 * Persists risk events to the database.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CanonicalRiskEvent } from "./types";

export type RiskEventRow = {
  id: string;
  org_id: string;
  provider: string;
  object: string;
  object_id: string;
  field?: string | null;
  old_value?: unknown;
  new_value?: unknown;
  timestamp: string;
  actor?: string | null;
  risk_type: string;
  risk_score: number;
  risk_bucket: string;
  impact_amount?: number | null;
  change_event_id?: string | null;
  approval_id?: string | null;
  approved_at?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export async function storeRiskEvent(
  client: SupabaseClient,
  orgId: string,
  event: Omit<CanonicalRiskEvent, "id">
): Promise<string> {
  const { data, error } = await client
    .from("risk_events")
    .insert({
      org_id: orgId,
      provider: event.provider,
      object: event.object,
      object_id: event.objectId,
      field: event.field ?? null,
      old_value: event.oldValue ?? null,
      new_value: event.newValue ?? null,
      timestamp: event.timestamp,
      actor: event.actor ?? null,
      risk_type: event.riskType,
      risk_score: event.riskScore,
      risk_bucket: event.riskBucket,
      impact_amount: event.impactAmount ?? null,
      change_event_id: event.changeEventId ?? null,
      approval_id: event.approvalId ?? null,
      approved_at: event.approvedAt ?? null,
      metadata: event.metadata ?? {},
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}
