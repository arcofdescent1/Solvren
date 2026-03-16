-- Patch 1A.1 — Solvren schema foundation
-- Adds revenue exposure context to change_events.
-- NOTE: Logic that uses these fields is implemented in Patch 1A.2.

alter table public.change_events
  add column if not exists revenue_surface text null, -- e.g. BILLING|PRICING|CHECKOUT|CRM|ATTRIBUTION|RENEWALS|REPORTING|TAX
  add column if not exists estimated_mrr_affected numeric null,
  add column if not exists percent_customer_base_affected numeric null,
  add column if not exists customers_affected_count integer null;

-- Soft constraint: keep within 0..100 when provided
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_change_events_pct_customers'
  ) then
    alter table public.change_events
      add constraint chk_change_events_pct_customers
      check (
        percent_customer_base_affected is null
        or (percent_customer_base_affected >= 0 and percent_customer_base_affected <= 100)
      );
  end if;
end $$;

create index if not exists idx_change_events_org_domain_surface
  on public.change_events (org_id, domain, revenue_surface);

create index if not exists idx_change_events_org_mrr
  on public.change_events (org_id, estimated_mrr_affected);
