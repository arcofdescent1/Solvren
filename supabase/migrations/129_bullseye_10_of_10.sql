-- Bullseye 10/10 — Final architecture pass

-- Area 1: evidence_requirements (policy-driven, not code-driven)
create table if not exists public.evidence_requirements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  change_type_pattern text not null,
  evidence_type text not null,
  required boolean not null default true,
  created_at timestamptz not null default now(),
  unique (org_id, change_type_pattern, evidence_type)
);
create index if not exists idx_evidence_requirements_org on public.evidence_requirements(org_id);
alter table public.evidence_requirements enable row level security;
create policy evidence_requirements_select on public.evidence_requirements for select using (is_org_member(org_id));
create policy evidence_requirements_insert on public.evidence_requirements for insert with check (is_org_member(org_id));
create policy evidence_requirements_update on public.evidence_requirements for update using (is_org_member(org_id));

-- Area 2: providers registry (extensible provider metadata)
create table if not exists public.integration_providers (
  provider_key text primary key,
  display_name text not null,
  auth_type text not null default 'oauth',
  capabilities jsonb not null default '[]',
  created_at timestamptz not null default now()
);
insert into public.integration_providers (provider_key, display_name, auth_type, capabilities) values
  ('jira', 'Jira', 'oauth', '["connect","disconnect","sync","webhook","health"]'),
  ('salesforce', 'Salesforce', 'oauth', '["connect","disconnect","sync","health"]'),
  ('hubspot', 'HubSpot', 'oauth', '["connect","disconnect","sync","health"]'),
  ('netsuite', 'NetSuite', 'api_key', '["connect","disconnect","sync","health"]'),
  ('slack', 'Slack', 'oauth', '["connect","disconnect","health"]'),
  ('github', 'GitHub', 'app', '["connect","disconnect","sync","webhook","health"]')
on conflict (provider_key) do nothing;

-- Area 3/4: risk_exposure_summary view (replaces materialized view for flexibility)
create or replace view public.risk_exposure_summary as
select
  org_id,
  count(*) as total_events,
  coalesce(sum(impact_amount) filter (where approved_at is null), 0) as unapproved_exposure,
  coalesce(sum(impact_amount), 0) as total_exposure,
  count(*) filter (where risk_score > 80) as high_risk_count,
  count(*) filter (where approved_at is null) as unapproved_count
from public.risk_events
where timestamp >= now() - interval '90 days'
group by org_id;
