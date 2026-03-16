-- Patch 1A.1 — Solvren schema foundation
-- Tracks whether Solvren defaults have been seeded for an org (Patch 1A.4).

create table if not exists public.org_bootstrap_status (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  revenueguard_seeded boolean not null default false,
  seeded_at timestamptz null
);

alter table public.org_bootstrap_status enable row level security;

-- READ: org members can view bootstrap status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'org_bootstrap_status'
      AND policyname = 'obs_select_org_members'
  ) THEN
    CREATE POLICY obs_select_org_members
      ON public.org_bootstrap_status
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.organization_members m
          WHERE m.org_id = org_bootstrap_status.org_id
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
      AND tablename = 'org_bootstrap_status'
      AND policyname = 'obs_insert_service_role'
  ) THEN
    CREATE POLICY obs_insert_service_role
      ON public.org_bootstrap_status
      FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'org_bootstrap_status'
      AND policyname = 'obs_update_service_role'
  ) THEN
    CREATE POLICY obs_update_service_role
      ON public.org_bootstrap_status
      FOR UPDATE
      USING (auth.role() = 'service_role')
      WITH CHECK (auth.role() = 'service_role');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'org_bootstrap_status'
      AND policyname = 'obs_delete_service_role'
  ) THEN
    CREATE POLICY obs_delete_service_role
      ON public.org_bootstrap_status
      FOR DELETE
      USING (auth.role() = 'service_role');
  END IF;
END $$;
