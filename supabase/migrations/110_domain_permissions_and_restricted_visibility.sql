-- Task 21: domain-level permissions and restricted change visibility.

create table if not exists public.user_domain_permissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null,
  can_view boolean not null default true,
  can_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id, domain)
);

create index if not exists idx_user_domain_permissions_org_user
  on public.user_domain_permissions(org_id, user_id);

create table if not exists public.change_permissions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  change_event_id uuid not null references public.change_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_type text not null default 'VIEW',
  created_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  expires_at timestamptz null,
  unique (change_event_id, user_id, access_type)
);

create index if not exists idx_change_permissions_change
  on public.change_permissions(change_event_id, user_id);

alter table public.change_events
  add column if not exists is_restricted boolean not null default false;

alter table public.user_domain_permissions enable row level security;
alter table public.change_permissions enable row level security;

drop policy if exists user_domain_permissions_select on public.user_domain_permissions;
create policy user_domain_permissions_select on public.user_domain_permissions
for select using (is_org_member(org_id));

drop policy if exists user_domain_permissions_admin_write on public.user_domain_permissions;
create policy user_domain_permissions_admin_write on public.user_domain_permissions
for all using (
  exists (
    select 1 from public.organization_members m
    where m.org_id = user_domain_permissions.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.organization_members m
    where m.org_id = user_domain_permissions.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  )
);

drop policy if exists change_permissions_select on public.change_permissions;
create policy change_permissions_select on public.change_permissions
for select using (is_org_member(org_id));

drop policy if exists change_permissions_admin_write on public.change_permissions;
create policy change_permissions_admin_write on public.change_permissions
for all using (
  exists (
    select 1 from public.organization_members m
    where m.org_id = change_permissions.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1 from public.organization_members m
    where m.org_id = change_permissions.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  )
);
