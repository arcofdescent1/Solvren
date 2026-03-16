-- Salesforce Integration (IES v1.0)
-- Uses integration_connections (provider='salesforce'), integration_credentials

-- Extend integration_credentials for Salesforce OAuth (JWT / client credentials)
alter table public.integration_credentials
  add column if not exists jwt_key_ref text,
  add column if not exists jwt_private_key_base64 text,
  add column if not exists salesforce_username text;

-- salesforce_orgs
create table if not exists public.salesforce_orgs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  integration_connection_id uuid references public.integration_connections(id) on delete cascade,
  sf_org_id text not null,
  instance_url text not null,
  login_url text not null,
  environment text not null default 'production' check (environment in ('production','sandbox')),
  connected_app_name text,
  auth_mode text not null default 'client_credentials' check (auth_mode in ('jwt_bearer','client_credentials','web_server')),
  cdc_enabled boolean not null default false,
  pubsub_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, sf_org_id)
);

create index if not exists idx_salesforce_orgs_org on public.salesforce_orgs(org_id);

-- salesforce_object_configs
create table if not exists public.salesforce_object_configs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  salesforce_org_id uuid not null references public.salesforce_orgs(id) on delete cascade,
  object_api_name text not null,
  enabled boolean not null default true,
  cdc_enabled boolean not null default false,
  polling_enabled boolean not null default false,
  validation_enabled boolean not null default true,
  sensitive boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, salesforce_org_id, object_api_name)
);

create index if not exists idx_salesforce_object_configs_sf_org on public.salesforce_object_configs(salesforce_org_id);

-- salesforce_field_rules
create table if not exists public.salesforce_field_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  salesforce_object_config_id uuid not null references public.salesforce_object_configs(id) on delete cascade,
  field_api_name text not null,
  rule_type text not null check (rule_type in ('risk_signal','domain_map','ignore')),
  domain text,
  risk_weight int,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_salesforce_field_rules_object_config on public.salesforce_field_rules(salesforce_object_config_id);

-- salesforce_record_links
create table if not exists public.salesforce_record_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  change_id uuid not null references public.change_events(id) on delete cascade,
  salesforce_org_id uuid not null references public.salesforce_orgs(id) on delete cascade,
  object_api_name text not null,
  record_id text not null,
  record_name text,
  link_type text not null check (link_type in ('source','affected_record','detected_change','manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, change_id, object_api_name, record_id)
);

create index if not exists idx_salesforce_record_links_org on public.salesforce_record_links(org_id);
create index if not exists idx_salesforce_record_links_change on public.salesforce_record_links(change_id);

-- salesforce_cdc_events
create table if not exists public.salesforce_cdc_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  salesforce_org_id uuid not null references public.salesforce_orgs(id) on delete cascade,
  replay_id text not null,
  channel_name text not null,
  object_api_name text not null,
  record_ids jsonb default '[]',
  change_type text,
  commit_user text,
  commit_timestamp timestamptz,
  payload jsonb default '{}',
  processed boolean not null default false,
  processed_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  unique (org_id, replay_id, channel_name)
);

create index if not exists idx_salesforce_cdc_events_org on public.salesforce_cdc_events(org_id);
create index if not exists idx_salesforce_cdc_events_processed on public.salesforce_cdc_events(processed) where not processed;

