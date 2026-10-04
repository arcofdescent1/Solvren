create function public.store_connector_credential(p_org uuid, p_provider text, p_secret text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_existing uuid;
  v_new uuid;
begin
  if not private.is_verified() or auth.jwt()->>'aal' <> 'aal2'
     or private.member_role_for(p_org) not in ('owner', 'engineer')
  then raise exception 'Engineer or owner with MFA required'; end if;
  if p_provider not in ('openai', 'anthropic', 'langfuse', 'stripe') then raise exception 'Unsupported provider'; end if;
  if char_length(p_secret) < 8 or char_length(p_secret) > 8192 then raise exception 'Invalid credential'; end if;
  select vault_secret_id into v_existing from private.connector_credentials
    where org_id = p_org and provider = p_provider for update;
  if v_existing is null then
    v_new := vault.create_secret(p_secret);
    insert into private.connector_credentials(org_id, provider, vault_secret_id)
      values (p_org, p_provider, v_new);
  else
    perform vault.update_secret(v_existing, p_secret);
    update private.connector_credentials set updated_at = now()
      where org_id = p_org and provider = p_provider;
  end if;
end;
$$;

create function public.disconnect_connector_credential(p_org uuid, p_provider text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_secret uuid;
begin
  if not private.is_verified() or auth.jwt()->>'aal' <> 'aal2'
     or private.member_role_for(p_org) not in ('owner', 'engineer')
  then raise exception 'Engineer or owner with MFA required'; end if;
  delete from private.connector_credentials where org_id = p_org and provider = p_provider
    returning vault_secret_id into v_secret;
  if v_secret is not null then delete from vault.secrets where id = v_secret; end if;
end;
$$;

create function public.read_connector_credential_for_worker(p_org uuid, p_provider text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare v_value text;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  select s.decrypted_secret into v_value
    from private.connector_credentials c join vault.decrypted_secrets s on s.id = c.vault_secret_id
    where c.org_id = p_org and c.provider = p_provider;
  return v_value;
end;
$$;

revoke all on function public.store_connector_credential(uuid,text,text),
  public.disconnect_connector_credential(uuid,text),
  public.read_connector_credential_for_worker(uuid,text) from public;
grant execute on function public.store_connector_credential(uuid,text,text),
  public.disconnect_connector_credential(uuid,text) to authenticated;
grant execute on function public.read_connector_credential_for_worker(uuid,text) to service_role;
