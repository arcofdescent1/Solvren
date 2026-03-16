-- Coordination Autopilot plan versions.

create table if not exists public.coordination_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  change_id uuid not null references public.change_events(id) on delete cascade,
  version integer not null,
  status text not null check (status in ('PENDING', 'COMPLETED', 'FAILED')),
  input_hash text not null,
  plan_json jsonb not null default '{}'::jsonb,
  summary_text text null,
  is_current boolean not null default true,
  generated_by text not null check (generated_by in ('RULES_ONLY', 'HYBRID_AI', 'MANUAL_OVERRIDE')),
  created_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  superseded_at timestamptz null
);

create unique index if not exists uq_coordination_plans_change_version
  on public.coordination_plans(change_id, version);

create unique index if not exists uq_coordination_plans_current_per_change
  on public.coordination_plans(change_id)
  where is_current = true;

create index if not exists idx_coordination_plans_change_id
  on public.coordination_plans(change_id);

create index if not exists idx_coordination_plans_org_change_current
  on public.coordination_plans(org_id, change_id, is_current);

create index if not exists idx_coordination_plans_created_at_desc
  on public.coordination_plans(created_at desc);

alter table public.coordination_plans enable row level security;

drop policy if exists coordination_plans_select on public.coordination_plans;
create policy coordination_plans_select on public.coordination_plans
for select using (is_org_member(org_id));

drop policy if exists coordination_plans_insert on public.coordination_plans;
create policy coordination_plans_insert on public.coordination_plans
for insert with check (is_org_member(org_id));

drop policy if exists coordination_plans_update on public.coordination_plans;
create policy coordination_plans_update on public.coordination_plans
for update using (is_org_member(org_id))
with check (is_org_member(org_id));
