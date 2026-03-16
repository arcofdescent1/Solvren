-- Phase 1A Improvement — persist computed exposure + revenue-at-risk

ALTER TABLE public.change_events
  ADD COLUMN IF NOT EXISTS revenue_exposure_multiplier numeric NULL,
  ADD COLUMN IF NOT EXISTS revenue_exposure_normalized numeric NULL,
  ADD COLUMN IF NOT EXISTS revenue_exposure_explanation jsonb NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS revenue_at_risk numeric NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'change_events_revenue_exposure_multiplier_range') THEN
    ALTER TABLE public.change_events
      ADD CONSTRAINT change_events_revenue_exposure_multiplier_range
      CHECK (revenue_exposure_multiplier IS NULL OR (revenue_exposure_multiplier >= 1 AND revenue_exposure_multiplier <= 10));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'change_events_revenue_exposure_normalized_range') THEN
    ALTER TABLE public.change_events
      ADD CONSTRAINT change_events_revenue_exposure_normalized_range
      CHECK (revenue_exposure_normalized IS NULL OR (revenue_exposure_normalized >= 0 AND revenue_exposure_normalized <= 1));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'change_events_revenue_at_risk_nonnegative') THEN
    ALTER TABLE public.change_events
      ADD CONSTRAINT change_events_revenue_at_risk_nonnegative
      CHECK (revenue_at_risk IS NULL OR revenue_at_risk >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_change_events_revenue_at_risk
  ON public.change_events(org_id, revenue_at_risk DESC)
  WHERE revenue_at_risk IS NOT NULL;
