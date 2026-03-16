-- Jira Phase 2: webhook registrations, comment syncs, sync queue, retry schema

-- jira_webhook_registrations
create table if not exists public.jira_webhook_registrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  integration_connection_id uuid references public.integration_connections(id) on delete cascade,
  jira_webhook_id text not null,
  cloud_id text not null,
  callback_url text not null,
  events jsonb not null default '[]',
  jql_filter text,
  status text not null default 'active' check (status in ('active', 'inactive', 'error')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_jira_webhook_reg_org on public.jira_webhook_registrations(org_id);

-- jira_comment_syncs: idempotency for outbound comments
create table if not exists public.jira_comment_syncs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  change_event_id uuid not null references public.change_events(id) on delete cascade,
  jira_issue_id text not null,
  event_type text not null,
  idempotency_key text not null,
  jira_comment_id text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key)
);

create index if not exists idx_jira_comment_syncs_org on public.jira_comment_syncs(org_id);
create index if not exists idx_jira_comment_syncs_change on public.jira_comment_syncs(change_event_id);

-- jira_sync_queue: outbound issue property + comment sync jobs
create table if not exists public.jira_sync_queue (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  change_event_id uuid not null references public.change_events(id) on delete cascade,
  sync_type text not null check (sync_type in ('issue_property', 'comment')),
  event_type text,
  payload jsonb not null default '{}',
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_jira_sync_queue_pending on public.jira_sync_queue(org_id, processed_at) where processed_at is null;

-- extend integration_event_failures for retry (add columns if needed)
alter table public.integration_event_failures
  add column if not exists entity_type text,
  add column if not exists entity_id text,
  add column if not exists error_code text,
  add column if not exists status text default 'pending' check (status in ('pending', 'retrying', 'failed_permanent', 'resolved')),
  add column if not exists resolved_at timestamptz;

-- rename attempts -> attempt_count for spec alignment (keep both for backward compat - add attempt_count)
alter table public.integration_event_failures add column if not exists attempt_count int;
update public.integration_event_failures set attempt_count = attempts where attempt_count is null and attempts is not null;
alter table public.integration_event_failures alter column attempt_count set default 0;

-- RLS
alter table public.jira_webhook_registrations enable row level security;
alter table public.jira_comment_syncs enable row level security;
alter table public.jira_sync_queue enable row level security;

drop policy if exists jira_webhook_reg_service on public.jira_webhook_registrations;
create policy jira_webhook_reg_service on public.jira_webhook_registrations
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists jira_comment_syncs_service on public.jira_comment_syncs;
create policy jira_comment_syncs_service on public.jira_comment_syncs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

drop policy if exists jira_sync_queue_service on public.jira_sync_queue;
create policy jira_sync_queue_service on public.jira_sync_queue
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- triggers
drop trigger if exists trg_jira_webhook_reg_updated_at on public.jira_webhook_registrations;
create trigger trg_jira_webhook_reg_updated_at before update on public.jira_webhook_registrations
  for each row execute function set_updated_at();
drop trigger if exists trg_jira_comment_syncs_updated_at on public.jira_comment_syncs;
create trigger trg_jira_comment_syncs_updated_at before update on public.jira_comment_syncs
  for each row execute function set_updated_at();
