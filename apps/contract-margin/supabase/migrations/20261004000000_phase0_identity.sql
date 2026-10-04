create schema if not exists private;
create schema if not exists extensions;
create schema if not exists vault;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;

create type public.member_role as enum ('owner', 'finance', 'engineer', 'viewer');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  created_at timestamptz not null default now()
);

create table public.organization_members (
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create unique index one_owner_per_organization on public.organization_members(org_id) where role = 'owner';
create index members_by_user on public.organization_members(user_id, org_id);

create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.member_role not null check (role <> 'owner'),
  token_hash bytea not null unique,
  invited_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  check (expires_at > created_at)
);
create index pending_invites_by_org on public.organization_invites(org_id, expires_at)
  where accepted_at is null and revoked_at is null;

create table private.connector_credentials (
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('openai', 'anthropic', 'langfuse', 'stripe')),
  vault_secret_id uuid not null unique,
  updated_at timestamptz not null default now(),
  primary key (org_id, provider)
);

revoke all on schema private from public, anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
revoke all on public.organizations, public.organization_members, public.organization_invites from anon;
grant select on public.organizations, public.organization_members, public.organization_invites to authenticated;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invites enable row level security;
alter table private.connector_credentials enable row level security;

create function private.is_verified() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;

create function private.is_verified_work_account() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_verified() and exists (
    select 1 from auth.users u where u.id = auth.uid()
      and split_part(lower(u.email), '@', 2) not in
        ('gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com', 'icloud.com', 'proton.me', 'protonmail.com')
  );
$$;

create function private.member_role_for(p_org uuid) returns public.member_role
language sql stable security definer set search_path = '' as $$
  select m.role from public.organization_members m
  where m.org_id = p_org and m.user_id = auth.uid();
$$;

