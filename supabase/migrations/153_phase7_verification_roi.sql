-- Phase 7: Verification, Learning Loop, and ROI Engine
-- outcomes + issue_outcome_summary

CREATE TABLE IF NOT EXISTS public.outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  action_id uuid NULL REFERENCES public.issue_actions(id) ON DELETE SET NULL,
  outcome_type text NOT NULL CHECK (outcome_type IN ('recovered_revenue', 'avoided_loss', 'operational_savings')),
  amount numeric(18,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  verification_type text NOT NULL CHECK (verification_type IN ('direct', 'inferred', 'probabilistic')),
  confidence_score numeric(5,2) NOT NULL DEFAULT 1.0,
  evidence_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outcomes_org_id ON public.outcomes(org_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_issue_id ON public.outcomes(issue_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_action_id ON public.outcomes(action_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_created_at ON public.outcomes(org_id, created_at DESC);

-- issue_outcome_summary: aggregated per-issue outcome totals
CREATE TABLE IF NOT EXISTS public.issue_outcome_summary (
  issue_id uuid PRIMARY KEY REFERENCES public.issues(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  total_recovered numeric(18,2) NOT NULL DEFAULT 0,
  total_avoided numeric(18,2) NOT NULL DEFAULT 0,
  total_cost_savings numeric(18,2) NOT NULL DEFAULT 0,
  outcome_count int NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_outcome_summary_org ON public.issue_outcome_summary(org_id);

-- org_roi_snapshot: for dashboards (optional, can be computed on-demand)
CREATE TABLE IF NOT EXISTS public.org_roi_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  total_recovered numeric(18,2) NOT NULL DEFAULT 0,
  total_avoided numeric(18,2) NOT NULL DEFAULT 0,
  total_savings numeric(18,2) NOT NULL DEFAULT 0,
  total_cost numeric(18,2) NOT NULL DEFAULT 0,
  roi_multiple numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_roi_snapshots_org_period ON public.org_roi_snapshots(org_id, period_end DESC);

-- RLS
ALTER TABLE public.outcomes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS outcomes_select ON public.outcomes;
CREATE POLICY outcomes_select ON public.outcomes FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS outcomes_insert ON public.outcomes;
CREATE POLICY outcomes_insert ON public.outcomes FOR INSERT WITH CHECK (public.is_org_member(org_id));

ALTER TABLE public.issue_outcome_summary ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS issue_outcome_summary_select ON public.issue_outcome_summary;
CREATE POLICY issue_outcome_summary_select ON public.issue_outcome_summary FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS issue_outcome_summary_insert ON public.issue_outcome_summary;
CREATE POLICY issue_outcome_summary_insert ON public.issue_outcome_summary FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS issue_outcome_summary_update ON public.issue_outcome_summary;
CREATE POLICY issue_outcome_summary_update ON public.issue_outcome_summary FOR UPDATE USING (public.is_org_member(org_id));

ALTER TABLE public.org_roi_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_roi_snapshots_select ON public.org_roi_snapshots;
CREATE POLICY org_roi_snapshots_select ON public.org_roi_snapshots FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS org_roi_snapshots_insert ON public.org_roi_snapshots;
CREATE POLICY org_roi_snapshots_insert ON public.org_roi_snapshots FOR INSERT WITH CHECK (public.is_org_member(org_id));
