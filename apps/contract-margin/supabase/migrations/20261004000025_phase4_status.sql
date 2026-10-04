create table public.status_incidents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 5 and 160),
  summary text not null check (length(btrim(summary)) between 15 and 2000),
  severity text not null check (severity in ('degraded','outage','maintenance')),
  state text not null check (state in ('investigating','identified','monitoring','resolved')),
  published boolean not null default false,
  started_at timestamptz not null,
  resolved_at timestamptz,
  updated_at timestamptz not null default now()
);
create index status_incidents_recent on public.status_incidents(published,started_at desc);
alter table public.status_incidents enable row level security;
create policy status_incidents_public on public.status_incidents for select to anon,authenticated
  using (published);
grant select on public.status_incidents to anon,authenticated;
grant select,insert,update,delete on public.status_incidents to service_role;