create function private.can_read_org(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_verified() and exists (
    select 1 from public.organization_members m
    where m.org_id = p_org and m.user_id = auth.uid()
      and (m.role = 'viewer' or auth.jwt()->>'aal' = 'aal2')
  );
$$;

create function private.is_owner(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_verified()
    and auth.jwt()->>'aal' = 'aal2'
    and private.member_role_for(p_org) = 'owner';
$$;

create policy organization_read on public.organizations for select to authenticated
  using (private.can_read_org(id));
create policy membership_read on public.organization_members for select to authenticated
  using (private.is_verified() and (user_id = auth.uid() or private.is_owner(org_id)));
create policy invitation_read on public.organization_invites for select to authenticated
  using (private.is_owner(org_id));

create function public.create_organization(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  if not private.is_verified_work_account() then raise exception 'Verified work email required'; end if;
  if (select count(*) from public.organization_members where user_id = auth.uid() and role = 'owner') >= 5
  then raise exception 'Organization limit reached'; end if;
  if char_length(btrim(p_name)) not between 2 and 80 then raise exception 'Organization name must be 2–80 characters'; end if;
  insert into public.organizations(name) values (btrim(p_name)) returning id into v_org;
  insert into public.organization_members(org_id, user_id, role) values (v_org, auth.uid(), 'owner');
  return v_org;
end;
$$;

create function public.create_organization_invite(p_org uuid, p_email text, p_role public.member_role)
returns table (invite_id uuid, invite_token text)
language plpgsql security definer set search_path = '' as $$
declare
  v_token text;
  v_email text := lower(btrim(p_email));
  v_id uuid;
begin
  if not private.is_owner(p_org) then raise exception 'Owner and MFA required'; end if;
  if p_role = 'owner' or p_role is null then raise exception 'Transfer ownership separately'; end if;
  if v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v_email) > 254
  then raise exception 'Valid email required'; end if;
  if exists (
    select 1 from public.organization_members m join auth.users u on u.id = m.user_id
    where m.org_id = p_org and lower(u.email) = v_email
  ) then raise exception 'Already a member'; end if;
  if (select count(*) from public.organization_invites
      where org_id = p_org and created_at > now() - interval '1 day') >= 50
  then raise exception 'Daily invitation limit reached'; end if;
  update public.organization_invites set revoked_at = now()
    where org_id = p_org and email = v_email and accepted_at is null and revoked_at is null;
  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.organization_invites(org_id, email, role, token_hash, invited_by, expires_at)
    values (p_org, v_email, p_role, extensions.digest(v_token, 'sha256'), auth.uid(), now() + interval '7 days')
    returning id into v_id;
  return query select v_id, v_token;
end;
$$;

create function public.revoke_organization_invite(p_invite uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  select org_id into v_org from public.organization_invites where id = p_invite;
  if v_org is null or not private.is_owner(v_org) then raise exception 'Owner and MFA required'; end if;
  update public.organization_invites set revoked_at = now()
    where id = p_invite and accepted_at is null and revoked_at is null;
end;
$$;

create function public.accept_organization_invite(p_token text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.organization_invites%rowtype;
  v_email text;
begin
  if not private.is_verified_work_account() then raise exception 'Verified work email required'; end if;
  if p_token !~ '^[0-9a-f]{64}$' then raise exception 'Invalid invitation'; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  select * into v_invite from public.organization_invites
    where token_hash = extensions.digest(p_token, 'sha256')
      and accepted_at is null and revoked_at is null and expires_at > now()
    for update;
  if v_invite.id is null or v_invite.email <> v_email then raise exception 'Invitation unavailable for this account'; end if;
  if exists (select 1 from public.organization_members where org_id = v_invite.org_id and user_id = auth.uid())
  then raise exception 'Already a member'; end if;
  insert into public.organization_members(org_id, user_id, role)
    values (v_invite.org_id, auth.uid(), v_invite.role);
  update public.organization_invites set accepted_at = now() where id = v_invite.id;
  return v_invite.org_id;
end;
$$;

create function public.organization_directory(p_org uuid)
returns table (user_id uuid, email text, role public.member_role, joined_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_owner(p_org) then raise exception 'Owner and MFA required'; end if;
  return query select m.user_id, u.email::text, m.role, m.created_at
    from public.organization_members m join auth.users u on u.id = m.user_id
    where m.org_id = p_org order by m.created_at;
end;
$$;

create function public.change_organization_member_role(p_org uuid, p_user uuid, p_role public.member_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.organizations where id = p_org for update;
  if not private.is_owner(p_org) then raise exception 'Owner and MFA required'; end if;
  if p_role = 'owner' or p_role is null then raise exception 'Transfer ownership separately'; end if;
  update public.organization_members set role = p_role
    where org_id = p_org and user_id = p_user and role <> 'owner';
  if not found then raise exception 'Member not found or is owner'; end if;
end;
$$;

create function public.remove_organization_member(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.organizations where id = p_org for update;
  if not private.is_owner(p_org) then raise exception 'Owner and MFA required'; end if;
  delete from public.organization_members where org_id = p_org and user_id = p_user and role <> 'owner';
  if not found then raise exception 'Member not found or is owner'; end if;
end;
$$;

create function public.transfer_organization_ownership(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.organizations where id = p_org for update;
  if not private.is_owner(p_org) then raise exception 'Owner and MFA required'; end if;
  if p_user = auth.uid() then raise exception 'Choose another member'; end if;
  if not exists (select 1 from public.organization_members where org_id = p_org and user_id = p_user)
  then raise exception 'Member not found'; end if;
  update public.organization_members set role = 'finance' where org_id = p_org and user_id = auth.uid();
  update public.organization_members set role = 'owner' where org_id = p_org and user_id = p_user;
end;
$$;

revoke all on function private.is_verified() from public;
revoke all on function private.is_verified_work_account() from public;
revoke all on function private.member_role_for(uuid) from public;
revoke all on function private.can_read_org(uuid) from public;
revoke all on function private.is_owner(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_verified(), private.is_verified_work_account(),
  private.member_role_for(uuid), private.can_read_org(uuid), private.is_owner(uuid) to authenticated;
revoke all on function public.create_organization(text), public.create_organization_invite(uuid,text,public.member_role),
  public.revoke_organization_invite(uuid), public.accept_organization_invite(text), public.organization_directory(uuid),
  public.change_organization_member_role(uuid,uuid,public.member_role), public.remove_organization_member(uuid,uuid),
  public.transfer_organization_ownership(uuid,uuid) from public;
grant execute on function public.create_organization(text), public.create_organization_invite(uuid,text,public.member_role),
  public.revoke_organization_invite(uuid), public.accept_organization_invite(text), public.organization_directory(uuid),
  public.change_organization_member_role(uuid,uuid,public.member_role), public.remove_organization_member(uuid,uuid),
  public.transfer_organization_ownership(uuid,uuid) to authenticated;
