-- Phase 4 — Production-Grade Integration Reliability
-- Durable inbound, authoritative outbound, dead-letter, reconciliation, health.

-- 8.1 integration_accounts: add Phase 4 columns if missing
ALTER TABLE public.integration_accounts
  ADD COLUMN IF NOT EXISTS auth_mode text,
  ADD COLUMN IF NOT EXISTS scopes_json jsonb DEFAULT '[]'::jsonb;

-- 8.2 integration_inbound_events — Durable inbound envelope (Phase 4)
-- Named to avoid conflict with 127 integration_events (processed event bus)
CREATE TABLE IF NOT EXISTS public.integration_inbound_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_account_id uuid NOT NULL REFERENCES public.integration_accounts(id) ON DELETE CASCADE,
  provider text NOT NULL,
  source_channel text NOT NULL CHECK (source_channel IN ('webhook', 'sync', 'backfill', 'warehouse', 'internal')),

  external_event_id text NULL,
  external_object_type text NULL,
  external_object_id text NULL,
  event_type text NOT NULL,
  event_time timestamptz NULL,
  received_at timestamptz NOT NULL DEFAULT now(),

  payload_json jsonb NOT NULL,
  headers_json jsonb NULL,

  payload_hash text NOT NULL,
  idempotency_key text NOT NULL,

  ingest_status text NOT NULL DEFAULT 'RECEIVED' CHECK (ingest_status IN ('RECEIVED', 'VALIDATED', 'QUEUED', 'PROCESSED', 'FAILED', 'DEAD_LETTERED')),

  processing_attempts integer NOT NULL DEFAULT 0,
  last_processing_error_code text NULL,
  last_processing_error_message text NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_inbound_events_idempotency
  ON public.integration_inbound_events(org_id, provider, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_integration_inbound_events_status
  ON public.integration_inbound_events(ingest_status, received_at);

CREATE INDEX IF NOT EXISTS idx_integration_inbound_events_external
  ON public.integration_inbound_events(provider, external_object_type, external_object_id);

ALTER TABLE public.integration_inbound_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_inbound_events_select ON public.integration_inbound_events FOR SELECT
  USING (public.is_org_member(org_id));
CREATE POLICY integration_inbound_events_insert ON public.integration_inbound_events FOR INSERT
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY integration_inbound_events_update ON public.integration_inbound_events FOR UPDATE
  USING (public.is_org_member(org_id));
CREATE POLICY integration_inbound_events_service ON public.integration_inbound_events FOR ALL
  USING (auth.role() = 'service_role');

-- 8.3 integration_action_executions — Authoritative outbound
CREATE TABLE IF NOT EXISTS public.integration_action_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_account_id uuid NOT NULL REFERENCES public.integration_accounts(id) ON DELETE CASCADE,

  issue_id uuid NULL REFERENCES public.issues(id) ON DELETE SET NULL,
  workflow_run_id uuid NULL,

  provider text NOT NULL,
  action_key text NOT NULL,
  target_ref_json jsonb NOT NULL DEFAULT '{}',
  request_payload_json jsonb NOT NULL DEFAULT '{}',

  idempotency_key text NOT NULL,
  execution_status text NOT NULL DEFAULT 'PENDING' CHECK (execution_status IN ('PENDING', 'EXECUTING', 'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'RETRYING', 'DEAD_LETTERED', 'VERIFIED')),

  risk_level text NULL,

  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 4,

  provider_response_code text NULL,
  provider_response_json jsonb NULL,

  last_error_code text NULL,
  last_error_message text NULL,

  reconciliation_required boolean NOT NULL DEFAULT false,
  reconciliation_status text NOT NULL DEFAULT 'NOT_REQUIRED' CHECK (reconciliation_status IN ('NOT_REQUIRED', 'PENDING', 'VERIFIED_SUCCESS', 'VERIFIED_FAILURE')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_action_exec_idempotency
  ON public.integration_action_executions(org_id, provider, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_integration_action_exec_status
  ON public.integration_action_executions(execution_status, updated_at);

CREATE INDEX IF NOT EXISTS idx_integration_action_exec_recon
  ON public.integration_action_executions(reconciliation_status, updated_at);

ALTER TABLE public.integration_action_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_action_executions_select ON public.integration_action_executions FOR SELECT
  USING (public.is_org_member(org_id));
CREATE POLICY integration_action_executions_insert ON public.integration_action_executions FOR INSERT
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY integration_action_executions_update ON public.integration_action_executions FOR UPDATE
  USING (public.is_org_member(org_id));
CREATE POLICY integration_action_executions_service ON public.integration_action_executions FOR ALL
  USING (auth.role() = 'service_role');

-- 8.4 integration_action_execution_targets — Bulk/partial-failure
CREATE TABLE IF NOT EXISTS public.integration_action_execution_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id uuid NOT NULL REFERENCES public.integration_action_executions(id) ON DELETE CASCADE,
  target_key text NOT NULL,
  target_ref_json jsonb NOT NULL DEFAULT '{}',

  target_status text NOT NULL DEFAULT 'PENDING' CHECK (target_status IN ('PENDING', 'SUCCESS', 'FAILED', 'RETRYING', 'VERIFIED')),

  attempt_count integer NOT NULL DEFAULT 0,
  provider_response_json jsonb NULL,
  last_error_code text NULL,
  last_error_message text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_action_targets_exec
  ON public.integration_action_execution_targets(execution_id);

ALTER TABLE public.integration_action_execution_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_action_targets_select ON public.integration_action_execution_targets FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.integration_action_executions e WHERE e.id = execution_id AND public.is_org_member(e.org_id)));
CREATE POLICY integration_action_targets_insert ON public.integration_action_execution_targets FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.integration_action_executions e WHERE e.id = execution_id AND public.is_org_member(e.org_id)));
CREATE POLICY integration_action_targets_update ON public.integration_action_execution_targets FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.integration_action_executions e WHERE e.id = execution_id AND public.is_org_member(e.org_id)));
CREATE POLICY integration_action_targets_service ON public.integration_action_execution_targets FOR ALL
  USING (auth.role() = 'service_role');

