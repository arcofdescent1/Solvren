-- updated_at trigger for user_saved_views
create or replace function public.set_updated_at()
returns trigger as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$ language plpgsql;

drop trigger if exists trg_user_saved_views_updated_at on public.user_saved_views;
create trigger trg_user_saved_views_updated_at
  before update on public.user_saved_views
  for each row execute function public.set_updated_at();

alter table public.user_saved_views enable row level security;

create policy "read own saved views"
  on public.user_saved_views for select using (auth.uid() = user_id);

create policy "insert own saved views"
  on public.user_saved_views for insert with check (auth.uid() = user_id);

create policy "update own saved views"
  on public.user_saved_views for update using (auth.uid() = user_id);

create policy "delete own saved views"
  on public.user_saved_views for delete using (auth.uid() = user_id);
