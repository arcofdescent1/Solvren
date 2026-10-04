insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('margin-imports', 'margin-imports', false, 10485760, array['application/json'])
on conflict (id) do nothing;

create function public.create_contract_version(
  p_org uuid, p_customer_external_id text, p_customer_name text, p_effective_from date,
  p_billing_period text, p_base_fee_usd numeric, p_included_outcomes integer,
  p_overage_usd numeric, p_discount_pct numeric, p_target_margin_pct numeric,
  p_renewal_on date default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_customer uuid;
  v_prior public.contract_versions%rowtype;
  v_id uuid;
  v_version integer;
begin
  if not private.can_edit_finance(p_org) then raise exception 'Finance access with MFA required'; end if;
  if length(btrim(p_customer_external_id)) not between 1 and 200
    or length(btrim(p_customer_name)) not between 1 and 200
  then raise exception 'Customer ID and name are required'; end if;
  if p_effective_from is null or p_billing_period not in ('monthly', 'annual')
    or p_base_fee_usd is null or p_base_fee_usd < 0 or p_base_fee_usd > 9999999999999999.99
    or p_included_outcomes is null or p_included_outcomes < 0
    or p_overage_usd is null or p_overage_usd < 0
    or p_discount_pct is null or p_discount_pct not between 0 and 100
    or (p_target_margin_pct is not null and p_target_margin_pct not between 0 and 100)
  then raise exception 'Invalid contract terms'; end if;
  perform 1 from public.organizations where id = p_org for update;
  insert into public.customers(org_id, external_id, name)
    values (p_org, btrim(p_customer_external_id), btrim(p_customer_name))
    on conflict (org_id, external_id) do update set name = excluded.name
    returning id into v_customer;
  select * into v_prior from public.contract_versions
    where org_id = p_org and customer_id = v_customer
    order by effective_from desc limit 1 for update;
  if v_prior.id is not null and p_effective_from <= v_prior.effective_from
  then raise exception 'An amendment must start after the latest contract version'; end if;
  if v_prior.id is not null then
    update public.contract_versions set effective_to = p_effective_from where id = v_prior.id;
  end if;
  v_version := coalesce(v_prior.version, 0) + 1;
  insert into public.contract_versions (
    org_id, customer_id, version, effective_from, billing_period, base_fee_usd,
    included_outcomes, overage_usd, discount_pct, target_margin_pct, renewal_on, created_by
  ) values (
    p_org, v_customer, v_version, p_effective_from, p_billing_period, p_base_fee_usd,
    p_included_outcomes, p_overage_usd, p_discount_pct, p_target_margin_pct, p_renewal_on, auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

create function public.import_contract_versions(p_org uuid, p_rows jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb;
  v_count integer := 0;
begin
  if not private.can_edit_finance(p_org) then raise exception 'Finance access with MFA required'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 1000
  then raise exception 'Import between 1 and 1000 contract versions'; end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    perform public.create_contract_version(
      p_org, v_row->>'customerId', v_row->>'customerName', (v_row->>'effectiveFrom')::date,
      v_row->>'billingPeriod', (v_row->>'baseFeeUsd')::numeric,
      (v_row->>'includedOutcomes')::integer, (v_row->>'overageUsd')::numeric,
      (v_row->>'discountPct')::numeric, (v_row->>'targetMarginPct')::numeric,
      (v_row->>'renewalOn')::date
    );
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create function public.set_customer_mapping(
  p_org uuid, p_source text, p_source_customer_id text, p_customer uuid
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_edit_mapping(p_org) then raise exception 'Finance or Engineer access with MFA required'; end if;
  if length(btrim(p_source)) not between 1 and 80 or length(btrim(p_source_customer_id)) not between 1 and 200
  then raise exception 'Source and customer ID are required'; end if;
  if not exists (select 1 from public.customers where org_id = p_org and id = p_customer)
  then raise exception 'Customer not found in organization'; end if;
  insert into public.customer_mappings(org_id, source, source_customer_id, customer_id, updated_by)
    values (p_org, btrim(p_source), btrim(p_source_customer_id), p_customer, auth.uid())
    on conflict (org_id, source, source_customer_id) do update
      set customer_id = excluded.customer_id, updated_at = now(), updated_by = auth.uid();
end;
$$;

create function public.create_model_rate(
  p_org uuid, p_provider text, p_model text, p_effective_from date,
  p_input numeric, p_output numeric, p_cache_read numeric, p_cache_write numeric
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.can_edit_mapping(p_org) then raise exception 'Finance or Engineer access with MFA required'; end if;
  insert into public.model_rates(org_id, provider, model, effective_from,
    input_per_million_usd, output_per_million_usd,
    cache_read_per_million_usd, cache_write_per_million_usd, created_by)
  values (p_org, p_provider, p_model, p_effective_from, p_input, p_output,
    p_cache_read, p_cache_write, auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

create function public.add_provider_statement(
  p_org uuid, p_provider text, p_start date, p_end date,
  p_total numeric, p_file text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.can_edit_finance(p_org) then raise exception 'Finance access with MFA required'; end if;
  insert into public.provider_statements(org_id, provider, period_start, period_end,
    total_usd, source_file, imported_by)
  values (p_org, p_provider, p_start, p_end, p_total, p_file, auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

create function public.import_provider_statements(p_org uuid, p_file text, p_rows jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_row jsonb; v_count integer := 0;
begin
  if not private.can_edit_finance(p_org) then raise exception 'Finance access with MFA required'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) not between 1 and 1000
  then raise exception 'Import between 1 and 1000 supplier statement rows'; end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    perform public.add_provider_statement(p_org, v_row->>'provider',
      (v_row->>'periodStart')::date, (v_row->>'periodEnd')::date,
      (v_row->>'totalUsd')::numeric, p_file);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;

create function public.issue_ingestion_key(p_org uuid, p_label text)
returns table (key_id uuid, token text)
language plpgsql security definer set search_path = '' as $$
declare v_token text; v_id uuid;
begin
  if not private.can_edit_engineering(p_org) then raise exception 'Engineer access with MFA required'; end if;
  if length(btrim(p_label)) not between 1 and 80 then raise exception 'Key label required'; end if;
  if (select count(*) from public.ingestion_keys where org_id = p_org and revoked_at is null) >= 10
  then raise exception 'Maximum active key count reached'; end if;
  v_token := 'sm_' || encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.ingestion_keys(org_id, label, token_prefix, token_hash, created_by)
    values (p_org, btrim(p_label), left(v_token, 11), extensions.digest(v_token, 'sha256'), auth.uid())
    returning id into v_id;
  return query select v_id, v_token;
end;
$$;

create function public.revoke_ingestion_key(p_org uuid, p_key uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_edit_engineering(p_org) then raise exception 'Engineer access with MFA required'; end if;
  update public.ingestion_keys set revoked_at = now()
    where id = p_key and org_id = p_org and revoked_at is null;
  if not found then raise exception 'Active key not found'; end if;
end;
$$;

create function public.authorize_ingestion_key(p_token text)
returns table (org_id uuid, created_by uuid)
language plpgsql security definer set search_path = '' as $$
declare v_key public.ingestion_keys%rowtype; v_window timestamptz; v_requests integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if p_token !~ '^sm_[0-9a-f]{64}$' then return; end if;
  select * into v_key from public.ingestion_keys
    where token_hash = extensions.digest(p_token, 'sha256') and revoked_at is null for update;
  if v_key.id is null then return; end if;
  v_window := date_trunc('minute', now());
  insert into private.ingest_rate_windows(key_id, window_start, requests)
    values (v_key.id, v_window, 1)
    on conflict (key_id, window_start) do update
      set requests = private.ingest_rate_windows.requests + 1
    returning requests into v_requests;
  if v_requests > 60 then raise exception 'Ingestion rate limit exceeded'; end if;
  update public.ingestion_keys set last_used_at = now() where id = v_key.id;
  delete from private.ingest_rate_windows
    where key_id = v_key.id and window_start < now() - interval '1 day';
  return query select v_key.org_id, v_key.created_by;
end;
$$;

revoke all on function public.create_contract_version(uuid,text,text,date,text,numeric,integer,numeric,numeric,numeric,date),
  public.import_contract_versions(uuid,jsonb), public.set_customer_mapping(uuid,text,text,uuid),
  public.create_model_rate(uuid,text,text,date,numeric,numeric,numeric,numeric),
  public.add_provider_statement(uuid,text,date,date,numeric,text),
  public.import_provider_statements(uuid,text,jsonb),
  public.issue_ingestion_key(uuid,text), public.revoke_ingestion_key(uuid,uuid),
  public.authorize_ingestion_key(text) from public;
grant execute on function public.create_contract_version(uuid,text,text,date,text,numeric,integer,numeric,numeric,numeric,date),
  public.import_contract_versions(uuid,jsonb), public.set_customer_mapping(uuid,text,text,uuid),
  public.create_model_rate(uuid,text,text,date,numeric,numeric,numeric,numeric),
  public.add_provider_statement(uuid,text,date,date,numeric,text),
  public.import_provider_statements(uuid,text,jsonb),
  public.issue_ingestion_key(uuid,text), public.revoke_ingestion_key(uuid,uuid) to authenticated;
grant execute on function public.authorize_ingestion_key(text) to service_role;
