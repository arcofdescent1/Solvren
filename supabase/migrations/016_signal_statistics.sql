-- Signal statistics (computed by correlation engine)
CREATE TABLE IF NOT EXISTS public.signal_statistics (
  signal_key text PRIMARY KEY,
  total_changes integer NOT NULL DEFAULT 0,
  incident_count integer NOT NULL DEFAULT 0,
  incident_rate numeric NOT NULL DEFAULT 0,
  last_computed_at timestamptz NOT NULL DEFAULT now()
);
