create function public.phase3_issue_summary(p_org uuid)
returns table(open_issues bigint,known_exposure_usd text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_read_org(p_org) then raise exception 'Organization access required'; end if;
  return query select count(*),coalesce(sum(i.exposure_usd),0)::text
    from public.margin_issues i where i.org_id = p_org and i.status <> 'resolved';
end;
$$;
revoke all on function public.phase3_issue_summary(uuid) from public;
grant execute on function public.phase3_issue_summary(uuid) to authenticated,service_role;

create function public.phase3_digest_summary(p_org uuid,p_since timestamptz)
returns table(newly_at_risk bigint,resolved_issues bigint,confidence_gap_issues bigint,
  total_exposure_usd text,top_issues jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if p_since is null or p_since < now() - interval '30 days' or p_since > now()
  then raise exception 'Invalid digest period'; end if;
  return query
    select
      (select count(distinct e.issue_id) from public.margin_issue_events e
        where e.org_id = p_org and e.created_at >= p_since
          and e.event_type in ('detected','reopened')),
      (select count(distinct e.issue_id) from public.margin_issue_events e
        where e.org_id = p_org and e.created_at >= p_since
          and e.event_type = 'resolved'),
      (select count(*) from public.margin_issues i where i.org_id = p_org
        and i.status <> 'resolved' and i.kind in ('stale_data','reconciliation_gap')),
      (select coalesce(sum(i.exposure_usd),0)::text from public.margin_issues i
        where i.org_id = p_org and i.status <> 'resolved'),
      (select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'kind',q.kind,
        'customerName',coalesce(q.evidence->>'customerName',q.evidence->>'provider','Organization'),
        'exposureUsd',q.exposure_usd)), '[]'::jsonb)
        from (select i.id,i.kind,i.evidence,i.exposure_usd from public.margin_issues i
          where i.org_id = p_org and i.status <> 'resolved'
          order by i.exposure_usd desc,i.id limit 5) q);
end;
$$;
revoke all on function public.phase3_digest_summary(uuid,timestamptz) from public;
grant execute on function public.phase3_digest_summary(uuid,timestamptz) to service_role;
