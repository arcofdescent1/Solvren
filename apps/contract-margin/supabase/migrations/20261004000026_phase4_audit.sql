create table public.organization_audit_heads (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  last_event_id bigint not null default 0,
  last_hash text not null default repeat('0',64)
);
create table public.organization_audit_events (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid,
  event_type text not null check (length(event_type) between 3 and 100),
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  previous_hash text not null,
  event_hash text not null,
  created_at timestamptz not null
);
create index organization_audit_recent on public.organization_audit_events(org_id,id desc);
alter table public.organization_audit_heads enable row level security;
alter table public.organization_audit_events enable row level security;
create policy audit_events_owner_read on public.organization_audit_events for select to authenticated
  using (private.is_owner(org_id));
create policy audit_heads_owner_read on public.organization_audit_heads for select to authenticated
  using (private.is_owner(org_id));
revoke all on public.organization_audit_events,public.organization_audit_heads from anon;
grant select on public.organization_audit_events,public.organization_audit_heads to authenticated;
grant select,insert,update,delete on public.organization_audit_events,public.organization_audit_heads to service_role;
grant usage,select on sequence public.organization_audit_events_id_seq to service_role;

create function private.append_audit(p_org uuid,p_actor uuid,p_type text,
  p_entity text,p_details jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_head public.organization_audit_heads%rowtype;v_id bigint;
  v_at timestamptz := now();v_hash text;v_details jsonb := coalesce(p_details,'{}'::jsonb);
begin
  if p_org is null or length(p_type) not between 3 and 100
    or pg_column_size(v_details) > 2000 then raise exception 'Invalid audit entry'; end if;
  insert into public.organization_audit_heads(org_id) values(p_org) on conflict do nothing;
  select * into v_head from public.organization_audit_heads where org_id = p_org for update;
  v_id := nextval('public.organization_audit_events_id_seq');
  v_hash := encode(extensions.digest(v_head.last_hash || '|' || v_id || '|' || p_org
    || '|' || coalesce(p_actor::text,'') || '|' || p_type || '|'
    || coalesce(p_entity,'') || '|' || v_details::text || '|' || v_at::text,
    'sha256'),'hex');
  insert into public.organization_audit_events(id,org_id,actor_user_id,event_type,
    entity_id,details,previous_hash,event_hash,created_at)
    overriding system value
    values(v_id,p_org,p_actor,p_type,p_entity,v_details,v_head.last_hash,v_hash,v_at);
  update public.organization_audit_heads set last_event_id = v_id,last_hash = v_hash
    where org_id = p_org;
  return v_id;
end;
$$;
create function public.phase4_record_audit(p_org uuid,p_actor uuid,p_type text,
  p_entity text,p_details jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if p_type not in ('login','export','billing_checkout','billing_portal','support_case',
    'operator_access','operator_action','incident_update') then
    raise exception 'Unsupported application audit event'; end if;
  return private.append_audit(p_org,p_actor,p_type,p_entity,p_details);
end;
$$;

create function private.audit_row_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_org uuid;v_entity text;v_details jsonb := '{}'::jsonb;
  v_row jsonb;v_type text;
begin
  v_row := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_org := (v_row->>'org_id')::uuid;
  if v_org is null and tg_table_name = 'organizations' then v_org := (v_row->>'id')::uuid; end if;
  if v_org is null then return null; end if;
  v_entity := coalesce(v_row->>'id',v_row->>'user_id',v_row->>'provider',
    v_row->>'source_event_id',v_row->>'source_customer_id',v_row->>'quote_id');
  v_type := tg_table_name || '_' || lower(tg_op);
  if tg_table_name = 'report_snapshots' then
    if tg_op <> 'UPDATE' or new.status <> 'frozen' or old.status = 'frozen' then return null; end if;
    v_type := 'report_frozen';v_details := jsonb_build_object('periodStart',new.period_start,
      'periodEnd',new.period_end,'version',new.version);
  elsif tg_table_name = 'organization_billing' then
    if tg_op = 'UPDATE' and new.status = old.status and
      new.stripe_subscription_id is not distinct from old.stripe_subscription_id and
      new.cancel_at_period_end = old.cancel_at_period_end then return null; end if;
    v_type := 'billing_entitlement';
    v_details := jsonb_build_object('status',v_row->>'status',
      'subscription',v_row->>'stripe_subscription_id');
  elsif tg_table_name = 'organization_members' then
    v_details := jsonb_build_object('role',v_row->>'role');
  elsif tg_table_name = 'connector_credentials' then
    v_details := jsonb_build_object('provider',v_row->>'provider');
  elsif tg_table_name = 'contract_versions' then
    v_details := jsonb_build_object('version',v_row->>'version');
  elsif tg_table_name = 'margin_alert_settings' then
    v_type := 'alert_thresholds_' || lower(tg_op);
  elsif tg_table_name = 'organizations' then
    if tg_op <> 'UPDATE' or new.target_margin_pct is not distinct from old.target_margin_pct
    then return null; end if;
    v_type := 'target_margin_changed';
    v_details := jsonb_build_object('from',old.target_margin_pct,'to',new.target_margin_pct);
  elsif tg_table_name = 'margin_issue_events' then
    v_type := 'issue_' || (v_row->>'event_type');
  elsif tg_table_name = 'support_tickets' then
    v_type := 'support_case';
    v_details := jsonb_build_object('category',v_row->>'category',
      'caseNumber',v_row->>'case_number');
  end if;
  perform private.append_audit(v_org,auth.uid(),v_type,v_entity,v_details);
  return null;
end;
$$;
do $$
declare v_table text;
begin
  foreach v_table in array array['organization_members','customer_mappings',
    'contract_versions','margin_alert_settings','quote_decisions','organization_billing',
    'margin_issue_events','support_tickets'] loop
    execute format('create trigger audit_change after insert or update or delete on public.%I '
      || 'for each row execute function private.audit_row_change()',v_table);
  end loop;
end;
$$;
create trigger audit_connector_change after insert or update or delete
  on private.connector_credentials for each row execute function private.audit_row_change();
create trigger audit_report_freeze after update on public.report_snapshots
  for each row execute function private.audit_row_change();
create trigger audit_target_margin after update of target_margin_pct on public.organizations
  for each row execute function private.audit_row_change();

create function private.prevent_audit_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.organizations where id = old.org_id) then
    raise exception 'Audit history is append-only'; end if;
  return old;
end;
$$;
create trigger audit_immutable before update or delete on public.organization_audit_events
  for each row execute function private.prevent_audit_change();
create function public.phase4_audit_chain_valid(p_org uuid)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare v_row public.organization_audit_events%rowtype;v_last text := repeat('0',64);
  v_id bigint := 0;v_expected text;v_head public.organization_audit_heads%rowtype;
begin
  if not private.is_owner(p_org) then raise exception 'Owner and MFA required'; end if;
  for v_row in select * from public.organization_audit_events
    where org_id = p_org order by id loop
    v_expected := encode(extensions.digest(v_last || '|' || v_row.id || '|' || p_org
      || '|' || coalesce(v_row.actor_user_id::text,'') || '|' || v_row.event_type || '|'
      || coalesce(v_row.entity_id,'') || '|' || v_row.details::text || '|'
      || v_row.created_at::text,'sha256'),'hex');
    if v_row.previous_hash <> v_last or v_row.event_hash <> v_expected then return false; end if;
    v_last := v_row.event_hash;v_id := v_row.id;
  end loop;
  select * into v_head from public.organization_audit_heads where org_id = p_org;
  return (v_head.org_id is null and v_id = 0)
    or (v_head.last_event_id = v_id and v_head.last_hash = v_last);
end;
$$;
revoke all on function public.phase4_record_audit(uuid,uuid,text,text,jsonb),
  public.phase4_audit_chain_valid(uuid) from public;
grant execute on function public.phase4_record_audit(uuid,uuid,text,text,jsonb) to service_role;
grant execute on function public.phase4_audit_chain_valid(uuid) to authenticated;
