-- Phase 6 — Seed benchmark metrics and default cohort
INSERT INTO public.benchmark_metrics (metric_key, display_name, description, category, unit_type, normalization_method, minimum_org_count, minimum_coverage_rate, customer_visible, metric_version, higher_is_better)
SELECT 'payment_recovery_rate', 'Payment Recovery Rate', 'Share of failed payments successfully recovered', 'revenue_recovery', 'rate', 'RATE', 20, 0.70, true, '1.0', true
WHERE NOT EXISTS (SELECT 1 FROM public.benchmark_metrics WHERE metric_key = 'payment_recovery_rate' AND metric_version = '1.0');
INSERT INTO public.benchmark_metrics (metric_key, display_name, description, category, unit_type, normalization_method, minimum_org_count, minimum_coverage_rate, customer_visible, metric_version, higher_is_better)
SELECT 'median_recovery_time_hours', 'Median Recovery Time (hours)', 'Median hours to recover a failed payment', 'revenue_recovery', 'hours', 'MEDIAN_BUCKETED', 20, 0.70, true, '1.0', false
WHERE NOT EXISTS (SELECT 1 FROM public.benchmark_metrics WHERE metric_key = 'median_recovery_time_hours' AND metric_version = '1.0');
INSERT INTO public.benchmark_metrics (metric_key, display_name, description, category, unit_type, normalization_method, minimum_org_count, minimum_coverage_rate, customer_visible, metric_version, higher_is_better)
SELECT 'auto_recovered_revenue_ratio', 'Auto-Recovered Revenue Ratio', 'Share of recovered revenue via automated actions', 'revenue_recovery', 'rate', 'RATE', 20, 0.70, true, '1.0', true
WHERE NOT EXISTS (SELECT 1 FROM public.benchmark_metrics WHERE metric_key = 'auto_recovered_revenue_ratio' AND metric_version = '1.0');
INSERT INTO public.benchmark_metrics (metric_key, display_name, description, category, unit_type, normalization_method, minimum_org_count, minimum_coverage_rate, customer_visible, metric_version, higher_is_better)
SELECT 'median_qualified_lead_response_hours', 'Median Qualified Lead Response (hours)', 'Median hours to respond to qualified leads', 'funnel_protection', 'hours', 'MEDIAN_BUCKETED', 20, 0.70, true, '1.0', false
WHERE NOT EXISTS (SELECT 1 FROM public.benchmark_metrics WHERE metric_key = 'median_qualified_lead_response_hours' AND metric_version = '1.0');
INSERT INTO public.benchmark_metrics (metric_key, display_name, description, category, unit_type, normalization_method, minimum_org_count, minimum_coverage_rate, customer_visible, metric_version, higher_is_better)
SELECT 'duplicate_rate_per_10k_contacts', 'Duplicate Rate per 10K Contacts', 'Duplicate records per 10,000 contacts', 'data_integrity', 'per_10000', 'PER_10000', 20, 0.70, true, '1.0', false
WHERE NOT EXISTS (SELECT 1 FROM public.benchmark_metrics WHERE metric_key = 'duplicate_rate_per_10k_contacts' AND metric_version = '1.0');
INSERT INTO public.benchmark_metrics (metric_key, display_name, description, category, unit_type, normalization_method, minimum_org_count, minimum_coverage_rate, customer_visible, metric_version, higher_is_better)
SELECT 'change_incident_follow_rate', 'Change Incident Follow Rate', 'Share of high-risk changes with incident follow-up', 'change_risk', 'rate', 'RATE', 20, 0.70, true, '1.0', true
WHERE NOT EXISTS (SELECT 1 FROM public.benchmark_metrics WHERE metric_key = 'change_incident_follow_rate' AND metric_version = '1.0');
INSERT INTO public.benchmark_metrics (metric_key, display_name, description, category, unit_type, normalization_method, minimum_org_count, minimum_coverage_rate, customer_visible, metric_version, higher_is_better)
SELECT 'policy_violation_rate', 'Policy Violation Rate', 'Share of actions blocked by policy', 'change_risk', 'rate', 'RATE', 20, 0.70, true, '1.0', false
WHERE NOT EXISTS (SELECT 1 FROM public.benchmark_metrics WHERE metric_key = 'policy_violation_rate' AND metric_version = '1.0');

INSERT INTO public.benchmark_cohorts (cohort_key, display_name, cohort_definition_json, minimum_org_count)
VALUES ('default', 'Default Cohort', '{}'::jsonb, 20)
ON CONFLICT (cohort_key) DO NOTHING;
