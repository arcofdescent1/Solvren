-- Patch 1B.2 — Slack Approve/Reject via Buttons

-- 1) slack_action_events (if not exists from 055)
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

drop policy if exists slack_action_events_write_service on public.slack_action_events;
create policy slack_action_events_write_service on public.slack_action_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');


-- 2) slack_user_map policies (table from 054; align policy names with spec)
drop policy if exists slack_user_map_insert_org_members on public.slack_user_map;
create policy slack_user_map_insert_org_members on public.slack_user_map
for insert with check (is_org_member(org_id));
