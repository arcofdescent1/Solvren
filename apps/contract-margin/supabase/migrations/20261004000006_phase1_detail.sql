create function public.set_customer_owner(p_org uuid, p_customer uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_edit_finance(p_org) then raise exception 'Finance access with MFA required'; end if;
  if p_user is not null and not exists (
    select 1 from public.organization_members m where m.org_id = p_org and m.user_id = p_user)
  then raise exception 'Owner must be an organization member'; end if;
  update public.customers set owner_user_id = p_user where org_id = p_org and id = p_customer;
  if not found then raise exception 'Customer not found'; end if;
end;
$$;

create function public.organization_member_picker(p_org uuid)
returns table (user_id uuid, email text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_edit_finance(p_org) then raise exception 'Finance access with MFA required'; end if;
  return query select m.user_id, u.email::text
    from public.organization_members m join auth.users u on u.id = m.user_id
    where m.org_id = p_org order by u.email;
end;
$$;

create function public.phase1_customer_workflows(p_org uuid, p_start date, p_end date)
returns table (customer_id uuid, workflow_id text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_read_org(p_org) then raise exception 'Organization access required'; end if;
  if p_start is null or p_end is null or p_end <= p_start or p_end > p_start + 62
  then raise exception 'Choose a period of 1 to 62 days'; end if;
  return query
  select distinct coalesce(m.customer_id, c.id), x.workflow_id
  from (
    select source, source_customer_id, workflow_id from public.usage_events
      where org_id = p_org and occurred_at >= p_start and occurred_at < p_end
    union all
    select source, source_customer_id, workflow_id from public.outcome_events
      where org_id = p_org and occurred_at >= p_start and occurred_at < p_end
    union all
    select source, source_customer_id, workflow_id from public.direct_cost_events
      where org_id = p_org and occurred_at >= p_start and occurred_at < p_end
  ) x
  left join public.customer_mappings m on m.org_id = p_org
    and m.source = x.source and m.source_customer_id = x.source_customer_id
  left join public.customers c on c.org_id = p_org and c.external_id = x.source_customer_id
  where coalesce(m.customer_id, c.id) is not null;
end;
$$;

create function public.phase1_customer_daily(p_org uuid, p_customer uuid, p_start date, p_end date)
returns table (day date, model_cost_usd text, direct_cost_usd text,
  unknown_cost_events bigint, completed_outcomes bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_read_org(p_org) or not exists (
    select 1 from public.customers where org_id = p_org and id = p_customer)
  then raise exception 'Customer access required'; end if;
  if p_start is null or p_end is null or p_end <= p_start or p_end > p_start + 62
  then raise exception 'Choose a period of 1 to 62 days'; end if;
  return query
  with u as (
    select e.occurred_at::date as day,
      coalesce(e.measured_cost_usd, case when r.id is not null then
        (e.input_tokens::numeric * r.input_per_million_usd
        + (e.output_tokens + e.reasoning_output_tokens)::numeric * r.output_per_million_usd
        + e.cache_read_tokens::numeric * r.cache_read_per_million_usd
        + e.cache_write_tokens::numeric * r.cache_write_per_million_usd) / 1000000 end) as cost
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
  ), u_days as (
    select u.day, sum(u.cost) as amount, count(*) filter (where u.cost is null) as unknown
    from u group by u.day
  ), d_days as (
    select e.occurred_at::date as day, sum(e.cost_usd) as amount
    from public.direct_cost_events e
    left join public.customer_mappings m on m.org_id = e.org_id
      and m.source = e.source and m.source_customer_id = e.source_customer_id
    left join public.customers c on c.org_id = e.org_id and c.external_id = e.source_customer_id
    where e.org_id = p_org and e.occurred_at >= p_start and e.occurred_at < p_end
      and coalesce(m.customer_id, c.id) = p_customer
    group by e.occurred_at::date
  ), outcomes as (
    select distinct on (e.source, e.run_id) e.source, e.run_id, e.occurred_at, e.status
    from public.outcome_events e
    left join public.customer_mappings m on m.org_id = e.org_id
      and m.source = e.source and m.source_customer_id = e.source_customer_id
    left join public.customers c on c.org_id = e.org_id and c.external_id = e.source_customer_id
    where e.org_id = p_org and e.occurred_at >= p_start and e.occurred_at < p_end
      and coalesce(m.customer_id, c.id) = p_customer
    order by e.source, e.run_id, e.occurred_at desc, e.id desc
  ), o_days as (
    select o.occurred_at::date as day, count(*) filter (where o.status = 'completed') as completed
    from outcomes o group by o.occurred_at::date
  )
  select days.d::date, coalesce(u.amount, 0)::text, coalesce(d.amount, 0)::text,
    coalesce(u.unknown, 0), coalesce(o.completed, 0)
  from generate_series(p_start::timestamp, (p_end - 1)::timestamp, interval '1 day') days(d)
  left join u_days u on u.day = days.d::date
  left join d_days d on d.day = days.d::date
  left join o_days o on o.day = days.d::date
  order by days.d;
end;
$$;

create function public.phase1_customer_sources(
  p_org uuid, p_customer uuid, p_start date, p_end date,
  p_before bigint default null, p_limit integer default 100
) returns table (event_id bigint, source text, source_event_id text, occurred_at timestamptz,
  workflow_id text, run_id text, provider text, model text, cost_usd text,
  cost_basis text,
  input_tokens bigint, output_tokens bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_read_org(p_org) or not exists (
    select 1 from public.customers where org_id = p_org and id = p_customer)
  then raise exception 'Customer access required'; end if;
  if p_start is null or p_end is null or p_end <= p_start or p_end > p_start + 62
  then raise exception 'Choose a period of 1 to 62 days'; end if;
  if p_limit not between 1 and 100 then raise exception 'Limit must be 1 to 100'; end if;
  return query
    select e.id, e.source, e.source_event_id, e.occurred_at,
      e.workflow_id, e.run_id, e.provider, e.model,
      coalesce(e.measured_cost_usd, case when r.id is not null then
        (e.input_tokens::numeric * r.input_per_million_usd
        + (e.output_tokens + e.reasoning_output_tokens)::numeric * r.output_per_million_usd
        + e.cache_read_tokens::numeric * r.cache_read_per_million_usd
        + e.cache_write_tokens::numeric * r.cache_write_per_million_usd) / 1000000 end)::text,
      case when e.measured_cost_usd is not null then 'source-reported'
        when r.id is not null then 'rate card' else 'unpriced' end,
      e.input_tokens, e.output_tokens
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
      and (p_before is null or e.id < p_before)
    order by e.id desc limit p_limit;
end;
$$;

revoke all on function public.set_customer_owner(uuid,uuid,uuid),
  public.organization_member_picker(uuid), public.phase1_customer_workflows(uuid,date,date),
  public.phase1_customer_daily(uuid,uuid,date,date),
  public.phase1_customer_sources(uuid,uuid,date,date,bigint,integer) from public;
grant execute on function public.set_customer_owner(uuid,uuid,uuid),
  public.organization_member_picker(uuid), public.phase1_customer_workflows(uuid,date,date),
  public.phase1_customer_daily(uuid,uuid,date,date),
  public.phase1_customer_sources(uuid,uuid,date,date,bigint,integer) to authenticated;
