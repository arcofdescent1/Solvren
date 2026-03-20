-- Phase 9 — Safe Mode + Autonomy Confidence Layer

-- 11.1 autonomy_mode_configs
CREATE TABLE IF NOT EXISTS public.autonomy_mode_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scope_type text NOT NULL,
  scope_ref text NULL,
  requested_mode text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_by_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_autonomy_mode_configs_org_scope ON public.autonomy_mode_configs(org_id, scope_type, status);

-- 11.2 autonomy_pause_controls
CREATE TABLE IF NOT EXISTS public.autonomy_pause_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pause_type text NOT NULL,
  scope_type text NOT NULL,
  scope_ref text NULL,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz NULL,
  created_by_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_autonomy_pause_controls_org_status ON public.autonomy_pause_controls(org_id, status);
CREATE INDEX IF NOT EXISTS idx_autonomy_pause_controls_scope ON public.autonomy_pause_controls(org_id, scope_type, scope_ref) WHERE status = 'active';

-- 11.3 autonomy_decision_states
CREATE TABLE IF NOT EXISTS public.autonomy_decision_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  issue_id uuid NULL REFERENCES public.issues(id) ON DELETE SET NULL,
  workflow_run_id uuid NULL,
  action_key text NULL,
  playbook_key text NULL,
  requested_mode text NOT NULL,
  effective_mode text NOT NULL,
  autonomy_confidence_score numeric(5,2) NOT NULL,
  autonomy_confidence_band text NOT NULL,
  downgrade_reason_codes_json jsonb NOT NULL DEFAULT '[]',
  pause_reason_codes_json jsonb NOT NULL DEFAULT '[]',
  supporting_metrics_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_autonomy_decision_states_org_time ON public.autonomy_decision_states(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_autonomy_decision_states_issue ON public.autonomy_decision_states(issue_id, created_at DESC) WHERE issue_id IS NOT NULL;

-- 11.4 automation_execution_envelopes
CREATE TABLE IF NOT EXISTS public.automation_execution_envelopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  issue_id uuid NULL REFERENCES public.issues(id) ON DELETE SET NULL,
  workflow_run_id uuid NULL,
  action_execution_id uuid NULL,
  action_key text NULL,
  playbook_key text NULL,
  requested_mode text NOT NULL,
  effective_mode text NOT NULL,
  autonomy_confidence_score numeric(5,2) NOT NULL,
  autonomy_confidence_band text NOT NULL,
  policy_decision_log_id uuid NULL,
  decision_log_id uuid NULL,
  downgrade_reason_codes_json jsonb NOT NULL DEFAULT '[]',
  execution_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_execution_envelopes_org_time ON public.automation_execution_envelopes(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_execution_envelopes_issue ON public.automation_execution_envelopes(issue_id, created_at DESC) WHERE issue_id IS NOT NULL;

-- RLS
ALTER TABLE public.autonomy_mode_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY autonomy_mode_configs_select ON public.autonomy_mode_configs FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY autonomy_mode_configs_insert ON public.autonomy_mode_configs FOR INSERT WITH CHECK (public.is_org_member(org_id));
CREATE POLICY autonomy_mode_configs_update ON public.autonomy_mode_configs FOR UPDATE USING (public.is_org_member(org_id));

ALTER TABLE public.autonomy_pause_controls ENABLE ROW LEVEL SECURITY;
CREATE POLICY autonomy_pause_controls_select ON public.autonomy_pause_controls FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY autonomy_pause_controls_insert ON public.autonomy_pause_controls FOR INSERT WITH CHECK (public.is_org_member(org_id));
CREATE POLICY autonomy_pause_controls_update ON public.autonomy_pause_controls FOR UPDATE USING (public.is_org_member(org_id));

ALTER TABLE public.autonomy_decision_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY autonomy_decision_states_select ON public.autonomy_decision_states FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY autonomy_decision_states_insert ON public.autonomy_decision_states FOR INSERT WITH CHECK (public.is_org_member(org_id));

ALTER TABLE public.automation_execution_envelopes ENABLE ROW LEVEL SECURITY;
CREATE POLICY automation_execution_envelopes_select ON public.automation_execution_envelopes FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY automation_execution_envelopes_insert ON public.automation_execution_envelopes FOR INSERT WITH CHECK (public.is_org_member(org_id));
