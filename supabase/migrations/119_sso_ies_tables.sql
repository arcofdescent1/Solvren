-- SSO IES: sso_providers, external_identities, org_role_mappings, sso_login_events
-- Reuses integration_connections (provider='sso') for high-level status

-- sso_providers: per-org IdP configuration
create table if not exists public.sso_providers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider_type text not null check (provider_type in ('okta','google','azure_ad','oidc_custom','saml_custom')),
  protocol text not null check (protocol in ('oidc','saml')),
  display_name text not null default '',
  issuer text,
  authorization_endpoint text,
  token_endpoint text,
  userinfo_endpoint text,
  jwks_uri text,
  saml_sso_url text,
  saml_entity_id text,
  saml_certificate text,
  client_id text,
  client_secret text,
  domain_hint text,
  enabled boolean not null default false,
  enforce_sso boolean not null default false,
  allow_local_fallback boolean not null default true,
  allow_jit_provisioning boolean not null default true,
  attribute_mappings jsonb default '{}',
  scopes text default 'openid profile email',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sso_providers_org on public.sso_providers(org_id);
create index if not exists idx_sso_providers_enabled on public.sso_providers(org_id, enabled) where enabled = true;

-- external_identities: maps IdP identity to Solvren user
create table if not exists public.external_identities (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references public.sso_providers(id) on delete cascade,
  external_subject text not null,
  email text not null,
  email_verified boolean not null default false,
  given_name text,
  family_name text,
  display_name text,
  raw_claims jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider_id, external_subject)
);

create index if not exists idx_external_identities_user on public.external_identities(user_id);
create index if not exists idx_external_identities_provider on public.external_identities(provider_id);
create index if not exists idx_external_identities_email on public.external_identities(org_id, email);

-- org_role_mappings: maps IdP groups/claims to Solvren roles
create table if not exists public.sso_role_mappings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider_id uuid not null references public.sso_providers(id) on delete cascade,
  mapping_type text not null check (mapping_type in ('group','claim','email_domain','default')),
  source_key text,
  source_value text,
  target_role text not null check (target_role in ('owner','admin','submitter','reviewer','approver','viewer')),
  priority int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sso_role_mappings_provider on public.sso_role_mappings(provider_id);

-- sso_login_events: audit trail for SSO attempts
create table if not exists public.sso_login_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete set null,
  provider_id uuid references public.sso_providers(id) on delete set null,
  protocol text not null check (protocol in ('oidc','saml')),
  event_type text not null,
  email text,
  external_subject text,
  status text not null check (status in ('success','failed','blocked')),
  error_code text,
  error_message text,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sso_login_events_org on public.sso_login_events(org_id);
create index if not exists idx_sso_login_events_created on public.sso_login_events(created_at desc);

-- sso_auth_sessions: short-lived state for OIDC flow
create table if not exists public.sso_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  state text not null unique,
  nonce text not null,
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider_id uuid not null references public.sso_providers(id) on delete cascade,
  redirect_success_url text,
  redirect_failure_url text,
  login_hint text,
  created_at timestamptz not null default now()
);

create index if not exists idx_sso_auth_sessions_state on public.sso_auth_sessions(state);

-- RLS
alter table public.sso_providers enable row level security;
alter table public.external_identities enable row level security;
alter table public.sso_role_mappings enable row level security;
alter table public.sso_login_events enable row level security;
alter table public.sso_auth_sessions enable row level security;

create policy sso_providers_read_org on public.sso_providers
  for select using (
    exists (select 1 from public.organization_members m where m.org_id = sso_providers.org_id and m.user_id = auth.uid())
  );
create policy sso_providers_write_admin on public.sso_providers
  for all using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = sso_providers.org_id and m.user_id = auth.uid()
      and m.role in ('owner','admin')
    )
  ) with check (
    exists (
      select 1 from public.organization_members m
      where m.org_id = sso_providers.org_id and m.user_id = auth.uid()
      and m.role in ('owner','admin')
    )
  );

create policy external_identities_read_own on public.external_identities
  for select using (user_id = auth.uid());
create policy external_identities_service on public.external_identities
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy sso_role_mappings_read_org on public.sso_role_mappings
  for select using (
    exists (select 1 from public.organization_members m where m.org_id = sso_role_mappings.org_id and m.user_id = auth.uid())
  );
create policy sso_role_mappings_write_admin on public.sso_role_mappings
  for all using (
    exists (
      select 1 from public.organization_members m
      where m.org_id = sso_role_mappings.org_id and m.user_id = auth.uid()
      and m.role in ('owner','admin')
    )
  ) with check (
    exists (
      select 1 from public.organization_members m
      where m.org_id = sso_role_mappings.org_id and m.user_id = auth.uid()
      and m.role in ('owner','admin')
    )
  );

create policy sso_login_events_read_org on public.sso_login_events
  for select using (
    org_id is null or exists (select 1 from public.organization_members m where m.org_id = sso_login_events.org_id and m.user_id = auth.uid())
  );
create policy sso_login_events_insert_service on public.sso_login_events
  for insert with check (auth.role() = 'service_role');

create policy sso_auth_sessions_service on public.sso_auth_sessions
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

-- triggers
drop trigger if exists trg_sso_providers_updated_at on public.sso_providers;
create trigger trg_sso_providers_updated_at before update on public.sso_providers
  for each row execute function set_updated_at();
drop trigger if exists trg_external_identities_updated_at on public.external_identities;
create trigger trg_external_identities_updated_at before update on public.external_identities
  for each row execute function set_updated_at();
drop trigger if exists trg_sso_role_mappings_updated_at on public.sso_role_mappings;
create trigger trg_sso_role_mappings_updated_at before update on public.sso_role_mappings
  for each row execute function set_updated_at();

-- RPC for JIT: lookup auth user by email (service_role only via server)
create or replace function public.get_auth_user_id_by_email(p_email text)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from auth.users where email = lower(trim(p_email)) limit 1;
$$;