-- salesforce_detection_events
create table if not exists public.salesforce_detection_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  salesforce_org_id uuid not null references public.salesforce_orgs(id) on delete cascade,
  source_type text not null check (source_type in ('cdc','polling','manual')),
  object_api_name text not null,
  record_id text not null,
  detected_domain text,
  detected_fields jsonb default '[]',
  risk_score int,
  change_id uuid references public.change_events(id) on delete set null,
  status text not null default 'new' check (status in ('new','linked','ignored','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_salesforce_detection_events_org on public.salesforce_detection_events(org_id);
create index if not exists idx_salesforce_detection_events_change on public.salesforce_detection_events(change_id);

-- salesforce_validation_templates
create table if not exists public.salesforce_validation_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  domain text not null,
  template_type text not null check (template_type in ('soql','rest_query','composite','custom')),
  query_text text,
  parameters jsonb default '{}',
  expected_result_schema jsonb default '{}',
  threshold_config jsonb default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_salesforce_validation_templates_org on public.salesforce_validation_templates(org_id);

-- salesforce_validation_runs
create table if not exists public.salesforce_validation_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  change_id uuid references public.change_events(id) on delete set null,
  template_id uuid not null references public.salesforce_validation_templates(id) on delete cascade,
  salesforce_org_id uuid not null references public.salesforce_orgs(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','running','succeeded','failed','threshold_breached')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  input_parameters jsonb default '{}',
  result_summary jsonb default '{}',
  raw_result_ref text,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_salesforce_validation_runs_org on public.salesforce_validation_runs(org_id);
create index if not exists idx_salesforce_validation_runs_change on public.salesforce_validation_runs(change_id);
create index if not exists idx_salesforce_validation_runs_template on public.salesforce_validation_runs(template_id);

-- updated_at triggers
drop trigger if exists trg_salesforce_orgs_updated_at on public.salesforce_orgs;
create trigger trg_salesforce_orgs_updated_at before update on public.salesforce_orgs
  for each row execute function set_updated_at();
drop trigger if exists trg_salesforce_object_configs_updated_at on public.salesforce_object_configs;
create trigger trg_salesforce_object_configs_updated_at before update on public.salesforce_object_configs
  for each row execute function set_updated_at();
drop trigger if exists trg_salesforce_field_rules_updated_at on public.salesforce_field_rules;
create trigger trg_salesforce_field_rules_updated_at before update on public.salesforce_field_rules
  for each row execute function set_updated_at();
drop trigger if exists trg_salesforce_record_links_updated_at on public.salesforce_record_links;
create trigger trg_salesforce_record_links_updated_at before update on public.salesforce_record_links
  for each row execute function set_updated_at();
drop trigger if exists trg_salesforce_detection_events_updated_at on public.salesforce_detection_events;
create trigger trg_salesforce_detection_events_updated_at before update on public.salesforce_detection_events
  for each row execute function set_updated_at();
drop trigger if exists trg_salesforce_validation_templates_updated_at on public.salesforce_validation_templates;
create trigger trg_salesforce_validation_templates_updated_at before update on public.salesforce_validation_templates
  for each row execute function set_updated_at();
drop trigger if exists trg_salesforce_validation_runs_updated_at on public.salesforce_validation_runs;
create trigger trg_salesforce_validation_runs_updated_at before update on public.salesforce_validation_runs
  for each row execute function set_updated_at();

-- RLS
alter table public.salesforce_orgs enable row level security;
alter table public.salesforce_object_configs enable row level security;
alter table public.salesforce_field_rules enable row level security;
alter table public.salesforce_record_links enable row level security;
alter table public.salesforce_cdc_events enable row level security;
alter table public.salesforce_detection_events enable row level security;
alter table public.salesforce_validation_templates enable row level security;
alter table public.salesforce_validation_runs enable row level security;

-- org members read
create policy salesforce_orgs_read_org on public.salesforce_orgs
  for select using (exists (select 1 from public.organization_members m where m.org_id = salesforce_orgs.org_id and m.user_id = auth.uid()));
create policy salesforce_object_configs_read_org on public.salesforce_object_configs
  for select using (exists (select 1 from public.organization_members m where m.org_id = salesforce_object_configs.org_id and m.user_id = auth.uid()));
create policy salesforce_field_rules_read_org on public.salesforce_field_rules
  for select using (exists (select 1 from public.organization_members m where m.org_id = salesforce_field_rules.org_id and m.user_id = auth.uid()));
create policy salesforce_record_links_read_org on public.salesforce_record_links
  for select using (exists (select 1 from public.organization_members m where m.org_id = salesforce_record_links.org_id and m.user_id = auth.uid()));
create policy salesforce_cdc_events_read_org on public.salesforce_cdc_events
  for select using (exists (select 1 from public.organization_members m where m.org_id = salesforce_cdc_events.org_id and m.user_id = auth.uid()));
create policy salesforce_detection_events_read_org on public.salesforce_detection_events
  for select using (exists (select 1 from public.organization_members m where m.org_id = salesforce_detection_events.org_id and m.user_id = auth.uid()));
create policy salesforce_validation_templates_read_org on public.salesforce_validation_templates
  for select using (exists (select 1 from public.organization_members m where m.org_id = salesforce_validation_templates.org_id and m.user_id = auth.uid()));
create policy salesforce_validation_runs_read_org on public.salesforce_validation_runs
  for select using (exists (select 1 from public.organization_members m where m.org_id = salesforce_validation_runs.org_id and m.user_id = auth.uid()));

-- service_role for writes
create policy salesforce_orgs_service on public.salesforce_orgs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy salesforce_object_configs_service on public.salesforce_object_configs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy salesforce_field_rules_service on public.salesforce_field_rules
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy salesforce_record_links_service on public.salesforce_record_links
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy salesforce_cdc_events_service on public.salesforce_cdc_events
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy salesforce_detection_events_service on public.salesforce_detection_events
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy salesforce_validation_templates_service on public.salesforce_validation_templates
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy salesforce_validation_runs_service on public.salesforce_validation_runs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
