create table public.lifecycle_deliveries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete cascade,
  event_key text not null unique check (length(event_key) between 5 and 200),
  template text not null check (template in
    ('source_failure','first_report','trial_expiring','trial_expired',
      'billing_failure','cancellation','support_case')),
  recipient_email text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued','sending','sent','failed','skipped')),
  attempts integer not null default 0,
  due_at timestamptz not null default now(),
  lease_until timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now()
);
create index lifecycle_deliveries_due on public.lifecycle_deliveries(status,due_at);
alter table public.lifecycle_deliveries enable row level security;
create policy lifecycle_deliveries_owner_read on public.lifecycle_deliveries for select to authenticated
  using (org_id is not null and private.is_owner(org_id));
revoke all on public.lifecycle_deliveries from anon;
grant select on public.lifecycle_deliveries to authenticated;
grant select,insert,update,delete on public.lifecycle_deliveries to service_role;

create function private.queue_owner_lifecycle(p_org uuid,p_template text,p_key text,
  p_payload jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_email text;
begin
  select u.email into v_email from public.organization_members m
    join auth.users u on u.id = m.user_id
    where m.org_id = p_org and m.role = 'owner' and u.email_confirmed_at is not null;
  if v_email is null then return; end if;
  insert into public.lifecycle_deliveries(org_id,event_key,template,recipient_email,payload)
    values(p_org,p_key,p_template,v_email,coalesce(p_payload,'{}'::jsonb))
    on conflict(event_key) do nothing;
end;
$$;
create function private.queue_source_failure()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'failed' and old.status is distinct from 'failed' then
    perform private.queue_owner_lifecycle(new.org_id,'source_failure',
      tg_table_name || ':' || new.id::text,
      jsonb_build_object('source',case when tg_table_name = 'connector_jobs'
        then to_jsonb(new)->>'provider' else to_jsonb(new)->>'kind' end,
        'sourceType',tg_table_name));
  end if;
  return null;
end;
$$;
create trigger source_failure_import after update of status on public.import_jobs
  for each row execute function private.queue_source_failure();
create trigger source_failure_connector after update of status on public.connector_jobs
  for each row execute function private.queue_source_failure();
create function private.queue_first_report()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'frozen' and old.status <> 'frozen'
    and not exists(select 1 from public.report_snapshots
      where org_id = new.org_id and id <> new.id and status = 'frozen') then
    perform private.queue_owner_lifecycle(new.org_id,'first_report',
      'first-report:' || new.org_id::text,
      jsonb_build_object('reportId',new.id));
  end if;
  return null;
end;
$$;
create trigger first_report_ready after update of status on public.report_snapshots
  for each row execute function private.queue_first_report();
create function private.queue_billing_lifecycle()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = old.status then return null; end if;
  if new.status in ('past_due','unpaid') then
    perform private.queue_owner_lifecycle(new.org_id,'billing_failure',
      'billing-failure:' || coalesce(new.last_event_id,new.org_id::text),'{}'::jsonb);
  elsif new.status = 'canceled' then
    perform private.queue_owner_lifecycle(new.org_id,'cancellation',
      'cancellation:' || coalesce(new.last_event_id,new.org_id::text),'{}'::jsonb);
  end if;
  return null;
end;
$$;
create trigger billing_lifecycle after update of status on public.organization_billing
  for each row execute function private.queue_billing_lifecycle();
create function private.queue_support_receipt()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.lifecycle_deliveries(org_id,event_key,template,recipient_email,payload)
    values(new.org_id,'support-case:' || new.id::text,'support_case',new.email,
      jsonb_build_object('caseId','SV-' || lpad(new.case_number::text,6,'0'),
        'expectedResponseAt',new.expected_response_at));
  return null;
end;
$$;
create trigger support_receipt after insert on public.support_tickets
  for each row execute function private.queue_support_receipt();

create function public.phase4_queue_trial_notices()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_row record;v_count integer := 0;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  for v_row in select org_id,trial_ends_at from public.organization_billing b
    join public.organizations o on o.id = b.org_id
    where b.status = 'trial' and o.deletion_requested_at is null
      and b.trial_ends_at <= now()+interval '24 hours' loop
    if v_row.trial_ends_at > now() then
      perform private.queue_owner_lifecycle(v_row.org_id,'trial_expiring',
        'trial-expiring:' || v_row.org_id::text,
        jsonb_build_object('trialEndsAt',v_row.trial_ends_at));
    else
      perform private.queue_owner_lifecycle(v_row.org_id,'trial_expired',
        'trial-expired:' || v_row.org_id::text,'{}'::jsonb);
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;
create function public.phase4_claim_lifecycle()
returns table(delivery_id uuid,org_id uuid,template text,recipient_email text,payload jsonb)
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  select d.id into v_id from public.lifecycle_deliveries d
    left join public.organizations o on o.id = d.org_id
    where d.due_at <= now() and d.attempts < 5
      and (d.org_id is null or o.deletion_requested_at is null)
      and (d.status = 'queued' or (d.status = 'sending' and d.lease_until < now()))
    order by d.due_at,d.created_at for update of d skip locked limit 1;
  if v_id is null then return; end if;
  update public.lifecycle_deliveries set status = 'sending',attempts = attempts+1,
    lease_until = now()+interval '3 minutes' where id = v_id;
  return query select d.id,d.org_id,d.template,d.recipient_email,d.payload
    from public.lifecycle_deliveries d where d.id = v_id;
end;
$$;
create function public.phase4_finish_lifecycle(p_id uuid,p_provider_id text,
  p_error text default null,p_skip boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  update public.lifecycle_deliveries set status = case when p_skip then 'skipped'
    when p_provider_id is not null then 'sent'
    when attempts >= 5 then 'failed' else 'queued' end,
    provider_message_id = p_provider_id,last_error = left(p_error,300),
    sent_at = case when p_provider_id is not null then now() else null end,
    lease_until = null,due_at = now()+make_interval(mins => least(60,attempts*attempts*5))
    where id = p_id and status = 'sending';
end;
$$;
revoke all on function public.phase4_queue_trial_notices(),
  public.phase4_claim_lifecycle(),public.phase4_finish_lifecycle(uuid,text,text,boolean)
  from public;
grant execute on function public.phase4_queue_trial_notices(),
  public.phase4_claim_lifecycle(),public.phase4_finish_lifecycle(uuid,text,text,boolean)
  to service_role;
