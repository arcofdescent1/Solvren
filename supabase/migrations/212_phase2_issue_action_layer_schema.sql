-- Phase 2 (part 2) — Single issue model: data backfill, table changes, action_tokens, slack_connections,
-- extend notification_outbox + issue_actions, product_event_log.
-- Runs after 211 so new issue_status enum values are committed.

-- ---------------------------------------------------------------------------
-- 1) Map legacy workflow statuses → Phase 2 vocabulary (best-effort)
-- ---------------------------------------------------------------------------
UPDATE public.issues SET status = 'detected'::public.issue_status WHERE status::text = 'open';
UPDATE public.issues SET status = 'acknowledged'::public.issue_status WHERE status::text = 'triaged';

-- ---------------------------------------------------------------------------
-- 2) Issues — Phase 2 fields (detection + SLA + notifications + approval)
-- ---------------------------------------------------------------------------
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS revenue_impact_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'usd',
  ADD COLUMN IF NOT EXISTS affected_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS detection_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS detection_confidence text CHECK (
    detection_confidence IS NULL OR detection_confidence IN ('high', 'medium', 'low')
  ),
  ADD COLUMN IF NOT EXISTS detection_source text,
  ADD COLUMN IF NOT EXISTS detection_type text,
  ADD COLUMN IF NOT EXISTS recommended_action text,
  ADD COLUMN IF NOT EXISTS approval_state text NOT NULL DEFAULT 'not_required'
    CHECK (approval_state IN ('not_required', 'pending', 'approved', 'denied', 'changes_requested')),
  ADD COLUMN IF NOT EXISTS notification_state text NOT NULL DEFAULT 'not_notified'
    CHECK (notification_state IN ('not_notified', 'queued', 'sent', 'skipped')),
  ADD COLUMN IF NOT EXISTS sla_due_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_notified_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS owner_email text NULL,
  ADD COLUMN IF NOT EXISTS owner_display_name text NULL;

COMMENT ON COLUMN public.issues.detection_source IS 'stripe | hubspot | salesforce — Value Engine origin.';
COMMENT ON COLUMN public.issues.detection_type IS 'Logical detection rule key from Value Engine.';

-- ---------------------------------------------------------------------------
-- 3) Rename value_engine_issues → legacy & migrate rows into public.issues
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'value_engine_issues'
  ) THEN
    ALTER TABLE public.value_engine_issues RENAME TO value_engine_issues_legacy;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.value_engine_issues_legacy') IS NOT NULL THEN
    INSERT INTO public.issues (
      org_id,
      issue_key,
      source_type,
      source_ref,
      source_event_time,
      domain_key,
      title,
      description,
      severity,
      status,
      revenue_impact_cents,
      currency,
      affected_count,
      detection_metadata,
      detection_confidence,
      detection_source,
      detection_type,
      recommended_action,
      approval_state,
      notification_state,
      sla_due_at,
      opened_at,
      updated_at
    )
    SELECT
      ve.org_id,
      ve.issue_key,
      'detector'::public.issue_source_type,
      ve.type,
      ve.created_at,
      'detection:' || ve.issue_key,
      ve.title,
      ve.description,
      CASE lower(trim(ve.severity))
        WHEN 'high' THEN 'high'::public.issue_severity
        WHEN 'low' THEN 'low'::public.issue_severity
        ELSE 'medium'::public.issue_severity
      END,
      CASE ve.status
        WHEN 'acknowledged' THEN 'acknowledged'::public.issue_status
        WHEN 'dismissed' THEN 'dismissed'::public.issue_status
        ELSE 'detected'::public.issue_status
      END,
      ve.revenue_impact_cents,
      ve.currency,
      ve.affected_count,
      COALESCE(ve.metadata, '{}'::jsonb),
      ve.confidence,
      lower(trim(ve.source)),
      ve.type,
      NULLIF(trim(ve.recommended_action), ''),
      CASE
        WHEN ve.severity = 'high' OR ve.revenue_impact_cents >= 500000 THEN 'pending'::text
        ELSE 'not_required'::text
      END,
      'not_notified'::text,
      CASE
        WHEN lower(trim(ve.severity)) IN ('critical', 'high') THEN now() + interval '1 day'
        WHEN lower(trim(ve.severity)) = 'medium' THEN now() + interval '5 days'
        ELSE now() + interval '10 days'
      END,
      ve.created_at,
      ve.updated_at
    FROM public.value_engine_issues_legacy ve
    ON CONFLICT (org_id, issue_key) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      severity = EXCLUDED.severity,
      status = EXCLUDED.status,
      revenue_impact_cents = EXCLUDED.revenue_impact_cents,
      currency = EXCLUDED.currency,
      affected_count = EXCLUDED.affected_count,
      detection_metadata = EXCLUDED.detection_metadata,
      detection_confidence = EXCLUDED.detection_confidence,
      detection_source = EXCLUDED.detection_source,
      detection_type = EXCLUDED.detection_type,
      recommended_action = COALESCE(EXCLUDED.recommended_action, public.issues.recommended_action),
      approval_state = EXCLUDED.approval_state,
      sla_due_at = EXCLUDED.sla_due_at,
      updated_at = EXCLUDED.updated_at;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4) issue_actions — Phase 2 decision columns (execution rows keep NULLs)
