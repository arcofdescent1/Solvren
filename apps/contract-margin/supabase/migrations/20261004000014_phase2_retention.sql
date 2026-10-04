create function public.prune_expired_source_data(p_limit integer default 10000)
returns table(usage_deleted integer,outcomes_deleted integer,direct_deleted integer,buckets_deleted integer)
language plpgsql security definer set search_path = '' as $$
declare v_cutoff timestamptz := now() - interval '13 months';
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if p_limit not between 1 and 10000 then raise exception 'Invalid retention batch size'; end if;
  delete from public.usage_events where id in (
    select id from public.usage_events where occurred_at < v_cutoff
      order by occurred_at,id limit p_limit);
  get diagnostics usage_deleted = row_count;
  delete from public.outcome_events where id in (
    select id from public.outcome_events where occurred_at < v_cutoff
      order by occurred_at,id limit p_limit);
  get diagnostics outcomes_deleted = row_count;
  delete from public.direct_cost_events where id in (
    select id from public.direct_cost_events where occurred_at < v_cutoff
      order by occurred_at,id limit p_limit);
  get diagnostics direct_deleted = row_count;
  delete from public.provider_cost_buckets where (org_id,provider,day,scope_id,line_item) in (
    select org_id,provider,day,scope_id,line_item from public.provider_cost_buckets
      where day < v_cutoff::date order by day limit p_limit);
  get diagnostics buckets_deleted = row_count;
  delete from public.provider_cost_days where day < v_cutoff::date;
  return next;
end;
$$;

create function public.request_organization_deletion(p_org uuid)
returns timestamptz language plpgsql security definer set search_path = '' as $$
declare v_purge timestamptz;
begin
  if not private.is_owner(p_org) then raise exception 'Owner access with MFA required'; end if;
  perform 1 from public.organizations where id = p_org and deletion_requested_at is null for update;
  if not found then raise exception 'Organization is unavailable'; end if;
  v_purge := now() + interval '29 days';
  update public.organizations set deletion_requested_at = now(),purge_after = v_purge where id = p_org;
  update public.ingestion_keys set revoked_at = now() where org_id = p_org and revoked_at is null;
  update public.provider_connections set disconnected_at = now(),last_error = 'Organization closure requested'
    where org_id = p_org and disconnected_at is null;
  update public.connector_jobs set status = 'failed',last_error = 'Organization closure requested'
    where org_id = p_org and status in ('queued','running');
  update public.import_jobs set status = 'failed',error_message = 'Organization closure requested'
    where org_id = p_org and status in ('preparing','queued','running');
  delete from vault.secrets where id in (
    select vault_secret_id from private.connector_credentials where org_id = p_org);
  delete from private.connector_credentials where org_id = p_org;
  delete from public.organization_members where org_id = p_org;
  return v_purge;
end;
$$;

revoke all on function public.prune_expired_source_data(integer),
  public.request_organization_deletion(uuid) from public;
grant execute on function public.prune_expired_source_data(integer) to service_role;
grant execute on function public.request_organization_deletion(uuid) to authenticated;
