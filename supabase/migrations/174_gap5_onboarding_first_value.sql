-- Gap 5 — Onboarding, First Value, and Playbook Performance

-- 1. Extend org_onboarding_states with granular progress columns
ALTER TABLE public.org_onboarding_states
  ADD COLUMN IF NOT EXISTS integrations_connected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_signal_received boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_issue_detected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_action_executed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS first_value_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_stage text;

-- Map onboarding_stage: not_started | connected | detecting | acting | verifying | complete
UPDATE public.org_onboarding_states
SET onboarding_stage = CASE
  WHEN first_value_reached THEN 'complete'
  WHEN onboarding_state = 'FIRST_VALUE_REACHED' THEN 'complete'
  WHEN onboarding_state = 'ACTIVATED' THEN 'complete'
  ELSE COALESCE(onboarding_stage, 'not_started')
END
WHERE onboarding_stage IS NULL;

-- 2. playbook_performance — Cumulative metrics per org + playbook
CREATE TABLE IF NOT EXISTS public.playbook_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_definition_id uuid NOT NULL REFERENCES public.playbook_definitions(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  executions int NOT NULL DEFAULT 0,
  successes int NOT NULL DEFAULT 0,
  failures int NOT NULL DEFAULT 0,

  total_recovered_value numeric(18,2) NOT NULL DEFAULT 0,
  total_avoided_loss numeric(18,2) NOT NULL DEFAULT 0,

  avg_execution_time_ms numeric,
  success_rate numeric,

  last_executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE(org_id, playbook_definition_id)
);

CREATE INDEX IF NOT EXISTS idx_playbook_performance_org ON public.playbook_performance(org_id);
ALTER TABLE public.playbook_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY playbook_performance_select ON public.playbook_performance FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY playbook_performance_insert ON public.playbook_performance FOR INSERT WITH CHECK (public.is_org_member(org_id));
CREATE POLICY playbook_performance_update ON public.playbook_performance FOR UPDATE USING (public.is_org_member(org_id));

-- 3. value_events — Value event log for onboarding and value dashboard
CREATE TABLE IF NOT EXISTS public.value_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  issue_id uuid REFERENCES public.issues(id) ON DELETE SET NULL,
  action_execution_id uuid REFERENCES public.integration_action_executions(id) ON DELETE SET NULL,

  value_type text NOT NULL CHECK (value_type IN ('recovered', 'avoided')),
  amount numeric(18,2) NOT NULL,
  confidence numeric(5,4) NOT NULL DEFAULT 1,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_value_events_org ON public.value_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_value_events_issue ON public.value_events(issue_id) WHERE issue_id IS NOT NULL;
ALTER TABLE public.value_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY value_events_select ON public.value_events FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY value_events_insert ON public.value_events FOR INSERT WITH CHECK (public.is_org_member(org_id));
