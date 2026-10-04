select pgmq.create('solvren_connectors');

create table public.provider_connections (
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('openai','anthropic','stripe')),
  connected_at timestamptz not null default now(),
  connected_by uuid not null references auth.users(id),
  disconnected_at timestamptz,
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  synced_through date,
  source_scope text not null default 'organization',
  primary key (org_id, provider)
);

create table public.provider_cost_buckets (
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('openai','anthropic')),
  day date not null,
  scope_id text not null default '',
  line_item text not null default '',
  amount_usd numeric(20,8) not null,
  collected_at timestamptz not null default now(),
  primary key (org_id, provider, day, scope_id, line_item)
);
create index provider_cost_period on public.provider_cost_buckets(org_id, day, provider);

create table public.provider_cost_days (
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('openai','anthropic')),
  day date not null,
  synced_at timestamptz not null default now(),
  primary key (org_id,provider,day)
);

create table public.connector_jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('openai','anthropic','stripe')),
  day date,
  status text not null default 'queued' check (status in ('queued','running','completed','failed')),
  attempts integer not null default 0,
  last_error text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  requested_by uuid references auth.users(id),
  stage text not null default 'customers',
  cursor text,
  rows_seen bigint not null default 0,
  check ((provider = 'stripe' and day is null) or (provider <> 'stripe' and day is not null))
);
create unique index connector_day_job on public.connector_jobs(org_id,provider,day) nulls not distinct;
create index connector_queue_status on public.connector_jobs(status,requested_at);

create table public.stripe_customers (
  org_id uuid not null references public.organizations(id) on delete cascade,
  stripe_customer_id text not null,
  display_name text,
  email text,
  updated_at timestamptz not null default now(),
  last_seen_job uuid references public.connector_jobs(id) on delete set null,
  primary key (org_id,stripe_customer_id)
);
create table public.stripe_subscriptions (
  org_id uuid not null references public.organizations(id) on delete cascade,
  stripe_subscription_id text not null,
  stripe_customer_id text not null,
  status text not null,
  currency text not null,
  interval text,
  interval_count integer,
  gross_recurring_usd numeric(20,2),
  discount_note text,
  latest_invoice_id text,
  updated_at timestamptz not null default now(),
  last_seen_job uuid references public.connector_jobs(id) on delete set null,
  primary key (org_id,stripe_subscription_id),
  foreign key (org_id,stripe_customer_id) references public.stripe_customers(org_id,stripe_customer_id) on delete cascade
);
create table public.stripe_invoices (
  org_id uuid not null references public.organizations(id) on delete cascade,
  stripe_invoice_id text not null,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  currency text not null,
  status text not null,
  subtotal_usd numeric(20,2),
  discount_usd numeric(20,2),
  credit_usd numeric(20,2),
  total_usd numeric(20,2),
  period_start timestamptz,
  period_end timestamptz,
  updated_at timestamptz not null default now(),
  last_seen_job uuid references public.connector_jobs(id) on delete set null,
  primary key (org_id,stripe_invoice_id),
  foreign key (org_id,stripe_customer_id) references public.stripe_customers(org_id,stripe_customer_id) on delete cascade
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('margin-reports','margin-reports',false,10485760,array['application/pdf','text/csv'])
on conflict (id) do nothing;

create table public.report_snapshots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  version integer not null,
  period_start date not null,
  period_end date not null,
  status text not null default 'preparing' check (status in ('preparing','frozen','failed')),
  confidence text not null,
  formula_version text not null default '2026-10-v2',
  snapshot jsonb not null,
  snapshot_hash text not null,
  csv_path text,
  pdf_path text,
  created_at timestamptz not null default now(),
  frozen_at timestamptz,
  created_by uuid not null references auth.users(id),
  unique (org_id,period_start,period_end,version),
  check (period_end > period_start and period_end <= period_start + 62),
  check (status <> 'frozen' or (csv_path is not null and pdf_path is not null and frozen_at is not null))
);
create index snapshots_recent on public.report_snapshots(org_id,created_at desc);

alter table public.organizations add column deletion_requested_at timestamptz,
  add column purge_after timestamptz;

alter table public.provider_connections enable row level security;
alter table public.provider_cost_buckets enable row level security;
alter table public.provider_cost_days enable row level security;
alter table public.connector_jobs enable row level security;
alter table public.stripe_customers enable row level security;
alter table public.stripe_subscriptions enable row level security;
alter table public.stripe_invoices enable row level security;
alter table public.report_snapshots enable row level security;

create policy provider_connections_read on public.provider_connections for select to authenticated
  using (private.can_read_org(org_id));
create policy provider_cost_read on public.provider_cost_buckets for select to authenticated
  using (private.can_read_org(org_id));
create policy provider_cost_days_read on public.provider_cost_days for select to authenticated
  using (private.can_read_org(org_id));
create policy connector_jobs_read on public.connector_jobs for select to authenticated
  using (private.can_read_org(org_id));
create policy stripe_customers_read on public.stripe_customers for select to authenticated
  using (private.can_read_org(org_id));
create policy stripe_subscriptions_read on public.stripe_subscriptions for select to authenticated
  using (private.can_read_org(org_id));
create policy stripe_invoices_read on public.stripe_invoices for select to authenticated
  using (private.can_read_org(org_id));
create policy report_snapshots_read on public.report_snapshots for select to authenticated
  using (private.can_read_org(org_id));

revoke all on public.provider_connections, public.provider_cost_buckets, public.provider_cost_days, public.connector_jobs,
  public.stripe_customers, public.stripe_subscriptions, public.stripe_invoices,
  public.report_snapshots from anon;
grant select on public.provider_connections, public.provider_cost_buckets, public.provider_cost_days, public.connector_jobs,
  public.stripe_customers, public.stripe_subscriptions, public.stripe_invoices,
  public.report_snapshots to authenticated;
grant select,insert,update,delete on public.provider_connections, public.provider_cost_buckets, public.provider_cost_days,
  public.connector_jobs, public.stripe_customers, public.stripe_subscriptions,
  public.stripe_invoices, public.report_snapshots to service_role;
