/**
 * Phase 1 — integration_webhook_events and endpoints (§8.6, §8.7, §20.3).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WebhookProcessedStatus } from "../contracts/types";

export type IntegrationWebhookEventRow = {
  id: string;
  integration_account_id: string | null;
  provider: string;
  external_event_id: string | null;
  event_type: string;
  request_headers_json: Record<string, unknown>;
  payload_json: Record<string, unknown>;
  signature_valid: boolean | null;
  received_at: string;
  processed_status: WebhookProcessedStatus;
  processed_at: string | null;
  processing_error_json: unknown;
  dedupe_key: string | null;
};

export async function insertWebhookEvent(
  supabase: SupabaseClient,
  row: Omit<IntegrationWebhookEventRow, "id" | "received_at">
): Promise<{ data: IntegrationWebhookEventRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_webhook_events")
    .insert(row)
    .select()
    .single();
  return { data: data as IntegrationWebhookEventRow | null, error: error as Error | null };
}

export async function getWebhookEventsByAccountId(
  supabase: SupabaseClient,
  integrationAccountId: string,
  limit = 50
): Promise<{ data: IntegrationWebhookEventRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from("integration_webhook_events")
    .select("*")
    .eq("integration_account_id", integrationAccountId)
    .order("received_at", { ascending: false })
    .limit(limit);
  return { data: (data ?? []) as IntegrationWebhookEventRow[], error: error as Error | null };
}

export async function updateWebhookEventProcessed(
  supabase: SupabaseClient,
  id: string,
  processedStatus: WebhookProcessedStatus,
  processingError?: unknown
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("integration_webhook_events")
    .update({
      processed_status: processedStatus,
      processed_at: new Date().toISOString(),
      ...(processingError != null && { processing_error_json: processingError }),
    })
    .eq("id", id);
  return { error: error as Error | null };
}
