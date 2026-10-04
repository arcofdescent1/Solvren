create table public.import_chunk_objects (
  job_id uuid not null references public.import_jobs(id) on delete cascade,
  object_path text not null,
  processed_at timestamptz,
  deleted_at timestamptz,
  primary key (job_id, object_path)
);
alter table public.import_chunk_objects enable row level security;
revoke all on public.import_chunk_objects from public, anon, authenticated;
grant select, insert, update, delete on public.import_chunk_objects to service_role;

create function public.queue_import_chunks(p_job uuid, p_paths text[]) returns void
language plpgsql security definer set search_path = '' as $$
declare v_job public.import_jobs%rowtype; v_path text;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  select * into v_job from public.import_jobs where id = p_job for update;
  if v_job.id is null or v_job.status <> 'preparing' then raise exception 'Import is not preparing'; end if;
  if coalesce(array_length(p_paths, 1), 0) not between 1 and 100
  then raise exception 'Import requires 1 to 100 chunks'; end if;
  foreach v_path in array p_paths loop
    if v_path !~ ('^' || v_job.org_id::text || '/' || v_job.id::text || '/[0-9]+[.]json$')
    then raise exception 'Invalid import object path'; end if;
  end loop;
  update public.import_jobs set status = 'queued', chunks_total = array_length(p_paths, 1),
    updated_at = now() where id = p_job;
  foreach v_path in array p_paths loop
    insert into public.import_chunk_objects(job_id, object_path) values (p_job, v_path)
      on conflict (job_id, object_path) do nothing;
    perform pgmq.send('solvren_imports', jsonb_build_object('job_id', p_job, 'path', v_path));
  end loop;
end;
$$;

create function public.claim_import_chunk()
returns table (message_id bigint, read_count bigint, job_id uuid, object_path text)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  return query
    select m.msg_id, m.read_ct, (m.message->>'job_id')::uuid, m.message->>'path'
    from pgmq.read('solvren_imports', 180, 1) m;
end;
$$;

