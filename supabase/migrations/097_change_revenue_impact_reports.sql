CREATE TABLE IF NOT EXISTS public.change_revenue_impact_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  change_event_id uuid NOT NULL REFERENCES public.change_events(id) ON DELETE CASCADE,
  version int NOT NULL DEFAULT 1,
  report_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text NOT NULL DEFAULT 'unknown',
  confidence numeric NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_impact_reports_change
  ON public.change_revenue_impact_reports(change_event_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_impact_reports_change_version
  ON public.change_revenue_impact_reports(change_event_id, version);
