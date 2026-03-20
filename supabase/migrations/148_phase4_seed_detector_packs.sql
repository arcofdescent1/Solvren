-- Phase 4 — Seed detector packs and definitions (§15).
-- Packs A–D: Revenue Leakage, Funnel Protection, Data Integrity, Change Risk

-- Pack A: Revenue Leakage Essentials
INSERT INTO public.detector_packs (pack_key, display_name, description, business_theme, recommended_integrations_json, status)
VALUES (
  'revenue_leakage_essentials',
  'Revenue Leakage Essentials',
  'Identify direct or near-direct revenue loss in billing and payment workflows.',
  'revenue_protection',
  '["stripe"]',
  'active'
) ON CONFLICT (pack_key) DO NOTHING;

-- Pack B: Funnel Protection
INSERT INTO public.detector_packs (pack_key, display_name, description, business_theme, recommended_integrations_json, status)
VALUES (
  'funnel_protection',
  'Funnel Protection',
  'Catch breakdowns in lead response and opportunity progression.',
  'sales_velocity',
  '["hubspot","salesforce"]',
  'active'
) ON CONFLICT (pack_key) DO NOTHING;

-- Pack C: Data Integrity and Attribution
INSERT INTO public.detector_packs (pack_key, display_name, description, business_theme, recommended_integrations_json, status)
VALUES (
  'data_integrity_attribution',
  'Data Integrity and Attribution',
  'Identify CRM and workflow integrity problems that distort revenue operations.',
  'data_quality',
  '["hubspot","salesforce"]',
  'active'
) ON CONFLICT (pack_key) DO NOTHING;

-- Pack D: Change Risk Monitoring
INSERT INTO public.detector_packs (pack_key, display_name, description, business_theme, recommended_integrations_json, status)
VALUES (
  'change_risk_monitoring',
  'Change Risk Monitoring',
  'Operational risk monitoring for revenue-impacting changes.',
  'change_governance',
  '[]',
  'active'
) ON CONFLICT (pack_key) DO NOTHING;

-- Detector definitions (reference pack by id)
DO $$
DECLARE
  pack_revenue uuid;
  pack_funnel uuid;
  pack_data uuid;
  pack_change uuid;