create function public.apply_import_chunk(p_job uuid, p_rows jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_job public.import_jobs%rowtype;
  v_row jsonb;
  v_count integer := 0;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  select * into v_job from public.import_jobs where id = p_job;
  if v_job.id is null or v_job.status not in ('queued', 'running')
  then raise exception 'Import is not queued'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 500
  then raise exception 'Chunk size must be 1 to 500 rows'; end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if v_job.kind in ('usage', 'langfuse') then
      insert into public.usage_events (
        org_id, source, source_event_id, source_customer_id, workflow_id, run_id,
        occurred_at, provider, billing_route, model, input_tokens, output_tokens,
        cache_read_tokens, cache_write_tokens, reasoning_output_tokens,
        measured_cost_usd, status, import_job_id
      ) values (
        v_job.org_id, v_job.source, v_row->>'eventId', v_row->>'customerId',
        v_row->>'workflowId', v_row->>'runId', (v_row->>'occurredAt')::timestamptz,
        v_row->>'provider', v_row->>'billingRoute', v_row->>'model',
        (v_row->>'inputTokens')::bigint, (v_row->>'outputTokens')::bigint,
        coalesce((v_row->>'cacheReadTokens')::bigint, 0),
        coalesce((v_row->>'cacheWriteTokens')::bigint, 0),
        coalesce((v_row->>'reasoningOutputTokens')::bigint, 0),
        (v_row->>'reportedCostUsd')::numeric, v_row->>'status', p_job
      ) on conflict (org_id, source, source_event_id) do nothing;
    elsif v_job.kind = 'outcomes' then
      insert into public.outcome_events (
        org_id, source, source_event_id, source_customer_id, workflow_id, run_id,
        occurred_at, status, import_job_id
      ) values (
        v_job.org_id, v_job.source, v_row->>'eventId', v_row->>'customerId',
        v_row->>'workflowId', v_row->>'runId', (v_row->>'occurredAt')::timestamptz,
        v_row->>'status', p_job
      ) on conflict (org_id, source, source_event_id) do nothing;
    elsif v_job.kind = 'direct_costs' then
      insert into public.direct_cost_events (
        org_id, source, source_event_id, source_customer_id, workflow_id, run_id,
        occurred_at, category, cost_usd, import_job_id
      ) values (
        v_job.org_id, v_job.source, v_row->>'eventId', v_row->>'customerId',
        v_row->>'workflowId', v_row->>'runId', (v_row->>'occurredAt')::timestamptz,
        v_row->>'category', (v_row->>'costUsd')::numeric, p_job
      ) on conflict (org_id, source, source_event_id) do nothing;
    else
      raise exception 'Unsupported import kind';
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create function public.complete_import_chunk(p_message bigint, p_job uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_job public.import_jobs%rowtype; v_imported integer; v_path text;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  select * into v_job from public.import_jobs where id = p_job for update;
  if v_job.id is null then raise exception 'Import not found'; end if;
  select q.message->>'path' into v_path from pgmq.q_solvren_imports q
    where q.msg_id = p_message and q.message->>'job_id' = p_job::text;
  if v_path is null then raise exception 'Message does not match import'; end if;
  if not pgmq.archive('solvren_imports', p_message)
  then raise exception 'Could not archive import message'; end if;
  update public.import_chunk_objects set processed_at = now()
    where job_id = p_job and object_path = v_path;
  if v_job.kind in ('usage', 'langfuse') then
    select count(*) into v_imported from public.usage_events where import_job_id = p_job;
  elsif v_job.kind = 'outcomes' then
    select count(*) into v_imported from public.outcome_events where import_job_id = p_job;
  else
    select count(*) into v_imported from public.direct_cost_events where import_job_id = p_job;
  end if;
  update public.import_jobs set chunks_done = chunks_done + 1,
    imported_rows = v_imported,
    duplicate_rows = greatest(0, total_rows - rejected_rows - v_imported),
    status = case when chunks_done + 1 >= chunks_total then 'completed' else 'running' end,
    error_message = null, updated_at = now()
    where id = p_job;
end;
$$;

create function public.mark_import_object_deleted(p_job uuid, p_path text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  update public.import_chunk_objects set deleted_at = now()
    where job_id = p_job and object_path = p_path
      and (processed_at is not null or exists (
        select 1 from public.import_jobs j where j.id = p_job and j.status = 'failed'));
end;
$$;

create function public.fail_import_chunk(p_message bigint, p_job uuid, p_error text, p_read_count bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if not exists (select 1 from pgmq.q_solvren_imports q
    where q.msg_id = p_message and q.message->>'job_id' = p_job::text)
  then raise exception 'Message does not match import'; end if;
  if p_read_count >= 5 then
    if not pgmq.archive('solvren_imports', p_message) then raise exception 'Could not archive failed message'; end if;
    update public.import_jobs set status = 'failed',
      error_message = left(coalesce(p_error, 'Unknown import error'), 500), updated_at = now()
      where id = p_job;
  else
    update public.import_jobs set status = 'running',
      error_message = 'Retrying after a processing error', updated_at = now()
      where id = p_job;
  end if;
end;
$$;

revoke all on function public.queue_import_chunks(uuid,text[]), public.claim_import_chunk(),
  public.apply_import_chunk(uuid,jsonb), public.complete_import_chunk(bigint,uuid),
  public.fail_import_chunk(bigint,uuid,text,bigint),
  public.mark_import_object_deleted(uuid,text) from public;
grant execute on function public.queue_import_chunks(uuid,text[]), public.claim_import_chunk(),
  public.apply_import_chunk(uuid,jsonb), public.complete_import_chunk(bigint,uuid),
  public.fail_import_chunk(bigint,uuid,text,bigint),
  public.mark_import_object_deleted(uuid,text) to service_role;
