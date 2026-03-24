/**
 * Phase 4 — Integration inbound events (durable envelope).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type IntegrationInboundEventRow = {
  id: string;
  org_id: string;
  integration_account_id: string;
  provider: string;
  source_channel: string;
  external_event_id: string | null;
  external_object_type: string | null;
  external_object_id: string | null;
  event_type: string;
  event_time: string | null;
  received_at: string;
  payload_json: Record<string, unknown>;
  headers_json: Record<string, unknown> | null;
  payload_hash: string;
  idempotency_key: string;
  ingest_status: string;
  processing_attempts: number;
  last_processing_error_code: string | null;
  last_processing_error_message: string | null;
  downstream_raw_event_id: string | null;
  replayed_at: string | null;
  replay_reason: string | null;
  replay_count: number;
  created_at: string;
};

export type InboundSourceChannel = "webhook" | "sync" | "backfill" | "warehouse" | "internal" | "reconcile" | "salesforce_cdc";

export type InsertInboundEventInput = {
  org_id: string;
  integration_account_id: string;
  provider: string;
  source_channel: InboundSourceChannel;
  initial_status?: "RECEIVED" | "VALIDATED";
  external_event_id?: string | null;
  external_object_type?: string | null;
  external_object_id?: string | null;
  event_type: string;
  event_time?: string | null;
  payload_json: Record<string, unknown>;
  headers_json?: Record<string, unknown> | null;
  payload_hash: string;
  idempotency_key: string;
};

export async function insertInboundEvent(
  supabase: SupabaseClient,
  input: InsertInboundEventInput
): Promise<{ data: IntegrationInboundEventRow | null; error: Error | null }> {
  const row = {
    org_id: input.org_id,
    integration_account_id: input.integration_account_id,
    provider: input.provider,
    source_channel: input.source_channel,
    external_event_id: input.external_event_id ?? null,
    external_object_type: input.external_object_type ?? null,
    external_object_id: input.external_object_id ?? null,
    event_type: input.event_type,
    event_time: input.event_time ?? null,
    payload_json: input.payload_json,
    headers_json: input.headers_json ?? null,
    payload_hash: input.payload_hash,
    idempotency_key: input.idempotency_key,
  };
  const status = input.initial_status ?? "RECEIVED";
  const { data, error } = await supabase
    .from("integration_inbound_events")
    .insert({ ...row, ingest_status: status })
    .select()
    .single();
  if (error) return { data: null, error: error as Error };
  return { data: data as IntegrationInboundEventRow, error: null };
}

export async function findInboundEventByIdempotencyKey(
  supabase: SupabaseClient,
  orgId: string,
  provider: string,
  idempotencyKey: string
): Promise<{ data: IntegrationInboundEventRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_inbound_events")
    .select("*")
    .eq("org_id", orgId)
    .eq("provider", provider)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  return { data: data as IntegrationInboundEventRow | null, error: error as Error | null };
}

export async function listInboundEventsForProcessing(
  supabase: SupabaseClient,
  limit = 50
): Promise<{ data: IntegrationInboundEventRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_inbound_events")
    .select("*")
    .in("ingest_status", ["RECEIVED", "QUEUED"])
    .order("received_at", { ascending: true })
    .limit(limit);
  return { data: (data ?? []) as IntegrationInboundEventRow[], error: error as Error | null };
}

export async function updateInboundEventStatus(
  supabase: SupabaseClient,
  id: string,
  updates: {
    ingest_status?: string;
    processing_attempts?: number;
    last_processing_error_code?: string | null;
    last_processing_error_message?: string | null;
    downstream_raw_event_id?: string | null;
    replayed_at?: string | null;
    replay_reason?: string | null;
    replay_count?: number;
  }
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("integration_inbound_events")
    .update(updates)
    .eq("id", id);
  return { error: error as Error | null };
}

export async function listInboundEventsByAccountId(
  supabase: SupabaseClient,
  integrationAccountId: string,
  limit = 20
): Promise<{ data: IntegrationInboundEventRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_inbound_events")
    .select("*")
    .eq("integration_account_id", integrationAccountId)
    .order("received_at", { ascending: false })
    .limit(limit);
  return { data: (data ?? []) as IntegrationInboundEventRow[], error: error as Error | null };
}

export async function listInboundEventsForReplay(
  supabase: SupabaseClient,
  params: {
    integrationAccountId?: string;
    fromReceived?: string;
    toReceived?: string;
    statuses?: string[];
  },
  limit = 100
): Promise<{ data: IntegrationInboundEventRow[]; error: Error | null }> {
  let q = supabase
    .from("integration_inbound_events")
    .select("*")
    .in("ingest_status", params.statuses ?? ["FAILED", "DEAD_LETTERED"])
    .order("received_at", { ascending: true })
    .limit(limit);
  if (params.integrationAccountId) q = q.eq("integration_account_id", params.integrationAccountId);
  if (params.fromReceived) q = q.gte("received_at", params.fromReceived);
  if (params.toReceived) q = q.lte("received_at", params.toReceived);
  const { data, error } = await q;
  return { data: (data ?? []) as IntegrationInboundEventRow[], error: error as Error | null };
}

export async function getInboundEventById(
  supabase: SupabaseClient,
  id: string
): Promise<{ data: IntegrationInboundEventRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_inbound_events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return { data: data as IntegrationInboundEventRow | null, error: error as Error | null };
}