BEGIN
  SELECT id INTO pack_revenue FROM public.detector_packs WHERE pack_key = 'revenue_leakage_essentials' LIMIT 1;
  SELECT id INTO pack_funnel FROM public.detector_packs WHERE pack_key = 'funnel_protection' LIMIT 1;
  SELECT id INTO pack_data FROM public.detector_packs WHERE pack_key = 'data_integrity_attribution' LIMIT 1;
  SELECT id INTO pack_change FROM public.detector_packs WHERE pack_key = 'change_risk_monitoring' LIMIT 1;

  -- A1: Failed payment not recovered
  INSERT INTO public.detector_definitions (
    detector_key, detector_pack_id, display_name, description, category, business_problem, why_it_matters,
    required_signal_keys_json, optional_signal_keys_json, evaluation_mode, evaluation_window_json,
    grouping_strategy_json, condition_definition_json, threshold_defaults_json, default_severity, status
  ) VALUES (
    'revenue.failed_payment_unrecovered', pack_revenue,
    'Failed Payment Not Recovered', 'Payment failed with no recovery within configured window.',
    'revenue', 'Unrecovered payment failures cause churn and manual intervention.',
    'Every failed payment left unrecovered risks customer churn and revenue loss.',
    '["payment_failed"]', '["invoice_paid","subscription_canceled"]',
    'hybrid', '{"recovery_hours": 24}',
    '{"by": "invoice_id"}', '{"type": "threshold"}', '{"min_amount": 0}',
    'medium', 'active'
  ) ON CONFLICT (detector_key) DO NOTHING;

  -- A2: Invoice past due above threshold
  INSERT INTO public.detector_definitions (
    detector_key, detector_pack_id, display_name, description, category, business_problem, why_it_matters,
    required_signal_keys_json, evaluation_mode, evaluation_window_json,
    grouping_strategy_json, condition_definition_json, threshold_defaults_json, default_severity, status
  ) VALUES (
    'revenue.invoice_past_due_high_value', pack_revenue,
    'Invoice Past Due High Value', 'High-value invoice remains past due beyond age threshold.',
    'revenue', 'Overdue high-value invoices indicate collection risk.',
    'Large overdue invoices require immediate attention to prevent write-offs.',
    '["invoice_past_due"]', 'scheduled', '{"past_due_days": 7}',
    '{"by": "invoice_id"}', '{"type": "threshold"}', '{"min_amount": 1000}',
    'high', 'active'
  ) ON CONFLICT (detector_key) DO NOTHING;

  -- B1: Qualified lead unworked
  INSERT INTO public.detector_definitions (
    detector_key, detector_pack_id, display_name, description, category, business_problem, why_it_matters,
    required_signal_keys_json, optional_signal_keys_json, evaluation_mode, evaluation_window_json,
    grouping_strategy_json, condition_definition_json, threshold_defaults_json, default_severity, status
  ) VALUES (
    'funnel.qualified_lead_unworked', pack_funnel,
    'Qualified Lead Unworked', 'Lead entered qualified state with no follow-up within SLA.',
    'funnel', 'Unworked qualified leads go cold.',
    'Quick follow-up on qualified leads is critical for conversion.',
    '["lead_status_changed","lead_created"]', '["meeting_booked","task_created"]',
    'scheduled', '{"sla_hours": 24}',
    '{"by": "lead_id"}', '{"type": "sla"}', '{}',
    'medium', 'active'
  ) ON CONFLICT (detector_key) DO NOTHING;

  -- B2: Opportunity stalled in stage
  INSERT INTO public.detector_definitions (
    detector_key, detector_pack_id, display_name, description, category, business_problem, why_it_matters,
    required_signal_keys_json, evaluation_mode, evaluation_window_json,
    grouping_strategy_json, condition_definition_json, threshold_defaults_json, default_severity, status
  ) VALUES (
    'funnel.opportunity_stalled_in_stage', pack_funnel,
    'Opportunity Stalled in Stage', 'Opportunity remained in stage beyond SLA.',
    'funnel', 'Stalled opportunities indicate pipeline risk.',
    'Stale opportunities often indicate stalled deals or missing updates.',
    '["opportunity_stage_changed","deal_stage_changed"]', 'scheduled', '{"sla_days": 14}',
    '{"by": "opportunity_id"}', '{"type": "sla"}', '{}',
    'medium', 'active'
  ) ON CONFLICT (detector_key) DO NOTHING;

  -- C1: Duplicate contact cluster
  INSERT INTO public.detector_definitions (
    detector_key, detector_pack_id, display_name, description, category, business_problem, why_it_matters,
    required_signal_keys_json, evaluation_mode, grouping_strategy_json,
    condition_definition_json, threshold_defaults_json, default_severity, status
  ) VALUES (
    'data.duplicate_contact_cluster', pack_data,
    'Duplicate Contact Cluster', 'Duplicate candidates exceed threshold for same cluster.',
    'data', 'Duplicate contacts corrupt attribution and reporting.',
    'Duplicate records distort pipeline and attribution metrics.',
    '["contact_duplicate_candidate"]', 'event_driven', '{"by": "cluster"}',
    '{"type": "pattern"}', '{"min_cluster_size": 2}',
    'medium', 'active'
  ) ON CONFLICT (detector_key) DO NOTHING;

  -- D1: Revenue-impacting change missing required approval
  INSERT INTO public.detector_definitions (
    detector_key, detector_pack_id, display_name, description, category, business_problem, why_it_matters,
    required_signal_keys_json, evaluation_mode, grouping_strategy_json,
    condition_definition_json, default_severity, status
  ) VALUES (
    'change.revenue_change_missing_approval', pack_change,
    'Revenue Change Missing Approval', 'Revenue-impacting change reaches deployable state without required approvals.',
    'change', 'Unapproved revenue changes risk operational integrity.',
    'Governance gates protect revenue systems from unauthorized changes.',
    '["change_submitted","change_approved"]', 'event_driven', '{"by": "change_id"}',
    '{"type": "state"}', 'high', 'active'
  ) ON CONFLICT (detector_key) DO NOTHING;

  -- D3: Change followed by incident
  INSERT INTO public.detector_definitions (
    detector_key, detector_pack_id, display_name, description, category, business_problem, why_it_matters,
    required_signal_keys_json, evaluation_mode, evaluation_window_json,
    grouping_strategy_json, condition_definition_json, default_severity, status
  ) VALUES (
    'change.change_followed_by_incident', pack_change,
    'Change Followed by Incident', 'Related incident occurs within window after deployment.',
    'change', 'Post-deploy incidents indicate change-related risk.',
    'Correlating changes with incidents surfaces risky deployments.',
    '["change_deployed"]', 'hybrid', '{"incident_window_hours": 2}',
    '{"by": "change_or_incident"}', '{"type": "correlation"}', 'high', 'active'
  ) ON CONFLICT (detector_key) DO NOTHING;
END $$;
