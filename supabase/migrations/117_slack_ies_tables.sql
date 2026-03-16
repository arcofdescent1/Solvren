-- Slack IES: workspace links, channel configs, message deliveries, interaction events
-- Reuses integration_connections + integration_credentials (add provider=slack)

-- slack_workspace_links
create table if not exists public.slack_workspace_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  integration_connection_id uuid references public.integration_connections(id) on delete cascade,
  slack_team_id text not null,
  slack_team_name text,
  slack_enterprise_id text,
  bot_user_id text,
  installed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id)
);

create index if not exists idx_slack_workspace_links_team on public.slack_workspace_links(slack_team_id);

-- slack_channel_configs
create table if not exists public.slack_channel_configs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  integration_connection_id uuid references public.integration_connections(id) on delete cascade,
  channel_type text not null check (channel_type in ('approval', 'risk_alert', 'incident', 'general')),
  slack_channel_id text not null,
  slack_channel_name text,
  is_default boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, channel_type)
);

create index if not exists idx_slack_channel_configs_org on public.slack_channel_configs(org_id);

-- slack_message_deliveries
create table if not exists public.slack_message_deliveries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  integration_connection_id uuid references public.integration_connections(id) on delete cascade,
  change_id uuid references public.change_events(id) on delete set null,
  approval_id uuid references public.approvals(id) on delete set null,
  message_type text not null,
  destination_type text not null check (destination_type in ('channel', 'user_dm')),
  destination_id text not null,
  slack_channel_id text,
  slack_ts text,
  idempotency_key text unique,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'retrying', 'resolved')),
  error_code text,
  error_message text,
  payload jsonb default '{}',
  attempt_count int default 0,
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_slack_message_deliveries_org on public.slack_message_deliveries(org_id);
create index if not exists idx_slack_message_deliveries_retry on public.slack_message_deliveries(next_retry_at) where next_retry_at is not null;

-- slack_interaction_events
create table if not exists public.slack_interaction_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  integration_connection_id uuid references public.integration_connections(id) on delete cascade,
  slack_team_id text not null,
  slack_user_id text not null,
  action_type text not null,
  payload jsonb default '{}',
  idempotency_key text unique,
  processed boolean default false,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_slack_interaction_events_org on public.slack_interaction_events(org_id);

-- RLS
alter table public.slack_workspace_links enable row level security;
alter table public.slack_channel_configs enable row level security;
alter table public.slack_message_deliveries enable row level security;
alter table public.slack_interaction_events enable row level security;

create policy slack_workspace_links_read_org on public.slack_workspace_links
  for select using (exists (select 1 from public.organization_members m where m.org_id = slack_workspace_links.org_id and m.user_id = auth.uid()));
create policy slack_workspace_links_write_service on public.slack_workspace_links
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy slack_channel_configs_read_org on public.slack_channel_configs
  for select using (exists (select 1 from public.organization_members m where m.org_id = slack_channel_configs.org_id and m.user_id = auth.uid()));
create policy slack_channel_configs_write_service on public.slack_channel_configs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy slack_message_deliveries_service on public.slack_message_deliveries
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy slack_interaction_events_service on public.slack_interaction_events
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- triggers
drop trigger if exists trg_slack_workspace_links_updated_at on public.slack_workspace_links;
create trigger trg_slack_workspace_links_updated_at before update on public.slack_workspace_links
  for each row execute function set_updated_at();
drop trigger if exists trg_slack_channel_configs_updated_at on public.slack_channel_configs;
create trigger trg_slack_channel_configs_updated_at before update on public.slack_channel_configs
  for each row execute function set_updated_at();
drop trigger if exists trg_slack_message_deliveries_updated_at on public.slack_message_deliveries;
create trigger trg_slack_message_deliveries_updated_at before update on public.slack_message_deliveries
  for each row execute function set_updated_at();
