/**
 * Phase 1 — Ingestion bridge.
 * RAW PAYLOAD → MAPPING ENGINE → CANONICAL OBJECT
 * Use this from webhook/sync/backfill flows. Never bypass mapping when mapping exists.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { executeMapping } from "./executeMapping";

export type MapForIngestionResult =
  | { mapped: true; canonical: Record<string, unknown>; status: "success" | "warning" }
  | { mapped: false; reason: "no_mapping" | "mapping_failed"; errors?: string[] };

/**
 * Try to map a payload to canonical. Returns canonical only when mapping exists and succeeds.
 */
export async function mapPayloadToCanonicalForIngestion(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    providerKey: string;
    sourceObjectType: string;
    payload: unknown;
  }
): Promise<MapForIngestionResult> {
  const result = await executeMapping({
    orgId: params.orgId,
    providerKey: params.providerKey,
    sourceObjectType: params.sourceObjectType,
    payload: params.payload,
    supabase,
    persistRun: false,
  });

  if (result.status === "failed" || !result.canonical) {
    return {
      mapped: false,
      reason: result.errors?.length ? "mapping_failed" : "no_mapping",
      errors: result.errors,
    };
  }

  return {
    mapped: true,
    canonical: result.canonical,
    status: result.status === "success" ? "success" : "warning",
  };
}
