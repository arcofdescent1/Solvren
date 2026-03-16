-- Phase 2 Pass 2 — Realized impact + mitigation effectiveness on signal_stats

ALTER TABLE public.signal_stats
  ADD COLUMN IF NOT EXISTS incident_realized_mrr numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incident_realized_revenue numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mitigations_applied_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mitigations_dismissed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mitigations_total_suggested integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mitigation_effectiveness numeric NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signal_stats_mitigation_effectiveness_range') THEN
    ALTER TABLE public.signal_stats
      ADD CONSTRAINT signal_stats_mitigation_effectiveness_range
      CHECK (mitigation_effectiveness >= 0 AND mitigation_effectiveness <= 1);
  END IF;
END $$;
