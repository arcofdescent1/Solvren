-- 1B.2 — Slack message refs for updating posted messages

create table if not exists public.notification_outbox_slack_refs (
  outbox_id uuid primary key references public.notification_outbox(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,

  channel_id text not null,
  message_ts text not null,
  thread_ts text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_outbox_slack_refs_org
  on public.notification_outbox_slack_refs(org_id);

alter table public.notification_outbox_slack_refs enable row level security;

drop policy if exists outbox_slack_refs_select on public.notification_outbox_slack_refs;
create policy outbox_slack_refs_select on public.notification_outbox_slack_refs
for select using (is_org_member(org_id));

drop policy if exists outbox_slack_refs_insert on public.notification_outbox_slack_refs;
create policy outbox_slack_refs_insert on public.notification_outbox_slack_refs
for insert with check (is_org_member(org_id));

drop policy if exists outbox_slack_refs_update on public.notification_outbox_slack_refs;
create policy outbox_slack_refs_update on public.notification_outbox_slack_refs
for update using (is_org_member(org_id)) with check (is_org_member(org_id));

-- 1B.2 — Slack interactive action events (dedupe + audit)

create table if not exists public.slack_action_events (
  id bigserial primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,

  dedupe_key text not null,
  slack_team_id text null,
  slack_user_id text not null,

  action_id text not null,
  channel_id text not null,
  message_ts text not null,

  payload jsonb not null,
  created_at timestamptz not null default now(),

  unique(dedupe_key)
);

create index if not exists idx_slack_action_events_org
  on public.slack_action_events(org_id);

alter table public.slack_action_events enable row level security;

drop policy if exists slack_action_events_select on public.slack_action_events;
create policy slack_action_events_select on public.slack_action_events
for select using (is_org_member(org_id));

drop policy if exists slack_action_events_insert on public.slack_action_events;
create policy slack_action_events_insert on public.slack_action_events
for insert with check (is_org_member(org_id));

drop policy if exists slack_action_events_insert_service_role on public.slack_action_events;
create policy slack_action_events_insert_service_role on public.slack_action_events
for insert with check (auth.role() = 'service_role');

drop policy if exists outbox_slack_refs_insert_service_role on public.notification_outbox_slack_refs;
create policy outbox_slack_refs_insert_service_role on public.notification_outbox_slack_refs
for insert with check (auth.role() = 'service_role');
