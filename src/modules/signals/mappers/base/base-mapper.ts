/**
 * Phase 3 — Base mapper helpers.
 */
import type { MapperContext } from "../../domain/mapper-context";
import type { MapperResult, EntityCandidate } from "../../domain/types";

export function baseMapperResult(
  signalKey: string,
  ctx: MapperContext,
  overrides: Partial<MapperResult>
): MapperResult {
  const signalTime = ctx.eventTime ?? ctx.rawEvent.received_at;
  return {
    signalKey,
    schemaVersion: 1,
    signalTime,
    dimensions: {},
    measures: {},
    references: {},
    entityCandidates: [],
    qualityInputs: { mapperCertainty: 1 },
    lineage: {
      rawEventId: ctx.rawEvent.id,
      mapperKey: overrides.lineage?.mapperKey,
      mapperVersion: overrides.lineage?.mapperVersion,
    },
    ...overrides,
  };
}

export function entityCandidate(
  provider: string,
  externalObjectType: string,
  externalId: string,
  entityType: string,
  confidence: number
): EntityCandidate {
  return { provider, externalObjectType, externalId, entityType, confidence };
}
