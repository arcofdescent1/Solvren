alter table public.customer_mappings add column export_id bigint generated always as identity unique;
alter table public.provider_cost_buckets add column export_id bigint generated always as identity unique;
alter table public.provider_cost_days add column export_id bigint generated always as identity unique;
alter table public.provider_connections add column export_id bigint generated always as identity unique;
alter table public.connector_jobs add column export_id bigint generated always as identity unique;
alter table public.stripe_customers add column export_id bigint generated always as identity unique;
alter table public.stripe_subscriptions add column export_id bigint generated always as identity unique;
alter table public.stripe_invoices add column export_id bigint generated always as identity unique;

create index usage_retention on public.usage_events(occurred_at,id);
create index outcomes_retention on public.outcome_events(occurred_at,id);
create index direct_cost_retention on public.direct_cost_events(occurred_at,id);
