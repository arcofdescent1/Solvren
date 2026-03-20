-- Phase 5 — Impact Quantification Engine (§8).

-- 8.1 impact_models
CREATE TABLE IF NOT EXISTS public.impact_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_key text NOT NULL,
  display_name text NOT NULL,
  issue_family text NOT NULL,
  detector_keys_json jsonb NOT NULL DEFAULT '[]',
  description text NOT NULL,
  inputs_schema_json jsonb NOT NULL DEFAULT '{}',
  outputs_schema_json jsonb NOT NULL DEFAULT '{}',
  assumptions_schema_json jsonb NOT NULL DEFAULT '{}',
  confidence_rules_json jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  model_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(model_key, model_version)
);

CREATE INDEX IF NOT EXISTS idx_impact_models_key ON public.impact_models(model_key);
CREATE INDEX IF NOT EXISTS idx_impact_models_family ON public.impact_models(issue_family);

-- 8.2 org_impact_assumptions
CREATE TABLE IF NOT EXISTS public.org_impact_assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  assumption_key text NOT NULL,
  display_name text NOT NULL,
  value_json jsonb NOT NULL DEFAULT '{}',
  value_type text NOT NULL DEFAULT 'number',
  source text NOT NULL DEFAULT 'default',
  effective_from timestamptz NOT NULL DEFAULT now(),
  effective_to timestamptz,
  confidence_score numeric(5,2),
  notes text,
  updated_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_impact_assumptions_org ON public.org_impact_assumptions(org_id);
CREATE INDEX IF NOT EXISTS idx_org_impact_assumptions_key ON public.org_impact_assumptions(org_id, assumption_key, effective_from DESC);

-- 8.3 impact_quantifications (Phase 5 issue/finding impact; legacy impact_assessments stays change-event scoped)
CREATE TABLE IF NOT EXISTS public.impact_quantifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  issue_id uuid REFERENCES public.issues(id) ON DELETE CASCADE,
  finding_id uuid REFERENCES public.detector_findings(id) ON DELETE SET NULL,
  impact_model_id uuid NOT NULL REFERENCES public.impact_models(id) ON DELETE CASCADE,
  model_key text NOT NULL,
  model_version text NOT NULL,
  assessment_status text NOT NULL DEFAULT 'estimated',
  direct_realized_loss_amount numeric(18,2),
  revenue_at_risk_amount numeric(18,2),
  avoided_loss_amount numeric(18,2),
  recovered_value_amount numeric(18,2),
  operational_cost_amount numeric(18,2),
  affected_customer_count integer,
  affected_record_count integer,
  confidence_score numeric(5,2) NOT NULL DEFAULT 0,
  impact_score numeric(5,2) NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'USD',
  inputs_snapshot_json jsonb NOT NULL DEFAULT '{}',
  assumptions_snapshot_json jsonb NOT NULL DEFAULT '{}',
  calculation_breakdown_json jsonb NOT NULL DEFAULT '{}',
  confidence_explanation_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  superseded_by_assessment_id uuid REFERENCES public.impact_quantifications(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_impact_quantifications_org_issue ON public.impact_quantifications(org_id, issue_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_impact_quantifications_org_finding ON public.impact_quantifications(org_id, finding_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_impact_quantifications_model ON public.impact_quantifications(impact_model_id);

-- 8.4 issue_impact_summaries
CREATE TABLE IF NOT EXISTS public.issue_impact_summaries (
  issue_id uuid PRIMARY KEY REFERENCES public.issues(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  latest_assessment_id uuid NOT NULL REFERENCES public.impact_quantifications(id) ON DELETE CASCADE,
  current_direct_realized_loss_amount numeric(18,2),
  current_revenue_at_risk_amount numeric(18,2),
  current_avoided_loss_amount numeric(18,2),
  current_recovered_value_amount numeric(18,2),
  current_operational_cost_amount numeric(18,2),
  current_confidence_score numeric(5,2) NOT NULL DEFAULT 0,
  current_impact_score numeric(5,2) NOT NULL DEFAULT 0,
  currency_code text NOT NULL DEFAULT 'USD',
  last_calculated_at timestamptz NOT NULL,
  last_model_key text NOT NULL,
  last_model_version text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_issue_impact_summaries_org ON public.issue_impact_summaries(org_id);

-- 8.5 impact_recalculation_jobs
CREATE TABLE IF NOT EXISTS public.impact_recalculation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scope_type text NOT NULL,
  scope_ref_json jsonb NOT NULL DEFAULT '{}',
  reason text NOT NULL,
  requested_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  results_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_impact_recalc_jobs_status ON public.impact_recalculation_jobs(org_id, status);

-- RLS
ALTER TABLE public.impact_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_impact_assumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impact_quantifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_impact_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.impact_recalculation_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS impact_models_select ON public.impact_models;
CREATE POLICY impact_models_select ON public.impact_models FOR SELECT USING (true);

DROP POLICY IF EXISTS org_impact_assumptions_select ON public.org_impact_assumptions;
CREATE POLICY org_impact_assumptions_select ON public.org_impact_assumptions FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS org_impact_assumptions_insert ON public.org_impact_assumptions;
CREATE POLICY org_impact_assumptions_insert ON public.org_impact_assumptions FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS org_impact_assumptions_update ON public.org_impact_assumptions;
CREATE POLICY org_impact_assumptions_update ON public.org_impact_assumptions FOR UPDATE USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS impact_quantifications_select ON public.impact_quantifications;
CREATE POLICY impact_quantifications_select ON public.impact_quantifications FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS impact_quantifications_insert ON public.impact_quantifications;
CREATE POLICY impact_quantifications_insert ON public.impact_quantifications FOR INSERT WITH CHECK (public.is_org_member(org_id));

DROP POLICY IF EXISTS issue_impact_summaries_select ON public.issue_impact_summaries;
CREATE POLICY issue_impact_summaries_select ON public.issue_impact_summaries FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS issue_impact_summaries_insert ON public.issue_impact_summaries;
CREATE POLICY issue_impact_summaries_insert ON public.issue_impact_summaries FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS issue_impact_summaries_update ON public.issue_impact_summaries;
CREATE POLICY issue_impact_summaries_update ON public.issue_impact_summaries FOR UPDATE USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS impact_recalc_jobs_select ON public.impact_recalculation_jobs;
CREATE POLICY impact_recalc_jobs_select ON public.impact_recalculation_jobs FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS impact_recalc_jobs_insert ON public.impact_recalculation_jobs;
CREATE POLICY impact_recalc_jobs_insert ON public.impact_recalculation_jobs FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS impact_recalc_jobs_update ON public.impact_recalculation_jobs;
CREATE POLICY impact_recalc_jobs_update ON public.impact_recalculation_jobs FOR UPDATE USING (public.is_org_member(org_id));
