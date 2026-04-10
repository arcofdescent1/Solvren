-- Phase 5 — Releases, readiness scores, predicted risk, snapshots, recompute queue

-- Releases (first-class)
CREATE TABLE IF NOT EXISTS public.releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NULL,
  target_release_at timestamptz NULL,
  status text NOT NULL DEFAULT 'PLANNING' CHECK (
    status IN ('PLANNING', 'READY', 'IN_PROGRESS', 'RELEASED', 'CANCELLED')
  ),
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now (),
  updated_at timestamptz NOT NULL DEFAULT now ()
);

CREATE INDEX IF NOT EXISTS idx_releases_org_target ON public.releases (org_id, target_release_at);

ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY releases_select ON public.releases FOR SELECT USING (public.is_org_member (org_id));
CREATE POLICY releases_write_admin ON public.releases FOR ALL USING (public.is_org_admin (org_id));
CREATE POLICY releases_service ON public.releases FOR ALL USING (auth.role () = 'service_role');

-- At most one release per change (Phase 5)
CREATE TABLE IF NOT EXISTS public.release_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  release_id uuid NOT NULL REFERENCES public.releases (id) ON DELETE CASCADE,
  change_event_id uuid NOT NULL REFERENCES public.change_events (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now (),
  UNIQUE (change_event_id)
);

CREATE INDEX IF NOT EXISTS idx_release_changes_release ON public.release_changes (release_id);
CREATE INDEX IF NOT EXISTS idx_release_changes_org ON public.release_changes (org_id);

ALTER TABLE public.release_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY release_changes_select ON public.release_changes FOR SELECT USING (public.is_org_member (org_id));
CREATE POLICY release_changes_write_admin ON public.release_changes FOR ALL USING (public.is_org_admin (org_id));
CREATE POLICY release_changes_service ON public.release_changes FOR ALL USING (auth.role () = 'service_role');

CREATE TABLE IF NOT EXISTS public.release_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  release_id uuid NOT NULL REFERENCES public.releases (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now (),
  UNIQUE (user_id, release_id)
);

CREATE INDEX IF NOT EXISTS idx_release_followers_org ON public.release_followers (org_id);

ALTER TABLE public.release_followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY release_followers_select ON public.release_followers FOR SELECT USING (public.is_org_member (org_id));
CREATE POLICY release_followers_own ON public.release_followers FOR ALL USING (
  user_id = auth.uid () AND public.is_org_member (org_id)
);
CREATE POLICY release_followers_service ON public.release_followers FOR ALL USING (auth.role () = 'service_role');

-- Predicted risk
CREATE TABLE IF NOT EXISTS public.predicted_risk_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  change_event_id uuid NOT NULL REFERENCES public.change_events (id) ON DELETE CASCADE,
  prediction_type text NOT NULL CHECK (
    prediction_type IN (
      'MISSING_EVIDENCE_DELAY',
      'APPROVAL_SLA_RISK',
      'DEPLOYMENT_BLOCKER_RISK',
      'ROLLBACK_RISK',
      'REVENUE_IMPACT_UNDERESTIMATED',
      'DEPENDENCY_DELAY_RISK',
      'HISTORICAL_FAILURE_MATCH',
      'READINESS_DETERIORATING'
    )
  ),
  root_cause_hash text NOT NULL,
  confidence_score int NOT NULL CHECK (
    confidence_score >= 0
    AND confidence_score <= 100
  ),
  predicted_impact text NULL,
  explanation_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (
    status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'EXPIRED', 'FALSE_POSITIVE')
  ),
  created_at timestamptz NOT NULL DEFAULT now (),
  expires_at timestamptz NOT NULL,
  acknowledged_at timestamptz NULL,
  resolved_at timestamptz NULL,
  readiness_level_snapshot text NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_predicted_risk_active_dedupe ON public.predicted_risk_events (
  org_id,
  change_event_id,
  prediction_type,
  root_cause_hash
)
WHERE
  status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_predicted_risk_org_status ON public.predicted_risk_events (org_id, status);
CREATE INDEX IF NOT EXISTS idx_predicted_risk_change ON public.predicted_risk_events (change_event_id);

ALTER TABLE public.predicted_risk_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY predicted_risk_select ON public.predicted_risk_events FOR SELECT USING (public.is_org_member (org_id));
CREATE POLICY predicted_risk_service ON public.predicted_risk_events FOR ALL USING (auth.role () = 'service_role');

