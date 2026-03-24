/**
 * Phase 3 — Replay executor: re-run mapping and re-enter ingestion.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { mapPayloadToCanonicalForIngestion } from "@/lib/integrations/mapping/ingestionBridge";

export type ReplayOptions = {
  safeReprocess?: boolean;
  replayJobId: string;
  replayReason: string;
  replayActor: string;
};

export async function replaySingleEvent(
  supabase: SupabaseClient,
  params: {
    rawEventId: string;
    orgId: string;
    provider: string;
    options: ReplayOptions;
  }
): Promise<{ ok: boolean; error?: string }> {
  const { data: rawEvent, error: fetchErr } = await supabase
    .from("raw_events")
    .select("*")
    .eq("id", params.rawEventId)
    .maybeSingle();

  if (fetchErr || !rawEvent) return { ok: false, error: "Raw event not found" };

  const row = rawEvent as {
    org_id: string;
    payload_json: Record<string, unknown>;
    external_object_type: string | null;
    external_object_id: string | null;
    event_type: string;
    integration_account_id: string | null;
  };

  if (row.org_id !== params.orgId) return { ok: false, error: "Org mismatch" };

  const mapped = await mapPayloadToCanonicalForIngestion(supabase, {
    orgId: params.orgId,
    providerKey: params.provider,
    sourceObjectType: row.external_object_type ?? "unknown",
    payload: row.payload_json,
  });

  if (!mapped.mapped) {
    return { ok: false, error: mapped.reason };
  }

  await supabase.from("raw_events").update({
    canonical_output_json: mapped.canonical,
    processing_status: "pending",
    processing_attempts: 0,
    last_error_code: null,
    last_error_message: null,
    updated_at: new Date().toISOString(),
  }).eq("id", params.rawEventId);

  return { ok: true };
}
