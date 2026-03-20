-- Gap 4 — Integration Reliability + Writeback Guarantees
-- integration_health table, executed_at, next_retry_at, max_attempts=5

-- 1. integration_health — Aggregated health per org+provider
CREATE TABLE IF NOT EXISTS public.integration_health (
  integration_key text PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,

  status text NOT NULL DEFAULT 'unknown' CHECK (status IN ('healthy', 'degraded', 'down', 'unknown')),

  last_success timestamptz,
  last_failure timestamptz,

  error_rate numeric DEFAULT 0,
  avg_latency_ms numeric,

  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_health_org_provider
  ON public.integration_health(org_id, provider);

ALTER TABLE public.integration_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_health_select ON public.integration_health FOR SELECT
  USING (public.is_org_member(org_id));
CREATE POLICY integration_health_insert ON public.integration_health FOR INSERT
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY integration_health_update ON public.integration_health FOR UPDATE
  USING (public.is_org_member(org_id));
CREATE POLICY integration_health_service ON public.integration_health FOR ALL
  USING (auth.role() = 'service_role');

-- 2. integration_action_executions — Add executed_at, next_retry_at
ALTER TABLE public.integration_action_executions
  ADD COLUMN IF NOT EXISTS executed_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

-- 3. Default max_attempts to 5 per spec
ALTER TABLE public.integration_action_executions
  ALTER COLUMN max_attempts SET DEFAULT 5;
