-- Org invitations: time-bound, single-use invites by email and role.
create table if not exists public.org_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null default 'viewer',
  token_hash text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
  invited_by_user_id uuid null references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz null,
  accepted_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_org_invites_token_hash on public.org_invites(token_hash) where status = 'PENDING';
create index if not exists idx_org_invites_org_status on public.org_invites(org_id, status);
create index if not exists idx_org_invites_org_email_pending on public.org_invites(org_id, lower(email)) where status = 'PENDING';

comment on table public.org_invites is 'Invitations to join an organization; token is single-use and time-limited.';

alter table public.org_invites enable row level security;

-- Only org admins can create/read/update invites for their org (service role used in API for insert/update)
drop policy if exists org_invites_select_admin on public.org_invites;
create policy org_invites_select_admin on public.org_invites
  for select using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = org_invites.org_id
        and m.user_id = auth.uid()
        and m.role = 'admin'
    )
  );

-- Write operations: service role only (API uses createAdminClient)
drop policy if exists org_invites_all_service on public.org_invites;
create policy org_invites_all_service on public.org_invites
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- Allow lookup by token for accept flow: no direct select by token_hash for anon.
-- Accept flow will use an API route with service role to look up by token hash and return minimal public info (org name, role).
-- So we do not add a policy for anon; the API handles lookup.

drop trigger if exists trg_org_invites_updated_at on public.org_invites;
create trigger trg_org_invites_updated_at
  before update on public.org_invites
  for each row execute function public.set_updated_at();
