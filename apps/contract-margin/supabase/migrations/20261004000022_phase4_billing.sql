create table public.organization_billing (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_price_id text,
  plan_interval text check (plan_interval in ('month','year')),
  status text not null default 'trial' check (status in
    ('trial','active','past_due','canceled','incomplete','unpaid','paused')),
  trial_ends_at timestamptz not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  last_invoice_status text,
  last_event_created bigint not null default 0,
  last_event_id text,
  billing_ended_at timestamptz,
  billing_purge_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.organization_billing(org_id,trial_ends_at)
  select id,created_at + interval '14 days' from public.organizations;
create function private.start_organization_trial()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.organization_billing(org_id,trial_ends_at)
    values(new.id,new.created_at + interval '14 days');
  return new;
end;
$$;
create trigger start_organization_trial after insert on public.organizations
  for each row execute function private.start_organization_trial();
alter table public.organization_billing enable row level security;
create policy organization_billing_read on public.organization_billing for select to authenticated
  using (private.can_read_org(org_id));
revoke all on public.organization_billing from anon;
grant select on public.organization_billing to authenticated;
grant select,insert,update,delete on public.organization_billing to service_role;

create function private.can_write_org(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.organization_billing b
    join public.organizations o on o.id = b.org_id
    where b.org_id = p_org and o.deletion_requested_at is null
      and ((b.status = 'trial' and b.trial_ends_at > now())
        or (b.status = 'active' and (b.current_period_end is null
          or b.current_period_end > now())
          and coalesce(b.last_invoice_status,'paid') <> 'open')));
$$;
create function public.organization_entitlement(p_org uuid)
returns table(status text,trial_ends_at timestamptz,current_period_end timestamptz,
  cancel_at_period_end boolean,plan_interval text,can_write boolean,
  stripe_customer_id text,event_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_read_org(p_org) then raise exception 'Organization access required'; end if;
  return query select b.status,b.trial_ends_at,b.current_period_end,
    b.cancel_at_period_end,b.plan_interval,private.can_write_org(p_org),
    b.stripe_customer_id,coalesce(u.event_count,0)
    from public.organization_billing b left join public.org_event_usage u
      on u.org_id = b.org_id and u.month_start = date_trunc('month',now())::date
    where b.org_id = p_org;
end;
$$;

create table public.org_event_usage (
  org_id uuid not null references public.organizations(id) on delete cascade,
  month_start date not null,
  event_count bigint not null default 0 check (event_count >= 0),
  warning_sent_at timestamptz,
  primary key(org_id,month_start)
);
insert into public.org_event_usage(org_id,month_start,event_count)
select org_id,month_start,sum(event_count) from (
  select org_id,date_trunc('month',imported_at)::date month_start,count(*) event_count
    from public.usage_events group by org_id,date_trunc('month',imported_at)::date
  union all
  select org_id,date_trunc('month',imported_at)::date,count(*)
    from public.outcome_events group by org_id,date_trunc('month',imported_at)::date
  union all
  select org_id,date_trunc('month',imported_at)::date,count(*)
    from public.direct_cost_events group by org_id,date_trunc('month',imported_at)::date
) source group by org_id,month_start;
alter table public.org_event_usage enable row level security;
create policy org_event_usage_read on public.org_event_usage for select to authenticated
  using (private.can_read_org(org_id));
revoke all on public.org_event_usage from anon;
grant select on public.org_event_usage to authenticated;
grant select,insert,update,delete on public.org_event_usage to service_role;

create function private.require_commercial_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_write_org(new.org_id) then
    raise exception 'Trial expired or subscription inactive; data is read-only';
  end if;
  return new;
end;
$$;
create function private.require_human_commercial_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' and not private.can_write_org(new.org_id) then
    raise exception 'Trial expired or subscription inactive; data is read-only';
  end if;
  return new;
end;
$$;
create trigger commercial_issue_action before update on public.margin_issues
  for each row execute function private.require_human_commercial_write();
create trigger commercial_issue_event before insert on public.margin_issue_events
  for each row execute function private.require_human_commercial_write();
create function private.require_target_entitlement()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_write_org(new.id) then
    raise exception 'Trial expired or subscription inactive; data is read-only';
  end if;
  return new;
end;
$$;
create trigger commercial_target_update before update of target_margin_pct on public.organizations
  for each row execute function private.require_target_entitlement();
do $$
declare v_table text;
begin
  foreach v_table in array array['customers','customer_mappings','contract_versions',
    'model_rates','provider_statements','usage_events','outcome_events',
    'direct_cost_events','ingestion_keys','quote_decisions',
    'report_snapshots','margin_alert_settings'] loop
    execute format('create trigger commercial_write before insert or update on public.%I '
      || 'for each row execute function private.require_commercial_write()',v_table);
  end loop;
end;
$$;
create trigger commercial_connector_credential before insert or update
  on private.connector_credentials for each row
  execute function private.require_commercial_write();

create function private.enforce_trial_decision_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select status from public.organization_billing where org_id = new.org_id) = 'trial' then
    if jsonb_array_length(new.scenario_input) <> 1 or exists
      (select 1 from public.quote_decisions where org_id = new.org_id)
    then raise exception 'The trial includes one saved scenario'; end if;
  end if;
  return new;
end;
$$;
create trigger trial_decision_limit before insert on public.quote_decisions
  for each row execute function private.enforce_trial_decision_limit();
create function private.enforce_trial_report_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select status from public.organization_billing where org_id = new.org_id) = 'trial'
    and exists(select 1 from public.report_snapshots where org_id = new.org_id)
  then raise exception 'The trial includes one frozen historical audit'; end if;
  return new;
