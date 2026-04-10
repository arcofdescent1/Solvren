-- Phase 1 — Executive safe surfaces: executive decisions + org revenue threshold default

CREATE TABLE IF NOT EXISTS public.executive_change_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  change_id uuid NOT NULL REFERENCES public.change_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('APPROVE', 'DELAY', 'ESCALATE', 'REQUEST_INFO')),
  comment text NULL,
  recommendation_snapshot text NULL,
  risk_level_snapshot text NULL,
  revenue_at_risk_snapshot numeric NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_executive_change_decisions_org_change_created
  ON public.executive_change_decisions(org_id, change_id, created_at DESC);

ALTER TABLE public.executive_change_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS executive_change_decisions_select ON public.executive_change_decisions;
CREATE POLICY executive_change_decisions_select ON public.executive_change_decisions
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS executive_change_decisions_insert ON public.executive_change_decisions;
CREATE POLICY executive_change_decisions_insert ON public.executive_change_decisions
  FOR INSERT WITH CHECK (
    public.is_org_member(org_id)
    AND user_id = auth.uid()
  );

COMMENT ON TABLE public.executive_change_decisions IS
  'Phase 1 executive decision layer (separate from domain approvals).';

ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS executive_revenue_escalation_threshold_usd numeric NULL
  DEFAULT 100000;

COMMENT ON COLUMN public.organization_settings.executive_revenue_escalation_threshold_usd IS
  'Revenue at risk (USD) at or above which executive recommendation escalates; default 100000 when null.';
