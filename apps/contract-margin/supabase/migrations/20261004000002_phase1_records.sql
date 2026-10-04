create extension if not exists btree_gist with schema extensions;
create extension if not exists pgmq;
select pgmq.create('solvren_imports');

alter table public.organizations add column target_margin_pct numeric(5,2) not null default 30
  check (target_margin_pct between 0 and 100);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  external_id text not null check (length(external_id) between 1 and 200),
  name text not null check (length(btrim(name)) between 1 and 200),
  owner_user_id uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (org_id, id), unique (org_id, external_id)
);

create table public.customer_mappings (
  org_id uuid not null references public.organizations(id) on delete cascade,
  source text not null check (length(source) between 1 and 80),
  source_customer_id text not null check (length(source_customer_id) between 1 and 200),
  customer_id uuid not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users(id),
  primary key (org_id, source, source_customer_id),
  foreign key (org_id, customer_id) references public.customers(org_id, id) on delete cascade
);

create table public.contract_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null,
  version integer not null check (version > 0),
  effective_from date not null,
  effective_to date,
  billing_period text not null check (billing_period in ('monthly', 'annual')),
  base_fee_usd numeric(18,2) not null check (base_fee_usd >= 0),
  included_outcomes integer not null default 0 check (included_outcomes >= 0),
  overage_usd numeric(18,6) not null default 0 check (overage_usd >= 0),
  discount_pct numeric(5,2) not null default 0 check (discount_pct between 0 and 100),
  target_margin_pct numeric(5,2) check (target_margin_pct between 0 and 100),
  renewal_on date,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  check (effective_to is null or effective_to > effective_from),
  unique (org_id, id), unique (org_id, customer_id, version),
  foreign key (org_id, customer_id) references public.customers(org_id, id) on delete cascade,
  exclude using gist (
    org_id with =, customer_id with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[)') with &&
  )
);
create index contracts_by_period on public.contract_versions(org_id, effective_from, effective_to);

create table public.model_rates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('openai', 'anthropic')),
  model text not null check (length(model) between 1 and 200),
  effective_from date not null,
  input_per_million_usd numeric(18,8) not null check (input_per_million_usd >= 0),
  output_per_million_usd numeric(18,8) not null check (output_per_million_usd >= 0),
  cache_read_per_million_usd numeric(18,8) not null default 0 check (cache_read_per_million_usd >= 0),
  cache_write_per_million_usd numeric(18,8) not null default 0 check (cache_write_per_million_usd >= 0),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  unique (org_id, provider, model, effective_from)
);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('usage', 'outcomes', 'direct_costs', 'langfuse')),
  source text not null check (length(source) between 1 and 80),
  file_name text check (length(file_name) <= 200),
  status text not null default 'preparing' check (status in ('preparing', 'queued', 'running', 'completed', 'failed')),
  total_rows integer not null default 0 check (total_rows >= 0),
  rejected_rows integer not null default 0 check (rejected_rows >= 0),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
  chunks_total integer not null default 0 check (chunks_total >= 0),
  chunks_done integer not null default 0 check (chunks_done >= 0),
  error_message text,
  configuration jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index import_jobs_recent on public.import_jobs(org_id, created_at desc);

create table public.import_rejections (
  job_id uuid not null references public.import_jobs(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  reason text not null check (length(reason) between 1 and 500),
  primary key (job_id, row_number)
);

create table public.usage_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  source text not null check (length(source) between 1 and 80),
  source_event_id text not null check (length(source_event_id) between 1 and 200),
  source_customer_id text not null check (length(source_customer_id) between 1 and 200),
  workflow_id text not null check (length(workflow_id) between 1 and 200),
  run_id text not null check (length(run_id) between 1 and 200),
  occurred_at timestamptz not null,
  provider text not null check (provider in ('openai', 'anthropic')),
  billing_route text not null check (billing_route in ('openai_direct', 'anthropic_direct', 'gateway_or_cloud', 'other')),
  model text not null check (length(model) between 1 and 200),
  input_tokens bigint not null default 0 check (input_tokens >= 0),
  output_tokens bigint not null default 0 check (output_tokens >= 0),
  cache_read_tokens bigint not null default 0 check (cache_read_tokens >= 0),
  cache_write_tokens bigint not null default 0 check (cache_write_tokens >= 0),
  reasoning_output_tokens bigint not null default 0 check (reasoning_output_tokens >= 0),
  measured_cost_usd numeric(20,8) check (measured_cost_usd >= 0),
  status text not null check (status in ('succeeded', 'failed')),
  imported_at timestamptz not null default now(),
  import_job_id uuid references public.import_jobs(id),
  unique (org_id, source, source_event_id),
  check ((billing_route = 'openai_direct' and provider = 'openai')
      or (billing_route = 'anthropic_direct' and provider = 'anthropic')
      or billing_route in ('gateway_or_cloud', 'other'))
);
create index usage_period on public.usage_events(org_id, occurred_at, source_customer_id);
create index usage_run on public.usage_events(org_id, source, run_id);

