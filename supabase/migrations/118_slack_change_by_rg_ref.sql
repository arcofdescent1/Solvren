-- RPC for /rg status RG-xxxxxxxx lookup (prefix match on change id)
create or replace function public.get_change_by_rg_ref(
  p_org_id uuid,
  p_ref text
)
returns table (
  id uuid,
  title text,
  domain text,
  status text
)
language sql
security definer
stable
as $$
  select ce.id, ce.title, ce.domain, ce.status
  from public.change_events ce
  where ce.org_id = p_org_id
    and ce.id::text like lower(p_ref) || '%'
  limit 1;
$$;
