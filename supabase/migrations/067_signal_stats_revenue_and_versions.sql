-- Phase 2 Pass 1 — Revenue-aware signal stats + model versions
-- Org-scoped signal_stats (separate from global signal_statistics)

CREATE TABLE IF NOT EXISTS public.signal_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain text NOT NULL DEFAULT 'REVENUE',
  signal_key text NOT NULL,

  total_changes integer NOT NULL DEFAULT 0,
  incident_changes integer NOT NULL DEFAULT 0,

  total_revenue_at_risk numeric NOT NULL DEFAULT 0,
  incident_revenue_at_risk numeric NOT NULL DEFAULT 0,

  incident_rate numeric NOT NULL DEFAULT 0,
  revenue_incident_rate numeric NOT NULL DEFAULT 0,

  learned_multiplier numeric NOT NULL DEFAULT 1.0,
  learned_multiplier_reason jsonb NOT NULL DEFAULT '{}'::jsonb,

  model_version integer NOT NULL DEFAULT 1,
  baseline_frozen_at timestamptz NULL,

  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_signal_stats_org_domain_signal_version
  ON public.signal_stats(org_id, domain, signal_key, model_version);

CREATE INDEX IF NOT EXISTS idx_signal_stats_org_domain_signal
  ON public.signal_stats(org_id, domain, signal_key);

ALTER TABLE public.signal_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS signal_stats_select ON public.signal_stats;
CREATE POLICY signal_stats_select ON public.signal_stats
  FOR SELECT USING (is_org_member(org_id));

DROP POLICY IF EXISTS signal_stats_write_server ON public.signal_stats;
CREATE POLICY signal_stats_write_server ON public.signal_stats
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
