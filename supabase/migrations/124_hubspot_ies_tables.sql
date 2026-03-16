-- HubSpot Integration (IES v1.0)
-- Uses integration_connections (provider='hubspot'), integration_credentials

-- Extend integration_credentials for HubSpot private-app token
alter table public.integration_credentials
  add column if not exists private_app_token text;

-- hubspot_accounts
create table if not exists public.hubspot_accounts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  integration_connection_id uuid references public.integration_connections(id) on delete cascade,
  hub_id bigint not null,
  portal_name text,
  auth_mode text not null check (auth_mode in ('oauth_public_app','private_app')),
  connected_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, hub_id)
);

create index if not exists idx_hubspot_accounts_org on public.hubspot_accounts(org_id);

-- hubspot_object_configs
create table if not exists public.hubspot_object_configs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  hubspot_account_id uuid not null references public.hubspot_accounts(id) on delete cascade,
  object_type text not null,
  enabled boolean not null default true,
  webhook_enabled boolean not null default false,
  validation_enabled boolean not null default true,
  sensitive boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, hubspot_account_id, object_type)
);

create index if not exists idx_hubspot_object_configs_account on public.hubspot_object_configs(hubspot_account_id);

-- hubspot_property_rules
create table if not exists public.hubspot_property_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  hubspot_object_config_id uuid not null references public.hubspot_object_configs(id) on delete cascade,
  property_name text not null,
  rule_type text not null check (rule_type in ('risk_signal','domain_map','ignore')),
  domain text,
  risk_weight int,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hubspot_property_rules_object_config on public.hubspot_property_rules(hubspot_object_config_id);

