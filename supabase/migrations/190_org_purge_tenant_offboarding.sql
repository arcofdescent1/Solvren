-- Phase 7 — Org purge (tenant offboarding): request/run audit trail + finance retention snapshots.
-- Target org id is NOT a foreign key to organizations so records survive after the org row is deleted.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS purge_lifecycle_status text NULL
  CONSTRAINT organizations_purge_lifecycle_status_chk CHECK (
    purge_lifecycle_status IS NULL
    OR purge_lifecycle_status IN ('PURGE_PENDING', 'PURGE_BLOCKED_LEGAL_HOLD')
  );

COMMENT ON COLUMN public.organizations.purge_lifecycle_status IS
  'Phase 7: PURGE_PENDING quiesces the org before destructive purge; PURGE_BLOCKED_LEGAL_HOLD blocks execution.';

CREATE TABLE IF NOT EXISTS public.org_purge_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_org_id uuid NOT NULL,
  target_org_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN (
      'pending_approval',
      'approved',
      'rejected',
      'blocked_legal_hold',
      'cancelled',
      'superseded'
    )),
  legal_hold_active boolean NOT NULL DEFAULT false,
  reason text NOT NULL DEFAULT '',
  retention_exception_summary jsonb NOT NULL DEFAULT '{}',
  requested_by_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  approved_by_user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  scheduled_execute_at timestamptz NULL,
  last_dry_run_at timestamptz NULL,
  last_dry_run_json jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_purge_requests_target_org
  ON public.org_purge_requests (target_org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_purge_requests_status
  ON public.org_purge_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.org_purge_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.org_purge_requests (id) ON DELETE RESTRICT,
  target_org_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'partial')),
  actor_user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  verification_json jsonb NULL,
  summary_json jsonb NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_org_purge_runs_request ON public.org_purge_runs (request_id);
CREATE INDEX IF NOT EXISTS idx_org_purge_runs_target_org ON public.org_purge_runs (target_org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.org_purge_run_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.org_purge_runs (id) ON DELETE CASCADE,
  step_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  detail_json jsonb NOT NULL DEFAULT '{}',
  error text NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (run_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_org_purge_run_steps_run ON public.org_purge_run_steps (run_id, step_key);

CREATE TABLE IF NOT EXISTS public.org_purge_finance_retention_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.org_purge_runs (id) ON DELETE CASCADE,
  target_org_id uuid NOT NULL,
  snapshot_json jsonb NOT NULL,
  reason_code text NOT NULL DEFAULT 'RETAIN_FINANCE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_purge_finance_snapshots_org
  ON public.org_purge_finance_retention_snapshots (target_org_id);

ALTER TABLE public.org_purge_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_purge_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_purge_run_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_purge_finance_retention_snapshots ENABLE ROW LEVEL SECURITY;

-- v1: only service_role touches purge tables; app uses privileged client after auth checks.
DROP POLICY IF EXISTS org_purge_requests_service ON public.org_purge_requests;
CREATE POLICY org_purge_requests_service ON public.org_purge_requests
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS org_purge_runs_service ON public.org_purge_runs;
CREATE POLICY org_purge_runs_service ON public.org_purge_runs
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS org_purge_run_steps_service ON public.org_purge_run_steps;
CREATE POLICY org_purge_run_steps_service ON public.org_purge_run_steps
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS org_purge_finance_snapshots_service ON public.org_purge_finance_retention_snapshots;
CREATE POLICY org_purge_finance_snapshots_service ON public.org_purge_finance_retention_snapshots
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS trg_org_purge_requests_updated_at ON public.org_purge_requests;
CREATE TRIGGER trg_org_purge_requests_updated_at
  BEFORE UPDATE ON public.org_purge_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.org_purge_requests IS 'Phase 7: purge request, approval, dry-run snapshot; survives org delete.';
COMMENT ON TABLE public.org_purge_runs IS 'Phase 7: one execution attempt for an approved purge request.';
COMMENT ON TABLE public.org_purge_run_steps IS 'Phase 7: checkpointed purge steps for idempotent resume.';
COMMENT ON TABLE public.org_purge_finance_retention_snapshots IS
  'Phase 7: billing_accounts row JSON before org delete (billing_accounts cascades away).';
