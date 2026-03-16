-- Phase 4 Pass 1 — Bayesian incident probability + mitigation lift

ALTER TABLE public.signal_stats
  ADD COLUMN IF NOT EXISTS bayes_alpha numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS bayes_beta numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS bayes_mean numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bayes_ci_low numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bayes_ci_high numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bayes_confidence numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mitigation_lift numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mitigation_ci_low numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mitigation_ci_high numeric NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signal_stats_bayes_mean_range') THEN
    ALTER TABLE public.signal_stats
      ADD CONSTRAINT signal_stats_bayes_mean_range
      CHECK (bayes_mean >= 0 AND bayes_mean <= 1);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signal_stats_bayes_ci_range') THEN
    ALTER TABLE public.signal_stats
      ADD CONSTRAINT signal_stats_bayes_ci_range
      CHECK (bayes_ci_low >= 0 AND bayes_ci_low <= 1 AND bayes_ci_high >= 0 AND bayes_ci_high <= 1);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'signal_stats_bayes_confidence_range') THEN
    ALTER TABLE public.signal_stats
      ADD CONSTRAINT signal_stats_bayes_confidence_range
      CHECK (bayes_confidence >= 0 AND bayes_confidence <= 1);
  END IF;
END $$;
