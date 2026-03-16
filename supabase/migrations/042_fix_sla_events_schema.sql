-- 042_fix_sla_events_schema.sql
--
-- Reconcile sla_events schema across historical migrations.
--
-- Background:
-- - 034 created sla_events (no FKs, used triggered_by text / triggered_by_user_id, meta/reason)
-- - 038 attempted to create sla_events with FKs + triggered_source / triggered_by uuid,
--   but was a no-op on fresh installs because the table already existed.
--
-- This migration is idempotent and safe to run on all environments.

-- Ensure normalized columns exist (used by API/UI)
alter table public.sla_events
  add column if not exists triggered_by uuid null;

alter table public.sla_events
  add column if not exists triggered_source text not null default 'SYSTEM';

comment on column public.sla_events.triggered_source is 'SYSTEM | USER | CRON (or other source labels)';

-- Add FK for triggered_by -> auth.users (only when triggered_by is uuid; skip if text from 034)
DO $$
DECLARE
  col_type text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sla_events_triggered_by_fkey') THEN
    RETURN;
  END IF;
  SELECT data_type INTO col_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sla_events' AND column_name = 'triggered_by';
  IF col_type = 'uuid' THEN
    ALTER TABLE public.sla_events
      ADD CONSTRAINT sla_events_triggered_by_fkey
      FOREIGN KEY (triggered_by)
      REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Ensure FK for org_id -> organizations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sla_events_org_id_fkey'
  ) THEN
    ALTER TABLE public.sla_events
      ADD CONSTRAINT sla_events_org_id_fkey
      FOREIGN KEY (org_id)
      REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure FK for change_event_id -> change_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sla_events_change_event_id_fkey'
  ) THEN
    ALTER TABLE public.sla_events
      ADD CONSTRAINT sla_events_change_event_id_fkey
      FOREIGN KEY (change_event_id)
      REFERENCES public.change_events(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Helpful indexes (if older names were used)
create index if not exists idx_sla_events_change
  on public.sla_events(change_event_id, created_at desc);

create index if not exists idx_sla_events_org
  on public.sla_events(org_id, created_at desc);
