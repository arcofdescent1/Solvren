alter table public.organization_billing
  add column last_refund_at timestamptz,
  add column last_refund_amount_cents bigint,
  add column last_refund_charge_id text;

create table private.billing_checkout_claims (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  interval text not null check (interval in ('month','year')),
  claim_id uuid not null,
  expires_at timestamptz not null,
  session_id text,
  session_url text
);
revoke all on private.billing_checkout_claims from public,anon,authenticated;
grant select,insert,update,delete on private.billing_checkout_claims to service_role;
create function public.phase4_claim_checkout(p_org uuid,p_interval text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_row private.billing_checkout_claims%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if p_interval not in ('month','year') then raise exception 'Invalid billing interval'; end if;
  perform 1 from public.organization_billing where org_id = p_org for update;
  if not found then raise exception 'Billing record missing'; end if;
  select * into v_row from private.billing_checkout_claims where org_id = p_org for update;
  if v_row.org_id is not null and v_row.expires_at > now() then
    if v_row.interval <> p_interval then
      raise exception 'A checkout is already open. Please retry in 31 minutes';
    end if;
    return jsonb_build_object('id',v_row.claim_id,'expiresAt',
      extract(epoch from v_row.expires_at)::bigint,'url',v_row.session_url);
  end if;
  insert into private.billing_checkout_claims(org_id,interval,claim_id,expires_at)
    values(p_org,p_interval,gen_random_uuid(),now()+interval '31 minutes')
    on conflict(org_id) do update set interval = excluded.interval,
      claim_id = excluded.claim_id,expires_at = excluded.expires_at,
      session_id = null,session_url = null
    returning claim_id into v_row.claim_id;
  select * into v_row from private.billing_checkout_claims where org_id = p_org;
  return jsonb_build_object('id',v_row.claim_id,'expiresAt',
    extract(epoch from v_row.expires_at)::bigint,'url',null);
end;
$$;
create function public.phase4_save_checkout(p_org uuid,p_claim uuid,p_session text,p_url text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if p_session !~ '^cs_[a-zA-Z0-9_]+$' or p_url !~ '^https://checkout[.]stripe[.]com/'
  then raise exception 'Invalid checkout session'; end if;
  update private.billing_checkout_claims set session_id = p_session,session_url = p_url
    where org_id = p_org and claim_id = p_claim and expires_at > now();
  if not found then raise exception 'Checkout claim expired'; end if;
end;
$$;
revoke all on function public.phase4_claim_checkout(uuid,text) from public;
grant execute on function public.phase4_claim_checkout(uuid,text) to service_role;
revoke all on function public.phase4_save_checkout(uuid,uuid,text,text) from public;
grant execute on function public.phase4_save_checkout(uuid,uuid,text,text) to service_role;

create function public.phase4_record_refund(p_org uuid,p_event_id text,p_created bigint,
  p_customer text,p_charge text,p_amount bigint)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_current public.organization_billing%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if p_event_id !~ '^evt_[a-zA-Z0-9]+$' or p_charge !~ '^ch_[a-zA-Z0-9]+$'
    or p_customer !~ '^cus_[a-zA-Z0-9]+$' or p_amount <= 0
  then raise exception 'Invalid refund event'; end if;
  select * into v_current from public.organization_billing where org_id = p_org for update;
  if v_current.org_id is null or v_current.stripe_customer_id <> p_customer
  then raise exception 'Refund customer mismatch'; end if;
  insert into public.billing_webhook_events(stripe_event_id,org_id,event_type,event_created)
    values(p_event_id,p_org,'charge.refunded',p_created) on conflict do nothing;
  if not found then return false; end if;
  update public.organization_billing set last_refund_at = to_timestamp(p_created),
    last_refund_amount_cents = p_amount,last_refund_charge_id = p_charge,
    updated_at = now() where org_id = p_org;
  perform private.append_audit(p_org,null,'billing_refund',p_charge,
    jsonb_build_object('amountCents',p_amount,'eventId',p_event_id));
  return true;
end;
$$;
revoke all on function public.phase4_record_refund(uuid,text,bigint,text,text,bigint) from public;
grant execute on function public.phase4_record_refund(uuid,text,bigint,text,text,bigint)
  to service_role;

create function public.phase4_set_support_status(p_grant uuid,p_ticket uuid,p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_ticket public.support_tickets%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if p_status not in ('open','in_progress','waiting','resolved')
  then raise exception 'Invalid case status'; end if;
  select * into v_ticket from public.support_tickets where id = p_ticket for update;
  if v_ticket.id is null then raise exception 'Case not found'; end if;
  perform public.phase4_operator_activity(p_grant,'support_case_status',v_ticket.org_id,
    p_ticket::text,jsonb_build_object('from',v_ticket.status,'to',p_status));
  update public.support_tickets set status = p_status,
    resolved_at = case when p_status = 'resolved' then now() else null end,
    updated_at = now() where id = p_ticket;
end;
$$;
create function public.phase4_create_incident(p_grant uuid,p_title text,p_summary text,
  p_severity text,p_published boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  insert into public.status_incidents(title,summary,severity,published,state,started_at)
    values(p_title,p_summary,p_severity,p_published,'investigating',now()) returning id into v_id;
  perform public.phase4_operator_activity(p_grant,'incident_created',null,v_id::text,
    jsonb_build_object('severity',p_severity,'published',p_published));
  return v_id;
end;
$$;
create function public.phase4_set_incident_status(p_grant uuid,p_incident uuid,p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_incident public.status_incidents%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if p_status not in ('investigating','identified','monitoring','resolved')
  then raise exception 'Invalid incident state'; end if;
  select * into v_incident from public.status_incidents where id = p_incident for update;
  if v_incident.id is null then raise exception 'Incident not found'; end if;
  perform public.phase4_operator_activity(p_grant,'incident_state',null,p_incident::text,
    jsonb_build_object('from',v_incident.state,'to',p_status));
  update public.status_incidents set state = p_status,
    resolved_at = case when p_status = 'resolved' then now() else null end,
    updated_at = now() where id = p_incident;
end;
$$;
revoke all on function public.phase4_set_support_status(uuid,uuid,text),
  public.phase4_create_incident(uuid,text,text,text,boolean),
  public.phase4_set_incident_status(uuid,uuid,text) from public;
grant execute on function public.phase4_set_support_status(uuid,uuid,text),
  public.phase4_create_incident(uuid,text,text,text,boolean),
  public.phase4_set_incident_status(uuid,uuid,text) to service_role;

create function public.phase4_retry_lifecycle(p_grant uuid,p_delivery uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_delivery public.lifecycle_deliveries%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  select * into v_delivery from public.lifecycle_deliveries where id = p_delivery for update;
  if v_delivery.id is null or v_delivery.status <> 'failed'
  then raise exception 'Failed delivery not found'; end if;
  perform public.phase4_operator_activity(p_grant,'lifecycle_retry',v_delivery.org_id,
    p_delivery::text,'{}'::jsonb);
  update public.lifecycle_deliveries set status = 'queued',attempts = 0,due_at = now(),
    last_error = null where id = p_delivery;
end;
$$;
revoke all on function public.phase4_retry_lifecycle(uuid,uuid) from public;
grant execute on function public.phase4_retry_lifecycle(uuid,uuid) to service_role;

create function public.phase4_funnel_summary()
returns table(event_name text,event_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  return query select e.event_name,count(*) from public.product_events e
    where e.occurred_at >= now()-interval '90 days' group by e.event_name;
end;
$$;
revoke all on function public.phase4_funnel_summary() from public;
grant execute on function public.phase4_funnel_summary() to service_role;

create function private.record_paid_retention()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.event_type in ('invoice.paid','invoice.payment_succeeded') and
    exists(select 1 from public.organization_billing where org_id = new.org_id
      and status = 'active') and exists(
        select 1 from public.product_events where org_id = new.org_id
          and event_name = 'paid' and occurred_at < to_timestamp(new.event_created)-interval '25 days') then
    perform private.record_conversion('paid-retained:' || new.org_id::text || ':' ||
      to_char(to_timestamp(new.event_created),'YYYY-MM'),'paid_retained',new.org_id,null);
  end if;
  return null;
end;
$$;
create trigger conversion_paid_retained after insert on public.billing_webhook_events
  for each row execute function private.record_paid_retention();

alter table public.lifecycle_deliveries drop constraint lifecycle_deliveries_template_check;
alter table public.lifecycle_deliveries add constraint lifecycle_deliveries_template_check
  check (template in ('source_failure','first_report','trial_expiring','trial_expired',
    'billing_failure','cancellation','support_case','incident'));
create function private.queue_incident_notice()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  if not new.published or (tg_op = 'UPDATE' and old.published
    and old.state = new.state) then return null; end if;
  for v_org in select distinct m.org_id from public.organization_members m
    join public.organizations o on o.id = m.org_id
    where m.role = 'owner' and o.deletion_requested_at is null loop
    perform private.queue_owner_lifecycle(v_org,'incident',
      'incident:' || new.id::text || ':' || new.state,
      jsonb_build_object('state',new.state,'incidentId',new.id));
  end loop;
  return null;
end;
$$;
create trigger incident_notice after insert or update of state,published
  on public.status_incidents for each row execute function private.queue_incident_notice();
