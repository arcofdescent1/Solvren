-- Phase 4 Pass 2 — Exposure bucket + decayed Bayesian stats
-- Bucketed + time-decayed posterior in a separate table to avoid bloating signal_stats.

CREATE TABLE IF NOT EXISTS public.signal_stats_buckets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  domain text NOT NULL,
  signal_key text NOT NULL,
  exposure_bucket text NOT NULL, -- NONE, LOW, MEDIUM, HIGH, CRITICAL

  -- raw counts
  total_changes int NOT NULL DEFAULT 0,
  incident_changes int NOT NULL DEFAULT 0,

  -- time-decayed effective counts
  decayed_total numeric NOT NULL DEFAULT 0,
  decayed_incidents numeric NOT NULL DEFAULT 0,

  -- bayesian posterior (raw counts)
  bayes_alpha numeric NOT NULL DEFAULT 1,
  bayes_beta numeric NOT NULL DEFAULT 1,
  bayes_mean numeric NOT NULL DEFAULT 0,
  bayes_ci_low numeric NOT NULL DEFAULT 0,
  bayes_ci_high numeric NOT NULL DEFAULT 0,

  -- bayesian posterior (decayed effective counts)
  bayes_d_alpha numeric NOT NULL DEFAULT 1,
  bayes_d_beta numeric NOT NULL DEFAULT 1,
  bayes_d_mean numeric NOT NULL DEFAULT 0,
  bayes_d_ci_low numeric NOT NULL DEFAULT 0,
  bayes_d_ci_high numeric NOT NULL DEFAULT 0,
  bayes_d_confidence numeric NOT NULL DEFAULT 0,

  -- mitigation lift stratified
  mitigation_lift numeric NOT NULL DEFAULT 0,
  mitigation_ci_low numeric NOT NULL DEFAULT 0,
  mitigation_ci_high numeric NOT NULL DEFAULT 0,

  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_signal_stats_buckets
  ON public.signal_stats_buckets(org_id, domain, signal_key, exposure_bucket);

CREATE INDEX IF NOT EXISTS idx_signal_stats_buckets_org_domain
  ON public.signal_stats_buckets(org_id, domain);

CREATE INDEX IF NOT EXISTS idx_signal_stats_buckets_signal
  ON public.signal_stats_buckets(signal_key);

ALTER TABLE public.signal_stats_buckets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS signal_stats_buckets_select ON public.signal_stats_buckets;
CREATE POLICY signal_stats_buckets_select ON public.signal_stats_buckets
  FOR SELECT USING (is_org_member(org_id));

DROP POLICY IF EXISTS signal_stats_buckets_write_server ON public.signal_stats_buckets;
CREATE POLICY signal_stats_buckets_write_server ON public.signal_stats_buckets
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