create table public.outcome_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  source text not null check (length(source) between 1 and 80),
  source_event_id text not null check (length(source_event_id) between 1 and 200),
  source_customer_id text not null check (length(source_customer_id) between 1 and 200),
  workflow_id text not null check (length(workflow_id) between 1 and 200),
  run_id text not null check (length(run_id) between 1 and 200),
  occurred_at timestamptz not null,
  status text not null check (status in ('completed', 'failed', 'cancelled')),
  imported_at timestamptz not null default now(),
  import_job_id uuid references public.import_jobs(id),
  unique (org_id, source, source_event_id)
);
create index outcome_period on public.outcome_events(org_id, occurred_at, source_customer_id);
create index outcome_run on public.outcome_events(org_id, source, run_id, occurred_at desc);

create table public.direct_cost_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  source text not null check (length(source) between 1 and 80),
  source_event_id text not null check (length(source_event_id) between 1 and 200),
  source_customer_id text not null check (length(source_customer_id) between 1 and 200),
  workflow_id text not null check (length(workflow_id) between 1 and 200),
  run_id text not null check (length(run_id) between 1 and 200),
  occurred_at timestamptz not null,
  category text not null check (category in ('tool', 'human_review', 'other')),
  cost_usd numeric(20,8) not null check (cost_usd >= 0),
  imported_at timestamptz not null default now(),
  import_job_id uuid references public.import_jobs(id),
  unique (org_id, source, source_event_id)
);
create index direct_cost_period on public.direct_cost_events(org_id, occurred_at, source_customer_id);

create table public.provider_statements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('openai', 'anthropic')),
  period_start date not null,
  period_end date not null,
  total_usd numeric(20,8) not null check (total_usd >= 0),
  source_file text not null check (length(source_file) between 1 and 200),
  imported_at timestamptz not null default now(),
  imported_by uuid not null references auth.users(id),
  check (period_end > period_start),
  exclude using gist (org_id with =, provider with =, daterange(period_start, period_end, '[)') with &&)
);

create table public.ingestion_keys (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 80),
  token_prefix text not null,
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  last_used_at timestamptz,
  revoked_at timestamptz
);
create table private.ingest_rate_windows (
  key_id uuid not null references public.ingestion_keys(id) on delete cascade,
  window_start timestamptz not null,
  requests integer not null default 0,
  primary key (key_id, window_start)
);

create function private.can_edit_finance(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_verified_work_account() and auth.jwt()->>'aal' = 'aal2'
    and private.member_role_for(p_org) in ('owner', 'finance');
$$;
create function private.can_edit_engineering(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_verified_work_account() and auth.jwt()->>'aal' = 'aal2'
    and private.member_role_for(p_org) in ('owner', 'engineer');
$$;
create function private.can_edit_mapping(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.can_edit_finance(p_org) or private.can_edit_engineering(p_org);
$$;

alter table public.customers enable row level security;
alter table public.customer_mappings enable row level security;
alter table public.contract_versions enable row level security;
alter table public.model_rates enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_rejections enable row level security;
alter table public.usage_events enable row level security;
alter table public.outcome_events enable row level security;
alter table public.direct_cost_events enable row level security;
alter table public.provider_statements enable row level security;
alter table public.ingestion_keys enable row level security;
alter table private.ingest_rate_windows enable row level security;

create policy customers_read on public.customers for select to authenticated using (private.can_read_org(org_id));
create policy mappings_read on public.customer_mappings for select to authenticated using (private.can_read_org(org_id));
create policy contracts_read on public.contract_versions for select to authenticated using (private.can_read_org(org_id));
create policy rates_read on public.model_rates for select to authenticated using (private.can_read_org(org_id));
create policy jobs_read on public.import_jobs for select to authenticated using (private.can_read_org(org_id));
create policy rejections_read on public.import_rejections for select to authenticated
  using (exists (select 1 from public.import_jobs j where j.id = job_id and private.can_read_org(j.org_id)));
create policy usage_read on public.usage_events for select to authenticated using (private.can_read_org(org_id));
create policy outcomes_read on public.outcome_events for select to authenticated using (private.can_read_org(org_id));
create policy direct_cost_read on public.direct_cost_events for select to authenticated using (private.can_read_org(org_id));
create policy statements_read on public.provider_statements for select to authenticated using (private.can_read_org(org_id));
create policy keys_read on public.ingestion_keys for select to authenticated using (private.can_edit_engineering(org_id));

revoke all on public.customers, public.customer_mappings, public.contract_versions,
  public.model_rates, public.import_jobs, public.import_rejections, public.usage_events,
  public.outcome_events, public.direct_cost_events, public.provider_statements,
  public.ingestion_keys from anon;
grant select on public.customers, public.customer_mappings, public.contract_versions,
  public.model_rates, public.import_jobs, public.import_rejections, public.usage_events,
  public.outcome_events, public.direct_cost_events, public.provider_statements,
  public.ingestion_keys to authenticated;
grant select, insert, update, delete on public.customers, public.customer_mappings,
  public.contract_versions, public.model_rates, public.import_jobs,
  public.import_rejections, public.usage_events, public.outcome_events,
  public.direct_cost_events, public.provider_statements, public.ingestion_keys to service_role;
grant usage, select on all sequences in schema public to service_role;
revoke all on private.ingest_rate_windows from public, anon, authenticated;
grant select, insert, update, delete on private.ingest_rate_windows to service_role;
revoke all on function private.can_edit_finance(uuid), private.can_edit_engineering(uuid), private.can_edit_mapping(uuid) from public;
grant execute on function private.can_edit_finance(uuid), private.can_edit_engineering(uuid),
  private.can_edit_mapping(uuid) to authenticated;
