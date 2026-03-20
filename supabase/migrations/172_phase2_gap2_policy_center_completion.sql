-- Phase 2 Gap 2 — Policy Center Completion

-- 7.1 policies additions
ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS is_system_policy boolean NOT NULL DEFAULT false;
ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;
ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS updated_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 7.2 policy_versions
CREATE TABLE IF NOT EXISTS public.policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id uuid NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  version integer NOT NULL,
  snapshot_json jsonb NOT NULL,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_policy_versions_policy_version
  ON public.policy_versions(policy_id, version);

CREATE INDEX IF NOT EXISTS idx_policy_versions_policy ON public.policy_versions(policy_id);

-- 7.3 policy_ui_drafts
CREATE TABLE IF NOT EXISTS public.policy_ui_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  policy_key text NULL,
  draft_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policy_ui_drafts_org_user ON public.policy_ui_drafts(org_id, created_by_user_id);

-- RLS for policy_versions and policy_ui_drafts
ALTER TABLE public.policy_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS policy_versions_select ON public.policy_versions;
CREATE POLICY policy_versions_select ON public.policy_versions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.policies p WHERE p.id = policy_versions.policy_id AND (p.org_id IS NULL OR public.is_org_member(p.org_id))));
DROP POLICY IF EXISTS policy_versions_insert ON public.policy_versions;
CREATE POLICY policy_versions_insert ON public.policy_versions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.policies p WHERE p.id = policy_versions.policy_id AND (p.org_id IS NULL OR public.is_org_member(p.org_id))));

ALTER TABLE public.policy_ui_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS policy_ui_drafts_select ON public.policy_ui_drafts;
CREATE POLICY policy_ui_drafts_select ON public.policy_ui_drafts FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS policy_ui_drafts_insert ON public.policy_ui_drafts;
CREATE POLICY policy_ui_drafts_insert ON public.policy_ui_drafts FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS policy_ui_drafts_update ON public.policy_ui_drafts;
CREATE POLICY policy_ui_drafts_update ON public.policy_ui_drafts FOR UPDATE USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS policy_ui_drafts_delete ON public.policy_ui_drafts;
CREATE POLICY policy_ui_drafts_delete ON public.policy_ui_drafts FOR DELETE USING (public.is_org_member(org_id));

-- policy_exceptions: add update policy for deactivate
DROP POLICY IF EXISTS policy_exceptions_update ON public.policy_exceptions;
CREATE POLICY policy_exceptions_update ON public.policy_exceptions FOR UPDATE USING (public.is_org_member(org_id));
