create or replace function private.can_read_org(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.role() = 'service_role' or (private.is_verified() and exists (
    select 1 from public.organization_members m
    where m.org_id = p_org and m.user_id = auth.uid()
      and (m.role = 'viewer' or auth.jwt()->>'aal' = 'aal2')
  ));
$$;

create function public.phase3_workflow_samples(p_org uuid,p_start date,p_end date)
returns table(workflow_id text,completed_runs bigint,priced_runs bigint,
  unknown_runs bigint,median_unit_usd text,p90_unit_usd text,
  observed_cost_usd text,first_outcome_at timestamptz,last_outcome_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_read_org(p_org) then raise exception 'Organization access required'; end if;
  if p_start is null or p_end is null or p_end <= p_start or p_end > p_start + 62
  then raise exception 'Choose a period of 1 to 62 days'; end if;
  return query
  with latest_outcomes as (
    select distinct on (o.source,o.source_customer_id,o.run_id)
      o.source,o.source_customer_id,o.run_id,o.workflow_id,o.status,o.occurred_at
    from public.outcome_events o
    where o.org_id = p_org and o.occurred_at >= p_start and o.occurred_at < p_end
    order by o.source,o.source_customer_id,o.run_id,o.occurred_at desc,o.id desc
  ), usage_runs as (
    select u.source,u.source_customer_id,u.run_id,
      sum(coalesce(u.measured_cost_usd,case when r.id is not null then
        (u.input_tokens::numeric * r.input_per_million_usd
        + (u.output_tokens + u.reasoning_output_tokens)::numeric * r.output_per_million_usd
        + u.cache_read_tokens::numeric * r.cache_read_per_million_usd
        + u.cache_write_tokens::numeric * r.cache_write_per_million_usd) / 1000000 end)) as amount,
      count(*) filter (where u.measured_cost_usd is null and r.id is null) as unknown
    from public.usage_events u
    left join lateral (select mr.* from public.model_rates mr
      where mr.org_id = u.org_id and mr.provider = u.provider and mr.model = u.model
        and mr.effective_from <= u.occurred_at::date
      order by mr.effective_from desc limit 1) r on true
    where u.org_id = p_org and u.occurred_at >= p_start and u.occurred_at < p_end
    group by u.source,u.source_customer_id,u.run_id
  ), direct_runs as (
    select d.source,d.source_customer_id,d.run_id,sum(d.cost_usd) as amount
    from public.direct_cost_events d
    where d.org_id = p_org and d.occurred_at >= p_start and d.occurred_at < p_end
    group by d.source,d.source_customer_id,d.run_id
  ), completed as (
    select o.workflow_id,o.occurred_at,
      coalesce(u.amount,0) + coalesce(d.amount,0) as amount,
      coalesce(u.unknown,0) as unknown,
      (u.run_id is not null or d.run_id is not null) as has_cost
    from latest_outcomes o
    left join usage_runs u on u.source = o.source
      and u.source_customer_id = o.source_customer_id and u.run_id = o.run_id
    left join direct_runs d on d.source = o.source
      and d.source_customer_id = o.source_customer_id and d.run_id = o.run_id
    where o.status = 'completed'
  )
  select c.workflow_id,count(*),count(*) filter (where c.unknown = 0 and c.has_cost),
    count(*) filter (where c.unknown > 0 or not c.has_cost),
    (percentile_disc(0.5) within group (order by c.amount)
      filter (where c.unknown = 0 and c.has_cost))::text,
    (percentile_disc(0.9) within group (order by c.amount)
      filter (where c.unknown = 0 and c.has_cost))::text,
    coalesce(sum(c.amount) filter (where c.unknown = 0 and c.has_cost),0)::text,
    min(c.occurred_at),max(c.occurred_at)
  from completed c group by c.workflow_id order by c.workflow_id;
end;
$$;

create function public.phase3_daily_costs(p_org uuid,p_start date,p_end date)
returns table(customer_id uuid,day date,known_cost_usd text,
  unknown_cost_events bigint,completed_outcomes bigint,usage_events bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_read_org(p_org) then raise exception 'Organization access required'; end if;
  if p_start is null or p_end is null or p_end <= p_start or p_end > p_start + 62
  then raise exception 'Choose a period of 1 to 62 days'; end if;
  return query
  with usage_cost as (
    select coalesce(m.customer_id,c.id) as customer_id,u.occurred_at::date as day,
      sum(coalesce(u.measured_cost_usd,case when r.id is not null then
        (u.input_tokens::numeric * r.input_per_million_usd
        + (u.output_tokens + u.reasoning_output_tokens)::numeric * r.output_per_million_usd
        + u.cache_read_tokens::numeric * r.cache_read_per_million_usd
        + u.cache_write_tokens::numeric * r.cache_write_per_million_usd) / 1000000 end)) as amount,
      count(*) filter (where u.measured_cost_usd is null and r.id is null) as unknown,
      count(*) as events
    from public.usage_events u
    left join public.customer_mappings m on m.org_id = u.org_id
      and m.source = u.source and m.source_customer_id = u.source_customer_id
    left join public.customers c on c.org_id = u.org_id and c.external_id = u.source_customer_id
    left join lateral (select mr.* from public.model_rates mr
      where mr.org_id = u.org_id and mr.provider = u.provider and mr.model = u.model
        and mr.effective_from <= u.occurred_at::date
      order by mr.effective_from desc limit 1) r on true
    where u.org_id = p_org and u.occurred_at >= p_start and u.occurred_at < p_end
    group by coalesce(m.customer_id,c.id),u.occurred_at::date
  ), direct_cost as (
    select coalesce(m.customer_id,c.id) as customer_id,d.occurred_at::date as day,
      sum(d.cost_usd) as amount
    from public.direct_cost_events d
    left join public.customer_mappings m on m.org_id = d.org_id
      and m.source = d.source and m.source_customer_id = d.source_customer_id
    left join public.customers c on c.org_id = d.org_id and c.external_id = d.source_customer_id
    where d.org_id = p_org and d.occurred_at >= p_start and d.occurred_at < p_end
    group by coalesce(m.customer_id,c.id),d.occurred_at::date
  ), latest_outcomes as (
    select distinct on (o.source,o.source_customer_id,o.run_id)
      coalesce(m.customer_id,c.id) as customer_id,o.occurred_at::date as day,o.status
    from public.outcome_events o
    left join public.customer_mappings m on m.org_id = o.org_id
      and m.source = o.source and m.source_customer_id = o.source_customer_id
    left join public.customers c on c.org_id = o.org_id and c.external_id = o.source_customer_id
    where o.org_id = p_org and o.occurred_at >= p_start and o.occurred_at < p_end
    order by o.source,o.source_customer_id,o.run_id,o.occurred_at desc,o.id desc
  ), outcome_days as (
    select o.customer_id,o.day,count(*) filter (where o.status = 'completed') as completed
    from latest_outcomes o group by o.customer_id,o.day
  )
  select coalesce(u.customer_id,d.customer_id,o.customer_id),coalesce(u.day,d.day,o.day),
    (coalesce(u.amount,0) + coalesce(d.amount,0))::text,
    coalesce(u.unknown,0),coalesce(o.completed,0),coalesce(u.events,0)
  from usage_cost u full join direct_cost d on d.customer_id is not distinct from u.customer_id
    and d.day = u.day
  full join outcome_days o on o.customer_id is not distinct from coalesce(u.customer_id,d.customer_id)
    and o.day = coalesce(u.day,d.day)
  where coalesce(u.customer_id,d.customer_id,o.customer_id) is not null;
end;
$$;

revoke all on function public.phase3_workflow_samples(uuid,date,date),
  public.phase3_daily_costs(uuid,date,date) from public;
grant execute on function public.phase3_workflow_samples(uuid,date,date),
  public.phase3_daily_costs(uuid,date,date) to authenticated,service_role;
