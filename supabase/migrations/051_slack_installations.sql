-- Patch 1B.1 — Slack app installations per org

create table if not exists public.slack_installations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,

  team_id text not null,
  team_name text null,

  bot_user_id text null,
  bot_token text not null,

  installed_by uuid null references auth.users(id) on delete set null,
  installed_at timestamptz not null default now(),

  default_channel_id text null,
  default_channel_name text null,

  status text not null default 'ACTIVE',

  unique (org_id),
  unique (team_id)
);

create index if not exists idx_slack_installations_org on public.slack_installations(org_id);
alter table public.slack_installations enable row level security;

drop policy if exists slack_installations_read_org_members on public.slack_installations;
create policy slack_installations_read_org_members on public.slack_installations
for select
using (
  exists (
    select 1 from public.organization_members m
    where m.org_id = slack_installations.org_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists slack_installations_write_service on public.slack_installations;
create policy slack_installations_write_service on public.slack_installations
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
