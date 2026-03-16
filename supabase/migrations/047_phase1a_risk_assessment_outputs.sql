-- Patch 1A.1 — Solvren schema foundation
-- Executive-ready computed assessment snapshots.
-- Written by server-side compute (Patch 1A.2) and used by executive dashboards (Patch 1A.3).

create table if not exists public.risk_assessment_outputs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  change_event_id uuid not null references public.change_events(id) on delete cascade,

  -- computed scores
  base_risk_score numeric not null,
  exposure_score numeric not null,
  risk_bucket text not null,     -- LOW|MEDIUM|HIGH|CRITICAL
  exposure_bucket text not null, -- NONE|LOW|MED|HIGH|EXTREME

  -- explainable multipliers
  revenue_surface_multiplier numeric not null default 1,
  mrr_multiplier numeric not null default 1,
  customer_multiplier numeric not null default 1,

  -- explainability
  top_signal_drivers jsonb not null default '[]'::jsonb,
  computed_at timestamptz not null default now()
);

create index if not exists idx_risk_assessment_outputs_change_time
  on public.risk_assessment_outputs (change_event_id, computed_at desc);

create index if not exists idx_risk_assessment_outputs_org_time
  on public.risk_assessment_outputs (org_id, computed_at desc);

alter table public.risk_assessment_outputs enable row level security;

-- READ: org members can read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'risk_assessment_outputs'
      AND policyname = 'rao_select_org_members'
  ) THEN
    CREATE POLICY rao_select_org_members
      ON public.risk_assessment_outputs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.organization_members m
          WHERE m.org_id = risk_assessment_outputs.org_id
            AND m.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- WRITE: service role only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'risk_assessment_outputs'
      AND policyname = 'rao_insert_service_role'
  ) THEN
    CREATE POLICY rao_insert_service_role
      ON public.risk_assessment_outputs
      FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'risk_assessment_outputs'
      AND policyname = 'rao_update_service_role'
  ) THEN
    CREATE POLICY rao_update_service_role
      ON public.risk_assessment_outputs
      FOR UPDATE
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'risk_assessment_outputs'
      AND policyname = 'rao_delete_service_role'
  ) THEN
    CREATE POLICY rao_delete_service_role
      ON public.risk_assessment_outputs
      FOR DELETE
      USING (auth.role() = 'service_role');
  END IF;
END $$;
