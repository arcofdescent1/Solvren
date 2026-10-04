alter table public.usage_events add column provider_scope_id text
  check (provider_scope_id is null or length(provider_scope_id) between 1 and 200);
create index usage_scope_period on public.usage_events(org_id,provider,provider_scope_id,occurred_at)
  where billing_route in ('openai_direct','anthropic_direct');

create or replace function public.apply_import_chunk(p_job uuid, p_rows jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_job public.import_jobs%rowtype; v_row jsonb; v_count integer := 0;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  select * into v_job from public.import_jobs where id = p_job;
  if v_job.id is null or v_job.status not in ('queued','running')
  then raise exception 'Import is not queued'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 500
  then raise exception 'Chunk size must be 1 to 500 rows'; end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    if v_job.kind in ('usage','langfuse') then
      insert into public.usage_events (
        org_id,source,source_event_id,source_customer_id,workflow_id,run_id,
        occurred_at,provider,billing_route,model,input_tokens,output_tokens,
        cache_read_tokens,cache_write_tokens,reasoning_output_tokens,
        measured_cost_usd,status,import_job_id,provider_scope_id
      ) values (
        v_job.org_id,v_job.source,v_row->>'eventId',v_row->>'customerId',
        v_row->>'workflowId',v_row->>'runId',(v_row->>'occurredAt')::timestamptz,
        v_row->>'provider',v_row->>'billingRoute',v_row->>'model',
        (v_row->>'inputTokens')::bigint,(v_row->>'outputTokens')::bigint,
        coalesce((v_row->>'cacheReadTokens')::bigint,0),
        coalesce((v_row->>'cacheWriteTokens')::bigint,0),
        coalesce((v_row->>'reasoningOutputTokens')::bigint,0),
        (v_row->>'reportedCostUsd')::numeric,v_row->>'status',p_job,
        nullif(v_row->>'providerScopeId','')
      ) on conflict (org_id,source,source_event_id) do nothing;
    elsif v_job.kind = 'outcomes' then
      insert into public.outcome_events(org_id,source,source_event_id,source_customer_id,
        workflow_id,run_id,occurred_at,status,import_job_id)
      values (v_job.org_id,v_job.source,v_row->>'eventId',v_row->>'customerId',
        v_row->>'workflowId',v_row->>'runId',(v_row->>'occurredAt')::timestamptz,
        v_row->>'status',p_job)
      on conflict (org_id,source,source_event_id) do nothing;
    elsif v_job.kind = 'direct_costs' then
      insert into public.direct_cost_events(org_id,source,source_event_id,source_customer_id,
        workflow_id,run_id,occurred_at,category,cost_usd,import_job_id)
      values (v_job.org_id,v_job.source,v_row->>'eventId',v_row->>'customerId',
        v_row->>'workflowId',v_row->>'runId',(v_row->>'occurredAt')::timestamptz,
        v_row->>'category',(v_row->>'costUsd')::numeric,p_job)
      on conflict (org_id,source,source_event_id) do nothing;
    else raise exception 'Unsupported import kind'; end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create function public.phase2_reconciliation(p_org uuid,p_start date,p_end date)
returns table(provider text,source text,reported_usd text,attributed_usd text,
  variance_usd text,unassigned_usd text,covered_days bigint,total_days integer,
  unmapped_events bigint,unpriced_events bigint,scope_missing_events bigint,
  status text,last_success_at timestamptz,last_error text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_read_org(p_org) then raise exception 'Organization access required'; end if;
  if p_start is null or p_end is null or p_end <= p_start or p_end > p_start + 62
  then raise exception 'Choose a period of 1 to 62 days'; end if;
  return query
  with usage_priced as (
    select u.provider,u.billing_route,u.provider_scope_id,
      coalesce(m.customer_id,c.id) as customer_id,
      coalesce(u.measured_cost_usd,case when r.id is not null then
        (u.input_tokens::numeric * r.input_per_million_usd
        + (u.output_tokens + u.reasoning_output_tokens)::numeric * r.output_per_million_usd
        + u.cache_read_tokens::numeric * r.cache_read_per_million_usd
        + u.cache_write_tokens::numeric * r.cache_write_per_million_usd) / 1000000 end) as amount
    from public.usage_events u
    left join public.customer_mappings m on m.org_id = u.org_id
      and m.source = u.source and m.source_customer_id = u.source_customer_id
    left join public.customers c on c.org_id = u.org_id and c.external_id = u.source_customer_id
    left join lateral (select mr.* from public.model_rates mr where mr.org_id = u.org_id
      and mr.provider = u.provider and mr.model = u.model
      and mr.effective_from <= u.occurred_at::date
      order by mr.effective_from desc limit 1) r on true
    where u.org_id = p_org and u.occurred_at >= p_start and u.occurred_at < p_end
  ), usage_totals as (
    select u.provider,sum(u.amount) as amount,
      count(*) filter (where u.customer_id is null) as unmapped,
      count(*) filter (where u.amount is null) as unpriced,
      count(*) filter (where u.provider_scope_id is null) as scope_missing
    from usage_priced u
    where u.billing_route = u.provider || '_direct'
    group by u.provider
  ), cost_days as (
    select d.provider,count(*) as days from public.provider_cost_days d
    where d.org_id = p_org and d.day >= p_start and d.day < p_end group by d.provider
  ), connector_totals as (
    select b.provider,sum(b.amount_usd) as amount
    from public.provider_cost_buckets b
    where b.org_id = p_org and b.day >= p_start and b.day < p_end group by b.provider
  ), statement_totals as (
    select s.provider,sum(s.total_usd) as amount,
      sum(s.period_end - s.period_start) as days
    from public.provider_statements s
    where s.org_id = p_org and s.period_start >= p_start and s.period_end <= p_end
    group by s.provider
  ), evidence as (
    select p.provider,case when cd.days = p_end - p_start then 'connector'
      when st.days = p_end - p_start then 'statement'
      when cd.days > 0 then 'connector'
      when st.days > 0 then 'statement' else 'none' end as source,
      case when cd.days = p_end - p_start then coalesce(ct.amount,0)
        when st.days = p_end - p_start then st.amount
        when cd.days > 0 then coalesce(ct.amount,0)
        else st.amount end as reported,
      case when cd.days = p_end - p_start then cd.days
        when st.days = p_end - p_start then st.days
        when cd.days > 0 then cd.days else coalesce(st.days,0) end as days,
      coalesce(ut.amount,0) as attributed,
      coalesce(ut.unmapped,0) as unmapped,
      coalesce(ut.unpriced,0) as unpriced,
      coalesce(ut.scope_missing,0) as scope_missing,
      pc.last_success_at,pc.last_error,pc.disconnected_at
    from (values ('openai'::text),('anthropic'::text)) p(provider)
    left join cost_days cd on cd.provider = p.provider
    left join connector_totals ct on ct.provider = p.provider
    left join statement_totals st on st.provider = p.provider
    left join usage_totals ut on ut.provider = p.provider
    left join public.provider_connections pc on pc.org_id = p_org and pc.provider = p.provider
  )
  select e.provider,e.source,e.reported::text,e.attributed::text,
    (e.reported - e.attributed)::text,
    greatest(0,e.reported - e.attributed)::text,e.days::bigint,(p_end - p_start)::integer,
    e.unmapped,e.unpriced,e.scope_missing,
    case when e.source = 'none' then 'unavailable'
      when e.days < p_end - p_start or e.unmapped > 0 or e.unpriced > 0 then 'partial'
      when e.source = 'connector' and (e.disconnected_at is not null
        or e.last_success_at < now() - interval '24 hours') then 'stale'
      when abs(e.reported - e.attributed) > greatest(abs(e.reported) * 0.05,0.01) then 'variance'
      when e.scope_missing > 0 then 'provisional'
      else 'verified' end,
    e.last_success_at,e.last_error
  from evidence e;
end;
$$;

revoke all on function public.phase2_reconciliation(uuid,date,date) from public;
grant execute on function public.phase2_reconciliation(uuid,date,date) to authenticated;
