-- Phase 5 — Org onboarding state machine + ingestion trigger tracking

CREATE TABLE IF NOT EXISTS public.onboarding_state (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  current_step text NOT NULL DEFAULT 'NOT_STARTED',
  completed_steps text[] NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  initial_detection_triggered_at timestamptz NULL
);

COMMENT ON TABLE public.onboarding_state IS 'Phase 5 — single org onboarding funnel (replaces legacy guided flags).';

ALTER TABLE public.onboarding_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS onboarding_state_select ON public.onboarding_state;
CREATE POLICY onboarding_state_select ON public.onboarding_state
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS onboarding_state_insert ON public.onboarding_state;
CREATE POLICY onboarding_state_insert ON public.onboarding_state
  FOR INSERT WITH CHECK (public.is_org_member(org_id));

DROP POLICY IF EXISTS onboarding_state_update ON public.onboarding_state;
CREATE POLICY onboarding_state_update ON public.onboarding_state
  FOR UPDATE USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS onboarding_state_service ON public.onboarding_state;
CREATE POLICY onboarding_state_service ON public.onboarding_state
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_onboarding_state_step ON public.onboarding_state(current_step);
