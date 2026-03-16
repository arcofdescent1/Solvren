-- Patch 1B.5 — Weekly Digest settings

create table if not exists public.digest_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,

  enabled boolean not null default false,

  slack_enabled boolean not null default true,
  email_enabled boolean not null default true,

  slack_channel_id text null,
  email_recipients text[] null,

  cadence text not null default 'WEEKLY',
  timezone text null default 'UTC',
  day_of_week int null default 1,
  hour_local int null default 9,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_digest_settings_enabled on public.digest_settings(enabled);

alter table public.digest_settings enable row level security;

drop policy if exists digest_settings_select on public.digest_settings;
create policy digest_settings_select on public.digest_settings
for select using (
  exists (
    select 1 from public.organization_members m
    where m.org_id = digest_settings.org_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists digest_settings_admin_write on public.digest_settings;
create policy digest_settings_admin_write on public.digest_settings
for insert with check (
  exists (
    select 1 from public.organization_members m
    where m.org_id = digest_settings.org_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
  )
);

drop policy if exists digest_settings_admin_update on public.digest_settings;
create policy digest_settings_admin_update on public.digest_settings
for update using (
  exists (
    select 1 from public.organization_members m
    where m.org_id = digest_settings.org_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
  )
) with check (
  exists (
    select 1 from public.organization_members m
    where m.org_id = digest_settings.org_id
      and m.user_id = auth.uid()
      and m.role = 'admin'
  )
);

drop trigger if exists trg_digest_settings_updated_at on public.digest_settings;
create trigger trg_digest_settings_updated_at
before update on public.digest_settings
for each row execute function public.set_updated_at();
