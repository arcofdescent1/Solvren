/**
 * Phase 4 — Detector definition contract (§7.1).
 */
export type EvaluationMode = "event_driven" | "scheduled" | "hybrid";
export type DetectorStatus = "draft" | "active" | "deprecated";

export type DetectorDefinitionRow = {
  id: string;
  detector_key: string;
  detector_pack_id: string;
  display_name: string;
  description: string;
  category: string;
  business_problem: string;
  why_it_matters: string;
  required_integrations_json: string[];
  required_signal_keys_json: string[];
  optional_signal_keys_json: string[];
  required_entity_types_json: string[];
  evaluation_mode: EvaluationMode;
  evaluation_window_json: Record<string, unknown>;
  grouping_strategy_json: Record<string, unknown>;
  condition_definition_json: Record<string, unknown>;
  threshold_defaults_json: Record<string, unknown>;
  noise_controls_json: Record<string, unknown>;
  dedupe_strategy_json: Record<string, unknown>;
  suppression_strategy_json: Record<string, unknown>;
  issue_template_key: string;
  default_severity: string;
  default_priority_band: string;
  evidence_schema_json: Record<string, unknown>;
  impact_prerequisites_json: unknown[];
  routing_hints_json: Record<string, unknown>;
  verification_hints_json: Record<string, unknown>;
  detector_version: string;
  status: DetectorStatus;
  created_at: string;
  updated_at: string;
};
