/**
 * Phase 1 — Mapping layer types.
 */
import type { TransformSpec } from "./transformEngine";

export type MappingFieldRule = {
  source_path: string;
  canonical_field: string;
  transform_chain: TransformSpec[];
  default_value: string | null;
};

export type MappingConfig = {
  id: string;
  org_id: string;
  provider_key: string;
  source_object_type: string;
  canonical_object_type: string;
  version: number;
  fields: MappingFieldRule[];
};

export type ExecuteMappingResult = {
  status: "success" | "warning" | "failed";
  canonical: Record<string, unknown> | null;
  errors: string[];
  warnings: string[];
  runId?: string;
};
