-- Phase 3 — Secret access audit (service-role writes from app) + integration_credentials metadata columns.

CREATE TABLE IF NOT EXISTS public.secret_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_account_id text NULL,
  secret_field text NOT NULL,
  actor_type text NOT NULL CHECK (actor_type IN ('system', 'user', 'employee')),
  actor_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN (
    'provider_api_call',
    'oauth_refresh',
    'webhook_verification',
    'scheduled_sync',
    'manual_retry',
    'debug_with_approval'
  )),
  access_context text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_secret_access_audit_org_created
  ON public.secret_access_audit(org_id, created_at DESC);

COMMENT ON TABLE public.secret_access_audit IS 'Integration/custom source secret decrypt audit; insert via service role only.';

ALTER TABLE public.secret_access_audit ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated users: only service_role (bypasses RLS) may read/write.

-- integration_credentials: optional envelope metadata (flat org_id rows and integration_account rows).
ALTER TABLE public.integration_credentials
  ADD COLUMN IF NOT EXISTS credentials_encrypted jsonb,
  ADD COLUMN IF NOT EXISTS encryption_version text,
  ADD COLUMN IF NOT EXISTS secret_status text,
  ADD COLUMN IF NOT EXISTS credentials_encrypted_at timestamptz;

COMMENT ON COLUMN public.integration_credentials.secret_status IS
  'legacy | dual_write | encrypted | rotation_required | rotation_in_progress | disabled';
