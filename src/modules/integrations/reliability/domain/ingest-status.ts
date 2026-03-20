/**
 * Phase 4 — Inbound event ingest status.
 */
export type IngestStatus =
  | "RECEIVED"
  | "VALIDATED"
  | "QUEUED"
  | "PROCESSED"
  | "FAILED"
  | "DEAD_LETTERED";