-- hubspot_record_links
create table if not exists public.hubspot_record_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  change_id uuid not null references public.change_events(id) on delete cascade,
  hubspot_account_id uuid not null references public.hubspot_accounts(id) on delete cascade,
  object_type text not null,
  record_id text not null,
  record_name text,
  link_type text not null check (link_type in ('source','affected_record','detected_change','manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, change_id, object_type, record_id)
);

create index if not exists idx_hubspot_record_links_org on public.hubspot_record_links(org_id);
create index if not exists idx_hubspot_record_links_change on public.hubspot_record_links(change_id);

-- hubspot_webhook_events
create table if not exists public.hubspot_webhook_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  hubspot_account_id uuid not null references public.hubspot_accounts(id) on delete cascade,
  event_id text,
  subscription_type text not null,
  object_type text,
  object_id text,
  property_name text,
  change_source text,
  payload jsonb default '{}',
  received_at timestamptz not null default now(),
  processed boolean not null default false,
  processed_at timestamptz,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_hubspot_webhook_events_org on public.hubspot_webhook_events(org_id);
create index if not exists idx_hubspot_webhook_events_processed on public.hubspot_webhook_events(processed) where not processed;

-- hubspot_detection_events
create table if not exists public.hubspot_detection_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  hubspot_account_id uuid not null references public.hubspot_accounts(id) on delete cascade,
  source_type text not null check (source_type in ('webhook','polling','workflow_action','manual')),
  object_type text not null,
  record_id text not null,
  detected_domain text,
  detected_properties jsonb default '[]',
  risk_score int,
  change_id uuid references public.change_events(id) on delete set null,
  status text not null default 'new' check (status in ('new','linked','ignored','resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hubspot_detection_events_org on public.hubspot_detection_events(org_id);
create index if not exists idx_hubspot_detection_events_change on public.hubspot_detection_events(change_id);

-- hubspot_validation_templates
create table if not exists public.hubspot_validation_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  domain text not null,
  template_type text not null check (template_type in ('crm_batch_read','crm_search','custom')),
  query_text text,
  parameters jsonb default '{}',
  expected_result_schema jsonb default '{}',
  threshold_config jsonb default '{}',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_hubspot_validation_templates_org on public.hubspot_validation_templates(org_id);

-- hubspot_validation_runs
create table if not exists public.hubspot_validation_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  change_id uuid references public.change_events(id) on delete set null,
  template_id uuid not null references public.hubspot_validation_templates(id) on delete cascade,
  hubspot_account_id uuid not null references public.hubspot_accounts(id) on delete cascade,
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

create index if not exists idx_hubspot_validation_runs_org on public.hubspot_validation_runs(org_id);
create index if not exists idx_hubspot_validation_runs_change on public.hubspot_validation_runs(change_id);
create index if not exists idx_hubspot_validation_runs_template on public.hubspot_validation_runs(template_id);

-- hubspot_workflow_action_logs
create table if not exists public.hubspot_workflow_action_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  hubspot_account_id uuid not null references public.hubspot_accounts(id) on delete cascade,
  action_name text not null,
  object_type text,
  object_id text,
  request_payload jsonb default '{}',
  response_payload jsonb default '{}',
  status text not null check (status in ('succeeded','failed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_hubspot_workflow_action_logs_org on public.hubspot_workflow_action_logs(org_id);

-- updated_at triggers
drop trigger if exists trg_hubspot_accounts_updated_at on public.hubspot_accounts;
create trigger trg_hubspot_accounts_updated_at before update on public.hubspot_accounts
  for each row execute function set_updated_at();
drop trigger if exists trg_hubspot_object_configs_updated_at on public.hubspot_object_configs;
create trigger trg_hubspot_object_configs_updated_at before update on public.hubspot_object_configs
  for each row execute function set_updated_at();
drop trigger if exists trg_hubspot_property_rules_updated_at on public.hubspot_property_rules;
create trigger trg_hubspot_property_rules_updated_at before update on public.hubspot_property_rules
  for each row execute function set_updated_at();
drop trigger if exists trg_hubspot_record_links_updated_at on public.hubspot_record_links;
create trigger trg_hubspot_record_links_updated_at before update on public.hubspot_record_links
  for each row execute function set_updated_at();
drop trigger if exists trg_hubspot_detection_events_updated_at on public.hubspot_detection_events;
create trigger trg_hubspot_detection_events_updated_at before update on public.hubspot_detection_events
  for each row execute function set_updated_at();
drop trigger if exists trg_hubspot_validation_templates_updated_at on public.hubspot_validation_templates;
create trigger trg_hubspot_validation_templates_updated_at before update on public.hubspot_validation_templates
  for each row execute function set_updated_at();
drop trigger if exists trg_hubspot_validation_runs_updated_at on public.hubspot_validation_runs;
create trigger trg_hubspot_validation_runs_updated_at before update on public.hubspot_validation_runs
  for each row execute function set_updated_at();

-- RLS
alter table public.hubspot_accounts enable row level security;
alter table public.hubspot_object_configs enable row level security;
alter table public.hubspot_property_rules enable row level security;
alter table public.hubspot_record_links enable row level security;
alter table public.hubspot_webhook_events enable row level security;
alter table public.hubspot_detection_events enable row level security;
alter table public.hubspot_validation_templates enable row level security;
alter table public.hubspot_validation_runs enable row level security;
alter table public.hubspot_workflow_action_logs enable row level security;

-- org members read
create policy hubspot_accounts_read_org on public.hubspot_accounts
  for select using (exists (select 1 from public.organization_members m where m.org_id = hubspot_accounts.org_id and m.user_id = auth.uid()));
create policy hubspot_object_configs_read_org on public.hubspot_object_configs
  for select using (exists (select 1 from public.organization_members m where m.org_id = hubspot_object_configs.org_id and m.user_id = auth.uid()));
create policy hubspot_property_rules_read_org on public.hubspot_property_rules
  for select using (exists (select 1 from public.organization_members m where m.org_id = hubspot_property_rules.org_id and m.user_id = auth.uid()));
create policy hubspot_record_links_read_org on public.hubspot_record_links
  for select using (exists (select 1 from public.organization_members m where m.org_id = hubspot_record_links.org_id and m.user_id = auth.uid()));
create policy hubspot_webhook_events_read_org on public.hubspot_webhook_events
  for select using (exists (select 1 from public.organization_members m where m.org_id = hubspot_webhook_events.org_id and m.user_id = auth.uid()));
create policy hubspot_detection_events_read_org on public.hubspot_detection_events
  for select using (exists (select 1 from public.organization_members m where m.org_id = hubspot_detection_events.org_id and m.user_id = auth.uid()));
create policy hubspot_validation_templates_read_org on public.hubspot_validation_templates
  for select using (exists (select 1 from public.organization_members m where m.org_id = hubspot_validation_templates.org_id and m.user_id = auth.uid()));
create policy hubspot_validation_runs_read_org on public.hubspot_validation_runs
  for select using (exists (select 1 from public.organization_members m where m.org_id = hubspot_validation_runs.org_id and m.user_id = auth.uid()));
create policy hubspot_workflow_action_logs_read_org on public.hubspot_workflow_action_logs
  for select using (exists (select 1 from public.organization_members m where m.org_id = hubspot_workflow_action_logs.org_id and m.user_id = auth.uid()));

-- service_role for writes
create policy hubspot_accounts_service on public.hubspot_accounts
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy hubspot_object_configs_service on public.hubspot_object_configs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy hubspot_property_rules_service on public.hubspot_property_rules
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy hubspot_record_links_service on public.hubspot_record_links
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy hubspot_webhook_events_service on public.hubspot_webhook_events
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy hubspot_detection_events_service on public.hubspot_detection_events
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy hubspot_validation_templates_service on public.hubspot_validation_templates
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy hubspot_validation_runs_service on public.hubspot_validation_runs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy hubspot_workflow_action_logs_service on public.hubspot_workflow_action_logs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
