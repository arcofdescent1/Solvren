-- Phase 5 — Privacy mode, write-back controls, audit (trust productization)

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS privacy_mode text NOT NULL DEFAULT 'minimal',
  ADD COLUMN IF NOT EXISTS write_back_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy_policy_version text NOT NULL DEFAULT 'p5-v1',
  ADD COLUMN IF NOT EXISTS expanded_financial_detail_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_privacy_mode_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_privacy_mode_check CHECK (privacy_mode IN ('minimal', 'expanded'));

COMMENT ON COLUMN public.organizations.privacy_mode IS 'minimal | expanded — data minimization (not automation safe mode).';
COMMENT ON COLUMN public.organizations.write_back_enabled IS 'When false, external mutations are blocked by policy.';

CREATE TABLE IF NOT EXISTS public.write_back_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  action_type text NOT NULL,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('allowed', 'denied')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_write_back_audit_org ON public.write_back_audit(org_id, created_at DESC);

ALTER TABLE public.write_back_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS write_back_audit_org_select ON public.write_back_audit;
CREATE POLICY write_back_audit_org_select ON public.write_back_audit
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = write_back_audit.org_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS write_back_audit_service ON public.write_back_audit;
CREATE POLICY write_back_audit_service ON public.write_back_audit
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.org_privacy_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN ('downgrade_to_minimal')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_org_privacy_jobs_org ON public.org_privacy_jobs(org_id, created_at DESC);

ALTER TABLE public.org_privacy_jobs ENABLE ROW LEVEL SECURITY;

-- Onboarding: privacy review before integrations (existing orgs grandfathered)
ALTER TABLE public.onboarding_state
  ADD COLUMN IF NOT EXISTS privacy_review_completed_at timestamptz;

UPDATE public.onboarding_state
SET privacy_review_completed_at = coalesce(privacy_review_completed_at, now())
WHERE privacy_review_completed_at IS NULL;

-- Optional provenance on derived impact (downgrade worker / recompute can set)
ALTER TABLE public.issue_impact_summaries
  ADD COLUMN IF NOT EXISTS computed_under_privacy_mode text,
  ADD COLUMN IF NOT EXISTS privacy_policy_version text;

DROP POLICY IF EXISTS org_privacy_jobs_service ON public.org_privacy_jobs;
CREATE POLICY org_privacy_jobs_service ON public.org_privacy_jobs
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
