-- Phase 2: add smoothed + learning params; backfill from existing columns

-- risk_learning_baseline: add smoothed baseline + params
ALTER TABLE risk_learning_baseline
  ADD COLUMN IF NOT EXISTS baseline_incident_rate_smoothed numeric,
  ADD COLUMN IF NOT EXISTS min_samples integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS window_days integer NOT NULL DEFAULT 14;

UPDATE risk_learning_baseline
SET baseline_incident_rate_smoothed = COALESCE(baseline_incident_rate_smoothed, baseline_incident_rate)
WHERE id = 1;

ALTER TABLE risk_learning_baseline
  ALTER COLUMN baseline_incident_rate_smoothed SET DEFAULT 0;

-- signal_statistics: add smoothed rate
ALTER TABLE signal_statistics
  ADD COLUMN IF NOT EXISTS incident_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incident_rate_smoothed numeric;

UPDATE signal_statistics
SET incident_rate_smoothed = COALESCE(incident_rate_smoothed, incident_rate);

ALTER TABLE signal_statistics
  ALTER COLUMN incident_rate_smoothed SET DEFAULT 0;
