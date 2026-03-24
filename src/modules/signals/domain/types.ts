/**
 * Phase 3 — Signal domain types (§6).
 */

export const SOURCE_CHANNELS = ["webhook", "incremental_sync", "backfill", "warehouse", "internal", "file_import", "db_read"] as const;
export type SourceChannel = (typeof SOURCE_CHANNELS)[number];

export const PROCESSING_STATUSES = ["pending", "processing", "processed", "failed", "dead_letter"] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export type RawEventRow = {
  id: string;
  org_id: string;
  integration_account_id: string | null;
  provider: string;
  source_channel: SourceChannel | string;
  external_event_id: string | null;
  external_object_type: string | null;
  external_object_id: string | null;
  event_type: string;
  event_time: string | null;
  received_at: string;
  payload_json: Record<string, unknown>;
  headers_json: Record<string, unknown> | null;
  payload_hash: string;
  idempotency_key: string;
  processing_status: ProcessingStatus | string;
  processing_attempts: number;
  last_error_code: string | null;
  last_error_message: string | null;
  mapper_key: string | null;
  mapper_version: string | null;
  canonical_output_json?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type SignalDefinitionRow = {
  id: string;
  signal_key: string;
  display_name: string;
  category: string;
  description: string | null;
  business_meaning: string | null;
  source_providers: string[];
  canonical_entity_type: string;
  secondary_entity_types: string[];
  schema_version: number;
  required_dimensions: string[];
  optional_dimensions: string[];
  required_measures: string[];
  optional_measures: string[];
  required_references: string[];
  timestamp_fields: string[];
  idempotency_strategy: string;
  quality_rules: Record<string, unknown>;
  sample_payload: Record<string, unknown> | null;
  detector_dependencies: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type NormalizedSignalRow = {
  id: string;
  org_id: string;
  raw_event_id: string;
  signal_definition_id: string;
  signal_key: string;
  schema_version: number;
  provider: string;
  integration_account_id: string | null;
  source_ref: string | null;
  primary_canonical_entity_id: string | null;
  signal_time: string;
  dimensions_json: Record<string, unknown>;
  measures_json: Record<string, unknown>;
  references_json: Record<string, unknown>;
  quality_score: number;
  quality_flags_json: string[];
  mapper_key: string;
  mapper_version: string;
  processing_lineage_json: Record<string, unknown>;
  idempotency_key: string | null;
  processing_run_id: string | null;
  created_at: string;
};

export type EntityCandidate = {
  provider: string;
  externalObjectType: string;
  externalId: string;
  entityType: string;
  confidence: number;
};

export type MapperResult = {
  signalKey: string;
  schemaVersion: number;
  signalTime: string;
  dimensions: Record<string, unknown>;
  measures: Record<string, unknown>;
  references: Record<string, unknown>;
  entityCandidates: EntityCandidate[];
  qualityInputs: Record<string, unknown>;
  lineage: Record<string, unknown>;
};
