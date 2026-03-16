-- GitHub Integration (IES v1.0)
-- Uses integration_connections (provider='github'), github_installations, github_repositories, etc.

-- github_connect_sessions: short-lived state for installation redirect flow
create table if not exists public.github_connect_sessions (
  id uuid primary key default gen_random_uuid(),
  state text not null unique,
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_github_connect_sessions_state on public.github_connect_sessions(state);

-- github_installations
create table if not exists public.github_installations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  integration_connection_id uuid references public.integration_connections(id) on delete cascade,
  github_installation_id bigint not null,
  github_account_login text,
  github_account_type text check (github_account_type in ('User','Organization')),
  app_slug text,
  installation_target_id bigint,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, github_installation_id)
);

create index if not exists idx_github_installations_org on public.github_installations(org_id);
create index if not exists idx_github_installations_installation_id on public.github_installations(github_installation_id);

-- github_repositories
create table if not exists public.github_repositories (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  github_installation_id bigint not null,
  github_repository_id bigint not null,
  owner_login text,
  repo_name text,
  full_name text,
  default_branch text,
  private boolean default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, github_repository_id)
);

create index if not exists idx_github_repositories_org on public.github_repositories(org_id);
create index if not exists idx_github_repositories_installation on public.github_repositories(github_installation_id);

-- github_repo_configs
create table if not exists public.github_repo_configs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  github_repository_id bigint not null,
  enabled boolean not null default true,
  auto_create_change_from_pr boolean not null default true,
  auto_detect_push_changes boolean not null default true,
  status_checks_enabled boolean not null default true,
  pr_comment_sync_enabled boolean not null default false,
  default_domain text,
  file_path_rules jsonb default '[]',
  branch_rules jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, github_repository_id)
);

create index if not exists idx_github_repo_configs_org on public.github_repo_configs(org_id);

-- github_pull_request_links
create table if not exists public.github_pull_request_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  change_id uuid not null references public.change_events(id) on delete cascade,
  github_repository_id bigint not null,
  github_pr_number int not null,
  github_pr_id bigint not null,
  head_sha text,
  base_ref text,
  head_ref text,
  state text check (state in ('open','closed','merged')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, github_pr_id)
);

create index if not exists idx_github_pr_links_org on public.github_pull_request_links(org_id);
create index if not exists idx_github_pr_links_change on public.github_pull_request_links(change_id);
create index if not exists idx_github_pr_links_repo_pr on public.github_pull_request_links(github_repository_id, github_pr_number);

-- github_commit_status_links
create table if not exists public.github_commit_status_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  change_id uuid not null references public.change_events(id) on delete cascade,
  github_repository_id bigint not null,
  sha text not null,
  status_context text not null,
  last_state text check (last_state in ('pending','success','failure','error')),
  target_url text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, github_repository_id, sha, status_context)
);

create index if not exists idx_github_commit_status_org on public.github_commit_status_links(org_id);
create index if not exists idx_github_commit_status_change on public.github_commit_status_links(change_id);

-- github_webhook_events
create table if not exists public.github_webhook_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid,
  github_delivery_id text not null unique,
  github_event text not null,
  github_installation_id bigint,
  github_repository_id bigint,
  action text,
  payload jsonb not null default '{}',
  received_at timestamptz not null default now(),
  processed boolean not null default false,
  processed_at timestamptz,
  error_code text,
  error_message text
);

create index if not exists idx_github_webhook_events_processed on public.github_webhook_events(processed, received_at);
create index if not exists idx_github_webhook_events_delivery on public.github_webhook_events(github_delivery_id);

-- github_detection_events
create table if not exists public.github_detection_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  github_repository_id bigint not null,
  source_type text not null check (source_type in ('pull_request','push')),
  source_id text not null,
  change_id uuid references public.change_events(id) on delete set null,
  detected_domain text,
  detected_files jsonb default '[]',
  detected_risk_score int,
  detection_reason jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_github_detection_events_org on public.github_detection_events(org_id);
create index if not exists idx_github_detection_events_repo on public.github_detection_events(github_repository_id);
create index if not exists idx_github_detection_events_source on public.github_detection_events(source_type, source_id);