end;
$$;
create trigger trial_report_limit before insert on public.report_snapshots
  for each row execute function private.enforce_trial_report_limit();

create function private.count_commercial_events()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_org uuid;v_count bigint;v_month date := date_trunc('month',now())::date;
begin
  for v_org,v_count in select org_id,count(*) from new_rows group by org_id loop
    insert into public.org_event_usage(org_id,month_start,event_count)
      values(v_org,v_month,v_count)
      on conflict(org_id,month_start) do update set
        event_count = public.org_event_usage.event_count + excluded.event_count
      where public.org_event_usage.event_count + excluded.event_count <= 2000000;
    if not found then raise exception 'Monthly event limit reached; upgrade or retry next month'; end if;
  end loop;
  return null;
end;
$$;
create trigger count_usage_events after insert on public.usage_events
  referencing new table as new_rows for each statement execute function private.count_commercial_events();
create trigger count_outcome_events after insert on public.outcome_events
  referencing new table as new_rows for each statement execute function private.count_commercial_events();
create trigger count_direct_cost_events after insert on public.direct_cost_events
  referencing new table as new_rows for each statement execute function private.count_commercial_events();

create table public.billing_webhook_events (
  stripe_event_id text primary key,
  org_id uuid references public.organizations(id) on delete set null,
  event_type text not null,
  event_created bigint not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz not null default now()
);
alter table public.billing_webhook_events enable row level security;
create policy billing_webhook_events_read on public.billing_webhook_events for select to authenticated
  using (org_id is not null and private.can_read_org(org_id));
revoke all on public.billing_webhook_events from anon;
grant select on public.billing_webhook_events to authenticated;
grant select,insert,update,delete on public.billing_webhook_events to service_role;

create function public.phase4_apply_billing_event(p_org uuid,p_event_id text,
  p_type text,p_created bigint,p_customer text,p_subscription text,
  p_price text,p_interval text,p_status text,p_period_end timestamptz,
  p_cancel_at_period_end boolean,p_invoice_status text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_current public.organization_billing%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if p_event_id !~ '^evt_[a-zA-Z0-9]+$' or length(p_event_id) > 100
    or p_type is null or length(p_type) > 100
    or p_customer !~ '^cus_[a-zA-Z0-9]+$'
    or p_status not in ('active','past_due','canceled','incomplete','unpaid','paused')
    or p_interval not in ('month','year')
  then raise exception 'Invalid billing event'; end if;
  select * into v_current from public.organization_billing where org_id = p_org for update;
  if v_current.org_id is null then raise exception 'Organization billing not found'; end if;
  if v_current.stripe_customer_id is not null and v_current.stripe_customer_id <> p_customer
  then raise exception 'Billing customer mismatch'; end if;
  insert into public.billing_webhook_events(stripe_event_id,org_id,event_type,event_created)
    values(p_event_id,p_org,p_type,p_created) on conflict do nothing;
  if not found then return false; end if;
  if p_created >= v_current.last_event_created then
    update public.organization_billing set stripe_customer_id = p_customer,
      stripe_subscription_id = p_subscription,stripe_price_id = p_price,
      plan_interval = p_interval,status = p_status,current_period_end = p_period_end,
      cancel_at_period_end = coalesce(p_cancel_at_period_end,false),
      last_invoice_status = p_invoice_status,last_event_created = p_created,
      last_event_id = p_event_id,
      billing_ended_at = case when p_status = 'canceled'
        then coalesce(billing_ended_at,now()) else null end,
      billing_purge_at = case when p_status = 'canceled'
        then coalesce(billing_purge_at,now()+interval '29 days') else null end,
      updated_at = now()
      where org_id = p_org;
    return true;
  end if;
  return false;
end;
$$;
revoke all on function public.organization_entitlement(uuid),
  public.phase4_apply_billing_event(uuid,text,text,bigint,text,text,text,text,text,timestamptz,boolean,text)
  from public;
grant execute on function public.organization_entitlement(uuid) to authenticated;
grant execute on function public.phase4_apply_billing_event(uuid,text,text,bigint,text,text,text,text,text,timestamptz,boolean,text)
  to service_role;
