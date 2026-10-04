create function public.save_provider_connection(p_org uuid, p_provider text, p_secret text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_existing uuid;
begin
  if p_provider not in ('openai','anthropic','stripe') then raise exception 'Unsupported provider'; end if;
  if (p_provider = 'stripe' and not private.can_edit_finance(p_org))
    or (p_provider <> 'stripe' and not private.can_edit_engineering(p_org))
  then raise exception 'Role and MFA required'; end if;
  if length(p_secret) not between 16 and 8192 then raise exception 'Invalid credential'; end if;
  perform 1 from public.organizations where id = p_org for update;
  select vault_secret_id into v_existing from private.connector_credentials
    where org_id = p_org and provider = p_provider for update;
  if v_existing is null then
    insert into private.connector_credentials(org_id,provider,vault_secret_id)
      values (p_org,p_provider,vault.create_secret(p_secret))
      on conflict (org_id,provider) do update set
        vault_secret_id = excluded.vault_secret_id, updated_at = now();
  else
    perform vault.update_secret(v_existing,p_secret);
    update private.connector_credentials set updated_at = now()
      where org_id = p_org and provider = p_provider;
  end if;
  insert into public.provider_connections(org_id,provider,connected_by,disconnected_at,last_error)
    values (p_org,p_provider,auth.uid(),null,null)
    on conflict (org_id,provider) do update set connected_at = now(),
      connected_by = excluded.connected_by, disconnected_at = null, last_error = null;
end;
$$;

create function public.remove_provider_connection(p_org uuid, p_provider text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_secret uuid;
begin
  if p_provider not in ('openai','anthropic','stripe') then raise exception 'Unsupported provider'; end if;
  if (p_provider = 'stripe' and not private.can_edit_finance(p_org))
    or (p_provider <> 'stripe' and not private.can_edit_engineering(p_org))
  then raise exception 'Role and MFA required'; end if;
  delete from private.connector_credentials where org_id = p_org and provider = p_provider
    returning vault_secret_id into v_secret;
  if v_secret is not null then delete from vault.secrets where id = v_secret; end if;
  update public.provider_connections set disconnected_at = now(),
    last_error = 'Disconnected by customer' where org_id = p_org and provider = p_provider;
  update public.connector_jobs set status = 'failed', last_error = 'Connection removed'
    where org_id = p_org and provider = p_provider and status in ('queued','running');
end;
$$;

create function public.queue_connector_day(p_org uuid, p_provider text, p_day date,
  p_force boolean default false) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_job public.connector_jobs%rowtype;
begin
  if p_provider not in ('openai','anthropic','stripe')
    or (p_provider = 'stripe' and p_day is not null)
    or (p_provider <> 'stripe' and (p_day is null or p_day > current_date or p_day < current_date - 93))
  then raise exception 'Invalid provider or sync day'; end if;
  if auth.role() <> 'service_role' then
    if (p_provider = 'stripe' and not private.can_edit_finance(p_org))
      or (p_provider <> 'stripe' and not private.can_edit_engineering(p_org))
    then raise exception 'Role and MFA required'; end if;
  end if;
  perform 1 from public.provider_connections where org_id = p_org and provider = p_provider
    and disconnected_at is null for update;
  if not found then raise exception 'Connection is unavailable'; end if;
  select * into v_job from public.connector_jobs
    where org_id = p_org and provider = p_provider and day is not distinct from p_day for update;
  if v_job.id is not null then
    if v_job.status in ('queued','running') then return v_job.id; end if;
    if v_job.status = 'failed' and not p_force then return v_job.id; end if;
    if not p_force and v_job.status = 'completed' and v_job.requested_at::date = current_date
    then return v_job.id; end if;
    update public.connector_jobs set status = 'queued', attempts = 0, last_error = null,
      requested_at = now(), started_at = null, completed_at = null,
      requested_by = case when auth.role() = 'service_role' then null else auth.uid() end,
      stage = 'customers', cursor = null, rows_seen = 0 where id = v_job.id;
  else
    insert into public.connector_jobs(org_id,provider,day,requested_by)
      values (p_org,p_provider,p_day,
        case when auth.role() = 'service_role' then null else auth.uid() end)
      returning * into v_job;
  end if;
  perform pgmq.send('solvren_connectors',jsonb_build_object('job_id',v_job.id));
  return v_job.id;
end;
$$;

create function public.queue_connector_backfill(p_org uuid, p_provider text, p_days integer default 30)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_day date; v_count integer := 0;
begin
  if p_days not between 1 and 31 then raise exception 'Backfill must be 1 to 31 days'; end if;
  if p_provider = 'stripe' then
    perform public.queue_connector_day(p_org,p_provider,null,true);
    return 1;
  end if;
  for v_day in select generate_series(current_date - p_days,current_date - 1,interval '1 day')::date loop
    perform public.queue_connector_day(p_org,p_provider,v_day,true);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create function public.schedule_connector_refreshes() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_connection record; v_day date; v_count integer := 0;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  for v_connection in select org_id,provider from public.provider_connections
    where disconnected_at is null loop
    if v_connection.provider = 'stripe' then
      perform public.queue_connector_day(v_connection.org_id,'stripe',null,false);
      v_count := v_count + 1;
    else
      for v_day in select generate_series(current_date - 3,current_date - 1,interval '1 day')::date loop
        perform public.queue_connector_day(v_connection.org_id,v_connection.provider,v_day,false);
        v_count := v_count + 1;
      end loop;
    end if;
  end loop;
  return v_count;
end;
$$;

create function public.claim_connector_job()
returns table(message_id bigint,read_count bigint,job_id uuid)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  return query select m.msg_id,m.read_ct,(m.message->>'job_id')::uuid
    from pgmq.read('solvren_connectors',180,1) m;
end;
$$;

create function public.complete_provider_cost_day(p_message bigint,p_job uuid,p_rows jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare v_job public.connector_jobs%rowtype; v_row jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  select * into v_job from public.connector_jobs where id = p_job for update;
  if v_job.id is null or v_job.provider not in ('openai','anthropic')
    or v_job.status not in ('queued','running') then raise exception 'Cost job unavailable'; end if;
  if not exists (select 1 from public.provider_connections where org_id = v_job.org_id
    and provider = v_job.provider and disconnected_at is null) then raise exception 'Connection removed'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 10000
  then raise exception 'Invalid provider cost result'; end if;
  if not exists (select 1 from pgmq.q_solvren_connectors q
    where q.msg_id = p_message and q.message->>'job_id' = p_job::text)
  then raise exception 'Message does not match cost job'; end if;
  delete from public.provider_cost_buckets where org_id = v_job.org_id
    and provider = v_job.provider and day = v_job.day;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if length(v_row->>'scopeId') > 200 or length(v_row->>'lineItem') > 200
    then raise exception 'Invalid provider bucket'; end if;
    insert into public.provider_cost_buckets(org_id,provider,day,scope_id,line_item,amount_usd)
      values (v_job.org_id,v_job.provider,v_job.day,
        coalesce(v_row->>'scopeId',''),coalesce(v_row->>'lineItem',''),
        (v_row->>'amountUsd')::numeric);
  end loop;
  insert into public.provider_cost_days(org_id,provider,day,synced_at)
    values (v_job.org_id,v_job.provider,v_job.day,now())
    on conflict (org_id,provider,day) do update set synced_at = now();
  if not pgmq.archive('solvren_connectors',p_message) then raise exception 'Could not archive cost job'; end if;
  update public.connector_jobs set status = 'completed', completed_at = now(),
    last_error = null, attempts = attempts + 1 where id = p_job;
  update public.provider_connections set last_attempt_at = now(),last_success_at = now(),
    last_error = null,synced_through = greatest(synced_through,v_job.day)
    where org_id = v_job.org_id and provider = v_job.provider;
end;
$$;

create function public.checkpoint_stripe_job(p_message bigint,p_job uuid,p_stage text,
  p_cursor text,p_count integer) returns void
language plpgsql security definer set search_path = '' as $$
declare v_job public.connector_jobs%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  select * into v_job from public.connector_jobs where id = p_job for update;
  if v_job.id is null or v_job.provider <> 'stripe' or v_job.status not in ('queued','running')
    or p_stage not in ('customers','subscriptions','invoices','complete')
    or p_count not between 0 and 100 then raise exception 'Invalid Stripe checkpoint'; end if;
  if not exists (select 1 from pgmq.q_solvren_connectors q
    where q.msg_id = p_message and q.message->>'job_id' = p_job::text)
  then raise exception 'Message does not match Stripe job'; end if;
  if not exists (select 1 from public.provider_connections where org_id = v_job.org_id
    and provider = 'stripe' and disconnected_at is null) then raise exception 'Connection removed'; end if;
  if not pgmq.archive('solvren_connectors',p_message) then raise exception 'Could not archive Stripe page'; end if;
  if p_stage = 'complete' then
    delete from public.stripe_invoices where org_id = v_job.org_id and last_seen_job is distinct from p_job;
    delete from public.stripe_subscriptions where org_id = v_job.org_id and last_seen_job is distinct from p_job;
    delete from public.stripe_customers where org_id = v_job.org_id and last_seen_job is distinct from p_job;
    update public.connector_jobs set status = 'completed',completed_at = now(),
      stage = p_stage,cursor = null,rows_seen = rows_seen + p_count,last_error = null where id = p_job;
    update public.provider_connections set last_attempt_at = now(),last_success_at = now(),
      last_error = null,synced_through = current_date - 1
      where org_id = v_job.org_id and provider = 'stripe';
  else
    update public.connector_jobs set status = 'running',stage = p_stage,cursor = p_cursor,
      rows_seen = rows_seen + p_count,last_error = null where id = p_job;
    perform pgmq.send('solvren_connectors',jsonb_build_object('job_id',p_job));
  end if;
end;
$$;

create function public.fail_connector_job(p_message bigint,p_job uuid,p_error text,p_read_count bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare v_job public.connector_jobs%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  select * into v_job from public.connector_jobs where id = p_job for update;
  if v_job.id is null then raise exception 'Connector job not found'; end if;
  if not exists (select 1 from pgmq.q_solvren_connectors q
    where q.msg_id = p_message and q.message->>'job_id' = p_job::text)
  then raise exception 'Message does not match connector job'; end if;
  if p_read_count >= 5 or v_job.status = 'failed' then
    if not pgmq.archive('solvren_connectors',p_message) then raise exception 'Could not archive failed job'; end if;
    update public.connector_jobs set status = 'failed',attempts = attempts + 1,
      last_error = left(coalesce(p_error,'Sync failed'),300) where id = p_job;
  else
    update public.connector_jobs set status = 'running',attempts = attempts + 1,
      last_error = 'Retrying after a source error' where id = p_job;
  end if;
  update public.provider_connections set last_attempt_at = now(),
    last_error = left(coalesce(p_error,'Sync failed'),300)
    where org_id = v_job.org_id and provider = v_job.provider and disconnected_at is null;
end;
$$;

create function public.stage_stripe_customer_refs(p_org uuid,p_job uuid,p_customer_ids text[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if p_customer_ids is null or cardinality(p_customer_ids) > 100
    or exists (select 1 from unnest(p_customer_ids) id where id is null or length(id) not between 1 and 200)
  then raise exception 'Invalid Stripe customer references'; end if;
  if not exists (select 1 from public.connector_jobs where id = p_job and org_id = p_org
    and provider = 'stripe' and status in ('queued','running'))
  then raise exception 'Stripe job unavailable'; end if;
  insert into public.stripe_customers(org_id,stripe_customer_id,last_seen_job)
    select p_org,id,p_job from unnest(p_customer_ids) id
    on conflict (org_id,stripe_customer_id) do update set
      last_seen_job = excluded.last_seen_job;
end;
$$;

revoke all on function public.save_provider_connection(uuid,text,text),
  public.remove_provider_connection(uuid,text), public.queue_connector_day(uuid,text,date,boolean),
  public.queue_connector_backfill(uuid,text,integer), public.schedule_connector_refreshes(),
  public.claim_connector_job(),public.complete_provider_cost_day(bigint,uuid,jsonb),
  public.checkpoint_stripe_job(bigint,uuid,text,text,integer),
  public.fail_connector_job(bigint,uuid,text,bigint),
  public.stage_stripe_customer_refs(uuid,uuid,text[]) from public;
grant execute on function public.save_provider_connection(uuid,text,text),
  public.remove_provider_connection(uuid,text),public.queue_connector_day(uuid,text,date,boolean),
  public.queue_connector_backfill(uuid,text,integer) to authenticated;
grant execute on function public.queue_connector_day(uuid,text,date,boolean),
  public.schedule_connector_refreshes(),public.claim_connector_job(),
  public.complete_provider_cost_day(bigint,uuid,jsonb),
  public.checkpoint_stripe_job(bigint,uuid,text,text,integer),
  public.fail_connector_job(bigint,uuid,text,bigint),
  public.stage_stripe_customer_refs(uuid,uuid,text[]) to service_role;
