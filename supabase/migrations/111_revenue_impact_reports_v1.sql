-- Revenue Impact Report v1 table and indexes.
-- Keeps legacy change_revenue_impact_reports intact; new API uses revenue_impact_reports.

create table if not exists public.revenue_impact_reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  change_id uuid not null references public.change_events(id) on delete cascade,
  version integer not null,
  status text not null check (status in ('PENDING', 'COMPLETED', 'FAILED')),
  generated_by text not null check (generated_by in ('RULES_ONLY', 'HYBRID_AI', 'MANUAL')),
  model_name text null,
  prompt_version text null,
  input_hash text not null,
  report_json jsonb not null default '{}'::jsonb,
  baseline_json jsonb not null default '{}'::jsonb,
  summary_text text null,
  risk_score numeric null,
  risk_level text null check (risk_level in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  confidence_score numeric null,
  is_current boolean not null default true,
  created_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  superseded_at timestamptz null
);

create unique index if not exists uq_revenue_impact_reports_change_version
  on public.revenue_impact_reports(change_id, version);

create unique index if not exists uq_revenue_impact_reports_current_per_change
  on public.revenue_impact_reports(change_id)
  where is_current = true;

create index if not exists idx_revenue_impact_reports_change_id
  on public.revenue_impact_reports(change_id);

create index if not exists idx_revenue_impact_reports_org_change_current
  on public.revenue_impact_reports(org_id, change_id, is_current);

create index if not exists idx_revenue_impact_reports_org_risk_level
  on public.revenue_impact_reports(org_id, risk_level);

create index if not exists idx_revenue_impact_reports_created_at_desc
  on public.revenue_impact_reports(created_at desc);

alter table public.revenue_impact_reports enable row level security;

drop policy if exists revenue_impact_reports_select on public.revenue_impact_reports;
create policy revenue_impact_reports_select on public.revenue_impact_reports
for select using (is_org_member(org_id));

drop policy if exists revenue_impact_reports_insert on public.revenue_impact_reports;
create policy revenue_impact_reports_insert on public.revenue_impact_reports
for insert with check (is_org_member(org_id));

drop policy if exists revenue_impact_reports_update on public.revenue_impact_reports;
create policy revenue_impact_reports_update on public.revenue_impact_reports
for update using (is_org_member(org_id))
with check (is_org_member(org_id));