-- Readiness (current row per scope)
CREATE TABLE IF NOT EXISTS public.readiness_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('CHANGE', 'RELEASE', 'PORTFOLIO')),
  scope_id uuid NOT NULL,
  readiness_score int NOT NULL CHECK (
    readiness_score >= 0
    AND readiness_score <= 100
  ),
  readiness_level text NOT NULL CHECK (
    readiness_level IN ('READY', 'WATCH', 'AT_RISK', 'NOT_READY')
  ),
  explanation_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculated_at timestamptz NOT NULL DEFAULT now (),
  UNIQUE (org_id, scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_readiness_scores_org ON public.readiness_scores (org_id);

ALTER TABLE public.readiness_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY readiness_scores_select ON public.readiness_scores FOR SELECT USING (public.is_org_member (org_id));
CREATE POLICY readiness_scores_service ON public.readiness_scores FOR ALL USING (auth.role () = 'service_role');

-- Trend snapshots (every 6 hours)
CREATE TABLE IF NOT EXISTS public.readiness_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('CHANGE', 'RELEASE', 'PORTFOLIO')),
  scope_id uuid NOT NULL,
  readiness_score int NOT NULL,
  readiness_level text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now ()
);

CREATE INDEX IF NOT EXISTS idx_readiness_snapshots_org_time ON public.readiness_snapshots (org_id, captured_at DESC);

ALTER TABLE public.readiness_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY readiness_snapshots_select ON public.readiness_snapshots FOR SELECT USING (public.is_org_member (org_id));
CREATE POLICY readiness_snapshots_service ON public.readiness_snapshots FOR ALL USING (auth.role () = 'service_role');

-- False-positive / dedupe suppression (30 days)
CREATE TABLE IF NOT EXISTS public.prediction_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  change_event_id uuid NOT NULL REFERENCES public.change_events (id) ON DELETE CASCADE,
  prediction_type text NOT NULL,
  root_cause_hash text NOT NULL,
  until timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now (),
  UNIQUE (org_id, change_event_id, prediction_type, root_cause_hash)
);

ALTER TABLE public.prediction_suppressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY prediction_suppressions_select ON public.prediction_suppressions FOR SELECT USING (public.is_org_member (org_id));
CREATE POLICY prediction_suppressions_service ON public.prediction_suppressions FOR ALL USING (auth.role () = 'service_role');

-- Recompute queue (meaningful change updates)
CREATE TABLE IF NOT EXISTS public.readiness_recompute_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  change_event_id uuid NOT NULL REFERENCES public.change_events (id) ON DELETE CASCADE,
  requested_at timestamptz NOT NULL DEFAULT now (),
  UNIQUE (change_event_id)
);

CREATE INDEX IF NOT EXISTS idx_readiness_recompute_org ON public.readiness_recompute_queue (org_id);

ALTER TABLE public.readiness_recompute_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY readiness_recompute_service ON public.readiness_recompute_queue FOR ALL USING (auth.role () = 'service_role');

-- Optional manual failed-launch label on change
ALTER TABLE public.change_events
  ADD COLUMN IF NOT EXISTS failed_launch_labeled_at timestamptz NULL;

-- Org settings (Phase 5)
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS predictive_warnings_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prediction_min_confidence int NOT NULL DEFAULT 75 CHECK (
    prediction_min_confidence >= 50
    AND prediction_min_confidence <= 99
  ),
  ADD COLUMN IF NOT EXISTS prediction_enabled_types text[] NOT NULL DEFAULT ARRAY[
    'MISSING_EVIDENCE_DELAY',
    'APPROVAL_SLA_RISK',
    'DEPLOYMENT_BLOCKER_RISK',
    'ROLLBACK_RISK',
    'REVENUE_IMPACT_UNDERESTIMATED',
    'DEPENDENCY_DELAY_RISK',
    'HISTORICAL_FAILURE_MATCH',
    'READINESS_DETERIORATING'
  ]::text[],
  ADD COLUMN IF NOT EXISTS readiness_dimension_weights jsonb NOT NULL DEFAULT '{"evidence":25,"approvals":20,"risk":20,"rollback":15,"dependencies":10,"historical":10}'::jsonb,
  ADD COLUMN IF NOT EXISTS prediction_expire_days int NOT NULL DEFAULT 14 CHECK (
    prediction_expire_days >= 7
    AND prediction_expire_days <= 30
  ),
  ADD COLUMN IF NOT EXISTS readiness_prior_band_json jsonb NULL;

COMMENT ON COLUMN public.organization_settings.readiness_prior_band_json IS 'Phase 5: last portfolio readiness band for deterioration detection (service-maintained)';

ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS receive_early_warnings boolean NOT NULL DEFAULT true;

-- Extend Phase 4 mutes for Phase 5 (prediction_type / readiness_level)
ALTER TABLE public.notification_mutes DROP CONSTRAINT IF EXISTS notification_mutes_mute_type_check;

ALTER TABLE public.notification_mutes
  ADD CONSTRAINT notification_mutes_mute_type_check CHECK (
    mute_type IN (
      'CHANGE_EVENT_ID',
      'DOMAIN',
      'RISK_BUCKET',
      'NOTIFICATION_TEMPLATE',
      'PREDICTION_TYPE',
      'READINESS_LEVEL'
    )
  );
