-- Phase 8: Autonomy, Orchestration, Policy Engine, Network Intelligence

-- 9.1 policies
CREATE TABLE IF NOT EXISTS public.policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  policy_key text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL,
  policy_scope text NOT NULL,
  scope_ref_json jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  autonomy_mode text NOT NULL,
  policy_rules_json jsonb NOT NULL,
  priority_order int NOT NULL DEFAULT 100,
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz NULL,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policies_org_scope_status ON public.policies(org_id, policy_scope, status);
CREATE INDEX IF NOT EXISTS idx_policies_org_key_effective ON public.policies(org_id, policy_key, effective_from DESC);

-- 9.2 playbook_definitions
CREATE TABLE IF NOT EXISTS public.playbook_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_key text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL,
  issue_family text NOT NULL,
  detector_keys_json jsonb NOT NULL DEFAULT '[]',
  entry_conditions_json jsonb NOT NULL,
  steps_json jsonb NOT NULL,
  branching_rules_json jsonb NOT NULL DEFAULT '{}',
  timeout_rules_json jsonb NOT NULL DEFAULT '{}',
  rollback_rules_json jsonb NOT NULL DEFAULT '{}',
  required_actions_json jsonb NOT NULL DEFAULT '[]',
  required_integrations_json jsonb NOT NULL DEFAULT '[]',
  default_autonomy_mode text NOT NULL,
  playbook_version text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(playbook_key, playbook_version)
);

-- 9.3 org_playbook_configs
CREATE TABLE IF NOT EXISTS public.org_playbook_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  playbook_definition_id uuid NOT NULL REFERENCES public.playbook_definitions(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  autonomy_mode_override text NULL,
  step_overrides_json jsonb NOT NULL DEFAULT '{}',
  approval_overrides_json jsonb NOT NULL DEFAULT '{}',
  rollout_state text NOT NULL DEFAULT 'off',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, playbook_definition_id)
);

CREATE INDEX IF NOT EXISTS idx_org_playbook_configs_org ON public.org_playbook_configs(org_id);

