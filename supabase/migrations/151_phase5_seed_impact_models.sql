-- Phase 5 — Seed impact models and default assumptions (§14).

-- RL1: Failed payment unrecovered
INSERT INTO public.impact_models (
  model_key, model_version, display_name, issue_family, detector_keys_json,
  description, inputs_schema_json, outputs_schema_json, assumptions_schema_json,
  confidence_rules_json, status
) VALUES (
  'revenue.failed_payment_unrecovered', '1.0',
  'Failed Payment Unrecovered', 'revenue_leakage', '["revenue.failed_payment_unrecovered"]',
  'Estimates revenue at risk from unrecovered payment failures.',
  '{"amount": "number", "recovery_rate": "number"}',
  '{"revenue_at_risk_amount": "number"}',
  '{"payment_recovery_rate": "number"}',
  '{}', 'active'
) ON CONFLICT (model_key, model_version) DO NOTHING;

-- RL2: Past-due invoice high value
INSERT INTO public.impact_models (
  model_key, model_version, display_name, issue_family, detector_keys_json,
  description, inputs_schema_json, outputs_schema_json, assumptions_schema_json,
  confidence_rules_json, status
) VALUES (
  'revenue.invoice_past_due_high_value', '1.0',
  'Past-Due Invoice High Value', 'revenue_leakage', '["revenue.invoice_past_due_high_value"]',
  'Estimates revenue at risk from high-value past-due invoices.',
  '{"amount": "number", "recovery_rate": "number"}',
  '{"revenue_at_risk_amount": "number"}',
  '{"payment_recovery_rate": "number"}',
  '{}', 'active'
) ON CONFLICT (model_key, model_version) DO NOTHING;

-- RL3: Subscription canceled after payment distress
INSERT INTO public.impact_models (
  model_key, model_version, display_name, issue_family, detector_keys_json,
  description, inputs_schema_json, outputs_schema_json, assumptions_schema_json,
  confidence_rules_json, status
) VALUES (
  'revenue.subscription_canceled_after_failed_payment', '1.0',
  'Subscription Canceled After Failed Payment', 'revenue_leakage', '["revenue.subscription_canceled_after_failed_payment"]',
  'Estimates lost LTV from churned subscription after payment distress.',
  '{"mrr": "number", "ltv_multiplier": "number"}',
  '{"revenue_at_risk_amount": "number", "direct_realized_loss_amount": "number"}',
  '{"avg_ltv_multiplier": "number"}',
  '{}', 'active'
) ON CONFLICT (model_key, model_version) DO NOTHING;

-- RL4: Payment failure spike
INSERT INTO public.impact_models (
  model_key, model_version, display_name, issue_family, detector_keys_json,
  description, inputs_schema_json, outputs_schema_json, assumptions_schema_json,
  confidence_rules_json, status
) VALUES (
  'revenue.payment_failure_spike', '1.0',
  'Payment Failure Spike', 'revenue_leakage', '["revenue.payment_failure_spike"]',
  'Estimates aggregate revenue at risk and operational cost from payment failure spike.',
  '{"total_failed_amount": "number", "failure_count": "number"}',
  '{"revenue_at_risk_amount": "number", "operational_cost_amount": "number"}',
  '{"payment_recovery_rate": "number"}',
  '{}', 'active'
) ON CONFLICT (model_key, model_version) DO NOTHING;

-- FP1–FP4: Funnel Protection
INSERT INTO public.impact_models (model_key, model_version, display_name, issue_family, detector_keys_json, description, inputs_schema_json, outputs_schema_json, assumptions_schema_json, confidence_rules_json, status)
VALUES
  ('funnel.qualified_lead_unworked', '1.0', 'Qualified Lead Unworked', 'funnel_protection', '["funnel.qualified_lead_unworked"]', 'Revenue at risk from unworked qualified leads.', '{}', '{"revenue_at_risk_amount": "number"}', '{"avg_deal_size":"number","mql_to_opportunity_rate":"number","opportunity_to_close_rate":"number","lead_response_decay_factor":"number"}', '{}', 'active'),
  ('funnel.opportunity_stalled_in_stage', '1.0', 'Opportunity Stalled in Stage', 'funnel_protection', '["funnel.opportunity_stalled_in_stage"]', 'Revenue at risk from stalled opportunities.', '{}', '{"revenue_at_risk_amount": "number"}', '{"avg_deal_size":"number","opportunity_to_close_rate":"number"}', '{}', 'active'),
  ('funnel.meeting_missing_after_qualification', '1.0', 'Meeting Missing After Qualification', 'funnel_protection', '["funnel.meeting_missing_after_qualification"]', 'Revenue at risk from missing meetings post-qualification.', '{}', '{"revenue_at_risk_amount": "number"}', '{"avg_deal_size":"number","meeting_to_opportunity_rate":"number","opportunity_to_close_rate":"number","lead_response_decay_factor":"number"}', '{}', 'active'),
  ('funnel.no_show_without_followup', '1.0', 'No-Show Without Follow-up', 'funnel_protection', '["funnel.no_show_without_followup"]', 'Revenue at risk from no-shows without reschedule.', '{}', '{"revenue_at_risk_amount": "number"}', '{"avg_deal_size":"number","meeting_to_opportunity_rate":"number","opportunity_to_close_rate":"number"}', '{}', 'active')
