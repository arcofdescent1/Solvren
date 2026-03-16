-- Jira Integration (IES v1.0)
-- Tables: integration_connections, integration_credentials, jira_issue_links, jira_status_mappings, integration_event_failures

-- integration_connections: org-level integration state
create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'jira',
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error')),
  config jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider)
);

create index if not exists idx_integration_connections_org on public.integration_connections(org_id);

-- integration_credentials: OAuth tokens (service_role only)
create table if not exists public.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'jira',
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider)
);

create index if not exists idx_integration_credentials_org on public.integration_credentials(org_id);

-- jira_issue_links: links Jira issues to Solvren changes
create table if not exists public.jira_issue_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  change_event_id uuid not null references public.change_events(id) on delete cascade,
  jira_issue_id text not null,
  jira_issue_key text not null,
  jira_project_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, jira_issue_id)
);

create index if not exists idx_jira_issue_links_org on public.jira_issue_links(org_id);
create index if not exists idx_jira_issue_links_change on public.jira_issue_links(change_event_id);
create index if not exists idx_jira_issue_links_issue on public.jira_issue_links(jira_issue_id);

-- jira_status_mappings: map Jira statuses to RG statuses
create table if not exists public.jira_status_mappings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  jira_status text not null,
  rg_status text not null,
  created_at timestamptz not null default now(),
  unique (org_id, jira_status)
);

create index if not exists idx_jira_status_mappings_org on public.jira_status_mappings(org_id);

-- integration_event_failures: failed webhook events for retry
create table if not exists public.integration_event_failures (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null default 'jira',
  event_type text not null,
  payload jsonb not null,
  error_message text,
  attempts int not null default 0,
  max_attempts int not null default 5,
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_integration_event_failures_org on public.integration_event_failures(org_id);
create index if not exists idx_integration_event_failures_retry on public.integration_event_failures(next_retry_at) where next_retry_at is not null;

-- updated_at triggers
drop trigger if exists trg_integration_connections_updated_at on public.integration_connections;
create trigger trg_integration_connections_updated_at before update on public.integration_connections
  for each row execute function set_updated_at();
drop trigger if exists trg_integration_credentials_updated_at on public.integration_credentials;
create trigger trg_integration_credentials_updated_at before update on public.integration_credentials
  for each row execute function set_updated_at();
drop trigger if exists trg_jira_issue_links_updated_at on public.jira_issue_links;
create trigger trg_jira_issue_links_updated_at before update on public.jira_issue_links
  for each row execute function set_updated_at();
drop trigger if exists trg_integration_event_failures_updated_at on public.integration_event_failures;
create trigger trg_integration_event_failures_updated_at before update on public.integration_event_failures
  for each row execute function set_updated_at();

-- RLS
alter table public.integration_connections enable row level security;
alter table public.integration_credentials enable row level security;
alter table public.jira_issue_links enable row level security;
alter table public.jira_status_mappings enable row level security;
alter table public.integration_event_failures enable row level security;

-- integration_connections: org members can read
drop policy if exists integration_connections_read_org_members on public.integration_connections;
create policy integration_connections_read_org_members on public.integration_connections
for select using (
  exists (select 1 from public.organization_members m where m.org_id = integration_connections.org_id and m.user_id = auth.uid())
);

drop policy if exists integration_connections_write_service on public.integration_connections;
create policy integration_connections_write_service on public.integration_connections
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- integration_credentials: service_role only (tokens)
drop policy if exists integration_credentials_service_only on public.integration_credentials;
create policy integration_credentials_service_only on public.integration_credentials
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- jira_issue_links: org members can read, service writes
drop policy if exists jira_issue_links_read_org_members on public.jira_issue_links;
create policy jira_issue_links_read_org_members on public.jira_issue_links
for select using (
  exists (select 1 from public.organization_members m where m.org_id = jira_issue_links.org_id and m.user_id = auth.uid())
);

drop policy if exists jira_issue_links_write_service on public.jira_issue_links;
create policy jira_issue_links_write_service on public.jira_issue_links
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- jira_status_mappings: admins read/write via app, service for sync
drop policy if exists jira_status_mappings_read_org_members on public.jira_status_mappings;
create policy jira_status_mappings_read_org_members on public.jira_status_mappings
for select using (
  exists (select 1 from public.organization_members m where m.org_id = jira_status_mappings.org_id and m.user_id = auth.uid())
);

drop policy if exists jira_status_mappings_write_service on public.jira_status_mappings;
create policy jira_status_mappings_write_service on public.jira_status_mappings
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- integration_event_failures: service only
drop policy if exists integration_event_failures_service_only on public.integration_event_failures;
create policy integration_event_failures_service_only on public.integration_event_failures
for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
