-- Baseline table for weighted average incident rate
CREATE TABLE IF NOT EXISTS public.risk_learning_baseline (
  id integer PRIMARY KEY,
  baseline_incident_rate numeric NOT NULL DEFAULT 0,
  last_computed_at timestamptz NOT NULL DEFAULT now()
);

-- Handle migration drift: add columns if table existed with older schema
ALTER TABLE risk_learning_baseline ADD COLUMN IF NOT EXISTS baseline_incident_rate numeric NOT NULL DEFAULT 0;
ALTER TABLE risk_learning_baseline ADD COLUMN IF NOT EXISTS last_computed_at timestamptz NOT NULL DEFAULT now();

INSERT INTO risk_learning_baseline (id, baseline_incident_rate, last_computed_at)
VALUES (1, 0, now())
ON CONFLICT (id) DO NOTHING;
