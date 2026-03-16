/**
 * Shared draft shape for the guided intake workflow.
 * Maps to change_events columns.
 */
export type IntakeDraft = {
  id: string;
  title: string;
  org_id: string;
  status: string;
  domain: string;
  change_type: string | null;
  structured_change_type: string | null;
  systems_involved: string[];
  revenue_impact_areas: string[];
  rollout_method: string | null;
  planned_release_at: string | null;
  requested_release_at: string | null;
  rollback_time_estimate_hours: number | null;
  backfill_required: boolean;
  customer_impact_expected: boolean;
  affected_customer_segments: string[];
  revenue_surface: string | null;
  estimated_mrr_affected: number | null;
  percent_customer_base_affected: number | null;
  description: string | null;
  impacts_active_customers?: boolean;
  alters_pricing_visibility?: boolean;
  data_migration_required?: boolean;
  requires_code_deploy?: boolean;
  reversible_via_config?: boolean;
  requires_db_restore?: boolean;
  requires_manual_data_correction?: boolean;
};

export type IntakeStepId =
  | "change-type"
  | "systems"
  | "describe"
  | "revenue"
  | "customer"
  | "rollout"
  | "evidence"
  | "approvals"
  | "review";

/** Gap 6: 7-step guided wizard order. */
export const WIZARD_STEPS: { id: IntakeStepId; label: string }[] = [
  { id: "change-type", label: "What are you changing?" },
  { id: "systems", label: "Where is this happening?" },
  { id: "describe", label: "Describe the change" },
  { id: "revenue", label: "Estimated revenue impact" },
  { id: "evidence", label: "Proof the change was tested" },
  { id: "approvals", label: "Who approves?" },
  { id: "review", label: "Review & submit" },
];

/** Legacy full step list (includes optional customer/rollout). */
export const INTAKE_STEPS = WIZARD_STEPS;
