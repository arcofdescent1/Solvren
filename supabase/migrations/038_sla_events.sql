-- 038_sla_events.sql
--
-- NOTE: This migration originally attempted to "upgrade" sla_events with FKs +
-- normalized columns (triggered_source / triggered_by).
--
-- sla_events was introduced earlier in 034 using CREATE TABLE IF NOT EXISTS.
-- On fresh installs, the table already exists by the time this runs.
-- That means the CREATE TABLE below becomes a no-op and the intended FK/column
-- changes do not apply.
--
-- We keep this file for historical context. The actual schema reconciliation is
-- performed in a follow-up idempotent migration: 042_fix_sla_events_schema.sql.

create table if not exists public.sla_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  change_event_id uuid not null references public.change_events(id) on delete cascade,

  previous_state text,
  new_state text not null,

  triggered_by uuid references auth.users(id) on delete set null,
  triggered_source text not null default 'SYSTEM',
  created_at timestamptz not null default now()
);

create index if not exists idx_sla_events_change on public.sla_events(change_event_id, created_at desc);
create index if not exists idx_sla_events_org on public.sla_events(org_id, created_at desc);

alter table public.sla_events enable row level security;

drop policy if exists sla_events_select on public.sla_events;
create policy sla_events_select on public.sla_events
for select using (is_org_member(org_id));

drop policy if exists sla_events_insert on public.sla_events;
create policy sla_events_insert on public.sla_events
for insert with check (is_org_member(org_id));
