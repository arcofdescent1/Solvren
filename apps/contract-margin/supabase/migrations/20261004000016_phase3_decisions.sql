create table public.quote_decisions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null,
  version integer not null check (version > 0),
  customer_name text not null check (length(btrim(customer_name)) between 2 and 200),
  owner_user_id uuid not null references auth.users(id),
  decision text not null check (decision in ('approve','revise','reject')),
  notes text not null check (length(btrim(notes)) between 5 and 4000),
  scenario_input jsonb not null,
  scenario_results jsonb not null,
  sample_snapshot jsonb not null,
  formula_version text not null,
  snapshot_hash text not null check (length(snapshot_hash) = 64),
  saved_by uuid not null references auth.users(id),
  saved_at timestamptz not null default now(),
  unique (org_id,quote_id,version)
);
create index quote_decisions_recent on public.quote_decisions(org_id,saved_at desc);

create function private.keep_quote_decision_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Saved quote decisions are immutable; save a new version';
end;
$$;
create trigger keep_quote_decision_immutable before update on public.quote_decisions
  for each row execute function private.keep_quote_decision_immutable();

create table public.margin_alert_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  floor_exposure_usd numeric(18,2) not null default 25 check (floor_exposure_usd >= 0),
  projected_exposure_usd numeric(18,2) not null default 50 check (projected_exposure_usd >= 0),
  daily_spike_pct numeric(6,2) not null default 50 check (daily_spike_pct between 0 and 1000),
  daily_spike_min_usd numeric(18,2) not null default 50 check (daily_spike_min_usd >= 0),
  reconciliation_gap_usd numeric(18,2) not null default 50 check (reconciliation_gap_usd >= 0),
  stale_hours integer not null default 24 check (stale_hours between 1 and 168),
  timezone text not null default 'UTC' check (length(timezone) between 1 and 80),
  quiet_start_hour integer not null default 20 check (quiet_start_hour between 0 and 23),
  quiet_end_hour integer not null default 8 check (quiet_end_hour between 0 and 23),
  digest_weekday integer not null default 1 check (digest_weekday between 0 and 6),
  digest_hour integer not null default 8 check (digest_hour between 0 and 23),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table public.margin_issues (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid,
  condition_key text not null check (length(condition_key) between 3 and 240),
  kind text not null check (kind in ('floor_breach','projected_breach','daily_spike','stale_data','reconciliation_gap')),
  status text not null default 'open' check (status in ('open','acknowledged','snoozed','resolved')),
  severity text not null check (severity in ('material','critical')),
  exposure_usd numeric(20,2) not null default 0,
  evidence jsonb not null,
  signal_active boolean not null default true,
  assignee_user_id uuid references auth.users(id),
  snoozed_until timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  occurrence_count integer not null default 1,
  unique (org_id,condition_key),
  foreign key (org_id,customer_id) references public.customers(org_id,id) on delete cascade
);
create index margin_issues_queue on public.margin_issues(org_id,status,last_seen_at desc);
create index margin_issues_assignee on public.margin_issues(org_id,assignee_user_id,status);

create table public.margin_issue_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  issue_id uuid not null references public.margin_issues(id) on delete cascade,
  event_type text not null check (event_type in ('detected','reopened','acknowledged','commented','assigned','snoozed','unsnoozed','resolved')),
  actor_user_id uuid references auth.users(id),
  note text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index margin_issue_events_history on public.margin_issue_events(issue_id,created_at,id);

create table public.margin_alert_deliveries (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  issue_id uuid not null references public.margin_issues(id) on delete cascade,
  event_id bigint not null references public.margin_issue_events(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id),
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','skipped')),
  due_at timestamptz not null default now(),
  lease_until timestamptz,
  attempts integer not null default 0,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  unique (event_id,recipient_user_id)
);
create index margin_alert_deliveries_pending on public.margin_alert_deliveries(status,due_at);

create table public.executive_digests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id),
  week_start date not null,
  snapshot jsonb not null,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','skipped')),
  due_at timestamptz not null default now(),
  lease_until timestamptz,
  attempts integer not null default 0,
  provider_message_id text,
  last_error text,
  sent_at timestamptz,
  unique (org_id,recipient_user_id,week_start)
);
create index executive_digests_pending on public.executive_digests(status,due_at);

alter table public.quote_decisions enable row level security;
alter table public.margin_alert_settings enable row level security;
alter table public.margin_issues enable row level security;
alter table public.margin_issue_events enable row level security;
alter table public.margin_alert_deliveries enable row level security;
alter table public.executive_digests enable row level security;

create policy quote_decisions_read on public.quote_decisions for select to authenticated
  using (private.can_read_org(org_id));
create policy margin_alert_settings_read on public.margin_alert_settings for select to authenticated
  using (private.can_read_org(org_id));
create policy margin_issues_read on public.margin_issues for select to authenticated
  using (private.can_read_org(org_id));
create policy margin_issue_events_read on public.margin_issue_events for select to authenticated
  using (private.can_read_org(org_id));
create policy margin_alert_deliveries_read on public.margin_alert_deliveries for select to authenticated
  using (private.can_read_org(org_id));
create policy executive_digests_read on public.executive_digests for select to authenticated
  using (private.can_read_org(org_id));

revoke all on public.quote_decisions,public.margin_alert_settings,public.margin_issues,
  public.margin_issue_events,public.margin_alert_deliveries,public.executive_digests from anon;
grant select on public.quote_decisions,public.margin_alert_settings,public.margin_issues,
  public.margin_issue_events,public.margin_alert_deliveries,public.executive_digests to authenticated;
grant select,insert,update,delete on public.quote_decisions,public.margin_alert_settings,
  public.margin_issues,public.margin_issue_events,public.margin_alert_deliveries,
  public.executive_digests to service_role;
grant usage,select on sequence public.margin_issue_events_id_seq,
  public.margin_alert_deliveries_id_seq to service_role;
