-- Phase 2 Pass 2 — Track mitigation APPLIED/DISMISSED per change

CREATE TABLE IF NOT EXISTS public.change_mitigation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  change_event_id uuid NOT NULL REFERENCES public.change_events(id) ON DELETE CASCADE,
  domain text NOT NULL DEFAULT 'REVENUE',
  signal_key text NULL,
  mitigation_id uuid NULL,
  mitigation_key text NULL,
  recommendation text NULL,
  status text NOT NULL DEFAULT 'SUGGESTED',
  applied_at timestamptz NULL,
  dismissed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cma_org_change ON public.change_mitigation_actions(org_id, change_event_id);
CREATE INDEX IF NOT EXISTS idx_cma_org_domain_signal ON public.change_mitigation_actions(org_id, domain, signal_key);

ALTER TABLE public.change_mitigation_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cma_select ON public.change_mitigation_actions;
CREATE POLICY cma_select ON public.change_mitigation_actions
  FOR SELECT USING (is_org_member(org_id));

DROP POLICY IF EXISTS cma_write ON public.change_mitigation_actions;
CREATE POLICY cma_write ON public.change_mitigation_actions
  FOR INSERT WITH CHECK (is_org_member(org_id));

DROP POLICY IF EXISTS cma_update ON public.change_mitigation_actions;
CREATE POLICY cma_update ON public.change_mitigation_actions
  FOR UPDATE USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));
