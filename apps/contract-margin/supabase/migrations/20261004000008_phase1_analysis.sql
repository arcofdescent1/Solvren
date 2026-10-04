create function public.phase1_workflow_costs(p_org uuid, p_customer uuid, p_start date, p_end date)
returns table (workflow_id text, model_cost_usd text, tool_cost_usd text,
  human_cost_usd text, other_cost_usd text, unknown_cost_events bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_read_org(p_org) or not exists (
    select 1 from public.customers where org_id = p_org and id = p_customer)
  then raise exception 'Customer access required'; end if;
  if p_start is null or p_end is null or p_end <= p_start or p_end > p_start + 62
  then raise exception 'Choose a period of 1 to 62 days'; end if;
  return query
  with model as (
    select e.workflow_id,
      coalesce(e.measured_cost_usd, case when r.id is not null then
        (e.input_tokens::numeric * r.input_per_million_usd
        + (e.output_tokens + e.reasoning_output_tokens)::numeric * r.output_per_million_usd
        + e.cache_read_tokens::numeric * r.cache_read_per_million_usd
        + e.cache_write_tokens::numeric * r.cache_write_per_million_usd) / 1000000 end) as amount
    from public.usage_events e
    left join public.customer_mappings m on m.org_id = e.org_id
      and m.source = e.source and m.source_customer_id = e.source_customer_id
    left join public.customers c on c.org_id = e.org_id and c.external_id = e.source_customer_id
    left join lateral (select mr.* from public.model_rates mr
      where mr.org_id = e.org_id and mr.provider = e.provider and mr.model = e.model
        and mr.effective_from <= e.occurred_at::date
      order by mr.effective_from desc limit 1) r on true
    where e.org_id = p_org and e.occurred_at >= p_start and e.occurred_at < p_end
      and coalesce(m.customer_id, c.id) = p_customer
  ), model_totals as (
    select m.workflow_id, sum(m.amount) as amount,
      count(*) filter (where m.amount is null) as unknown
    from model m group by m.workflow_id
  ), direct_totals as (
    select e.workflow_id,
      sum(e.cost_usd) filter (where e.category = 'tool') as tool,
      sum(e.cost_usd) filter (where e.category = 'human_review') as human,
      sum(e.cost_usd) filter (where e.category = 'other') as other
    from public.direct_cost_events e
    left join public.customer_mappings m on m.org_id = e.org_id
      and m.source = e.source and m.source_customer_id = e.source_customer_id
    left join public.customers c on c.org_id = e.org_id and c.external_id = e.source_customer_id
    where e.org_id = p_org and e.occurred_at >= p_start and e.occurred_at < p_end
      and coalesce(m.customer_id, c.id) = p_customer
    group by e.workflow_id
  )
  select coalesce(m.workflow_id, d.workflow_id), coalesce(m.amount, 0)::text,
    coalesce(d.tool, 0)::text, coalesce(d.human, 0)::text,
    coalesce(d.other, 0)::text, coalesce(m.unknown, 0)
  from model_totals m full join direct_totals d on d.workflow_id = m.workflow_id
  order by (coalesce(m.amount, 0) + coalesce(d.tool, 0)
    + coalesce(d.human, 0) + coalesce(d.other, 0)) desc;
end;
$$;

create function public.phase1_run_distribution(p_org uuid, p_customer uuid, p_start date, p_end date)
returns table (completed_runs bigint, median_completed_run_usd text,
  p90_completed_run_usd text, maximum_completed_run_usd text,
  completed_runs_with_unknown_cost bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_read_org(p_org) or not exists (
    select 1 from public.customers where org_id = p_org and id = p_customer)
  then raise exception 'Customer access required'; end if;
  if p_start is null or p_end is null or p_end <= p_start or p_end > p_start + 62
  then raise exception 'Choose a period of 1 to 62 days'; end if;
  return query
  with usage_runs as (
    select e.run_id,
      sum(coalesce(e.measured_cost_usd, case when r.id is not null then
        (e.input_tokens::numeric * r.input_per_million_usd
        + (e.output_tokens + e.reasoning_output_tokens)::numeric * r.output_per_million_usd
        + e.cache_read_tokens::numeric * r.cache_read_per_million_usd
        + e.cache_write_tokens::numeric * r.cache_write_per_million_usd) / 1000000 end)) as amount,
      count(*) filter (where e.measured_cost_usd is null and r.id is null) as unknown
    from public.usage_events e
    left join public.customer_mappings m on m.org_id = e.org_id
      and m.source = e.source and m.source_customer_id = e.source_customer_id
    left join public.customers c on c.org_id = e.org_id and c.external_id = e.source_customer_id
    left join lateral (select mr.* from public.model_rates mr
      where mr.org_id = e.org_id and mr.provider = e.provider and mr.model = e.model
        and mr.effective_from <= e.occurred_at::date
      order by mr.effective_from desc limit 1) r on true
    where e.org_id = p_org and e.occurred_at >= p_start and e.occurred_at < p_end
      and coalesce(m.customer_id, c.id) = p_customer
    group by e.run_id
  ), direct_runs as (
    select e.run_id, sum(e.cost_usd) as amount
    from public.direct_cost_events e
    left join public.customer_mappings m on m.org_id = e.org_id
      and m.source = e.source and m.source_customer_id = e.source_customer_id
    left join public.customers c on c.org_id = e.org_id and c.external_id = e.source_customer_id
    where e.org_id = p_org and e.occurred_at >= p_start and e.occurred_at < p_end
      and coalesce(m.customer_id, c.id) = p_customer
    group by e.run_id
  ), outcomes as (
    select distinct on (e.run_id) e.run_id, e.status
    from public.outcome_events e
    left join public.customer_mappings m on m.org_id = e.org_id
      and m.source = e.source and m.source_customer_id = e.source_customer_id
    left join public.customers c on c.org_id = e.org_id and c.external_id = e.source_customer_id
    where e.org_id = p_org and e.occurred_at >= p_start and e.occurred_at < p_end
      and coalesce(m.customer_id, c.id) = p_customer
    order by e.run_id, e.occurred_at desc, e.id desc
  ), completed as (
    select o.run_id, coalesce(u.amount, 0) + coalesce(d.amount, 0) as amount,
      coalesce(u.unknown, 0) as unknown
    from outcomes o left join usage_runs u on u.run_id = o.run_id
    left join direct_runs d on d.run_id = o.run_id
    where o.status = 'completed'
  )
  select count(*),
    percentile_disc(0.5) within group (order by amount)
      filter (where unknown = 0)::text,
    percentile_disc(0.9) within group (order by amount)
      filter (where unknown = 0)::text,
    max(amount) filter (where unknown = 0)::text,
    count(*) filter (where unknown > 0)
  from completed;
end;
$$;

revoke all on function public.phase1_workflow_costs(uuid,uuid,date,date),
  public.phase1_run_distribution(uuid,uuid,date,date) from public;
grant execute on function public.phase1_workflow_costs(uuid,uuid,date,date),
  public.phase1_run_distribution(uuid,uuid,date,date) to authenticated;
