/**
 * Phase 4 — Detector configuration (§9.3).
 */
export type RolloutState = "off" | "observe_only" | "full";

export type DetectorConfigRow = {
  id: string;
  org_id: string;
  detector_definition_id: string;
  enabled: boolean;
  threshold_overrides_json: Record<string, unknown>;
  noise_control_overrides_json: Record<string, unknown>;
  routing_overrides_json: Record<string, unknown>;
  severity_override: string | null;
  priority_override: string | null;
  schedule_override_json: Record<string, unknown> | null;
  rollout_state: RolloutState;
  created_at: string;
  updated_at: string;
};