-- github_pr_comment_syncs (idempotency for PR comments)
create table if not exists public.github_pr_comment_syncs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  change_id uuid not null references public.change_events(id) on delete cascade,
  github_repository_id bigint not null,
  github_pr_id bigint not null,
  event_type text not null,
  idempotency_key text not null unique,
  github_comment_id bigint,
  status text not null default 'pending' check (status in ('sent','failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_github_pr_comment_syncs_org on public.github_pr_comment_syncs(org_id);
create index if not exists idx_github_pr_comment_syncs_pr on public.github_pr_comment_syncs(github_repository_id, github_pr_id);

-- updated_at triggers
drop trigger if exists trg_github_installations_updated_at on public.github_installations;
create trigger trg_github_installations_updated_at before update on public.github_installations
  for each row execute function set_updated_at();
drop trigger if exists trg_github_repositories_updated_at on public.github_repositories;
create trigger trg_github_repositories_updated_at before update on public.github_repositories
  for each row execute function set_updated_at();
drop trigger if exists trg_github_repo_configs_updated_at on public.github_repo_configs;
create trigger trg_github_repo_configs_updated_at before update on public.github_repo_configs
  for each row execute function set_updated_at();
drop trigger if exists trg_github_pull_request_links_updated_at on public.github_pull_request_links;
create trigger trg_github_pull_request_links_updated_at before update on public.github_pull_request_links
  for each row execute function set_updated_at();
drop trigger if exists trg_github_commit_status_links_updated_at on public.github_commit_status_links;
create trigger trg_github_commit_status_links_updated_at before update on public.github_commit_status_links
  for each row execute function set_updated_at();
drop trigger if exists trg_github_pr_comment_syncs_updated_at on public.github_pr_comment_syncs;
create trigger trg_github_pr_comment_syncs_updated_at before update on public.github_pr_comment_syncs
  for each row execute function set_updated_at();

-- RLS
alter table public.github_connect_sessions enable row level security;
create policy github_connect_sessions_service on public.github_connect_sessions
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

alter table public.github_installations enable row level security;
alter table public.github_repositories enable row level security;
alter table public.github_repo_configs enable row level security;
alter table public.github_pull_request_links enable row level security;
alter table public.github_commit_status_links enable row level security;
alter table public.github_webhook_events enable row level security;
alter table public.github_detection_events enable row level security;
alter table public.github_pr_comment_syncs enable row level security;

-- github_installations, github_repositories, github_repo_configs: org members read
create policy github_installations_read_org on public.github_installations
  for select using (exists (select 1 from public.organization_members m where m.org_id = github_installations.org_id and m.user_id = auth.uid()));
create policy github_repositories_read_org on public.github_repositories
  for select using (exists (select 1 from public.organization_members m where m.org_id = github_repositories.org_id and m.user_id = auth.uid()));
create policy github_repo_configs_read_org on public.github_repo_configs
  for select using (exists (select 1 from public.organization_members m where m.org_id = github_repo_configs.org_id and m.user_id = auth.uid()));

-- github_pull_request_links, github_commit_status_links: org members read
create policy github_pr_links_read_org on public.github_pull_request_links
  for select using (exists (select 1 from public.organization_members m where m.org_id = github_pull_request_links.org_id and m.user_id = auth.uid()));
create policy github_commit_status_read_org on public.github_commit_status_links
  for select using (exists (select 1 from public.organization_members m where m.org_id = github_commit_status_links.org_id and m.user_id = auth.uid()));

-- service_role for all writes and webhook tables
create policy github_installations_service on public.github_installations
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy github_repositories_service on public.github_repositories
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy github_repo_configs_read_org_write_admin on public.github_repo_configs
  for select using (exists (select 1 from public.organization_members m where m.org_id = github_repo_configs.org_id and m.user_id = auth.uid()));
create policy github_repo_configs_write_admin on public.github_repo_configs
  for insert with check (exists (select 1 from public.organization_members m where m.org_id = github_repo_configs.org_id and m.user_id = auth.uid() and m.role in ('owner','admin')));
create policy github_repo_configs_update_admin on public.github_repo_configs
  for update using (exists (select 1 from public.organization_members m where m.org_id = github_repo_configs.org_id and m.user_id = auth.uid() and m.role in ('owner','admin')));
create policy github_pr_links_service on public.github_pull_request_links
  for insert with check (auth.role() = 'service_role');
create policy github_pr_links_update_service on public.github_pull_request_links
  for update using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy github_commit_status_service on public.github_commit_status_links
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy github_webhook_events_service on public.github_webhook_events
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy github_detection_events_service on public.github_detection_events
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy github_pr_comment_syncs_service on public.github_pr_comment_syncs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
