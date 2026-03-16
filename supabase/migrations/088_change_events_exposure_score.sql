-- base_risk_score, exposure_multiplier, revenue_risk_score, exposure_components
ALTER TABLE public.change_events
  ADD COLUMN IF NOT EXISTS base_risk_score numeric NULL,
  ADD COLUMN IF NOT EXISTS exposure_multiplier numeric NULL,
  ADD COLUMN IF NOT EXISTS revenue_risk_score numeric NULL,
  ADD COLUMN IF NOT EXISTS exposure_components jsonb NOT NULL DEFAULT '{}'::jsonb;