-- 9.4 workflow_runs
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  playbook_definition_id uuid NOT NULL REFERENCES public.playbook_definitions(id) ON DELETE CASCADE,
  issue_id uuid REFERENCES public.issues(id) ON DELETE CASCADE,
  finding_id uuid NULL,
  entry_signal_id uuid NULL,
  run_status text NOT NULL,
  current_step_key text NULL,
  autonomy_mode text NOT NULL,
  policy_snapshot_json jsonb NOT NULL,
  input_snapshot_json jsonb NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs_org_status ON public.workflow_runs(org_id, run_status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_issue ON public.workflow_runs(issue_id);

-- 9.5 workflow_step_runs
CREATE TABLE IF NOT EXISTS public.workflow_step_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_run_id uuid NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  step_type text NOT NULL,
  status text NOT NULL,
  decision_log_id uuid NULL,
  action_execution_id uuid NULL,
  input_json jsonb NOT NULL DEFAULT '{}',
  output_json jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workflow_step_runs_run ON public.workflow_step_runs(workflow_run_id);

-- 9.6 decision_logs
CREATE TABLE IF NOT EXISTS public.decision_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  workflow_run_id uuid REFERENCES public.workflow_runs(id) ON DELETE SET NULL,
  issue_id uuid REFERENCES public.issues(id) ON DELETE SET NULL,
  finding_id uuid NULL,
  decision_context_json jsonb NOT NULL,
  eligible_actions_json jsonb NOT NULL,
  blocked_actions_json jsonb NOT NULL,
  ranked_actions_json jsonb NOT NULL,
  selected_action_key text NULL,
  selection_reason_json jsonb NOT NULL,
  policy_constraints_json jsonb NOT NULL,
  confidence_score numeric(5,2) NOT NULL,
  requires_approval boolean NOT NULL DEFAULT false,
  decision_status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_logs_org_created ON public.decision_logs(org_id, created_at DESC);

-- 9.7 simulation_runs
CREATE TABLE IF NOT EXISTS public.simulation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  simulation_type text NOT NULL,
  scope_json jsonb NOT NULL,
  playbook_definition_id uuid REFERENCES public.playbook_definitions(id) ON DELETE SET NULL,
  policy_set_snapshot_json jsonb NOT NULL,
  historical_window_start timestamptz NOT NULL,
  historical_window_end timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  results_json jsonb NULL,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_simulation_runs_org_status ON public.simulation_runs(org_id, status);

-- 9.8 benchmark_snapshots
CREATE TABLE IF NOT EXISTS public.benchmark_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_key text NOT NULL,
  snapshot_time timestamptz NOT NULL,
  cohort_definition_json jsonb NOT NULL,
  metrics_json jsonb NOT NULL,
  minimum_org_count int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_snapshots_cohort ON public.benchmark_snapshots(cohort_key, snapshot_time DESC);

-- 9.9 recommendations
CREATE TABLE IF NOT EXISTS public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recommendation_type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  recommended_change_json jsonb NOT NULL,
  evidence_json jsonb NOT NULL,
  estimated_uplift_json jsonb NOT NULL,
  confidence_score numeric(5,2) NOT NULL,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recommendations_org_status ON public.recommendations(org_id, status);

-- 9.10 policy_exceptions
CREATE TABLE IF NOT EXISTS public.policy_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  policy_id uuid NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  exception_scope_json jsonb NOT NULL,
  reason text NOT NULL,
  approved_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  effective_from timestamptz NOT NULL,
  effective_to timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- org_autonomy_settings: global pause and controls
CREATE TABLE IF NOT EXISTS public.org_autonomy_settings (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  automation_paused boolean NOT NULL DEFAULT false,
  paused_at timestamptz NULL,
  paused_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pause_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY policies_select ON public.policies FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY policies_insert ON public.policies FOR INSERT WITH CHECK (public.is_org_member(org_id));
CREATE POLICY policies_update ON public.policies FOR UPDATE USING (public.is_org_member(org_id));

ALTER TABLE public.playbook_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY playbook_definitions_select ON public.playbook_definitions FOR SELECT USING (true);

ALTER TABLE public.org_playbook_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_playbook_configs_select ON public.org_playbook_configs FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY org_playbook_configs_insert ON public.org_playbook_configs FOR INSERT WITH CHECK (public.is_org_member(org_id));
CREATE POLICY org_playbook_configs_update ON public.org_playbook_configs FOR UPDATE USING (public.is_org_member(org_id));

ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY workflow_runs_select ON public.workflow_runs FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY workflow_runs_insert ON public.workflow_runs FOR INSERT WITH CHECK (public.is_org_member(org_id));

ALTER TABLE public.workflow_step_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY workflow_step_runs_select ON public.workflow_step_runs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.workflow_runs wr WHERE wr.id = workflow_step_runs.workflow_run_id AND public.is_org_member(wr.org_id)));
CREATE POLICY workflow_step_runs_insert ON public.workflow_step_runs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.workflow_runs wr WHERE wr.id = workflow_step_runs.workflow_run_id AND public.is_org_member(wr.org_id)));

ALTER TABLE public.decision_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY decision_logs_select ON public.decision_logs FOR SELECT USING (public.is_org_member(org_id));

ALTER TABLE public.simulation_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY simulation_runs_select ON public.simulation_runs FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY simulation_runs_insert ON public.simulation_runs FOR INSERT WITH CHECK (public.is_org_member(org_id));

ALTER TABLE public.benchmark_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY benchmark_snapshots_select ON public.benchmark_snapshots FOR SELECT USING (true);

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY recommendations_select ON public.recommendations FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY recommendations_insert ON public.recommendations FOR INSERT WITH CHECK (public.is_org_member(org_id));
CREATE POLICY recommendations_update ON public.recommendations FOR UPDATE USING (public.is_org_member(org_id));

ALTER TABLE public.policy_exceptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY policy_exceptions_select ON public.policy_exceptions FOR SELECT USING (public.is_org_member(org_id));

ALTER TABLE public.org_autonomy_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_autonomy_settings_select ON public.org_autonomy_settings FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY org_autonomy_settings_insert ON public.org_autonomy_settings FOR INSERT WITH CHECK (public.is_org_member(org_id));
CREATE POLICY org_autonomy_settings_update ON public.org_autonomy_settings FOR UPDATE USING (public.is_org_member(org_id));
