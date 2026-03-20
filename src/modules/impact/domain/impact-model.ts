/**
 * Phase 5 — Impact model domain (§5.2).
 */
export type ImpactModelRow = {
  id: string;
  model_key: string;
  display_name: string;
  issue_family: string;
  detector_keys_json: string[];
  description: string;
  inputs_schema_json: Record<string, unknown>;
  outputs_schema_json: Record<string, unknown>;
  assumptions_schema_json: Record<string, unknown>;
  confidence_rules_json: Record<string, unknown>;
  status: string;
  model_version: string;
  created_at: string;
  updated_at: string;
};
