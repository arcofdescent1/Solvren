-- Phase 3 MCP controlled actions: prepare/confirm mutation bridge with durable audit.

CREATE TABLE IF NOT EXISTS public.mcp_action_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (
    action_type IN (
      'approve_decision',
      'request_more_proof',
      'attach_proof_link',
      'assign_problem_owner',
      'add_problem_comment'
    )
  ),
  target_table text NOT NULL,
  target_id text NOT NULL,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  actor_email text NOT NULL,
  caller_label text NOT NULL DEFAULT 'unspecified-mcp-client',
  status text NOT NULL DEFAULT 'PREPARED' CHECK (
    status IN ('PREPARED', 'CONFIRMED', 'EXECUTED', 'REJECTED', 'EXPIRED', 'FAILED')
  ),
  risk_level text NOT NULL DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')),
  confirmation_phrase text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_hash text NOT NULL,
  human_summary text NOT NULL,
  cannot_proceed_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  result_summary text NULL,
  expires_at timestamptz NOT NULL,
  prepared_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz NULL,
  executed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_mcp_action_requests_org_status
  ON public.mcp_action_requests(org_id, status, prepared_at DESC);

CREATE INDEX IF NOT EXISTS idx_mcp_action_requests_actor
  ON public.mcp_action_requests(actor_user_id, prepared_at DESC);

CREATE TABLE IF NOT EXISTS public.mcp_action_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_request_id uuid NULL REFERENCES public.mcp_action_requests(id) ON DELETE SET NULL,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  target_table text NOT NULL,
  target_id text NOT NULL,
  actor_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email text NULL,
  caller_label text NOT NULL DEFAULT 'unspecified-mcp-client',
  event_type text NOT NULL CHECK (event_type IN ('PREPARE', 'CONFIRM', 'EXECUTE')),
  status text NOT NULL,
  reason text NULL,
  payload_hash text NULL,
  before_summary text NULL,
  after_summary text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mcp_action_audit_org_created
  ON public.mcp_action_audit_log(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mcp_action_audit_request
  ON public.mcp_action_audit_log(action_request_id);

ALTER TABLE public.mcp_action_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_action_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mcp_action_requests_service_only ON public.mcp_action_requests;
CREATE POLICY mcp_action_requests_service_only
  ON public.mcp_action_requests
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS mcp_action_audit_log_service_only ON public.mcp_action_audit_log;
CREATE POLICY mcp_action_audit_log_service_only
  ON public.mcp_action_audit_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
