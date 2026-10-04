create function public.phase3_retry_failed_deliveries(p_org uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;v_digest_count integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  update public.margin_alert_deliveries set status = 'queued',attempts = 0,
    due_at = now(),lease_until = null,last_error = null
    where org_id = p_org and status = 'failed';
  get diagnostics v_count = row_count;
  update public.executive_digests set status = 'queued',attempts = 0,
    due_at = now(),lease_until = null,last_error = null
    where org_id = p_org and status = 'failed';
  get diagnostics v_digest_count = row_count;
  return v_count + v_digest_count;
end;
$$;
revoke all on function public.phase3_retry_failed_deliveries(uuid) from public;
grant execute on function public.phase3_retry_failed_deliveries(uuid) to service_role;
