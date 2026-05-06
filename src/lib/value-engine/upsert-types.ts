/**
 * Shared input for value-engine raw_events upsert (ingestion boundary + callers).
 */

export type UpsertNormalizedRawEventInput = {
  orgId: string;
  provider: string;
  sourceChannel?: string;
  externalId: string;
  eventType: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  integrationAccountId?: string | null;
};
