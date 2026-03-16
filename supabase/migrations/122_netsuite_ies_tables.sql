-- NetSuite Integration (IES v1.0)
-- Uses integration_connections (provider='netsuite'), integration_credentials

-- Extend integration_credentials for NetSuite OAuth 2.0 client credentials
alter table public.integration_credentials
  add column if not exists client_id text,
  add column if not exists client_secret text;

-- Allow null access_token for providers that fetch on demand
alter table public.integration_credentials
  alter column access_token drop not null;

-- netsuite_accounts
create table if not exists public.netsuite_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  integration_connection_id uuid references public.integration_connections(id) on delete cascade,
  account_id text not null,
  account_name text,
  environment text not null default 'production' check (environment in ('production','sandbox')),
  rest_web_services_enabled boolean default false,
  oauth_config_valid boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, account_id)
);

create index if not exists idx_netsuite_accounts_org on public.netsuite_accounts(org_id);

-- netsuite_record_configs
create table if not exists public.netsuite_record_configs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  netsuite_account_id uuid not null references public.netsuite_accounts(id) on delete cascade,
  record_type text not null,
  enabled boolean not null default true,
  detection_enabled boolean not null default false,
  validation_enabled boolean not null default true,
  polling_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, netsuite_account_id, record_type)
);

create index if not exists idx_netsuite_record_configs_account on public.netsuite_record_configs(netsuite_account_id);

-- netsuite_validation_templates
create table if not exists public.netsuite_validation_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  domain text not null,
  system text,
  template_type text not null check (template_type in ('suiteql','rest_record_query','custom')),
  query_text text,
  parameters jsonb default '{}',
  expected_result_schema jsonb default '{}',
  threshold_config jsonb default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_netsuite_validation_templates_org on public.netsuite_validation_templates(org_id);

-- netsuite_validation_runs
create table if not exists public.netsuite_validation_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  change_id uuid references public.change_events(id) on delete set null,
  template_id uuid not null references public.netsuite_validation_templates(id) on delete cascade,
  netsuite_account_id uuid not null references public.netsuite_accounts(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','running','succeeded','failed','threshold_breached')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  input_parameters jsonb default '{}',
  result_summary jsonb default '{}',
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_netsuite_validation_runs_org on public.netsuite_validation_runs(org_id);
create index if not exists idx_netsuite_validation_runs_change on public.netsuite_validation_runs(change_id);
create index if not exists idx_netsuite_validation_runs_template on public.netsuite_validation_runs(template_id);

-- netsuite_detection_events
create table if not exists public.netsuite_detection_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  netsuite_account_id uuid not null references public.netsuite_accounts(id) on delete cascade,
  source_type text not null check (source_type in ('system_notes_poll','user_event_script','scheduled_script','manual')),
  record_type text not null,
  record_internal_id text,
  change_detected_at timestamptz not null default now(),
  detected_domain text,
  detected_fields jsonb default '[]',
  detected_by text,
  change_id uuid references public.change_events(id) on delete set null,
  risk_score int,
  status text not null default 'new' check (status in ('new','linked','ignored','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_netsuite_detection_events_org on public.netsuite_detection_events(org_id);

-- netsuite_reconciliation_results
create table if not exists public.netsuite_reconciliation_results (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  change_id uuid not null references public.change_events(id) on delete cascade,
  netsuite_account_id uuid not null references public.netsuite_accounts(id) on delete cascade,
  reconciliation_type text not null check (reconciliation_type in ('invoice_total','transaction_count','revenue_variance','custom')),
  baseline_window_start timestamptz,
  baseline_window_end timestamptz,
  comparison_window_start timestamptz,
  comparison_window_end timestamptz,
  expected_value numeric,
  actual_value numeric,
  variance_value numeric,
  variance_percent numeric,
  threshold_percent numeric,
  status text not null check (status in ('ok','warning','breach')),
  details jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_netsuite_reconciliation_results_org on public.netsuite_reconciliation_results(org_id);
create index if not exists idx_netsuite_reconciliation_results_change on public.netsuite_reconciliation_results(change_id);

-- updated_at triggers
drop trigger if exists trg_netsuite_accounts_updated_at on public.netsuite_accounts;
create trigger trg_netsuite_accounts_updated_at before update on public.netsuite_accounts
  for each row execute function set_updated_at();
drop trigger if exists trg_netsuite_record_configs_updated_at on public.netsuite_record_configs;
create trigger trg_netsuite_record_configs_updated_at before update on public.netsuite_record_configs
  for each row execute function set_updated_at();
drop trigger if exists trg_netsuite_validation_templates_updated_at on public.netsuite_validation_templates;
create trigger trg_netsuite_validation_templates_updated_at before update on public.netsuite_validation_templates
  for each row execute function set_updated_at();
drop trigger if exists trg_netsuite_validation_runs_updated_at on public.netsuite_validation_runs;
create trigger trg_netsuite_validation_runs_updated_at before update on public.netsuite_validation_runs
  for each row execute function set_updated_at();
drop trigger if exists trg_netsuite_detection_events_updated_at on public.netsuite_detection_events;
create trigger trg_netsuite_detection_events_updated_at before update on public.netsuite_detection_events
  for each row execute function set_updated_at();
drop trigger if exists trg_netsuite_reconciliation_results_updated_at on public.netsuite_reconciliation_results;
create trigger trg_netsuite_reconciliation_results_updated_at before update on public.netsuite_reconciliation_results
  for each row execute function set_updated_at();

-- RLS
alter table public.netsuite_accounts enable row level security;
alter table public.netsuite_record_configs enable row level security;
alter table public.netsuite_validation_templates enable row level security;
alter table public.netsuite_validation_runs enable row level security;
alter table public.netsuite_detection_events enable row level security;
alter table public.netsuite_reconciliation_results enable row level security;

-- org members read
create policy netsuite_accounts_read_org on public.netsuite_accounts
  for select using (exists (select 1 from public.organization_members m where m.org_id = netsuite_accounts.org_id and m.user_id = auth.uid()));
create policy netsuite_record_configs_read_org on public.netsuite_record_configs
  for select using (exists (select 1 from public.organization_members m where m.org_id = netsuite_record_configs.org_id and m.user_id = auth.uid()));
create policy netsuite_validation_templates_read_org on public.netsuite_validation_templates
  for select using (exists (select 1 from public.organization_members m where m.org_id = netsuite_validation_templates.org_id and m.user_id = auth.uid()));
create policy netsuite_validation_runs_read_org on public.netsuite_validation_runs
  for select using (exists (select 1 from public.organization_members m where m.org_id = netsuite_validation_runs.org_id and m.user_id = auth.uid()));
create policy netsuite_reconciliation_results_read_org on public.netsuite_reconciliation_results
  for select using (exists (select 1 from public.organization_members m where m.org_id = netsuite_reconciliation_results.org_id and m.user_id = auth.uid()));

-- service_role for writes (admin API uses createAdminClient)
create policy netsuite_accounts_service on public.netsuite_accounts
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy netsuite_record_configs_service on public.netsuite_record_configs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy netsuite_validation_templates_service on public.netsuite_validation_templates
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy netsuite_validation_runs_service on public.netsuite_validation_runs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy netsuite_detection_events_service on public.netsuite_detection_events
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy netsuite_reconciliation_results_service on public.netsuite_reconciliation_results
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
