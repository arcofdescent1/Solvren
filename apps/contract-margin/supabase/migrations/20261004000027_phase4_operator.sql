create table private.operator_access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (length(btrim(reason)) between 15 and 500),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > granted_at and expires_at <= granted_at + interval '30 minutes')
);
create index operator_grants_active on private.operator_access_grants(user_id,expires_at desc);
create table private.operator_activity (
  id bigint generated always as identity primary key,
  grant_id uuid not null references private.operator_access_grants(id),
  user_id uuid not null references auth.users(id),
  action text not null check (length(action) between 3 and 80),
  org_id uuid references public.organizations(id) on delete set null,
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index operator_activity_recent on private.operator_activity(created_at desc);
revoke all on private.operator_access_grants,private.operator_activity from public,anon,authenticated;
grant select,insert,update,delete on private.operator_access_grants,
  private.operator_activity to service_role;
grant usage,select on sequence private.operator_activity_id_seq to service_role;
create function public.phase4_start_operator_access(p_user uuid,p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if length(btrim(coalesce(p_reason,''))) not between 15 and 500
  then raise exception 'A specific reason is required'; end if;
  insert into private.operator_access_grants(user_id,reason,expires_at)
    values(p_user,btrim(p_reason),now()+interval '30 minutes') returning id into v_id;
  insert into private.operator_activity(grant_id,user_id,action,details)
    values(v_id,p_user,'access_started',jsonb_build_object('reason',btrim(p_reason)));
  return v_id;
end;
$$;
create function public.phase4_operator_grant(p_user uuid)
returns table(grant_id uuid,expires_at timestamptz,reason text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  return query select g.id,g.expires_at,g.reason from private.operator_access_grants g
    where g.user_id = p_user and g.revoked_at is null and g.expires_at > now()
    order by g.expires_at desc limit 1;
end;
$$;
create function public.phase4_operator_activity(p_grant uuid,p_action text,
  p_org uuid default null,p_target text default null,p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  select user_id into v_user from private.operator_access_grants
    where id = p_grant and revoked_at is null and expires_at > now();
  if v_user is null then raise exception 'Operator access expired'; end if;
  if length(p_action) not between 3 and 80 or
    pg_column_size(coalesce(p_details,'{}'::jsonb)) > 1000 then
    raise exception 'Invalid operator activity'; end if;
  insert into private.operator_activity(grant_id,user_id,action,org_id,target_id,details)
    values(p_grant,v_user,p_action,p_org,p_target,coalesce(p_details,'{}'::jsonb));
  if p_org is not null then
    perform private.append_audit(p_org,v_user,'operator_access',p_target,
      jsonb_build_object('action',p_action));
  end if;
end;
$$;
create function public.phase4_end_operator_access(p_grant uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  update private.operator_access_grants set revoked_at = now()
    where id = p_grant and revoked_at is null returning user_id into v_user;
  if v_user is not null then
    insert into private.operator_activity(grant_id,user_id,action)
      values(p_grant,v_user,'access_ended');
  end if;
end;
$$;
revoke all on function public.phase4_start_operator_access(uuid,text),
  public.phase4_operator_grant(uuid),
  public.phase4_operator_activity(uuid,text,uuid,text,jsonb),
  public.phase4_end_operator_access(uuid) from public;
grant execute on function public.phase4_start_operator_access(uuid,text),
  public.phase4_operator_grant(uuid),
  public.phase4_operator_activity(uuid,text,uuid,text,jsonb),
  public.phase4_end_operator_access(uuid) to service_role;
