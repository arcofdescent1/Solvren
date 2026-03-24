-- Phase 1 — data retention registry (org-scoped defaults; no UI in Phase 1).
-- Soft-delete column on change_events for lifecycle (queries must filter deleted_at IS NULL).

CREATE TABLE IF NOT EXISTS public.data_retention_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  resource_type text NOT NULL,
  retention_days integer NOT NULL CHECK (retention_days > 0 AND retention_days <= 3650),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, resource_type)
);

CREATE INDEX IF NOT EXISTS idx_data_retention_policies_org ON public.data_retention_policies(org_id);

ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_retention_policies_select ON public.data_retention_policies;
CREATE POLICY data_retention_policies_select ON public.data_retention_policies
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS data_retention_policies_insert ON public.data_retention_policies;
CREATE POLICY data_retention_policies_insert ON public.data_retention_policies
  FOR INSERT WITH CHECK (public.is_org_admin(org_id));

DROP POLICY IF EXISTS data_retention_policies_update ON public.data_retention_policies;
CREATE POLICY data_retention_policies_update ON public.data_retention_policies
  FOR UPDATE USING (public.is_org_admin(org_id));

COMMENT ON TABLE public.data_retention_policies IS 'Phase 1: per-org retention days by resource_type; enforced by scheduled cleanup jobs.';

ALTER TABLE public.change_events
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_change_events_org_deleted
  ON public.change_events(org_id, deleted_at)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.change_events.deleted_at IS 'Phase 1: soft-delete tombstone; normal reads must exclude non-null.';
