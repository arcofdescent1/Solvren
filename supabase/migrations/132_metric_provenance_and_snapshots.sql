-- Gap 5: Metric provenance and snapshots for executive metric traceability.

-- Provenance: origin of every metric calculation (reconstruct numbers from source events).
create table if not exists public.metric_provenance (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric_name text not null,
  metric_value numeric not null,
  calculation_timestamp timestamptz not null default now(),
  source_event_ids uuid[] not null default '{}',
  calculation_version text not null default 'v1',
  created_at timestamptz not null default now()
);

create index if not exists idx_metric_provenance_org_ts
  on public.metric_provenance(organization_id, calculation_timestamp desc);
create index if not exists idx_metric_provenance_name
  on public.metric_provenance(organization_id, metric_name);

comment on table public.metric_provenance is 'Gap 5: Origin of each metric calculation for audit and drill-down';

-- Snapshots: historical metric values for trend graphs (hourly).
create table if not exists public.metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  metric_name text not null,
  metric_value numeric not null,
  snapshot_time timestamptz not null,
  calculation_version text not null default 'v1',
  created_at timestamptz not null default now()
);

create index if not exists idx_metric_snapshots_org_time
  on public.metric_snapshots(organization_id, snapshot_time desc);
create index if not exists idx_metric_snapshots_org_name_time
  on public.metric_snapshots(organization_id, metric_name, snapshot_time desc);

comment on table public.metric_snapshots is 'Gap 5: Hourly metric snapshots for dashboard trend graphs';

alter table public.metric_provenance enable row level security;
alter table public.metric_snapshots enable row level security;

drop policy if exists metric_provenance_select on public.metric_provenance;
create policy metric_provenance_select on public.metric_provenance
  for select using (is_org_member(organization_id));

drop policy if exists metric_provenance_insert on public.metric_provenance;
create policy metric_provenance_insert on public.metric_provenance
  for insert with check (is_org_member(organization_id));

drop policy if exists metric_snapshots_select on public.metric_snapshots;
create policy metric_snapshots_select on public.metric_snapshots
  for select using (is_org_member(organization_id));

drop policy if exists metric_snapshots_insert on public.metric_snapshots;
create policy metric_snapshots_insert on public.metric_snapshots
  for insert with check (is_org_member(organization_id));
