alter table private.connector_credentials drop constraint connector_credentials_provider_check;
alter table private.connector_credentials add constraint connector_credentials_provider_check
  check (provider in ('openai', 'anthropic', 'langfuse', 'stripe',
    'langfuse_openai', 'langfuse_anthropic'));

create function public.store_langfuse_connection(
  p_org uuid, p_provider text, p_public_key text, p_secret_key text, p_region text
) returns void language plpgsql security definer set search_path = '' as $$
declare v_existing uuid; v_value text;
begin
  if not private.can_edit_engineering(p_org) then raise exception 'Engineer access with MFA required'; end if;
  if p_provider not in ('openai', 'anthropic') or p_region not in ('us', 'eu', 'jp', 'hipaa_us')
  then raise exception 'Unsupported Langfuse connection'; end if;
  if length(p_public_key) not between 8 and 500 or length(p_secret_key) not between 8 and 500
  then raise exception 'Valid Langfuse keys are required'; end if;
  v_value := jsonb_build_object('publicKey', p_public_key, 'secretKey', p_secret_key,
    'region', p_region)::text;
  select vault_secret_id into v_existing from private.connector_credentials
    where org_id = p_org and provider = 'langfuse_' || p_provider for update;
  if v_existing is null then
    insert into private.connector_credentials(org_id, provider, vault_secret_id)
    values (p_org, 'langfuse_' || p_provider, vault.create_secret(v_value));
  else
    perform vault.update_secret(v_existing, v_value);
    update private.connector_credentials set updated_at = now()
      where org_id = p_org and provider = 'langfuse_' || p_provider;
  end if;
end;
$$;

create function public.disconnect_langfuse_connection(p_org uuid, p_provider text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_secret uuid;
begin
  if not private.can_edit_engineering(p_org) then raise exception 'Engineer access with MFA required'; end if;
  if p_provider not in ('openai', 'anthropic') then raise exception 'Unsupported provider'; end if;
  delete from private.connector_credentials
    where org_id = p_org and provider = 'langfuse_' || p_provider
    returning vault_secret_id into v_secret;
  if v_secret is not null then delete from vault.secrets where id = v_secret; end if;
end;
$$;

create function public.langfuse_connection_status(p_org uuid)
returns table (provider text, connected_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_read_org(p_org) then raise exception 'Organization access required'; end if;
  return query select replace(c.provider, 'langfuse_', ''), c.updated_at
    from private.connector_credentials c where c.org_id = p_org
      and c.provider in ('langfuse_openai', 'langfuse_anthropic');
end;
$$;

create function public.queue_langfuse_sync(p_org uuid, p_provider text,
  p_start timestamptz, p_end timestamptz) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_job uuid;
begin
  if not private.can_edit_engineering(p_org) then raise exception 'Engineer access with MFA required'; end if;
  if p_provider not in ('openai', 'anthropic') or p_start is null or p_end is null
    or p_end <= p_start or p_end > p_start + interval '31 days'
  then raise exception 'Choose a provider and a period up to 31 days'; end if;
  if not exists (select 1 from private.connector_credentials
    where org_id = p_org and provider = 'langfuse_' || p_provider)
  then raise exception 'Connect Langfuse first'; end if;
  if exists (select 1 from public.import_jobs where org_id = p_org
    and kind = 'langfuse' and source = 'langfuse_' || p_provider
    and status in ('queued','running','preparing'))
  then raise exception 'A Langfuse sync for this provider is already running'; end if;
  insert into public.import_jobs(org_id, kind, source, status, chunks_total, created_by, configuration)
    values (p_org, 'langfuse', 'langfuse_' || p_provider, 'queued', 1, auth.uid(),
      jsonb_build_object('from', p_start, 'to', p_end))
    returning id into v_job;
  perform pgmq.send('solvren_imports', jsonb_build_object('job_id', v_job));
  return v_job;
end;
$$;

create function public.complete_langfuse_page(
  p_message bigint, p_job uuid, p_next_cursor text, p_page_rows integer,
  p_rejected integer
) returns void language plpgsql security definer set search_path = '' as $$
declare v_job public.import_jobs%rowtype; v_imported integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  select * into v_job from public.import_jobs where id = p_job for update;
  if v_job.id is null or v_job.kind <> 'langfuse' then raise exception 'Langfuse job not found'; end if;
  if not exists (select 1 from pgmq.q_solvren_imports q
    where q.msg_id = p_message and q.message->>'job_id' = p_job::text)
  then raise exception 'Message does not match job'; end if;
  if p_page_rows not between 0 and 500 or p_rejected not between 0 and p_page_rows
  then raise exception 'Invalid page counts'; end if;
  if not pgmq.archive('solvren_imports', p_message) then raise exception 'Could not archive page'; end if;
  select count(*) into v_imported from public.usage_events where import_job_id = p_job;
  update public.import_jobs set total_rows = total_rows + p_page_rows,
    rejected_rows = rejected_rows + p_rejected,
    imported_rows = v_imported,
    duplicate_rows = greatest(0, total_rows + p_page_rows - rejected_rows - p_rejected - v_imported),
    chunks_done = chunks_done + 1,
    chunks_total = chunks_total + case when p_next_cursor is null then 0 else 1 end,
    status = case when p_next_cursor is null then 'completed' else 'running' end,
    configuration = case when p_next_cursor is null
      then configuration - 'cursor'
      else jsonb_set(configuration, '{cursor}', to_jsonb(p_next_cursor)) end,
    error_message = null, updated_at = now()
    where id = p_job;
  if p_next_cursor is not null then
    perform pgmq.send('solvren_imports', jsonb_build_object('job_id', p_job));
  end if;
end;
$$;

revoke all on function public.store_langfuse_connection(uuid,text,text,text,text),
  public.disconnect_langfuse_connection(uuid,text), public.langfuse_connection_status(uuid),
  public.queue_langfuse_sync(uuid,text,timestamptz,timestamptz),
  public.complete_langfuse_page(bigint,uuid,text,integer,integer) from public;
grant execute on function public.store_langfuse_connection(uuid,text,text,text,text),
  public.disconnect_langfuse_connection(uuid,text), public.langfuse_connection_status(uuid),
  public.queue_langfuse_sync(uuid,text,timestamptz,timestamptz) to authenticated;
grant execute on function public.complete_langfuse_page(bigint,uuid,text,integer,integer) to service_role;
