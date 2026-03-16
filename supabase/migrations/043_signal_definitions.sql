-- 043_signal_definitions.sql
-- Phase 3 Item 7: Signal Registry System (no hardcoded signals)

create table if not exists public.signal_definitions (
  signal_key text primary key,
  domain text null,
  category text not null,
  value_type text not null,
  base_weight numeric not null default 0,
  enabled boolean not null default true,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.signal_definitions is 'Registry of risk signals. Used by scorer; add new signals without code changes.';

create index if not exists idx_signal_definitions_domain_enabled
  on public.signal_definitions(domain, enabled);

alter table public.signal_definitions enable row level security;

-- Read-only for app users. Writes are intended for migrations / service role.
drop policy if exists signal_definitions_select on public.signal_definitions;
create policy signal_definitions_select on public.signal_definitions
for select using (true);

-- Seed initial registry (mirrors previous WEIGHTS map)
insert into public.signal_definitions (signal_key, domain, category, value_type, base_weight, enabled, description)
values
  ('affects_active_billing_system', null, 'FINANCIAL_EXPOSURE', 'BOOLEAN', 5, true, null),
  ('modifies_pricing_logic', null, 'FINANCIAL_EXPOSURE', 'BOOLEAN', 4, true, null),
  ('modifies_discount_rules', null, 'FINANCIAL_EXPOSURE', 'BOOLEAN', 3, true, null),
  ('impacts_recurring_revenue_calculation', null, 'FINANCIAL_EXPOSURE', 'BOOLEAN', 5, true, null),
  ('requires_backfill_billing', null, 'FINANCIAL_EXPOSURE', 'BOOLEAN', 4, true, null),
  ('affects_invoice_generation', null, 'FINANCIAL_EXPOSURE', 'BOOLEAN', 4, true, null),
  ('alters_tax_logic', null, 'FINANCIAL_EXPOSURE', 'BOOLEAN', 4, true, null),
  ('touches_payment_processing_flow', null, 'FINANCIAL_EXPOSURE', 'BOOLEAN', 5, true, null),
  ('modifies_revenue_recognition_logic', null, 'FINANCIAL_EXPOSURE', 'BOOLEAN', 5, true, null),
  ('affects_subscription_lifecycle_logic', null, 'FINANCIAL_EXPOSURE', 'BOOLEAN', 4, true, null),

  ('crm_schema_change', null, 'DATA_INTEGRITY', 'BOOLEAN', 3, true, null),
  ('field_deletion', null, 'DATA_INTEGRITY', 'BOOLEAN', 4, true, null),
  ('field_rename', null, 'DATA_INTEGRITY', 'BOOLEAN', 2, true, null),
  ('modifies_required_field', null, 'DATA_INTEGRITY', 'BOOLEAN', 3, true, null),
  ('affects_data_sync_integration', null, 'DATA_INTEGRITY', 'BOOLEAN', 4, true, null),
  ('requires_historical_data_migration', null, 'DATA_INTEGRITY', 'BOOLEAN', 4, true, null),
  ('impacts_unique_identifier_field', null, 'DATA_INTEGRITY', 'BOOLEAN', 5, true, null),
  ('changes_data_validation_rules', null, 'DATA_INTEGRITY', 'BOOLEAN', 3, true, null),
  ('modifies_segment_logic', null, 'DATA_INTEGRITY', 'BOOLEAN', 2, true, null),

  ('impacts_mrr_reporting', null, 'REPORTING_ACCURACY', 'BOOLEAN', 4, true, null),
  ('impacts_churn_reporting', null, 'REPORTING_ACCURACY', 'BOOLEAN', 3, true, null),
  ('impacts_forecast_model', null, 'REPORTING_ACCURACY', 'BOOLEAN', 3, true, null),
  ('impacts_dashboard_metrics', null, 'REPORTING_ACCURACY', 'BOOLEAN', 2, true, null),
  ('modifies_pipeline_stage_logic', null, 'REPORTING_ACCURACY', 'BOOLEAN', 3, true, null),
  ('modifies_attribution_logic', null, 'REPORTING_ACCURACY', 'BOOLEAN', 2, true, null),

  ('impacts_active_customers', null, 'CUSTOMER_IMPACT', 'BOOLEAN', 5, true, null),
  ('changes_contract_terms', null, 'CUSTOMER_IMPACT', 'BOOLEAN', 4, true, null),
  ('alters_pricing_visibility', null, 'CUSTOMER_IMPACT', 'BOOLEAN', 4, true, null),
  ('requires_customer_communication', null, 'CUSTOMER_IMPACT', 'BOOLEAN', 3, true, null),
  ('risk_of_double_billing', null, 'CUSTOMER_IMPACT', 'BOOLEAN', 5, true, null),
  ('risk_of_underbilling', null, 'CUSTOMER_IMPACT', 'BOOLEAN', 4, true, null),
  ('impacts_trial_logic', null, 'CUSTOMER_IMPACT', 'BOOLEAN', 3, true, null),

  ('affects_marketing_automation', null, 'AUTOMATION_INTEGRATION', 'BOOLEAN', 3, true, null),
  ('affects_salesforce_workflows', null, 'AUTOMATION_INTEGRATION', 'BOOLEAN', 4, true, null),
  ('impacts_webhooks', null, 'AUTOMATION_INTEGRATION', 'BOOLEAN', 3, true, null),
  ('impacts_api_integrations', null, 'AUTOMATION_INTEGRATION', 'BOOLEAN', 4, true, null),
  ('impacts_internal_zaps', null, 'AUTOMATION_INTEGRATION', 'BOOLEAN', 2, true, null),
  ('changes_event_trigger_logic', null, 'AUTOMATION_INTEGRATION', 'BOOLEAN', 3, true, null),
  ('requires_multi_system_coordination', null, 'AUTOMATION_INTEGRATION', 'BOOLEAN', 4, true, null),

  ('reversible_via_config', null, 'ROLLBACK_COMPLEXITY', 'BOOLEAN', -2, true, 'Risk reducer'),
  ('requires_code_deploy', null, 'ROLLBACK_COMPLEXITY', 'BOOLEAN', 3, true, null),
  ('requires_database_restore', null, 'ROLLBACK_COMPLEXITY', 'BOOLEAN', 5, true, null),
  ('requires_manual_data_correction', null, 'ROLLBACK_COMPLEXITY', 'BOOLEAN', 4, true, null),
  ('affects_multiple_customer_segments', null, 'ROLLBACK_COMPLEXITY', 'BOOLEAN', 3, true, null),

  ('number_of_systems_involved', null, 'AUTOMATION_INTEGRATION', 'NUMBER', 1, true, 'Numeric: contributes for systems beyond baseline'),
  ('rollback_time_estimate_hours', null, 'ROLLBACK_COMPLEXITY', 'NUMBER', 1, true, 'Numeric: contributes by rollback time buckets')
on conflict (signal_key) do nothing;
