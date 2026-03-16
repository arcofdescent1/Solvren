-- Phase 7 — Risk events, links, evidence, and alerts
-- risk_events: integration-sourced risk events with org scoping
-- risk_event_links: correlations between risk events
-- risk_event_evidence: evidence attachments for risk events
-- risk_alerts: alerts derived from risk events

-- risk_events
create table if not exists public.risk_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  object text not null,
  object_id text not null,
  field text,
  old_value jsonb,
  new_value jsonb,
  timestamp timestamptz not null,
  actor text,
  risk_type text not null,
  risk_score numeric not null,
  risk_bucket text not null,
  impact_amount numeric,
  change_event_id uuid references public.change_events(id) on delete set null,
  approval_id uuid references public.approvals(id) on delete set null,
  approved_at timestamptz,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_risk_events_org_timestamp
  on public.risk_events(org_id, timestamp desc);
create index if not exists idx_risk_events_change
  on public.risk_events(change_event_id) where change_event_id is not null;

-- risk_event_links
create table if not exists public.risk_event_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source_event_id uuid not null references public.risk_events(id) on delete cascade,
  target_event_id uuid not null references public.risk_events(id) on delete cascade,
  link_type text not null,
  created_at timestamptz not null default now(),
  unique (org_id, source_event_id, target_event_id, link_type)
);

create index if not exists idx_risk_event_links_source
  on public.risk_event_links(org_id, source_event_id);
create index if not exists idx_risk_event_links_target
  on public.risk_event_links(org_id, target_event_id);

-- risk_event_evidence
create table if not exists public.risk_event_evidence (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  risk_event_id uuid not null references public.risk_events(id) on delete cascade,
  evidence_type text not null,
  evidence_ref text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_risk_event_evidence_event
  on public.risk_event_evidence(risk_event_id);

-- risk_alerts
create table if not exists public.risk_alerts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  risk_event_id uuid not null references public.risk_events(id) on delete cascade,
  alert_type text not null,
  status text not null default 'open',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_risk_alerts_org_status
  on public.risk_alerts(org_id, status);
create index if not exists idx_risk_alerts_event
  on public.risk_alerts(risk_event_id);

-- RLS: risk_events
alter table public.risk_events enable row level security;

drop policy if exists risk_events_select on public.risk_events;
create policy risk_events_select on public.risk_events
  for select using (is_org_member(org_id));

drop policy if exists risk_events_insert_service on public.risk_events;
create policy risk_events_insert_service on public.risk_events
  for insert with check (auth.role() = 'service_role');

drop policy if exists risk_events_update_service on public.risk_events;
create policy risk_events_update_service on public.risk_events
  for update using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- RLS: risk_event_links
alter table public.risk_event_links enable row level security;

drop policy if exists risk_event_links_select on public.risk_event_links;
create policy risk_event_links_select on public.risk_event_links
  for select using (is_org_member(org_id));

drop policy if exists risk_event_links_insert_service on public.risk_event_links;
create policy risk_event_links_insert_service on public.risk_event_links
  for insert with check (auth.role() = 'service_role');

drop policy if exists risk_event_links_update_service on public.risk_event_links;
create policy risk_event_links_update_service on public.risk_event_links
  for update using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- RLS: risk_event_evidence
alter table public.risk_event_evidence enable row level security;

drop policy if exists risk_event_evidence_select on public.risk_event_evidence;
create policy risk_event_evidence_select on public.risk_event_evidence
  for select using (is_org_member(org_id));

drop policy if exists risk_event_evidence_insert_service on public.risk_event_evidence;
create policy risk_event_evidence_insert_service on public.risk_event_evidence
  for insert with check (auth.role() = 'service_role');

-- RLS: risk_alerts
alter table public.risk_alerts enable row level security;

drop policy if exists risk_alerts_select on public.risk_alerts;
create policy risk_alerts_select on public.risk_alerts
  for select using (is_org_member(org_id));

drop policy if exists risk_alerts_insert_service on public.risk_alerts;
create policy risk_alerts_insert_service on public.risk_alerts
  for insert with check (auth.role() = 'service_role');

drop policy if exists risk_alerts_update_service on public.risk_alerts;
create policy risk_alerts_update_service on public.risk_alerts
  for update using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
