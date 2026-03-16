-- 045_audit_log_change_event_id.sql
-- Phase 3 Item 6: Audit provenance anchored to change_event_id

alter table public.audit_log
  add column if not exists change_event_id uuid null;

comment on column public.audit_log.change_event_id is 'Denormalized pointer for complete Change audit timeline.';

-- Best-effort backfill for existing rows where entity_type=change and entity_id looks like a UUID
update public.audit_log
set change_event_id = nullif(trim(entity_id::text), '')::uuid
where change_event_id is null
  and entity_type = 'change'
  and entity_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

create index if not exists idx_audit_log_change_event
  on public.audit_log(org_id, change_event_id, created_at desc);
