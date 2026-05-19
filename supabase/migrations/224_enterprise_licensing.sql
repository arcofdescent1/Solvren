-- Enterprise licensing spine: commercial scope lives here; Stripe remains payment metadata.

create table if not exists public.organization_licenses (
  org_id uuid primary key references public.organizations(id) on delete cascade,

  license_tier text not null default 'FREE'
    check (license_tier in ('FREE', 'TEAM', 'BUSINESS', 'ENTERPRISE', 'STRATEGIC_ENTERPRISE')),
  status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'TRIALING', 'PAST_DUE', 'INCOMPLETE', 'CANCELED')),

  protected_revenue_band text not null default 'UNSET'
    check (protected_revenue_band in ('UNSET', 'UNDER_25M', '25M_100M', '100M_250M', '250M_1B', '1B_PLUS')),

  contract_start date null,
  contract_end date null,
  renewal_date date null,

  licensed_business_units integer null check (licensed_business_units is null or licensed_business_units >= 0),
  licensed_integrations text[] null,
  licensed_domains text[] null,
  included_admin_seats integer null check (included_admin_seats is null or included_admin_seats >= 0),
  unlimited_executive_access boolean not null default false,
  premium_modules text[] not null default '{}',

  implementation_mode text not null default 'SELF_SERVE'
    check (implementation_mode in ('SELF_SERVE', 'GUIDED', 'WHITE_GLOVE')),

  account_manager_user_id uuid null references auth.users(id) on delete set null,
  customer_success_owner_user_id uuid null references auth.users(id) on delete set null,
  order_form_reference text null,
  commercial_notes text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_organization_licenses_tier on public.organization_licenses(license_tier);
create index if not exists idx_organization_licenses_status on public.organization_licenses(status);
create index if not exists idx_organization_licenses_renewal on public.organization_licenses(renewal_date);

alter table public.organization_licenses enable row level security;

drop policy if exists organization_licenses_select on public.organization_licenses;
create policy organization_licenses_select on public.organization_licenses
for select using (public.is_org_admin(org_id));

drop policy if exists organization_licenses_write_service on public.organization_licenses;
create policy organization_licenses_write_service on public.organization_licenses
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

drop trigger if exists trg_organization_licenses_updated_at on public.organization_licenses;
create trigger trg_organization_licenses_updated_at
  before update on public.organization_licenses
  for each row execute function public.set_updated_at();

create table if not exists public.organization_license_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid null references auth.users(id) on delete set null,
  event_type text not null,
  previous_license jsonb null,
  next_license jsonb null,
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists idx_organization_license_events_org_created
  on public.organization_license_events(org_id, created_at desc);

alter table public.organization_license_events enable row level security;

drop policy if exists organization_license_events_select on public.organization_license_events;
create policy organization_license_events_select on public.organization_license_events
for select using (public.is_org_admin(org_id));

drop policy if exists organization_license_events_write_service on public.organization_license_events;
create policy organization_license_events_write_service on public.organization_license_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');
