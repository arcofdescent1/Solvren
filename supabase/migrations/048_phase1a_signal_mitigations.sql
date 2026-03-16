-- Patch 1A.1 — Solvren schema foundation
-- Structured mitigation catalog. Deterministic guardrails mapped to signals.
-- Seeded in Patch 1A.4; returned in Patch 1A.2.

create table if not exists public.signal_mitigations (
  id uuid primary key default gen_random_uuid(),
  signal_key text not null,
  domain text null,                     -- null = global
  severity text not null default 'MED', -- LOW|MED|HIGH
  recommendation text not null,
  evidence_kind text null,              -- e.g. TEST_PLAN, ROLLBACK_PLAN, RUNBOOK
  created_at timestamptz not null default now(),
  unique (signal_key, domain, recommendation)
);

create index if not exists idx_signal_mitigations_key
  on public.signal_mitigations (signal_key);

create index if not exists idx_signal_mitigations_domain
  on public.signal_mitigations (domain);

alter table public.signal_mitigations enable row level security;

-- READ: authenticated users (mitigations are global; org-specific overrides can come later)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'signal_mitigations'
      AND policyname = 'sm_select_authenticated'
  ) THEN
    CREATE POLICY sm_select_authenticated
      ON public.signal_mitigations
      FOR SELECT
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- WRITE: service role only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'signal_mitigations'
      AND policyname = 'sm_insert_service_role'
  ) THEN
    CREATE POLICY sm_insert_service_role
      ON public.signal_mitigations
      FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'signal_mitigations'
      AND policyname = 'sm_update_service_role'
  ) THEN
    CREATE POLICY sm_update_service_role
      ON public.signal_mitigations
      FOR UPDATE
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'signal_mitigations'
      AND policyname = 'sm_delete_service_role'
  ) THEN
    CREATE POLICY sm_delete_service_role
      ON public.signal_mitigations
      FOR DELETE
      USING (auth.role() = 'service_role');
  END IF;
END $$;
