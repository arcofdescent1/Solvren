-- Incidents (manual or change-linked)
CREATE TABLE IF NOT EXISTS public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  change_event_id uuid REFERENCES change_events(id) ON DELETE SET NULL,
  domain text NOT NULL DEFAULT 'REVENUE',
  severity integer NOT NULL CHECK (severity BETWEEN 1 AND 5),
  revenue_impact numeric NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL,
  description text NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_org ON incidents(org_id);
CREATE INDEX IF NOT EXISTS idx_incidents_change ON incidents(change_event_id);
CREATE INDEX IF NOT EXISTS idx_incidents_detected_at ON incidents(detected_at);

-- Snapshot of signals at submission time (immutable)
CREATE TABLE IF NOT EXISTS public.change_signal_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_event_id uuid NOT NULL REFERENCES change_events(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  signal_key text NOT NULL,
  signal_value text NULL,
  weight_at_time numeric NOT NULL,
  contribution numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_css_change ON change_signal_snapshot(change_event_id);
CREATE INDEX IF NOT EXISTS idx_css_signal ON change_signal_snapshot(signal_key);
CREATE INDEX IF NOT EXISTS idx_css_org ON change_signal_snapshot(org_id);
