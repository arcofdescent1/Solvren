-- Phase 6 — Value stories, outcome metrics, generated reports, org/user settings

-- value_stories
CREATE TABLE IF NOT EXISTS public.value_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  change_event_id uuid NOT NULL REFERENCES public.change_events (id) ON DELETE CASCADE,
  prediction_id uuid NULL REFERENCES public.predicted_risk_events (id) ON DELETE SET NULL,
  outcome_type text NOT NULL CHECK (
    outcome_type IN (
      'APPROVAL_DELAY_AVOIDED',
      'RELEASE_BLOCKER_AVOIDED',
      'REVENUE_INCIDENT_AVOIDED',
      'MAJOR_OUTAGE_AVOIDED',
      'APPROVAL_TIME_SAVED',
      'READINESS_IMPROVED'
    )
  ),
  headline text NOT NULL,
  story_text text NOT NULL DEFAULT '',
  estimated_value numeric NOT NULL DEFAULT 0,
  confidence_level text NOT NULL DEFAULT 'LIKELY' CHECK (
    confidence_level IN ('ESTIMATED', 'LIKELY', 'HIGH_CONFIDENCE', 'VERIFIED')
  ),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED')),
  evidence_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  corrective_action_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now (),
  finalized_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_value_stories_org_created ON public.value_stories (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_value_stories_org_status ON public.value_stories (org_id, status);
CREATE INDEX IF NOT EXISTS idx_value_stories_change ON public.value_stories (change_event_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_value_stories_dedupe_pred ON public.value_stories (
  org_id,
  change_event_id,
  prediction_id,
  outcome_type
)
WHERE
  prediction_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_value_stories_dedupe_no_pred ON public.value_stories (org_id, change_event_id, outcome_type)
WHERE
  prediction_id IS NULL;

ALTER TABLE public.value_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY value_stories_select ON public.value_stories FOR SELECT USING (public.is_org_member (org_id));
CREATE POLICY value_stories_service ON public.value_stories FOR ALL USING (auth.role () = 'service_role');

-- outcome_metrics (idempotent per org + period)
CREATE TABLE IF NOT EXISTS public.outcome_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  period_type text NOT NULL CHECK (period_type IN ('MONTH', 'QUARTER')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  revenue_protected numeric NOT NULL DEFAULT 0,
  incidents_prevented int NOT NULL DEFAULT 0,
  approval_hours_saved numeric NOT NULL DEFAULT 0,
  readiness_points_gained numeric NOT NULL DEFAULT 0,
  calculated_at timestamptz NOT NULL DEFAULT now (),
  UNIQUE (org_id, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_outcome_metrics_org ON public.outcome_metrics (org_id, period_start DESC);

ALTER TABLE public.outcome_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY outcome_metrics_select ON public.outcome_metrics FOR SELECT USING (public.is_org_member (org_id));
CREATE POLICY outcome_metrics_service ON public.outcome_metrics FOR ALL USING (auth.role () = 'service_role');

-- generated_reports (async PDF / PPTX / CSV)
CREATE TABLE IF NOT EXISTS public.generated_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (report_type IN ('MONTHLY_PDF', 'QUARTERLY_PPTX', 'CSV_EXPORT')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')
  ),
  storage_url text NULL,
  result_json jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now (),
  completed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_generated_reports_org ON public.generated_reports (org_id, created_at DESC);

ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY generated_reports_select ON public.generated_reports FOR SELECT USING (public.is_org_member (org_id));
CREATE POLICY generated_reports_service ON public.generated_reports FOR ALL USING (auth.role () = 'service_role');

-- Org settings (Phase 6)
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS value_tracking_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS outcome_observation_overrides_json jsonb NULL,
  ADD COLUMN IF NOT EXISTS revenue_confidence_threshold_in_rollups text NOT NULL DEFAULT 'HIGH_CONFIDENCE' CHECK (
    revenue_confidence_threshold_in_rollups IN ('ESTIMATED', 'LIKELY', 'HIGH_CONFIDENCE', 'VERIFIED')
  ),
  ADD COLUMN IF NOT EXISTS fiscal_year_start_month int NULL CHECK (
    fiscal_year_start_month IS NULL
    OR (
      fiscal_year_start_month >= 1
      AND fiscal_year_start_month <= 12
    )
  ),
  ADD COLUMN IF NOT EXISTS value_milestone_usd_thresholds int[] NOT NULL DEFAULT ARRAY[50000, 100000, 250000, 1000000]::int[],
  ADD COLUMN IF NOT EXISTS auto_generate_executive_summaries boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_currency text NOT NULL DEFAULT 'USD';

COMMENT ON COLUMN public.organization_settings.outcome_observation_overrides_json IS 'Phase 6: optional { OUTCOME_TYPE: days } overrides';

-- User notification prefs (Phase 6)
ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS receive_value_story_notifications boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS share_value_stories_with_team boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS include_value_in_weekly_digest boolean NOT NULL DEFAULT true;
