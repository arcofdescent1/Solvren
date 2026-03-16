-- Task 20 RBAC foundation: normalize org member roles and constrain allowed values.

update public.organization_members
set role = lower(trim(role))
where role is not null;

update public.organization_members
set role = 'viewer'
where role not in ('owner', 'admin', 'reviewer', 'submitter', 'viewer');

alter table public.organization_members
  alter column role set default 'viewer';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organization_members_role_check'
      and conrelid = 'public.organization_members'::regclass
  ) then
    alter table public.organization_members
      add constraint organization_members_role_check
      check (role in ('owner', 'admin', 'reviewer', 'submitter', 'viewer'));
  end if;
end $$;

create index if not exists idx_org_members_org_role
  on public.organization_members(org_id, role);
