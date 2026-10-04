create function public.phase1_portfolio(p_org uuid, p_start date, p_end date)
returns table (
  customer_id uuid, customer_name text, customer_external_id text, owner_email text,
  renewal_on date, revenue_usd text, known_cost_usd text, model_cost_usd text,
  tool_cost_usd text, human_cost_usd text, other_cost_usd text,
  completed_outcomes bigint, failed_outcomes bigint, usage_events bigint,
  unknown_cost_events bigint, target_margin_pct text, latest_event_at timestamptz,
  top_workflow text
) language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_read_org(p_org) then raise exception 'Organization access required'; end if;
  if p_start is null or p_end is null or p_end <= p_start or p_end > p_start + 62
  then raise exception 'Choose a period of 1 to 62 days'; end if;
  return query
  with days as (
    select g.d::date as day from generate_series(p_start::timestamp,
      (p_end - 1)::timestamp, interval '1 day') g(d)
  ), active_contract_days as (
    select cv.customer_id, days.day, cv.included_outcomes, cv.overage_usd,
      cv.discount_pct, cv.target_margin_pct, cv.renewal_on,
      case when cv.billing_period = 'monthly'
        then cv.base_fee_usd / extract(day from (date_trunc('month', days.day) + interval '1 month - 1 day'))
        else cv.base_fee_usd / extract(doy from make_date(extract(year from days.day)::integer, 12, 31))
      end * (1 - cv.discount_pct / 100) as daily_revenue
    from days join public.contract_versions cv on cv.org_id = p_org
      and days.day >= cv.effective_from
      and (cv.effective_to is null or days.day < cv.effective_to)
  ), base_revenue as (
    select a.customer_id, sum(a.daily_revenue) as amount
    from active_contract_days a group by a.customer_id
  ), allowance as (
    select a.customer_id, date_trunc('month', a.day)::date as month_start,
      sum(a.included_outcomes::numeric / extract(day from
        (date_trunc('month', a.day) + interval '1 month - 1 day'))) as included,
      (array_agg(a.overage_usd * (1 - a.discount_pct / 100) order by a.day desc))[1] as overage_rate
    from active_contract_days a group by a.customer_id, date_trunc('month', a.day)::date
  ), priced_usage as (
    select u.id, u.source, u.run_id, u.workflow_id, u.occurred_at,
      coalesce(m.customer_id, c.id) as mapped_customer_id,
      case when u.measured_cost_usd is not null then u.measured_cost_usd
        when r.id is not null then
          (u.input_tokens::numeric * r.input_per_million_usd
          + (u.output_tokens + u.reasoning_output_tokens)::numeric * r.output_per_million_usd
          + u.cache_read_tokens::numeric * r.cache_read_per_million_usd
          + u.cache_write_tokens::numeric * r.cache_write_per_million_usd) / 1000000
        else null end as cost_usd
    from public.usage_events u
    left join public.customer_mappings m on m.org_id = u.org_id
      and m.source = u.source and m.source_customer_id = u.source_customer_id
    left join public.customers c on c.org_id = u.org_id and c.external_id = u.source_customer_id
    left join lateral (
      select mr.* from public.model_rates mr
      where mr.org_id = u.org_id and mr.provider = u.provider and mr.model = u.model
        and mr.effective_from <= u.occurred_at::date
      order by mr.effective_from desc limit 1
    ) r on true
    where u.org_id = p_org and u.occurred_at >= p_start and u.occurred_at < p_end
  ), usage_totals as (
    select u.mapped_customer_id as customer_id, count(*) as events,
      count(*) filter (where u.cost_usd is null) as unknown_events,
      sum(u.cost_usd) as cost_usd, max(u.occurred_at) as latest_at
    from priced_usage u where u.mapped_customer_id is not null
    group by u.mapped_customer_id
  ), workflow_totals as (
    select u.mapped_customer_id as customer_id, u.workflow_id,
      sum(u.cost_usd) as cost_usd
    from priced_usage u where u.mapped_customer_id is not null
    group by u.mapped_customer_id, u.workflow_id
  ), ranked_workflows as (
    select w.customer_id, w.workflow_id,
      row_number() over (partition by w.customer_id order by w.cost_usd desc nulls last, w.workflow_id) as rank
    from workflow_totals w
  ), latest_outcomes as (
    select distinct on (coalesce(m.customer_id, c.id), o.run_id) o.source, o.run_id, o.source_customer_id,
      o.occurred_at, o.status,
      coalesce(m.customer_id, c.id) as mapped_customer_id
    from public.outcome_events o
    left join public.customer_mappings m on m.org_id = o.org_id
      and m.source = o.source and m.source_customer_id = o.source_customer_id
    left join public.customers c on c.org_id = o.org_id and c.external_id = o.source_customer_id
    where o.org_id = p_org and o.occurred_at >= p_start and o.occurred_at < p_end
    order by coalesce(m.customer_id, c.id), o.run_id, o.occurred_at desc, o.id desc
  ), outcome_totals as (
    select o.mapped_customer_id as customer_id,
      count(*) filter (where o.status = 'completed') as completed,
      count(*) filter (where o.status = 'failed') as failed
    from latest_outcomes o where o.mapped_customer_id is not null
    group by o.mapped_customer_id
  ), monthly_outcomes as (
    select o.mapped_customer_id as customer_id,
      date_trunc('month', o.occurred_at)::date as month_start,
      count(*) filter (where o.status = 'completed') as completed
    from latest_outcomes o where o.mapped_customer_id is not null
    group by o.mapped_customer_id, date_trunc('month', o.occurred_at)::date
  ), overages as (
    select a.customer_id,
      sum(greatest(0, coalesce(mo.completed, 0) - a.included) * a.overage_rate) as amount
    from allowance a left join monthly_outcomes mo on mo.customer_id = a.customer_id
      and mo.month_start = a.month_start
    group by a.customer_id
  ), direct_totals as (
    select coalesce(m.customer_id, c.id) as customer_id,
      sum(d.cost_usd) filter (where d.category = 'tool') as tool,
      sum(d.cost_usd) filter (where d.category = 'human_review') as human,
      sum(d.cost_usd) filter (where d.category = 'other') as other,
      max(d.occurred_at) as latest_at
    from public.direct_cost_events d
    left join public.customer_mappings m on m.org_id = d.org_id
      and m.source = d.source and m.source_customer_id = d.source_customer_id
    left join public.customers c on c.org_id = d.org_id and c.external_id = d.source_customer_id
    where d.org_id = p_org and d.occurred_at >= p_start and d.occurred_at < p_end
    group by coalesce(m.customer_id, c.id)
  )
  select c.id, c.name, c.external_id, owner.email::text,
    (select cv.renewal_on from public.contract_versions cv
      where cv.org_id = p_org and cv.customer_id = c.id and cv.effective_from < p_end
      order by cv.effective_from desc limit 1),
    round(coalesce(b.amount, 0) + coalesce(ov.amount, 0), 2)::text,
    (coalesce(u.cost_usd, 0) + coalesce(d.tool, 0) + coalesce(d.human, 0) + coalesce(d.other, 0))::text,
    coalesce(u.cost_usd, 0)::text, coalesce(d.tool, 0)::text,
    coalesce(d.human, 0)::text, coalesce(d.other, 0)::text,
    coalesce(o.completed, 0), coalesce(o.failed, 0), coalesce(u.events, 0),
    coalesce(u.unknown_events, 0),
    coalesce((select cv.target_margin_pct from public.contract_versions cv
      where cv.org_id = p_org and cv.customer_id = c.id and cv.effective_from < p_end
      order by cv.effective_from desc limit 1), org.target_margin_pct)::text,
    greatest(u.latest_at, d.latest_at), rw.workflow_id
  from public.customers c
  join public.organizations org on org.id = c.org_id
  left join auth.users owner on owner.id = c.owner_user_id
  left join base_revenue b on b.customer_id = c.id
  left join overages ov on ov.customer_id = c.id
  left join usage_totals u on u.customer_id = c.id
  left join outcome_totals o on o.customer_id = c.id
  left join direct_totals d on d.customer_id = c.id
  left join ranked_workflows rw on rw.customer_id = c.id and rw.rank = 1
  where c.org_id = p_org
  order by (coalesce(b.amount, 0) + coalesce(ov.amount, 0)
    - coalesce(u.cost_usd, 0) - coalesce(d.tool, 0)
    - coalesce(d.human, 0) - coalesce(d.other, 0)) asc, c.name;
