-- Phase 4 — Seed remaining detector definitions (A3, A4, B3, B4, C2–C4, D2, D4)

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

  -- A3: Subscription canceled after payment distress
  INSERT INTO public.detector_definitions (
    detector_key, detector_pack_id, display_name, description, category, business_problem, why_it_matters,
    required_signal_keys_json, optional_signal_keys_json, evaluation_mode, evaluation_window_json,
    grouping_strategy_json, condition_definition_json, default_severity, status
  ) VALUES (
    'revenue.subscription_canceled_after_failed_payment', pack_revenue,
    'Subscription Canceled After Payment Distress', 'Same subscription: payment distress then cancellation.',
    'revenue', 'Payment distress followed by churn indicates preventable loss.',
    'Early intervention on failed payments can prevent churn.',
    '["payment_failed","subscription_canceled"]', '[]',
    'hybrid', '{"lookback_hours": 168}',
    '{"by": "subscription_id"}', '{"type": "correlation"}', 'high', 'active'
  ) ON CONFLICT (detector_key) DO NOTHING;

  -- A4: Payment failure spike
  INSERT INTO public.detector_definitions (
    detector_key, detector_pack_id, display_name, description, category, business_problem, why_it_matters,
    required_signal_keys_json, evaluation_mode, evaluation_window_json,
    grouping_strategy_json, condition_definition_json, threshold_defaults_json, default_severity, status
  ) VALUES (
    'revenue.payment_failure_spike', pack_revenue,
    'Payment Failure Spike', 'Failure count or amount in window exceeds baseline.',
    'revenue', 'Spikes indicate systemic billing or card issues.',
    'Rapid detection enables quick response to payment system problems.',
    '["payment_failed"]', 'scheduled', '{"window_hours": 24}',
    '{"by": "org"}', '{"type": "threshold"}', '{"min_count": 5}', 'high', 'active'
  ) ON CONFLICT (detector_key) DO NOTHING;

  -- B3: Meeting missing after qualification
  INSERT INTO public.detector_definitions (
    detector_key, detector_pack_id, display_name, description, category, business_problem, why_it_matters,
    required_signal_keys_json, optional_signal_keys_json, evaluation_mode, evaluation_window_json,
    grouping_strategy_json, condition_definition_json, default_severity, status
  ) VALUES (
    'funnel.meeting_missing_after_qualification', pack_funnel,
    'Meeting Missing After Qualification', 'Qualified lead has no meeting within SLA.',
    'funnel', 'Unbooked qualified leads go cold.',
    'Meetings are critical for conversion; delay reduces close rate.',
    '["lead_status_changed","lead_created"]', '["meeting_booked"]',
    'scheduled', '{"sla_hours": 48}',
    '{"by": "lead_id"}', '{"type": "sla"}', 'medium', 'active'
  ) ON CONFLICT (detector_key) DO NOTHING;

  -- B4: No-show without follow-up
  INSERT INTO public.detector_definitions (
    detector_key, detector_pack_id, display_name, description, category, business_problem, why_it_matters,
    required_signal_keys_json, optional_signal_keys_json, evaluation_mode, evaluation_window_json,
    grouping_strategy_json, condition_definition_json, default_severity, status
  ) VALUES (
    'funnel.no_show_without_followup', pack_funnel,
    'No-Show Without Follow-Up', 'No-show with no recovery action within window.',
    'funnel', 'Unfollowed no-shows lose opportunities.',
    'Quick follow-up on no-shows can recover meetings.',
    '["meeting_no_show"]', '["task_created","meeting_rescheduled"]',
    'scheduled', '{"recovery_hours": 24}',
    '{"by": "meeting_id"}', '{"type": "sla"}', 'medium', 'active'
  ) ON CONFLICT (detector_key) DO NOTHING;

  -- C2: Opportunity missing source attribution
  INSERT INTO public.detector_definitions (
    detector_key, detector_pack_id, display_name, description, category, business_problem, why_it_matters,
    required_signal_keys_json, evaluation_mode, evaluation_window_json,
    grouping_strategy_json, condition_definition_json, default_severity, status
  ) VALUES (
    'data.opportunity_missing_source_attribution', pack_data,
    'Opportunity Missing Source Attribution', 'Opportunity lacks required source/attribution fields.',
    'data', 'Missing attribution distorts pipeline and marketing ROI.',
    'Source data is essential for attribution and reporting.',
    '["opportunity_stage_changed","deal_stage_changed"]', 'scheduled', '{"grace_hours": 72}',
    '{"by": "opportunity_id"}', '{"type": "state"}', 'medium', 'active'
  ) ON CONFLICT (detector_key) DO NOTHING;

  -- C3: Owner missing on revenue-critical records
  INSERT INTO public.detector_definitions (
    detector_key, detector_pack_id, display_name, description, category, business_problem, why_it_matters,
    required_signal_keys_json, evaluation_mode, evaluation_window_json,
    grouping_strategy_json, condition_definition_json, default_severity, status
  ) VALUES (
    'data.owner_missing_revenue_record', pack_data,
    'Owner Missing on Revenue Record', 'Deal or contact missing owner beyond grace period.',
    'data', 'Unassigned records slip through cracks.',
    'Ownership ensures accountability and follow-through.',
    '["deal_stage_changed","opportunity_stage_changed","contact_created","contact_updated"]', 'scheduled', '{"grace_hours": 24}',
    '{"by": "entity"}', '{"type": "state"}', 'medium', 'active'
  ) ON CONFLICT (detector_key) DO NOTHING;

  -- C4: Workflow sync drift detected
  INSERT INTO public.detector_definitions (
    detector_key, detector_pack_id, display_name, description, category, business_problem, why_it_matters,
    required_signal_keys_json, evaluation_mode, grouping_strategy_json,
    condition_definition_json, threshold_defaults_json, default_severity, status
  ) VALUES (
    'data.workflow_sync_drift_detected', pack_data,
    'Workflow Sync Drift', 'Repeated sync conflicts or drift for mapped records.',
    'data', 'Sync drift corrupts data integrity across systems.',
    'Consistent sync is required for accurate reporting.',
    '["workflow_sync_drift_detected","field_sync_conflict_detected"]', 'event_driven', '{"by": "workflow"}',
    '{"type": "pattern"}', '{"min_conflict_count": 2}', 'medium', 'active'
  ) ON CONFLICT (detector_key) DO NOTHING;

  -- D2: High-risk change missing evidence
  INSERT INTO public.detector_definitions (
    detector_key, detector_pack_id, display_name, description, category, business_problem, why_it_matters,
    required_signal_keys_json, evaluation_mode, grouping_strategy_json,
    condition_definition_json, default_severity, status
  ) VALUES (
    'change.high_risk_change_missing_evidence', pack_change,
    'High-Risk Change Missing Evidence', 'High-risk change lacks required documentation at gate.',
    'change', 'Undocumented changes increase operational risk.',
    'Evidence gates ensure changes are properly reviewed.',
    '["change_created","change_evidence_missing"]', 'event_driven', '{"by": "change_id"}',
    '{"type": "state"}', 'high', 'active'
  ) ON CONFLICT (detector_key) DO NOTHING;

  -- D4: Unsafe change concentration
  INSERT INTO public.detector_definitions (
    detector_key, detector_pack_id, display_name, description, category, business_problem, why_it_matters,
    required_signal_keys_json, evaluation_mode, evaluation_window_json,
    grouping_strategy_json, condition_definition_json, threshold_defaults_json, default_severity, status
  ) VALUES (
    'change.unsafe_change_concentration', pack_change,
    'Unsafe Change Concentration', 'Too many risky changes to same system in narrow window.',
    'change', 'Concentrated changes increase blast radius.',
    'Spreading risky changes reduces single-point failure risk.',
    '["change_deployed"]', 'event_driven', '{"window_hours": 4, "max_in_window": 3}',
    '{"by": "surface"}', '{"type": "threshold"}', '{"max_in_window": 3}', 'high', 'active'
  ) ON CONFLICT (detector_key) DO NOTHING;
END $$;
