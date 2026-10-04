create function public.phase4_prepare_canceled_purge(p_org uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_billing public.organization_billing%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  select * into v_billing from public.organization_billing
    where org_id = p_org for update;
  if v_billing.org_id is null or v_billing.status <> 'canceled'
    or v_billing.billing_purge_at is null or v_billing.billing_purge_at > now()
  then return false; end if;
  update public.organizations set deletion_requested_at = coalesce(deletion_requested_at,now()),
    purge_after = now() where id = p_org and purge_after is null;
  update public.ingestion_keys set revoked_at = now()
    where org_id = p_org and revoked_at is null;
  update public.provider_connections set disconnected_at = now(),
    last_error = 'Canceled subscription data deletion'
    where org_id = p_org and disconnected_at is null;
  update public.connector_jobs set status = 'failed',
    last_error = 'Canceled subscription data deletion'
    where org_id = p_org and status in ('queued','running');
  update public.import_jobs set status = 'failed',
    error_message = 'Canceled subscription data deletion'
    where org_id = p_org and status in ('preparing','queued','running');
  delete from vault.secrets where id in
    (select vault_secret_id from private.connector_credentials where org_id = p_org);
  delete from private.connector_credentials where org_id = p_org;
  delete from public.organization_members where org_id = p_org;
  return true;
end;
$$;
revoke all on function public.phase4_prepare_canceled_purge(uuid) from public;
grant execute on function public.phase4_prepare_canceled_purge(uuid) to service_role;
