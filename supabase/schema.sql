-- Solvren Schema
-- Run in Supabase Dashboard → SQL Editor → New query

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- Phase 1 enums (extend later without breaking)
do $$ begin
  create type change_type as enum (
    'PRICING',
    'BILLING',
    'CRM_SCHEMA',
    'REVENUE_INTEGRATION',
    'CONTRACT',
    'MARKETING_AUTOMATION',
    'OTHER'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type change_status as enum (
    'DRAFT',
    'READY',
    'SUBMITTED',
    'IN_REVIEW',
    'APPROVED',
    'REJECTED',
    'CLOSED',
    'RESOLVED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type approval_decision as enum ('PENDING','APPROVED','REJECTED');
exception when duplicate_object then null; end $$;

do $$ begin
  create type risk_domain as enum ('REVENUE');
exception when duplicate_object then null; end $$;

do $$ begin
  create type risk_category as enum (
    'FINANCIAL_EXPOSURE',
    'DATA_INTEGRITY',
    'REPORTING_ACCURACY',
    'CUSTOMER_IMPACT',
    'AUTOMATION_INTEGRATION',
    'ROLLBACK_COMPLEXITY'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type signal_value_type as enum ('BOOLEAN','NUMBER','TEXT');
exception when duplicate_object then null; end $$;

do $$ begin
  create type assessment_status as enum ('PENDING','READY','NEEDS_REVIEW','FAILED');
exception when duplicate_object then null; end $$;

-- Organizations + Membership
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists organization_members (
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index if not exists idx_org_members_user on organization_members(user_id);
create index if not exists idx_org_members_org on organization_members(org_id);

create table if not exists organization_settings (
  org_id uuid primary key references organizations(id) on delete cascade,
  slack_webhook_url text,
  email_enabled boolean not null default false,
  slack_enabled boolean not null default false,
  notification_emails text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Change Events
create table if not exists change_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,

  title text not null,
  change_type change_type not null,
  status change_status not null default 'SUBMITTED',

  intake jsonb not null default '{}'::jsonb,

  systems_involved text[] not null default '{}',
  revenue_impact_areas text[] not null default '{}',
  impacts_active_customers boolean not null default false,
  alters_pricing_visibility boolean not null default false,
  backfill_required boolean not null default false,
  data_migration_required boolean not null default false,
  requires_code_deploy boolean not null default false,
  reversible_via_config boolean not null default false,
  requires_db_restore boolean not null default false,
  requires_manual_data_correction boolean not null default false,
  rollback_time_estimate_hours integer,

  requested_release_at timestamptz,
  submitted_at timestamptz,
  due_at timestamptz,
  sla_status text default 'ON_TRACK',
  escalated_at timestamptz,
  last_notified_at timestamptz,

  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_change_events_org on change_events(org_id, created_at desc);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_change_events_updated_at on change_events;
create trigger trg_change_events_updated_at
before update on change_events
for each row execute function set_updated_at();

-- Impact Assessments
create table if not exists impact_assessments (
  id uuid primary key default gen_random_uuid(),
  change_event_id uuid not null references change_events(id) on delete cascade,

  schema_version text not null default 'pass_a_v1',
  status assessment_status not null default 'PENDING',

  risk_score_raw integer,
  risk_bucket text,

  pass_a_output jsonb,
  pass_a_model text,
  pass_a_ran_at timestamptz,
  report_md text,

  missing_evidence_suggestions jsonb,
  suggested_evidence_ran_at timestamptz,

  error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assessments_change_event on impact_assessments(change_event_id, created_at desc);

drop trigger if exists trg_impact_assessments_updated_at on impact_assessments;
create trigger trg_impact_assessments_updated_at
before update on impact_assessments
for each row execute function set_updated_at();

-- Risk Signals
create table if not exists risk_signals (
  id uuid primary key default gen_random_uuid(),
  change_event_id uuid not null references change_events(id) on delete cascade,

  domain risk_domain not null default 'REVENUE',
  category risk_category not null,

  signal_key text not null,
  value_type signal_value_type not null,
  value_bool boolean,
  value_num numeric,
  value_text text,

  confidence numeric not null default 1.0,
  rationale text,
  reasons jsonb not null default '[]'::jsonb,

  source text not null default 'AI',
  weight_at_time integer not null default 0,
  contribution integer not null default 0,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_risk_signals_event on risk_signals(change_event_id);
create index if not exists idx_risk_signals_key on risk_signals(signal_key);

-- Approvals
create table if not exists approvals (
  id uuid primary key default gen_random_uuid(),
  change_event_id uuid not null references change_events(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,

  approver_user_id uuid not null references auth.users(id) on delete cascade,
  approval_area text not null default 'General',
  decision approval_decision not null default 'PENDING',
  comment text,
  decided_at timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists idx_approvals_event on approvals(change_event_id);
create unique index if not exists idx_approvals_event_area on approvals(change_event_id, approval_area);
create index if not exists idx_approvals_org on approvals(org_id);
create index if not exists idx_approvals_approver on approvals(approver_user_id);

-- Change Evidence
create table if not exists change_evidence (
  id uuid primary key default gen_random_uuid(),
  change_event_id uuid not null references change_events(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  kind text not null,
  label text not null,
  url text,
  note text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_change_evidence_event on change_evidence(change_event_id);

-- Notification outbox
create table if not exists notification_outbox (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  change_event_id uuid references change_events(id) on delete cascade,
  channel text not null default 'IN_APP',
  template_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text default 'PENDING',
  attempt_count int default 0,
  last_error text,
  available_at timestamptz default now(),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists idx_notification_outbox_org on notification_outbox(org_id);
create index if not exists idx_notification_outbox_pending on notification_outbox(status, available_at) where status = 'PENDING';
alter table notification_outbox add column if not exists dedupe_key text;
create index if not exists notification_outbox_dedupe_idx on notification_outbox(dedupe_key, created_at) where dedupe_key is not null;

-- In-app notifications (read model, fan-out from outbox)
create table if not exists in_app_notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  change_event_id uuid references change_events(id) on delete cascade,
  title text not null,
  body text not null,
  severity text not null default 'INFO',
  cta_label text,
  cta_url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_in_app_notifications_user on in_app_notifications(user_id);
create index if not exists idx_in_app_notifications_user_unread on in_app_notifications(user_id) where read_at is null;
alter table in_app_notifications enable row level security;
drop policy if exists in_app_notif_select on in_app_notifications;
create policy in_app_notif_select on in_app_notifications for select using (auth.uid() = user_id);
drop policy if exists in_app_notif_insert on in_app_notifications;
create policy in_app_notif_insert on in_app_notifications for insert with check (is_org_member(org_id));
drop policy if exists in_app_notif_update on in_app_notifications;
create policy in_app_notif_update on in_app_notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- RLS Policies
alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table organization_settings enable row level security;
alter table change_events enable row level security;
alter table impact_assessments enable row level security;
alter table risk_signals enable row level security;
alter table approvals enable row level security;
alter table change_evidence enable row level security;
alter table notification_outbox enable row level security;

create or replace function is_org_member(p_org_id uuid)
returns boolean as $$
  select exists (
    select 1 from organization_members m
    where m.org_id = p_org_id and m.user_id = auth.uid()
  );
$$ language sql stable;

drop policy if exists org_select on organizations;
create policy org_select on organizations
for select using (is_org_member(id));

drop policy if exists org_insert on organizations;
create policy org_insert on organizations
for insert with check (created_by = auth.uid());

drop policy if exists org_members_select on organization_members;
create policy org_members_select on organization_members
for select using (is_org_member(org_id));

drop policy if exists org_members_insert on organization_members;
create policy org_members_insert on organization_members
for insert with check (auth.uid() = user_id);

drop policy if exists org_settings_select on organization_settings;
create policy org_settings_select on organization_settings for select using (is_org_member(org_id));
drop policy if exists org_settings_insert on organization_settings;
create policy org_settings_insert on organization_settings for insert with check (is_org_member(org_id));
drop policy if exists org_settings_update on organization_settings;
create policy org_settings_update on organization_settings for update using (is_org_member(org_id)) with check (is_org_member(org_id));

drop policy if exists change_select on change_events;
create policy change_select on change_events
for select using (is_org_member(org_id));

drop policy if exists change_insert on change_events;
create policy change_insert on change_events
for insert with check (is_org_member(org_id) and created_by = auth.uid());

drop policy if exists change_update on change_events;
create policy change_update on change_events
for update using (is_org_member(org_id)) with check (is_org_member(org_id));

drop policy if exists assess_select on impact_assessments;
create policy assess_select on impact_assessments
for select using (
  exists (
    select 1 from change_events ce
    where ce.id = change_event_id and is_org_member(ce.org_id)
  )
);

drop policy if exists assess_insert on impact_assessments;
create policy assess_insert on impact_assessments
for insert with check (
  exists (
    select 1 from change_events ce
    where ce.id = change_event_id and is_org_member(ce.org_id)
  )
);

drop policy if exists assess_update on impact_assessments;
create policy assess_update on impact_assessments
for update using (
  exists (
    select 1 from change_events ce
    where ce.id = change_event_id and is_org_member(ce.org_id)
  )
) with check (
  exists (
    select 1 from change_events ce
    where ce.id = change_event_id and is_org_member(ce.org_id)
  )
);

drop policy if exists signals_select on risk_signals;
create policy signals_select on risk_signals
for select using (
  exists (
    select 1 from change_events ce
    where ce.id = change_event_id and is_org_member(ce.org_id)
  )
);

drop policy if exists signals_insert on risk_signals;
create policy signals_insert on risk_signals
for insert with check (
  exists (
    select 1 from change_events ce
    where ce.id = change_event_id and is_org_member(ce.org_id)
  )
);

drop policy if exists approvals_select on approvals;
create policy approvals_select on approvals
for select using (is_org_member(org_id));

drop policy if exists approvals_insert on approvals;
create policy approvals_insert on approvals
for insert with check (is_org_member(org_id));

drop policy if exists approvals_update on approvals;
create policy approvals_update on approvals
for update using (is_org_member(org_id)) with check (is_org_member(org_id));

drop policy if exists evidence_select on change_evidence;
create policy evidence_select on change_evidence
for select using (
  exists (
    select 1 from change_events ce
    where ce.id = change_event_id and is_org_member(ce.org_id)
  )
);

drop policy if exists evidence_insert on change_evidence;
create policy evidence_insert on change_evidence
for insert with check (is_org_member(org_id));

drop policy if exists outbox_select on notification_outbox;
create policy outbox_select on notification_outbox
for select using (is_org_member(org_id));

drop policy if exists outbox_insert on notification_outbox;
create policy outbox_insert on notification_outbox
for insert with check (is_org_member(org_id));

drop policy if exists outbox_update on notification_outbox;
create policy outbox_update on notification_outbox
for update using (is_org_member(org_id)) with check (is_org_member(org_id));
