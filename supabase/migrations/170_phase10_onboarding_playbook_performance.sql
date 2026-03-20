-- Phase 10 — Onboarding + Playbook Performance Dashboard

-- 9.1 org_onboarding_states
CREATE TABLE IF NOT EXISTS public.org_onboarding_states (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  onboarding_state text NOT NULL DEFAULT 'NOT_STARTED',
  first_value_reached boolean NOT NULL DEFAULT false,
  first_value_at timestamptz NULL,
  activated_at timestamptz NULL,
  current_step_key text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 9.2 org_onboarding_steps
CREATE TABLE IF NOT EXISTS public.org_onboarding_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  step_group text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL,
  step_status text NOT NULL DEFAULT 'PENDING',
  required boolean NOT NULL DEFAULT true,
  blocked_reason_code text NULL,
  blocked_reason_text text NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_onboarding_steps_org_step
  ON public.org_onboarding_steps(org_id, step_key);
CREATE INDEX IF NOT EXISTS idx_org_onboarding_steps_org_status ON public.org_onboarding_steps(org_id, step_status);

-- 9.3 org_onboarding_milestones
CREATE TABLE IF NOT EXISTS public.org_onboarding_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  milestone_key text NOT NULL,
  reached boolean NOT NULL DEFAULT false,
  reached_at timestamptz NULL,
  detail_payload_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_onboarding_milestones_org_key
  ON public.org_onboarding_milestones(org_id, milestone_key);
CREATE INDEX IF NOT EXISTS idx_org_onboarding_milestones_org ON public.org_onboarding_milestones(org_id);

-- 9.4 playbook_performance_snapshots
CREATE TABLE IF NOT EXISTS public.playbook_performance_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  playbook_key text NOT NULL,
  snapshot_window_start timestamptz NOT NULL,
  snapshot_window_end timestamptz NOT NULL,
  run_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,
  partial_success_count integer NOT NULL DEFAULT 0,
  recovered_amount numeric(18,2) NOT NULL DEFAULT 0,
  avoided_amount numeric(18,2) NOT NULL DEFAULT 0,
  savings_amount numeric(18,2) NOT NULL DEFAULT 0,
  realized_loss_amount numeric(18,2) NOT NULL DEFAULT 0,
  avg_time_to_resolution_seconds numeric(18,2) NULL,
  verification_success_rate numeric(5,4) NULL,
  automation_rate numeric(5,4) NULL,
  approval_rate numeric(5,4) NULL,
  performance_score numeric(5,2) NOT NULL DEFAULT 0,
  health_state text NOT NULL,
  reasons_json jsonb NOT NULL DEFAULT '[]',
  metrics_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_playbook_perf_org_playbook_window
  ON public.playbook_performance_snapshots(org_id, playbook_key, snapshot_window_end DESC);
CREATE INDEX IF NOT EXISTS idx_playbook_perf_org_time ON public.playbook_performance_snapshots(org_id, snapshot_window_end DESC);

-- 9.5 activation_recommendations
CREATE TABLE IF NOT EXISTS public.activation_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recommendation_type text NOT NULL,
  target_key text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  recommendation_status text NOT NULL DEFAULT 'OPEN',
  confidence_score numeric(5,2) NOT NULL DEFAULT 0,
  evidence_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activation_recommendations_org_status ON public.activation_recommendations(org_id, recommendation_status);

-- RLS
ALTER TABLE public.org_onboarding_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_onboarding_states_select ON public.org_onboarding_states FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY org_onboarding_states_insert ON public.org_onboarding_states FOR INSERT WITH CHECK (public.is_org_member(org_id));
CREATE POLICY org_onboarding_states_update ON public.org_onboarding_states FOR UPDATE USING (public.is_org_member(org_id));

ALTER TABLE public.org_onboarding_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_onboarding_steps_select ON public.org_onboarding_steps FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY org_onboarding_steps_insert ON public.org_onboarding_steps FOR INSERT WITH CHECK (public.is_org_member(org_id));
CREATE POLICY org_onboarding_steps_update ON public.org_onboarding_steps FOR UPDATE USING (public.is_org_member(org_id));

ALTER TABLE public.org_onboarding_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_onboarding_milestones_select ON public.org_onboarding_milestones FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY org_onboarding_milestones_insert ON public.org_onboarding_milestones FOR INSERT WITH CHECK (public.is_org_member(org_id));
CREATE POLICY org_onboarding_milestones_update ON public.org_onboarding_milestones FOR UPDATE USING (public.is_org_member(org_id));

ALTER TABLE public.playbook_performance_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY playbook_performance_snapshots_select ON public.playbook_performance_snapshots FOR SELECT USING (public.is_org_member(org_id));

ALTER TABLE public.activation_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY activation_recommendations_select ON public.activation_recommendations FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY activation_recommendations_insert ON public.activation_recommendations FOR INSERT WITH CHECK (public.is_org_member(org_id));
CREATE POLICY activation_recommendations_update ON public.activation_recommendations FOR UPDATE USING (public.is_org_member(org_id));
