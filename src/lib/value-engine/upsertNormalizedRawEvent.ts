/**
 * Phase 1 — raw_events upsert: (org_id, provider, external_id, event_type) uniqueness.
 * Detection uses occurred_at; ingestion bookkeeping uses ingested_at.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertValueEngineRawEvent } from "@/modules/ingestion/ingestion.repository";
import type { UpsertNormalizedRawEventInput } from "./upsert-types";

export type { UpsertNormalizedRawEventInput } from "./upsert-types";

export async function upsertNormalizedRawEvent(
  supabase: SupabaseClient,
  input: UpsertNormalizedRawEventInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  return upsertValueEngineRawEvent(supabase, input);
}
