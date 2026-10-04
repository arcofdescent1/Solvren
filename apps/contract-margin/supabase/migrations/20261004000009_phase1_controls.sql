create function public.set_org_target_margin(p_org uuid, p_target numeric)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_edit_finance(p_org) then raise exception 'Finance access with MFA required'; end if;
  if p_target is null or p_target < 0 or p_target > 100
    or scale(p_target) > 2 then raise exception 'Enter a percentage from 0 to 100 with at most two decimals'; end if;
  update public.organizations set target_margin_pct = p_target where id = p_org;
end;
$$;

create function private.revoke_departed_member_keys()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' or (old.role in ('owner', 'engineer') and new.role not in ('owner', 'engineer')) then
    update public.ingestion_keys set revoked_at = now()
      where org_id = old.org_id and created_by = old.user_id and revoked_at is null;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger revoke_departed_member_keys
after delete or update of role on public.organization_members
for each row execute function private.revoke_departed_member_keys();

revoke all on function public.set_org_target_margin(uuid,numeric) from public;
grant execute on function public.set_org_target_margin(uuid,numeric) to authenticated;
