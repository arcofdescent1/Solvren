-- 037_approval_requirements.sql

create table if not exists public.approval_requirements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,

  domain text not null default 'REVENUE',
  risk_bucket text not null default 'MEDIUM',

  required_role text not null,
  min_count int not null default 1,

  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_approval_requirements_org
  on public.approval_requirements(org_id);

create index if not exists idx_approval_requirements_org_domain_bucket
  on public.approval_requirements(org_id, domain, risk_bucket);

drop trigger if exists trg_approval_requirements_updated_at on public.approval_requirements;
create trigger trg_approval_requirements_updated_at
before update on public.approval_requirements
for each row execute function public.set_updated_at();

alter table public.approval_requirements enable row level security;

drop policy if exists approval_req_select on public.approval_requirements;
create policy approval_req_select on public.approval_requirements
for select using (is_org_member(org_id));

drop policy if exists approval_req_insert on public.approval_requirements;
create policy approval_req_insert on public.approval_requirements
for insert with check (is_org_member(org_id));

drop policy if exists approval_req_update on public.approval_requirements;
create policy approval_req_update on public.approval_requirements
for update using (is_org_member(org_id)) with check (is_org_member(org_id));
