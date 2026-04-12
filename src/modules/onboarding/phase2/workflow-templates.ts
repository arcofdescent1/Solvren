/**
 * Phase 2 activation — workflow cards map to detector_definitions.detector_key via source_template_key.
 */
export const WORKFLOW_SOURCE_TEMPLATE_KEYS = [
  "approval_cycle_threshold",
  "crm_record_consistency",
  "revenue_impacting_change",
  "payment_distress_window",
] as const;

export type WorkflowSourceTemplateKey = (typeof WORKFLOW_SOURCE_TEMPLATE_KEYS)[number];

/** Maps onboarding template → production detector key (must exist in detector_definitions). */
export const WORKFLOW_TEMPLATE_TO_DETECTOR_KEY: Record<WorkflowSourceTemplateKey, string> = {
  approval_cycle_threshold: "change.revenue_change_missing_approval",
  crm_record_consistency: "data.opportunity_missing_source_attribution",
  revenue_impacting_change: "revenue.payment_failure_spike",
  payment_distress_window: "revenue.subscription_canceled_after_failed_payment",
};

export const WORKFLOW_CARD_COPY: Record<
  WorkflowSourceTemplateKey,
  { title: string; description: string; impact: string; defaultThreshold: string }
> = {
  approval_cycle_threshold: {
    title: "Approval cycle SLA",
    description: "Alert when revenue-impacting changes approach deploy without required approvals.",
    impact: "Reduces revenue leakage from ungoverned releases.",
    defaultThreshold: "24h",
  },
  crm_record_consistency: {
    title: "CRM data consistency",
    description: "Detect missing attribution and hygiene gaps that skew revenue reporting.",
    impact: "Improves forecast and pipeline accuracy.",
    defaultThreshold: "48h lookback",
  },
  revenue_impacting_change: {
    title: "Revenue-impacting change detection",
    description: "Surface material forecast or pipeline shifts that need executive visibility.",
    impact: "Surfaces silent revenue risk early.",
    defaultThreshold: "20% MoM delta",
  },
  payment_distress_window: {
    title: "Payment distress & churn",
    description: "Correlate failed payments with subscription risk signals.",
    impact: "Protects recurring revenue.",
    defaultThreshold: "7d window",
  },
};
