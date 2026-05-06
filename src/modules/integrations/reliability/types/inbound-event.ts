/**
 * Shared inbound event insert shape (integration repository + ingestion boundary).
 */

export type InboundSourceChannel =
  | "webhook"
  | "sync"
  | "backfill"
  | "warehouse"
  | "internal"
  | "reconcile"
  | "salesforce_cdc";

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
