/**
 * Phase 5 — Impact assessment domain (§5.1).
 */
export type AssessmentStatus = "estimated" | "recalculated" | "superseded" | "insufficient_data";

export type ImpactAssessmentRow = {
  id: string;
  org_id: string;
  issue_id: string | null;
  finding_id: string | null;
  impact_model_id: string;
  model_key: string;
  model_version: string;
  assessment_status: AssessmentStatus;
  direct_realized_loss_amount: number | null;
  revenue_at_risk_amount: number | null;
  avoided_loss_amount: number | null;
  recovered_value_amount: number | null;
  operational_cost_amount: number | null;
  affected_customer_count: number | null;
  affected_record_count: number | null;
  confidence_score: number;
  impact_score: number;
  currency_code: string;
  inputs_snapshot_json: Record<string, unknown>;
  assumptions_snapshot_json: Record<string, unknown>;
  calculation_breakdown_json: Record<string, unknown>;
  confidence_explanation_json: Record<string, unknown>;
  created_at: string;
  superseded_by_assessment_id: string | null;
};