ON CONFLICT (model_key, model_version) DO NOTHING;

-- DI1–DI4: Data Integrity
INSERT INTO public.impact_models (model_key, model_version, display_name, issue_family, detector_keys_json, description, inputs_schema_json, outputs_schema_json, assumptions_schema_json, confidence_rules_json, status)
VALUES
  ('data.duplicate_contact_cluster', '1.0', 'Duplicate Contact Cluster', 'data_integrity', '["data.duplicate_contact_cluster"]', 'Operational cost of duplicate cleanup.', '{}', '{"operational_cost_amount": "number"}', '{"duplicate_cleanup_minutes_per_record":"number","loaded_labor_cost_per_hour":"number"}', '{}', 'active'),
  ('data.opportunity_missing_source_attribution', '1.0', 'Opportunity Missing Source Attribution', 'data_integrity', '["data.opportunity_missing_source_attribution"]', 'Routing and repair cost for missing attribution.', '{}', '{"revenue_at_risk_amount":"number","operational_cost_amount":"number"}', '{"avg_deal_size":"number","loaded_labor_cost_per_hour":"number"}', '{}', 'active'),
  ('data.owner_missing_revenue_record', '1.0', 'Owner Missing on Revenue Record', 'data_integrity', '["data.owner_missing_revenue_record"]', 'Triage cost and pipeline risk for unassigned records.', '{}', '{"revenue_at_risk_amount":"number","operational_cost_amount":"number"}', '{"avg_deal_size":"number","loaded_labor_cost_per_hour":"number"}', '{}', 'active'),
  ('data.workflow_sync_drift_detected', '1.0', 'Workflow Sync Drift', 'data_integrity', '["data.workflow_sync_drift_detected"]', 'Cleanup cost and workflow impact.', '{}', '{"revenue_at_risk_amount":"number","operational_cost_amount":"number"}', '{"duplicate_cleanup_minutes_per_record":"number","loaded_labor_cost_per_hour":"number","critical_surface_revenue_share":"number"}', '{}', 'active')
ON CONFLICT (model_key, model_version) DO NOTHING;

-- CR1–CR4: Change Risk
INSERT INTO public.impact_models (model_key, model_version, display_name, issue_family, detector_keys_json, description, inputs_schema_json, outputs_schema_json, assumptions_schema_json, confidence_rules_json, status)
VALUES
  ('change.revenue_change_missing_approval', '1.0', 'Revenue Change Missing Approval', 'change_risk', '["change.revenue_change_missing_approval"]', 'Revenue at risk from unapproved changes.', '{}', '{"revenue_at_risk_amount":"number"}', '{"critical_surface_revenue_share":"number"}', '{}', 'active'),
  ('change.high_risk_change_missing_evidence', '1.0', 'High-Risk Change Missing Evidence', 'change_risk', '["change.high_risk_change_missing_evidence"]', 'Prevention estimate for evidence gap.', '{}', '{"revenue_at_risk_amount":"number"}', '{"critical_surface_revenue_share":"number"}', '{}', 'active'),
  ('change.change_followed_by_incident', '1.0', 'Change Followed by Incident', 'change_risk', '["change.change_followed_by_incident"]', 'Direct loss and ongoing risk from incident.', '{}', '{"direct_realized_loss_amount":"number","revenue_at_risk_amount":"number"}', '{"critical_surface_revenue_share":"number"}', '{}', 'active'),
  ('change.unsafe_change_concentration', '1.0', 'Unsafe Change Concentration', 'change_risk', '["change.unsafe_change_concentration"]', 'Compounded risk from risky changes.', '{}', '{"revenue_at_risk_amount":"number","operational_cost_amount":"number"}', '{"critical_surface_revenue_share":"number"}', '{}', 'active')
ON CONFLICT (model_key, model_version) DO NOTHING;
