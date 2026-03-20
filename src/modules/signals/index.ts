/**
 * Phase 3 — Signal Ingestion and Event Normalization.
 */
export * from "./domain/types";
export * from "./domain/mapper-context";
export * from "./domain/mapper.interface";
export { intakeRawEvent } from "./ingestion/raw-event-intake.service";
export { deriveIdempotencyKey, computePayloadHash } from "./ingestion/idempotency.service";
export { resolveMapper, getAllMappers } from "./mappers/mapper-registry";
export { processRawEvent } from "./processing/signal-processor.service";
export { computeQualityScore } from "./processing/quality-scorer.service";
export { resolveEntityCandidates } from "./processing/entity-linker.service";