-- ---------------------------------------------------------------------------
ALTER TABLE public.issue_actions
  ADD COLUMN IF NOT EXISTS decision_source text CHECK (
    decision_source IS NULL OR decision_source IN ('solvren_app', 'slack', 'email', 'system')
  ),
  ADD COLUMN IF NOT EXISTS actor_email text NULL,
  ADD COLUMN IF NOT EXISTS actor_display_name text NULL,
  ADD COLUMN IF NOT EXISTS previous_issue_status text NULL,
  ADD COLUMN IF NOT EXISTS new_issue_status text NULL,
  ADD COLUMN IF NOT EXISTS decision_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.issue_actions.decision_source IS 'Phase 2 — NULL for legacy execution actions';

-- ---------------------------------------------------------------------------
-- 5) action_tokens (hashed only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.action_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  action_type text NOT NULL,
  recipient_email text NULL,
  recipient_slack_user_id text NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_action_tokens_issue ON public.action_tokens(issue_id);
CREATE INDEX IF NOT EXISTS idx_action_tokens_expires ON public.action_tokens(expires_at);

ALTER TABLE public.action_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS action_tokens_service ON public.action_tokens;
CREATE POLICY action_tokens_service ON public.action_tokens
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 6) slack_connections — one workspace per org
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.slack_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  workspace_id text NOT NULL,
  workspace_name text NULL,
  bot_user_id text NULL,
  default_channel_id text NULL,
  default_channel_name text NULL,
  encrypted_bot_token jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'error', 'revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slack_connections_workspace ON public.slack_connections(workspace_id);

ALTER TABLE public.slack_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS slack_connections_select ON public.slack_connections;
CREATE POLICY slack_connections_select ON public.slack_connections
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS slack_connections_service ON public.slack_connections;
CREATE POLICY slack_connections_service ON public.slack_connections
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
-- 7) notification_outbox — extend (reuse existing table)
-- ---------------------------------------------------------------------------
ALTER TABLE public.notification_outbox
  ADD COLUMN IF NOT EXISTS issue_id uuid REFERENCES public.issues(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS recipient text,
  ADD COLUMN IF NOT EXISTS notification_type text,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS error_message text;

UPDATE public.notification_outbox SET next_attempt_at = COALESCE(next_attempt_at, available_at, now())
WHERE next_attempt_at IS NULL;

-- ---------------------------------------------------------------------------
-- 8) Product metrics (internal events)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  issue_id uuid NULL REFERENCES public.issues(id) ON DELETE SET NULL,
  actor_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_event_log_org_created ON public.product_event_log(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_event_log_name ON public.product_event_log(event_name, created_at DESC);

ALTER TABLE public.product_event_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_event_log_select ON public.product_event_log;
CREATE POLICY product_event_log_select ON public.product_event_log
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS product_event_log_insert_service ON public.product_event_log;
CREATE POLICY product_event_log_insert_service ON public.product_event_log
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
