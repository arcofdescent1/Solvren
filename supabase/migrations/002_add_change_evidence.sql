-- Change evidence (links, notes, artifacts)
create table if not exists change_evidence (
  id uuid primary key default gen_random_uuid(),
  change_event_id uuid not null references change_events(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,

  kind text not null,
  label text not null,
  url text,
  note text,

  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_change_evidence_event on change_evidence(change_event_id);

alter table change_evidence enable row level security;

drop policy if exists evidence_select on change_evidence;
create policy evidence_select on change_evidence
for select using (
  exists (
    select 1 from change_events ce
    where ce.id = change_event_id and is_org_member(ce.org_id)
  )
);

drop policy if exists evidence_insert on change_evidence;
create policy evidence_insert on change_evidence
for insert with check (is_org_member(org_id));
