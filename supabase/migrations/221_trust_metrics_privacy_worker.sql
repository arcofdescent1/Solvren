-- Phase 5 — Trust metrics (log-backed) + RLS

CREATE TABLE IF NOT EXISTS public.trust_compliance_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'ingestion_job_success',
    'ingestion_job_failed',
    'redaction_validation_passed',
    'raw_payload_policy_blocked',
    'write_back_denied',
    'privacy_downgrade_completed',
    'privacy_downgrade_failed'
  )),
  provider text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trust_compliance_org_created ON public.trust_compliance_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_compliance_org_type ON public.trust_compliance_events(org_id, event_type, created_at DESC);

COMMENT ON TABLE public.trust_compliance_events IS 'Append-only trust signals for buyer-facing metrics (ingestion, redaction, write-back denials).';

ALTER TABLE public.trust_compliance_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS trust_compliance_events_select ON public.trust_compliance_events;
CREATE POLICY trust_compliance_events_select ON public.trust_compliance_events
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS trust_compliance_events_service ON public.trust_compliance_events;
CREATE POLICY trust_compliance_events_service ON public.trust_compliance_events
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
