-- Revenue Policies: Control Layer for Revenue Systems
-- Policies can Monitor, Require Approval, or Block changes before they are applied.

create table if not exists revenue_policies (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,

  name text not null,
  description text,
  rule_type text not null,
  rule_config jsonb not null default '{}'::jsonb,
  systems_affected text[] not null default '{}',
  enforcement_mode text not null default 'MONITOR',

  enabled boolean not null default true,
  priority integer not null default 100,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_revenue_policies_org on revenue_policies(org_id);
create index if not exists idx_revenue_policies_enabled on revenue_policies(org_id, enabled, priority desc) where enabled = true;

create trigger trg_revenue_policies_updated_at
before update on revenue_policies
for each row execute function set_updated_at();

alter table revenue_policies enable row level security;

drop policy if exists revenue_policies_select on revenue_policies;
create policy revenue_policies_select on revenue_policies
for select using (is_org_member(org_id));

drop policy if exists revenue_policies_insert on revenue_policies;
create policy revenue_policies_insert on revenue_policies
for insert with check (is_org_member(org_id));

drop policy if exists revenue_policies_update on revenue_policies;
create policy revenue_policies_update on revenue_policies
for update using (is_org_member(org_id)) with check (is_org_member(org_id));

drop policy if exists revenue_policies_delete on revenue_policies;
create policy revenue_policies_delete on revenue_policies
for delete using (is_org_member(org_id));

comment on table revenue_policies is 'Policy engine for revenue control: Monitor, Require Approval, or Block changes';
comment on column revenue_policies.rule_type is 'DISCOUNT_LIMIT | PRICING_CHANGE | BILLING_RULE | CONTRACT_THRESHOLD | CUSTOM';
comment on column revenue_policies.enforcement_mode is 'MONITOR | REQUIRE_APPROVAL | BLOCK';
