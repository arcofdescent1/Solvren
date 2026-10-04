create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  case_number bigint generated always as identity unique,
  org_id uuid references public.organizations(id) on delete set null,
  requester_user_id uuid references auth.users(id) on delete set null,
  email text not null check (length(email) between 3 and 320),
  category text not null check (category in ('product','integration','billing','security','deletion')),
  subject text not null check (length(btrim(subject)) between 5 and 160),
  description text not null check (length(btrim(description)) between 15 and 4000),
  status text not null default 'open' check (status in ('open','in_progress','waiting','resolved')),
  expected_response_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index support_tickets_org_recent on public.support_tickets(org_id,created_at desc);
create index support_tickets_open on public.support_tickets(status,created_at);
alter table public.support_tickets enable row level security;
create policy support_tickets_member_read on public.support_tickets for select to authenticated
  using (org_id is not null and private.can_read_org(org_id));
revoke all on public.support_tickets from anon;
grant select on public.support_tickets to authenticated;
grant select,insert,update,delete on public.support_tickets to service_role;
grant usage,select on sequence public.support_tickets_case_number_seq to service_role;

create table private.support_rate_windows (
  fingerprint bytea not null,
  window_start timestamptz not null,
  request_count integer not null,
  primary key(fingerprint,window_start)
);
revoke all on private.support_rate_windows from public,anon,authenticated;
grant select,insert,update,delete on private.support_rate_windows to service_role;
create function public.phase4_allow_support_request(p_fingerprint bytea)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_count integer;v_window timestamptz := date_trunc('hour',now());
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if length(p_fingerprint) <> 32 then raise exception 'Invalid request fingerprint'; end if;
  insert into private.support_rate_windows(fingerprint,window_start,request_count)
    values(p_fingerprint,v_window,1)
    on conflict(fingerprint,window_start) do update set
      request_count = private.support_rate_windows.request_count+1
    where private.support_rate_windows.request_count < 5
    returning request_count into v_count;
  delete from private.support_rate_windows where window_start < now()-interval '2 days';
  return v_count is not null;
end;
$$;
revoke all on function public.phase4_allow_support_request(bytea) from public;
grant execute on function public.phase4_allow_support_request(bytea) to service_role;
