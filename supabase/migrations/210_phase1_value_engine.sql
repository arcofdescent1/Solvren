-- Phase 1 — First Value Engine: normalized raw_events extensions, value_engine_issues, job metrics.
-- Extends integration_connections (additive); does not duplicate integration_credentials.

-- 1) integration_connections (additive)
ALTER TABLE public.integration_connections
  ADD COLUMN IF NOT EXISTS credentials_encrypted jsonb,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

COMMENT ON COLUMN public.integration_connections.credentials_encrypted IS
  'Optional sealed credential envelope per Phase 1 spec; primary secrets may remain in integration_credentials.';

-- 2) raw_events — dual timestamps, fingerprint, external_id, Phase 1 dedupe key
ALTER TABLE public.raw_events
  ADD COLUMN IF NOT EXISTS occurred_at timestamptz,
  ADD COLUMN IF NOT EXISTS ingested_at timestamptz,
  ADD COLUMN IF NOT EXISTS fingerprint text,
  ADD COLUMN IF NOT EXISTS external_id text;

UPDATE public.raw_events
SET
  occurred_at = COALESCE(occurred_at, event_time, received_at),
  ingested_at = COALESCE(ingested_at, received_at)
WHERE occurred_at IS NULL OR ingested_at IS NULL;

-- One stable key per historical row (avoids collisions on shared external_object_id)
UPDATE public.raw_events
SET external_id = idempotency_key
WHERE external_id IS NULL OR TRIM(external_id) = '';

ALTER TABLE public.raw_events
  ALTER COLUMN occurred_at SET DEFAULT now(),
  ALTER COLUMN ingested_at SET DEFAULT now();

UPDATE public.raw_events SET occurred_at = received_at WHERE occurred_at IS NULL;
UPDATE public.raw_events SET ingested_at = received_at WHERE ingested_at IS NULL;

ALTER TABLE public.raw_events
  ALTER COLUMN occurred_at SET NOT NULL,
  ALTER COLUMN ingested_at SET NOT NULL,
  ALTER COLUMN external_id SET NOT NULL;

DROP INDEX IF EXISTS idx_raw_events_value_engine_dedupe;
CREATE UNIQUE INDEX idx_raw_events_value_engine_dedupe
  ON public.raw_events (org_id, provider, external_id, event_type);

CREATE INDEX IF NOT EXISTS idx_raw_events_org_provider_occurred
  ON public.raw_events (org_id, provider, occurred_at DESC);

-- 3) value_engine_issues — distinct from public.issues (Phase 0 canonical)
CREATE TABLE IF NOT EXISTS public.value_engine_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  source text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  revenue_impact_cents bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  affected_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'detected' CHECK (status IN ('detected', 'acknowledged', 'dismissed')),
  confidence text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  recommended_action text NOT NULL DEFAULT '',
  issue_key text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, issue_key)
);

CREATE INDEX IF NOT EXISTS idx_value_engine_issues_org_created
  ON public.value_engine_issues (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_value_engine_issues_org_status
  ON public.value_engine_issues (org_id, status);

-- 4) Job runs (detection_success_rate)
CREATE TABLE IF NOT EXISTS public.value_engine_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN ('ingestion', 'detection')),
  integration_provider text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  success boolean NOT NULL DEFAULT false,
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_value_engine_job_runs_started
  ON public.value_engine_job_runs (started_at DESC);

-- 5) First-issue timing (time_to_first_issue)
CREATE TABLE IF NOT EXISTS public.value_engine_org_metrics (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  first_integration_connected_at timestamptz,
  first_issue_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.value_engine_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.value_engine_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.value_engine_org_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS value_engine_issues_select ON public.value_engine_issues;
CREATE POLICY value_engine_issues_select ON public.value_engine_issues
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS value_engine_issues_write_service ON public.value_engine_issues;
CREATE POLICY value_engine_issues_write_service ON public.value_engine_issues
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS value_engine_job_runs_service ON public.value_engine_job_runs;
CREATE POLICY value_engine_job_runs_service ON public.value_engine_job_runs
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS value_engine_org_metrics_select ON public.value_engine_org_metrics;
CREATE POLICY value_engine_org_metrics_select ON public.value_engine_org_metrics
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS value_engine_org_metrics_service ON public.value_engine_org_metrics;
CREATE POLICY value_engine_org_metrics_service ON public.value_engine_org_metrics
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
