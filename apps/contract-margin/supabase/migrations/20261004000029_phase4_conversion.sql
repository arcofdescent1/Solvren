create table public.product_events (
  id bigint generated always as identity primary key,
  event_key text not null unique check (length(event_key) between 8 and 180),
  event_name text not null check (event_name in
    ('visit','signup','first_import','first_report','paid','paid_retained')),
  org_id uuid references public.organizations(id) on delete cascade,
  visitor_hash text check (visitor_hash ~ '^[0-9a-f]{64}$'),
  occurred_at timestamptz not null default now()
);
create index product_events_funnel on public.product_events(event_name,occurred_at);
alter table public.product_events enable row level security;
revoke all on public.product_events from public,anon,authenticated;
grant select,insert,update,delete on public.product_events to service_role;
grant usage,select on sequence public.product_events_id_seq to service_role;
create function private.record_conversion(p_key text,p_name text,p_org uuid,
  p_visitor text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if length(p_key) not between 8 and 180 or
    p_name not in ('visit','signup','first_import','first_report','paid','paid_retained')
    or (p_org is null and p_name <> 'visit')
    or (p_visitor is not null and p_visitor !~ '^[0-9a-f]{64}$')
  then raise exception 'Invalid conversion event'; end if;
  insert into public.product_events(event_key,event_name,org_id,visitor_hash)
    values(p_key,p_name,p_org,p_visitor) on conflict(event_key) do nothing;
end;
$$;
create function public.phase4_record_conversion(p_key text,p_name text,p_org uuid default null,
  p_visitor text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  perform private.record_conversion(p_key,p_name,p_org,p_visitor);
end;
$$;
create function private.conversion_source_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'import_jobs' then
    if new.status = 'completed' and old.status is distinct from 'completed' then
      perform private.record_conversion('first-import:' || new.org_id::text,
        'first_import',new.org_id,null);
    end if;
  elsif tg_table_name = 'report_snapshots' then
    if new.status = 'frozen' and old.status is distinct from 'frozen' then
      perform private.record_conversion('first-report:' || new.org_id::text,
        'first_report',new.org_id,null);
    end if;
  elsif tg_table_name = 'organization_billing' then
    if new.status = 'active' and old.status is distinct from 'active' then
      perform private.record_conversion('first-paid:' || new.org_id::text,
        'paid',new.org_id,null);
    end if;
  end if;
  return null;
end;
$$;
create trigger conversion_import_completed after update of status on public.import_jobs
  for each row execute function private.conversion_source_event();
create function private.conversion_imported_records()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  for v_org in select distinct org_id from new_rows loop
    perform private.record_conversion('first-import:' || v_org::text,
      'first_import',v_org,null);
  end loop;
  return null;
end;
$$;
create trigger conversion_contract_import after insert on public.contract_versions
  referencing new table as new_rows for each statement
  execute function private.conversion_imported_records();
create trigger conversion_statement_import after insert on public.provider_statements
  referencing new table as new_rows for each statement
  execute function private.conversion_imported_records();
create trigger conversion_first_report after update of status on public.report_snapshots
  for each row execute function private.conversion_source_event();
create trigger conversion_paid after update of status on public.organization_billing
  for each row execute function private.conversion_source_event();
revoke all on function public.phase4_record_conversion(text,text,uuid,text) from public;
grant execute on function public.phase4_record_conversion(text,text,uuid,text) to service_role;
