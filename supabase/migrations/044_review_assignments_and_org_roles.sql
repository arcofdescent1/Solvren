-- 044_review_assignments_and_org_roles.sql
-- Phase 3 Item 9: Role-based review routing + assignments

-- Allow users to hold multiple review roles within an org (DOMAIN_REVIEWER, RISK_OWNER, EXEC, etc.)
create table if not exists public.organization_member_roles (
  org_id uuid not null,
  user_id uuid not null,
  role_key text not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id, role_key)
);

create index if not exists idx_org_member_roles_org_role
  on public.organization_member_roles(org_id, role_key, created_at asc);

alter table public.organization_member_roles enable row level security;

drop policy if exists org_member_roles_select on public.organization_member_roles;
create policy org_member_roles_select on public.organization_member_roles
for select using (is_org_member(org_id));

-- Only org admins can manage role assignments
drop policy if exists org_member_roles_insert on public.organization_member_roles;
create policy org_member_roles_insert on public.organization_member_roles
for insert with check (
  exists (
    select 1 from public.organization_members m
    where m.org_id = organization_member_roles.org_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
  )
);

drop policy if exists org_member_roles_delete on public.organization_member_roles;
create policy org_member_roles_delete on public.organization_member_roles
for delete using (
  exists (
    select 1 from public.organization_members m
    where m.org_id = organization_member_roles.org_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
  )
);

-- Review assignments ("who is expected to review") separate from approvals ("who decided")
create table if not exists public.review_assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  change_event_id uuid not null,
  user_id uuid not null,
  role_key text not null,
  status text not null default 'ASSIGNED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_review_assignments_unique
  on public.review_assignments(change_event_id, user_id, role_key);

create index if not exists idx_review_assignments_org_user
  on public.review_assignments(org_id, user_id, status);

alter table public.review_assignments enable row level security;

drop policy if exists review_assignments_select on public.review_assignments;
create policy review_assignments_select on public.review_assignments
for select using (is_org_member(org_id));

-- Inserts/updates are server-driven; allow org members (server uses user session) but enforce org membership.
drop policy if exists review_assignments_insert on public.review_assignments;
create policy review_assignments_insert on public.review_assignments
for insert with check (is_org_member(org_id));

-- Updates only by org admins
drop policy if exists review_assignments_update on public.review_assignments;
create policy review_assignments_update on public.review_assignments
for update using (
  exists (
    select 1 from public.organization_members m
    where m.org_id = review_assignments.org_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
  )
);
