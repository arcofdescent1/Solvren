/**
 * Phase 3 — Mapper context (§11).
 */
import type { RawEventRow } from "./types";

export type MapperContext = {
  rawEvent: RawEventRow;
  orgId: string;
  provider: string;
  integrationAccountId: string | null;
  sourceChannel: string;
  eventType: string;
  externalEventId: string | null;
  externalObjectType: string | null;
  externalObjectId: string | null;
  eventTime: string | null;
  payload: Record<string, unknown>;
};

export function buildMapperContext(rawEvent: RawEventRow): MapperContext {
  return {
    rawEvent,
    orgId: rawEvent.org_id,
    provider: rawEvent.provider,
    integrationAccountId: rawEvent.integration_account_id,
    sourceChannel: rawEvent.source_channel,
    eventType: rawEvent.event_type,
    externalEventId: rawEvent.external_event_id,
    externalObjectType: rawEvent.external_object_type,
    externalObjectId: rawEvent.external_object_id,
    eventTime: rawEvent.event_time,
    payload: rawEvent.payload_json as Record<string, unknown>,
  };
}