end;
$$;

create function public.phase1_unmapped(p_org uuid, p_start date, p_end date)
returns table (source text, source_customer_id text, event_count bigint, known_cost_usd text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_read_org(p_org) then raise exception 'Organization access required'; end if;
  if p_start is null or p_end is null or p_end <= p_start or p_end > p_start + 62
  then raise exception 'Choose a period of 1 to 62 days'; end if;
  return query
    with events as (
      select u.source, u.source_customer_id, u.measured_cost_usd as known_cost
        from public.usage_events u where u.org_id = p_org
          and u.occurred_at >= p_start and u.occurred_at < p_end
      union all
      select d.source, d.source_customer_id, d.cost_usd
        from public.direct_cost_events d where d.org_id = p_org
          and d.occurred_at >= p_start and d.occurred_at < p_end
      union all
      select o.source, o.source_customer_id, null::numeric
        from public.outcome_events o where o.org_id = p_org
          and o.occurred_at >= p_start and o.occurred_at < p_end
    )
    select u.source, u.source_customer_id, count(*), coalesce(sum(u.known_cost), 0)::text
    from events u
    left join public.customer_mappings m on m.org_id = p_org
      and m.source = u.source and m.source_customer_id = u.source_customer_id
    left join public.customers c on c.org_id = p_org and c.external_id = u.source_customer_id
    where coalesce(m.customer_id, c.id) is null
    group by u.source, u.source_customer_id order by count(*) desc;
end;
$$;

create function public.phase1_source_coverage(p_org uuid, p_start date, p_end date)
returns table (provider text, direct_cost_usd text, statement_usd text, statement_days integer,
  unmapped_events bigint, unpriced_events bigint, last_usage_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_read_org(p_org) then raise exception 'Organization access required'; end if;
  if p_start is null or p_end is null or p_end <= p_start or p_end > p_start + 62
  then raise exception 'Choose a period of 1 to 62 days'; end if;
  return query
  with priced as (
    select u.provider, u.billing_route, u.occurred_at,
      coalesce(u.measured_cost_usd,
        case when r.id is not null then
          (u.input_tokens::numeric * r.input_per_million_usd
          + (u.output_tokens + u.reasoning_output_tokens)::numeric * r.output_per_million_usd
          + u.cache_read_tokens::numeric * r.cache_read_per_million_usd
          + u.cache_write_tokens::numeric * r.cache_write_per_million_usd) / 1000000
        end) as cost_usd,
      coalesce(m.customer_id, c.id) as customer_id
    from public.usage_events u
    left join public.customer_mappings m on m.org_id = u.org_id
      and m.source = u.source and m.source_customer_id = u.source_customer_id
    left join public.customers c on c.org_id = u.org_id and c.external_id = u.source_customer_id
    left join lateral (select mr.* from public.model_rates mr
      where mr.org_id = u.org_id and mr.provider = u.provider and mr.model = u.model
        and mr.effective_from <= u.occurred_at::date
      order by mr.effective_from desc limit 1) r on true
    where u.org_id = p_org and u.occurred_at >= p_start and u.occurred_at < p_end
  ), usage_rollup as (
    select p.provider,
      sum(p.cost_usd) filter (where p.billing_route in ('openai_direct', 'anthropic_direct')) as direct_cost,
      count(*) filter (where p.customer_id is null) as unmapped,
      count(*) filter (where p.cost_usd is null) as unpriced,
      max(p.occurred_at) as latest
    from priced p group by p.provider
  ), statements as (
    select s.provider, sum(s.total_usd) as total,
      sum(s.period_end - s.period_start)::integer as days
    from public.provider_statements s where s.org_id = p_org
      and s.period_start >= p_start and s.period_end <= p_end
    group by s.provider
  )
  select providers.provider, coalesce(u.direct_cost, 0)::text, s.total::text, s.days,
    coalesce(u.unmapped, 0), coalesce(u.unpriced, 0), u.latest
  from (values ('openai'::text), ('anthropic'::text)) providers(provider)
  left join usage_rollup u on u.provider = providers.provider
  left join statements s on s.provider = providers.provider;
end;
$$;

revoke all on function public.phase1_portfolio(uuid,date,date),
  public.phase1_unmapped(uuid,date,date), public.phase1_source_coverage(uuid,date,date) from public;
grant execute on function public.phase1_portfolio(uuid,date,date),
  public.phase1_unmapped(uuid,date,date), public.phase1_source_coverage(uuid,date,date) to authenticated;
