-- Patch 1B.2 — Slack user map: org + slack_user_id -> app user_id (no email reliance)

create table if not exists public.slack_user_map (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  slack_team_id text not null,
  slack_user_id text not null,
  created_at timestamptz not null default now(),

  unique (org_id, slack_user_id),
  unique (org_id, user_id)
);

create index if not exists idx_slack_user_map_org on public.slack_user_map(org_id);
create index if not exists idx_slack_user_map_team_user on public.slack_user_map(slack_team_id, slack_user_id);

alter table public.slack_user_map enable row level security;

drop policy if exists slack_user_map_read_org_members on public.slack_user_map;
create policy slack_user_map_read_org_members on public.slack_user_map
for select
using (
  exists (
    select 1 from public.organization_members m
    where m.org_id = slack_user_map.org_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists slack_user_map_write_service on public.slack_user_map;
create policy slack_user_map_write_service on public.slack_user_map
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
