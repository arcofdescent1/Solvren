export const WEIGHTS: Record<string, number> = {
  // Financial Exposure
  affects_active_billing_system: 5,
  modifies_pricing_logic: 4,
  modifies_discount_rules: 3,
  impacts_recurring_revenue_calculation: 5,
  requires_backfill_billing: 4,
  affects_invoice_generation: 4,
  alters_tax_logic: 4,
  touches_payment_processing_flow: 5,
  modifies_revenue_recognition_logic: 5,
  affects_subscription_lifecycle_logic: 4,

  // Data Integrity
  crm_schema_change: 3,
  field_deletion: 4,
  field_rename: 2,
  modifies_required_field: 3,
  affects_data_sync_integration: 4,
  requires_historical_data_migration: 4,
  impacts_unique_identifier_field: 5,
  changes_data_validation_rules: 3,
  modifies_segment_logic: 2,

  // Reporting Accuracy
  impacts_mrr_reporting: 4,
  impacts_churn_reporting: 3,
  impacts_forecast_model: 3,
  impacts_dashboard_metrics: 2,
  modifies_pipeline_stage_logic: 3,
  modifies_attribution_logic: 2,

  // Customer Impact
  impacts_active_customers: 5,
  changes_contract_terms: 4,
  alters_pricing_visibility: 4,
  requires_customer_communication: 3,
  risk_of_double_billing: 5,
  risk_of_underbilling: 4,
  impacts_trial_logic: 3,

  // Automation / Integration Risk
  affects_marketing_automation: 3,
  affects_salesforce_workflows: 4,
  impacts_webhooks: 3,
  impacts_api_integrations: 4,
  impacts_internal_zaps: 2,
  changes_event_trigger_logic: 3,
  requires_multi_system_coordination: 4,

  // Rollback Complexity
  reversible_via_config: -2, // risk reducer
  requires_code_deploy: 3,
  requires_database_restore: 5,
  requires_manual_data_correction: 4,
  affects_multiple_customer_segments: 3,

  // numeric signals handled specially (see scorer)
  number_of_systems_involved: 1,
  rollback_time_estimate_hours: 1,
};

export function bucketFromScore(
  score: number
): "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH" | "CRITICAL" {
  if (score <= 5) return "LOW";
  if (score <= 12) return "MEDIUM";
  if (score <= 20) return "HIGH";
  if (score <= 30) return "VERY_HIGH";
  return "CRITICAL";
}