-- 8.5 integration_dead_letters — Phase 4 DLQ
CREATE TABLE IF NOT EXISTS public.integration_dead_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider text NOT NULL,
  dead_letter_type text NOT NULL CHECK (dead_letter_type IN ('INBOUND_EVENT', 'OUTBOUND_ACTION', 'RECONCILIATION')),

  source_record_id uuid NOT NULL,
  reason_code text NOT NULL,
  reason_message text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}',
  retryable boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RETRIED', 'RESOLVED', 'IGNORED')),

  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_integration_dead_letters_org_status
  ON public.integration_dead_letters(org_id, status);

ALTER TABLE public.integration_dead_letters ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_dead_letters_select ON public.integration_dead_letters FOR SELECT
  USING (public.is_org_member(org_id));
CREATE POLICY integration_dead_letters_insert ON public.integration_dead_letters FOR INSERT
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY integration_dead_letters_update ON public.integration_dead_letters FOR UPDATE
  USING (public.is_org_member(org_id));
CREATE POLICY integration_dead_letters_service ON public.integration_dead_letters FOR ALL
  USING (auth.role() = 'service_role');

-- 8.6 integration_reconciliation_checks
CREATE TABLE IF NOT EXISTS public.integration_reconciliation_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  execution_id uuid NOT NULL REFERENCES public.integration_action_executions(id) ON DELETE CASCADE,
  provider text NOT NULL,
  reconciliation_type text NOT NULL CHECK (reconciliation_type IN ('REFETCH_ENTITY', 'WAIT_FOR_WEBHOOK', 'POLL_STATUS', 'COMPOSITE')),

  check_status text NOT NULL DEFAULT 'PENDING' CHECK (check_status IN ('PENDING', 'RUNNING', 'VERIFIED_SUCCESS', 'VERIFIED_FAILURE')),

  expected_state_json jsonb NOT NULL DEFAULT '{}',
  observed_state_json jsonb NULL,

  attempt_count integer NOT NULL DEFAULT 0,
  last_error_code text NULL,
  last_error_message text NULL,

  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_recon_checks_exec
  ON public.integration_reconciliation_checks(execution_id);

ALTER TABLE public.integration_reconciliation_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY integration_recon_checks_select ON public.integration_reconciliation_checks FOR SELECT
  USING (public.is_org_member(org_id));
CREATE POLICY integration_recon_checks_insert ON public.integration_reconciliation_checks FOR INSERT
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY integration_recon_checks_update ON public.integration_reconciliation_checks FOR UPDATE
  USING (public.is_org_member(org_id));
CREATE POLICY integration_recon_checks_service ON public.integration_reconciliation_checks FOR ALL
  USING (auth.role() = 'service_role');

-- 8.7 connector_health_snapshots
CREATE TABLE IF NOT EXISTS public.connector_health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_account_id uuid NOT NULL REFERENCES public.integration_accounts(id) ON DELETE CASCADE,
  provider text NOT NULL,
  health_state text NOT NULL,
  metrics_json jsonb NOT NULL DEFAULT '{}',
  reasons_json jsonb NOT NULL DEFAULT '[]',
  snapshot_time timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_connector_health_account_time
  ON public.connector_health_snapshots(integration_account_id, snapshot_time DESC);

ALTER TABLE public.connector_health_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY connector_health_snapshots_select ON public.connector_health_snapshots FOR SELECT
  USING (public.is_org_member(org_id));
CREATE POLICY connector_health_snapshots_insert ON public.connector_health_snapshots FOR INSERT
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY connector_health_snapshots_service ON public.connector_health_snapshots FOR ALL
  USING (auth.role() = 'service_role');
