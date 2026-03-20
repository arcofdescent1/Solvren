/**
 * Phase 3 — Signal processor (§11). Normalize raw event -> normalized signal.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildMapperContext } from "../domain/mapper-context";
import { resolveMapper } from "../mappers/mapper-registry";
import { getSignalDefinitionByKey } from "../persistence/signal-definitions.repository";
import { insertNormalizedSignal } from "../persistence/normalized-signals.repository";
import { insertSignalEntityLink } from "../persistence/signal-entity-links.repository";
import { updateRawEventProcessing } from "../persistence/raw-events.repository";
import { insertDeadLetterEvent } from "../persistence/dead-letter.repository";
import { deriveIdempotencyKey, computePayloadHash } from "../ingestion/idempotency.service";
import { computeQualityScore } from "./quality-scorer.service";
import { resolveEntityCandidates } from "./entity-linker.service";
import type { RawEventRow } from "../domain/types";

export type ProcessRawEventResult =
  | { ok: true; signalId: string }
  | { ok: false; deadLetter: boolean; error: string };

export async function processRawEvent(
  supabase: SupabaseClient,
  rawEvent: RawEventRow
): Promise<ProcessRawEventResult> {
  const ctx = buildMapperContext(rawEvent);
  const mapper = resolveMapper(ctx);

  if (!mapper) {
    await updateRawEventProcessing(supabase, rawEvent.id, {
      processing_status: "processed",
      mapper_key: null,
      mapper_version: null,
    });
    return { ok: false, deadLetter: false, error: "No mapper found" };
  }

  try {
    const result = await mapper.map(ctx);
    if (!result) {
      await updateRawEventProcessing(supabase, rawEvent.id, {
        processing_status: "processed",
        mapper_key: mapper.mapperKey,
        mapper_version: mapper.mapperVersion,
      });
      return { ok: false, deadLetter: false, error: "Mapper returned null" };
    }

    const { data: def } = await getSignalDefinitionByKey(supabase, result.signalKey);
    if (!def) {
      await insertDeadLetterEvent(supabase, {
        org_id: rawEvent.org_id,
        raw_event_id: rawEvent.id,
        failure_code: "unknown_signal_key",
        failure_message: `Signal key ${result.signalKey} has no definition`,
        retry_count: 0,
        last_retry_at: null,
        status: "pending",
        resolution: null,
        resolved_at: null,
        resolved_by: null,
      });
      await updateRawEventProcessing(supabase, rawEvent.id, {
        processing_status: "dead_letter",
        last_error_code: "unknown_signal_key",
        last_error_message: `Signal key ${result.signalKey} has no definition`,
      });
      return { ok: false, deadLetter: true, error: "Unknown signal key" };
    }

    const { score, flags } = computeQualityScore(result);
    const { primaryCanonicalEntityId, linkedEntityIds } = await resolveEntityCandidates(
      supabase,
      rawEvent.org_id,
      rawEvent.integration_account_id,
      result.entityCandidates
    );

    const payloadHash = computePayloadHash(rawEvent.payload_json as Record<string, unknown>);
    const idempotencyKey = deriveIdempotencyKey({
      provider: rawEvent.provider,
      externalEventId: rawEvent.external_event_id,
      externalObjectType: rawEvent.external_object_type,
      externalObjectId: rawEvent.external_object_id,
      eventType: rawEvent.event_type,
      eventTime: rawEvent.event_time,
      payloadHash,
    });

    const { data: signal, error: insErr } = await insertNormalizedSignal(supabase, {
      org_id: rawEvent.org_id,
      raw_event_id: rawEvent.id,
      signal_definition_id: def.id,
      signal_key: result.signalKey,
      schema_version: result.schemaVersion,
      provider: rawEvent.provider,
      integration_account_id: rawEvent.integration_account_id,
      source_ref: rawEvent.external_event_id ?? rawEvent.external_object_id ?? null,
      primary_canonical_entity_id: primaryCanonicalEntityId,
      signal_time: result.signalTime,
      dimensions_json: result.dimensions,
      measures_json: result.measures,
      references_json: result.references,
      quality_score: score,
      quality_flags_json: flags,
      mapper_key: mapper.mapperKey,
      mapper_version: mapper.mapperVersion,
      processing_lineage_json: {
        rawEventId: rawEvent.id,
        mapperKey: mapper.mapperKey,
        mapperVersion: mapper.mapperVersion,
      },
      idempotency_key: idempotencyKey,
      processing_run_id: null,
    });

    if (insErr) {
      await updateRawEventProcessing(supabase, rawEvent.id, {
        processing_status: "failed",
        processing_attempts: rawEvent.processing_attempts + 1,
        last_error_code: "insert_failed",
        last_error_message: insErr.message,
      });
      return { ok: false, deadLetter: false, error: insErr.message };
    }
    if (!signal) return { ok: false, deadLetter: false, error: "Insert returned no row" };

    for (const entityId of linkedEntityIds) {
      await insertSignalEntityLink(supabase, {
        org_id: rawEvent.org_id,
        normalized_signal_id: signal.id,
        canonical_entity_id: entityId,
        link_role: entityId === primaryCanonicalEntityId ? "primary" : "secondary",
        confidence_score: 1,
      });
    }

    await updateRawEventProcessing(supabase, rawEvent.id, {
      processing_status: "processed",
      mapper_key: mapper.mapperKey,
      mapper_version: mapper.mapperVersion,
    });

    // Phase 4 — Event-driven detector trigger
    const { triggerDetectorsForNewSignal } = await import("@/modules/detection/engine/event-driven-trigger.service");
    triggerDetectorsForNewSignal(supabase, rawEvent.org_id, signal.id);

    return { ok: true, signalId: signal.id };
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    await updateRawEventProcessing(supabase, rawEvent.id, {
      processing_status: "failed",
      processing_attempts: rawEvent.processing_attempts + 1,
      last_error_code: "mapper_error",
      last_error_message: err.message,
    });
    return { ok: false, deadLetter: false, error: err.message };
  }
}
