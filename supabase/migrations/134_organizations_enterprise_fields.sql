-- Enterprise registration: org slug and optional company fields.
-- Used by signup/organization flow and team settings.

alter table public.organizations
  add column if not exists slug text,
  add column if not exists website text,
  add column if not exists primary_domain text,
  add column if not exists company_size text,
  add column if not exists industry text;

-- Backfill slug from name for existing rows (lowercase, hyphenated, unique).
do $$
declare
  r record;
  base_slug text;
  candidate text;
  n int;
begin
  for r in select id, name from public.organizations where slug is null
  loop
    base_slug := lower(trim(regexp_replace(r.name, '[^a-z0-9]+', '-', 'gi')));
    base_slug := trim(both '-' from base_slug);
    if length(base_slug) < 1 then
      base_slug := 'org';
    end if;
    candidate := base_slug;
    n := 0;
    while exists (select 1 from public.organizations where slug = candidate and id != r.id)
    loop
      n := n + 1;
      candidate := base_slug || '-' || n;
    end loop;
    update public.organizations set slug = candidate where id = r.id;
  end loop;
end $$;

-- Require slug for existing rows (we backfilled). New rows get slug from app or trigger.
alter table public.organizations
  alter column slug set not null;

create unique index if not exists idx_organizations_slug on public.organizations(slug);

-- Default slug from name on insert when not provided (backward compatibility).
create or replace function public.organizations_slug_default()
returns trigger as $$
declare
  base_slug text;
  candidate text;
  n int := 0;
begin
  if new.slug is not null and new.slug != '' then
    return new;
  end if;
  base_slug := lower(trim(regexp_replace(coalesce(new.name, 'org'), '[^a-z0-9]+', '-', 'gi')));
  base_slug := trim(both '-' from base_slug);
  if length(base_slug) < 1 then
    base_slug := 'org';
  end if;
  candidate := base_slug;
  while exists (select 1 from public.organizations where slug = candidate)
  loop
    n := n + 1;
    candidate := base_slug || '-' || n;
  end loop;
  new.slug := candidate;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_organizations_slug_default on public.organizations;
create trigger trg_organizations_slug_default
  before insert on public.organizations
  for each row execute function public.organizations_slug_default();

comment on column public.organizations.slug is 'URL-safe unique identifier for the organization';
comment on column public.organizations.website is 'Company website URL';
comment on column public.organizations.primary_domain is 'Primary email/website domain (e.g. acme.com)';
comment on column public.organizations.company_size is 'e.g. 1_10, 11_50, 51_200';
comment on column public.organizations.industry is 'e.g. Software, Finance';
