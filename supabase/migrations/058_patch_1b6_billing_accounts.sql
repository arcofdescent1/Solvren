-- Patch 1B.6 — Billing accounts (Stripe; source of truth for entitlements)

create table if not exists public.billing_accounts (
  org_id uuid primary key references public.organizations(id) on delete cascade,

  stripe_customer_id text null,
  stripe_subscription_id text null,

  plan_key text not null default 'FREE',
  status text not null default 'ACTIVE',

  current_period_end timestamptz null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_billing_accounts_customer on public.billing_accounts(stripe_customer_id);
create index if not exists idx_billing_accounts_subscription on public.billing_accounts(stripe_subscription_id);

alter table public.billing_accounts enable row level security;

drop policy if exists billing_accounts_select on public.billing_accounts;
create policy billing_accounts_select on public.billing_accounts
for select using (is_org_member(org_id));

drop policy if exists billing_accounts_write_service on public.billing_accounts;
create policy billing_accounts_write_service on public.billing_accounts
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- updated_at trigger (set_updated_at from 033)
drop trigger if exists trg_billing_accounts_updated_at on public.billing_accounts;
create trigger trg_billing_accounts_updated_at
  before update on public.billing_accounts
  for each row execute function public.set_updated_at();
