-- Phase 6 — Queue-based async processing (A2.2) + tenant-scoped jobs

CREATE TABLE IF NOT EXISTS public.processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN (
    'signal_ingestion',
    'detector',
    'action_execution',
    'verification'
  )),
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'running',
    'completed',
    'failed',
    'dead_letter'
  )),
  priority integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 5,
  error text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_org_status_priority
  ON public.processing_jobs(org_id, status, priority DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_status_priority_created
  ON public.processing_jobs(status, priority DESC, created_at ASC)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS idx_processing_jobs_org_idempotency
  ON public.processing_jobs(org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY processing_jobs_select ON public.processing_jobs FOR SELECT
  USING (public.is_org_member(org_id) OR auth.role() = 'service_role');

CREATE POLICY processing_jobs_insert ON public.processing_jobs FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = processing_jobs.org_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin', 'reviewer', 'submitter')
    )
  );

CREATE POLICY processing_jobs_update ON public.processing_jobs FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY processing_jobs_delete ON public.processing_jobs FOR DELETE
  USING (auth.role() = 'service_role');

COMMENT ON TABLE public.processing_jobs IS 'Phase 6 async pipeline: signal → detector → execution → verification';
