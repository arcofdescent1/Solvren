-- Guided Phase 1 onboarding: org state namespace + baseline scan runs + RLS + grandfather backfill

-- 1) Baseline scan runs (history + latest pointer from org_onboarding_states)
CREATE TABLE IF NOT EXISTS public.org_onboarding_scan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'QUEUED',
  source_mode text NOT NULL DEFAULT 'REAL',
  selected_use_cases jsonb NOT NULL DEFAULT '[]'::jsonb,
  connected_integrations jsonb NOT NULL DEFAULT '[]'::jsonb,
  findings jsonb,
  estimated_revenue_at_risk numeric(14,2),
  issue_count integer,
  created_by uuid REFERENCES auth.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_onboarding_scan_runs_org_created
  ON public.org_onboarding_scan_runs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_onboarding_scan_runs_org_status
  ON public.org_onboarding_scan_runs(org_id, status);

DROP TRIGGER IF EXISTS trg_org_onboarding_scan_runs_updated_at ON public.org_onboarding_scan_runs;
CREATE TRIGGER trg_org_onboarding_scan_runs_updated_at
  BEFORE UPDATE ON public.org_onboarding_scan_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) Guided namespace on org_onboarding_states
ALTER TABLE public.org_onboarding_states
  ADD COLUMN IF NOT EXISTS guided_flow_version text,
  ADD COLUMN IF NOT EXISTS guided_phase1_status text,
  ADD COLUMN IF NOT EXISTS guided_current_step_key text,
  ADD COLUMN IF NOT EXISTS company_size text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS primary_goal text,
  ADD COLUMN IF NOT EXISTS selected_use_cases jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS latest_baseline_scan_id uuid REFERENCES public.org_onboarding_scan_runs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS first_insight_summary jsonb,
  ADD COLUMN IF NOT EXISTS results_screen_viewed_at timestamptz;

-- 3) RLS for scan runs (align with org_onboarding_states member model)
ALTER TABLE public.org_onboarding_scan_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_onboarding_scan_runs_select ON public.org_onboarding_scan_runs;
CREATE POLICY org_onboarding_scan_runs_select
  ON public.org_onboarding_scan_runs FOR SELECT
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS org_onboarding_scan_runs_insert ON public.org_onboarding_scan_runs;
CREATE POLICY org_onboarding_scan_runs_insert
  ON public.org_onboarding_scan_runs FOR INSERT
  WITH CHECK (public.is_org_member(org_id));

DROP POLICY IF EXISTS org_onboarding_scan_runs_update ON public.org_onboarding_scan_runs;
CREATE POLICY org_onboarding_scan_runs_update
  ON public.org_onboarding_scan_runs FOR UPDATE
  USING (public.is_org_member(org_id));

-- 4) Grandfather orgs that already reached durable tracker milestones
UPDATE public.org_onboarding_states o
SET
  guided_flow_version = COALESCE(o.guided_flow_version, '1'),
  guided_phase1_status = 'COMPLETED',
  guided_current_step_key = COALESCE(o.guided_current_step_key, 'results')
WHERE o.guided_phase1_status IS NULL
  AND (
    o.first_value_reached = true
    OR o.activated_at IS NOT NULL
    OR o.onboarding_state IN ('FIRST_VALUE_REACHED', 'ACTIVATED')
  );
