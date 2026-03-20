-- Phase 5 — Decision Engine Standardization

-- 18.1 decision_models
CREATE TABLE IF NOT EXISTS public.decision_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_key text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL,
  issue_family text NULL,
  weights_json jsonb NOT NULL DEFAULT '{}',
  normalization_rules_json jsonb NOT NULL DEFAULT '{}',
  fallback_rules_json jsonb NOT NULL DEFAULT '{}',
  tie_break_rules_json jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'active',
  model_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_decision_models_key_version
  ON public.decision_models(model_key, model_version);

ALTER TABLE public.decision_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY decision_models_select ON public.decision_models FOR SELECT USING (true);
CREATE POLICY decision_models_service ON public.decision_models FOR ALL USING (auth.role() = 'service_role');

-- 18.2 decision_logs — extend Phase 8 schema for Phase 5
-- Phase 8 decision_logs exists; add Phase 5 columns
ALTER TABLE public.decision_logs
  ADD COLUMN IF NOT EXISTS decision_model_id uuid REFERENCES public.decision_models(id),
  ADD COLUMN IF NOT EXISTS decision_model_key text NULL,
  ADD COLUMN IF NOT EXISTS decision_model_version text NULL,
  ADD COLUMN IF NOT EXISTS candidate_actions_json jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS ineligible_actions_json jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS used_cold_start boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS result_status text NULL,
  ADD COLUMN IF NOT EXISTS context_hash text NULL;

CREATE INDEX IF NOT EXISTS idx_decision_logs_issue
  ON public.decision_logs(issue_id, created_at DESC) WHERE issue_id IS NOT NULL;

-- 18.3 action_performance_stats
CREATE TABLE IF NOT EXISTS public.action_performance_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action_key text NOT NULL,
  issue_family text NULL,

  sample_count integer NOT NULL DEFAULT 0,
  success_count integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,

  avg_time_to_success_seconds numeric(18,2) NULL,
  avg_recovered_amount numeric(18,2) NULL,
  avg_avoided_amount numeric(18,2) NULL,

  stat_window_start timestamptz NULL,
  stat_window_end timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_perf_org_action_family
  ON public.action_performance_stats(org_id, action_key, issue_family);

ALTER TABLE public.action_performance_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY action_performance_stats_select ON public.action_performance_stats FOR SELECT USING (true);
CREATE POLICY action_performance_stats_service ON public.action_performance_stats FOR ALL USING (auth.role() = 'service_role');

-- Seed default decision model
INSERT INTO public.decision_models (
  model_key, display_name, description, status, model_version,
  weights_json, normalization_rules_json, fallback_rules_json, tie_break_rules_json
)
SELECT 'default_action_ranking', 'Default Action Ranking', 'Standard scoring model for action recommendation',
  'active', '1.0.0',
  '{"impact": 0.30, "confidence": 0.20, "historicalSuccess": 0.20, "urgency": 0.15, "policyPreference": 0.05, "strategicBoost": 0.05, "riskPenalty": 0.10, "frictionPenalty": 0.05, "cooldownPenalty": 0.05}'::jsonb,
  '{"impactBands": [[0, 999, 10], [1000, 4999, 30], [5000, 19999, 55], [20000, 99999, 80], [100000, null, 100]], "riskPenaltyMap": {"low": 10, "medium": 30, "high": 60, "critical": 90}}'::jsonb,
  '{"coldStartMinSampleOrgFamily": 20, "coldStartMinSampleOrg": 50}'::jsonb,
  '["weightedScore_desc", "riskPenalty_asc", "historicalSuccess_desc", "frictionPenalty_asc", "actionKey_asc"]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.decision_models WHERE model_key = 'default_action_ranking' AND model_version = '1.0.0');
