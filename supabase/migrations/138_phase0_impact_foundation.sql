-- Phase 0: issue_impact_assessments (issue-linked impact; existing impact_assessments stays change-linked)

CREATE TABLE IF NOT EXISTS public.issue_impact_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  model_key text NOT NULL,
  model_version text NULL,
  direct_revenue_loss numeric(14,2) NULL,
  revenue_at_risk numeric(14,2) NULL,
  customer_count_affected integer NULL,
  operational_cost_estimate numeric(14,2) NULL,
  confidence_score numeric(5,2) NULL,
  assumptions_json jsonb NOT NULL DEFAULT '{}',
  calculated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_impact_assessments_issue_id ON public.issue_impact_assessments(issue_id);
