-- Phase A-D: Governance Engine + Integration Platform enhancements

-- A1: Dynamic Approval Policies
create table if not exists public.approval_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  priority int not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_approval_policies_org on public.approval_policies(org_id);

create table if not exists public.approval_policy_conditions (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.approval_policies(id) on delete cascade,
  condition_type text not null,
  field text not null,
  operator text not null,
  value jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_approval_policy_conditions_policy on public.approval_policy_conditions(policy_id);

create table if not exists public.approval_policy_roles (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.approval_policies(id) on delete cascade,
  required_role text not null,
  min_count int not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists idx_approval_policy_roles_policy on public.approval_policy_roles(policy_id);

-- B2: Integration Event Bus (normalized events from all integrations)
create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  event_type text not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}',
  timestamp timestamptz not null default now(),
  processed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_integration_events_org_time on public.integration_events(org_id, timestamp desc);
create index if not exists idx_integration_events_unprocessed on public.integration_events(processed) where not processed;

-- RLS for new tables
alter table public.approval_policies enable row level security;
alter table public.approval_policy_conditions enable row level security;
alter table public.approval_policy_roles enable row level security;
alter table public.integration_events enable row level security;

create policy approval_policies_select on public.approval_policies for select using (is_org_member(org_id));
create policy approval_policies_insert on public.approval_policies for insert with check (is_org_member(org_id));
create policy approval_policies_update on public.approval_policies for update using (is_org_member(org_id));

create policy approval_policy_conditions_select on public.approval_policy_conditions for select
  using (exists (select 1 from public.approval_policies p where p.id = policy_id and is_org_member(p.org_id)));
create policy approval_policy_conditions_insert on public.approval_policy_conditions for insert
  with check (exists (select 1 from public.approval_policies p where p.id = policy_id and is_org_member(p.org_id)));

create policy approval_policy_roles_select on public.approval_policy_roles for select
  using (exists (select 1 from public.approval_policies p where p.id = policy_id and is_org_member(p.org_id)));
create policy approval_policy_roles_insert on public.approval_policy_roles for insert
  with check (exists (select 1 from public.approval_policies p where p.id = policy_id and is_org_member(p.org_id)));

create policy integration_events_select on public.integration_events for select using (is_org_member(org_id));
create policy integration_events_service on public.integration_events for all using (auth.role() = 'service_role');
