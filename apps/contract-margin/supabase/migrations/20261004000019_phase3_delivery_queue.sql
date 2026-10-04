create table public.margin_monitor_state (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  next_due_at timestamptz not null default now(),
  lease_until timestamptz,
  last_started_at timestamptz,
  last_success_at timestamptz,
  last_error text
);
create index margin_monitor_due on public.margin_monitor_state(next_due_at,lease_until);
alter table public.margin_monitor_state enable row level security;
create policy margin_monitor_state_read on public.margin_monitor_state for select to authenticated
  using (private.can_read_org(org_id));
revoke all on public.margin_monitor_state from anon;
grant select on public.margin_monitor_state to authenticated;
grant select,insert,update,delete on public.margin_monitor_state to service_role;

create function public.phase3_claim_monitor()
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_org uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  insert into public.margin_monitor_state(org_id)
    select o.id from public.organizations o where o.deletion_requested_at is null
    on conflict (org_id) do nothing;
  select m.org_id into v_org from public.margin_monitor_state m
    join public.organizations o on o.id = m.org_id and o.deletion_requested_at is null
    where m.next_due_at <= now() and (m.lease_until is null or m.lease_until < now())
    order by m.next_due_at,m.org_id for update of m skip locked limit 1;
  if v_org is not null then
    update public.margin_monitor_state set lease_until = now() + interval '3 minutes',
      last_started_at = now() where org_id = v_org;
  end if;
  return v_org;
end;
$$;

create function public.phase3_finish_monitor(p_org uuid,p_error text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  update public.margin_monitor_state set lease_until = null,
    next_due_at = now() + case when p_error is null then interval '1 hour' else interval '5 minutes' end,
    last_success_at = case when p_error is null then now() else last_success_at end,
    last_error = left(p_error,300) where org_id = p_org;
end;
$$;

create function public.phase3_claim_alert_delivery()
returns table(delivery_id bigint,org_id uuid,issue_id uuid,event_id bigint,recipient_user_id uuid)
language plpgsql security definer set search_path = '' as $$
declare v_id bigint;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  select d.id into v_id from public.margin_alert_deliveries d
    join public.organizations o on o.id = d.org_id and o.deletion_requested_at is null
    where d.due_at <= now() and d.attempts < 5 and
      (d.status = 'queued' or (d.status = 'sending' and d.lease_until < now()))
    order by d.due_at,d.id for update of d skip locked limit 1;
  if v_id is null then return; end if;
  update public.margin_alert_deliveries d set status = 'sending',
    lease_until = now() + interval '3 minutes',attempts = attempts + 1
    where d.id = v_id;
  return query select d.id,d.org_id,d.issue_id,d.event_id,d.recipient_user_id
    from public.margin_alert_deliveries d where d.id = v_id;
end;
$$;

create function public.phase3_finish_alert_delivery(p_id bigint,p_provider_id text,
  p_error text default null,p_defer_until timestamptz default null,p_skip boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  update public.margin_alert_deliveries set
    status = case when p_skip then 'skipped'
      when p_defer_until is not null then 'queued'
      when p_provider_id is not null then 'sent'
      when attempts >= 5 then 'failed' else 'queued' end,
    lease_until = null,provider_message_id = p_provider_id,
    sent_at = case when p_provider_id is not null then now() else null end,
    last_error = left(p_error,300),
    due_at = case when p_defer_until is not null then p_defer_until
      else now() + make_interval(mins => least(60, attempts * attempts * 5)) end,
    attempts = case when p_defer_until is not null then greatest(0,attempts - 1) else attempts end
    where id = p_id and status = 'sending';
end;
$$;

create function public.phase3_claim_digest()
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  select d.id into v_id from public.executive_digests d
    join public.organizations o on o.id = d.org_id and o.deletion_requested_at is null
    where d.due_at <= now() and d.attempts < 5 and
      (d.status = 'queued' or (d.status = 'sending' and d.lease_until < now()))
    order by d.due_at,d.id for update of d skip locked limit 1;
  if v_id is null then return null; end if;
  update public.executive_digests set status = 'sending',
    lease_until = now() + interval '3 minutes',attempts = attempts + 1 where id = v_id;
  return v_id;
end;
$$;

create function public.phase3_finish_digest(p_id uuid,p_provider_id text,p_error text default null,
  p_skip boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  update public.executive_digests set
    status = case when p_skip then 'skipped'
      when p_provider_id is not null then 'sent'
      when attempts >= 5 then 'failed' else 'queued' end,
    lease_until = null,provider_message_id = p_provider_id,
    sent_at = case when p_provider_id is not null then now() else null end,
    last_error = left(p_error,300),
    due_at = now() + make_interval(mins => least(60, attempts * attempts * 5))
    where id = p_id and status = 'sending';
end;
$$;

revoke all on function public.phase3_claim_monitor(),public.phase3_finish_monitor(uuid,text),
  public.phase3_claim_alert_delivery(),
  public.phase3_finish_alert_delivery(bigint,text,text,timestamptz,boolean),
  public.phase3_claim_digest(),public.phase3_finish_digest(uuid,text,text,boolean) from public;
grant execute on function public.phase3_claim_monitor(),public.phase3_finish_monitor(uuid,text),
  public.phase3_claim_alert_delivery(),
  public.phase3_finish_alert_delivery(bigint,text,text,timestamptz,boolean),
  public.phase3_claim_digest(),public.phase3_finish_digest(uuid,text,text,boolean) to service_role;
