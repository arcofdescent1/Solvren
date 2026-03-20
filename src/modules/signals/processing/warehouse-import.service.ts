/**
 * Phase 3 — Warehouse import processor (§17). Placeholder for warehouse sync pipeline.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { intakeRawEvent } from "../ingestion/raw-event-intake.service";

export type WarehouseImportRow = {
  orgId: string;
  provider: string;
  objectType: string;
  externalId: string;
  eventType: string;
  eventTime: string;
  payload: Record<string, unknown>;
};

export type WarehouseImportResult = {
  processed: number;
  created: number;
  duplicate: number;
  errors: number;
};

/**
 * Import batch of warehouse-synced rows as raw events. Idempotent via intakeRawEvent.
 */
export async function processWarehouseImport(
  supabase: SupabaseClient,
  rows: WarehouseImportRow[]
): Promise<WarehouseImportResult> {
  let created = 0;
  let duplicate = 0;
  let errors = 0;

  for (const row of rows) {
    const result = await intakeRawEvent(supabase, {
      orgId: row.orgId,
      integrationAccountId: null,
      provider: row.provider,
      sourceChannel: "warehouse",
      externalEventId: null,
      externalObjectType: row.objectType,
      externalObjectId: row.externalId,
      eventType: row.eventType,
      eventTime: row.eventTime,
      payload: row.payload,
    });
    if (!result.ok) {
      errors++;
      continue;
    }
    if (result.created) created++;
    else duplicate++;
  }

  return {
    processed: rows.length,
    created,
    duplicate,
    errors,
  };
}
