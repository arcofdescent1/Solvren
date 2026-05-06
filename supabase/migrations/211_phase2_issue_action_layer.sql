-- Phase 2 — Extend issue_status enum only (PostgreSQL: new enum labels cannot be used in the same
-- transaction they are added; schema + data migration continues in 212_phase2_issue_action_layer_schema.sql).

-- ---------------------------------------------------------------------------
-- 1) Extend issue_status enum (additive)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER TYPE public.issue_status ADD VALUE 'detected';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.issue_status ADD VALUE 'acknowledged';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TYPE public.issue_status ADD VALUE 'reopened';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
