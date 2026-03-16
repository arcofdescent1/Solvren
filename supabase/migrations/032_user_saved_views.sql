-- Phase 3 Item 3.2: Saved views per user
create table if not exists public.user_saved_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  query jsonb not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_saved_views_user_name_unique
  on public.user_saved_views(user_id, name);

create index if not exists user_saved_views_user_default_idx
  on public.user_saved_views(user_id, is_default);
