-- Phase 3 Item 4.1: SLA events table for transition audit
create table if not exists public.sla_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  change_event_id uuid not null,
  previous_state text null,
  new_state text not null,
  triggered_by text not null,
  triggered_by_user_id uuid null,
  reason text null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sla_events_change_idx
  on public.sla_events(change_event_id, created_at desc);

create index if not exists sla_events_org_idx
  on public.sla_events(org_id, created_at desc);

alter table public.sla_events enable row level security;

drop policy if exists "org members read sla events" on public.sla_events;
create policy "org members read sla events"
  on public.sla_events for select
  using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = sla_events.org_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "org members insert sla events" on public.sla_events;
create policy "org members insert sla events"
  on public.sla_events for insert
  with check (
    exists (
      select 1 from public.organization_members m
      where m.org_id = sla_events.org_id and m.user_id = auth.uid()
    )
  );
