-- Phase 4 — Slack-native approval, followers, mutes, deferrals, escalation prefs, delegation columns

-- Approvals: delegation + actor tracking (no new approval row on delegate)
ALTER TABLE public.approvals
  ADD COLUMN IF NOT EXISTS delegate_user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delegated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS acted_by_user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_approvals_delegate_user ON public.approvals (delegate_user_id)
  WHERE delegate_user_id IS NOT NULL;

COMMENT ON COLUMN public.approvals.delegate_user_id IS 'Phase 4: user who may act on behalf of approver when policy allows';
COMMENT ON COLUMN public.approvals.acted_by_user_id IS 'Phase 4: user who recorded the decision (delegate vs approver)';

-- Follow a change (Slack + in-app notifications scope)
CREATE TABLE IF NOT EXISTS public.change_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  change_event_id uuid NOT NULL REFERENCES public.change_events (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, change_event_id)
);

CREATE INDEX IF NOT EXISTS idx_change_followers_org_change ON public.change_followers (org_id, change_event_id);

ALTER TABLE public.change_followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY change_followers_select ON public.change_followers
  FOR SELECT USING (public.is_org_member (org_id));
CREATE POLICY change_followers_insert ON public.change_followers
  FOR INSERT WITH CHECK (public.is_org_member (org_id));
CREATE POLICY change_followers_delete ON public.change_followers
  FOR DELETE USING (user_id = auth.uid () OR public.is_org_admin (org_id));
CREATE POLICY change_followers_service ON public.change_followers
  FOR ALL USING (auth.role () = 'service_role');

-- Notification mutes (template / domain / change / risk)
CREATE TABLE IF NOT EXISTS public.notification_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  mute_type text NOT NULL CHECK (
    mute_type IN ('CHANGE_EVENT_ID', 'DOMAIN', 'RISK_BUCKET', 'NOTIFICATION_TEMPLATE')
  ),
  mute_value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_mutes_user_expires
  ON public.notification_mutes (user_id, org_id, expires_at);

ALTER TABLE public.notification_mutes ENABLE ROW LEVEL SECURITY;
CREATE POLICY notification_mutes_select ON public.notification_mutes
  FOR SELECT USING (public.is_org_member (org_id) AND user_id = auth.uid ());
CREATE POLICY notification_mutes_insert ON public.notification_mutes
  FOR INSERT WITH CHECK (public.is_org_member (org_id) AND user_id = auth.uid ());
CREATE POLICY notification_mutes_delete ON public.notification_mutes
  FOR DELETE USING (user_id = auth.uid ());
CREATE POLICY notification_mutes_service ON public.notification_mutes
  FOR ALL USING (auth.role () = 'service_role');

-- Deferred Slack reminders (worker processes every ~5 min)
CREATE TABLE IF NOT EXISTS public.slack_deferred_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  change_event_id uuid NOT NULL REFERENCES public.change_events (id) ON DELETE CASCADE,
  approval_id uuid NOT NULL REFERENCES public.approvals (id) ON DELETE CASCADE,
  reminder_at timestamptz NOT NULL,
  reminder_type text NOT NULL DEFAULT 'defer',
  slack_channel_id text NULL,
  slack_message_ts text NULL,
  sent_at timestamptz NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slack_deferred_reminder_at ON public.slack_deferred_actions (reminder_at)
  WHERE sent_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_slack_deferred_org ON public.slack_deferred_actions (org_id);

ALTER TABLE public.slack_deferred_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY slack_deferred_service ON public.slack_deferred_actions
  FOR ALL USING (auth.role () = 'service_role');

-- Escalation chain config (org-level)
CREATE TABLE IF NOT EXISTS public.approval_escalation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  risk_bucket text NOT NULL,
  escalation_order_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, risk_bucket)
);

CREATE INDEX IF NOT EXISTS idx_approval_escalation_org ON public.approval_escalation_rules (org_id);

ALTER TABLE public.approval_escalation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY approval_escalation_select ON public.approval_escalation_rules
  FOR SELECT USING (public.is_org_member (org_id));
CREATE POLICY approval_escalation_admin ON public.approval_escalation_rules
  FOR ALL USING (public.is_org_admin (org_id));
CREATE POLICY approval_escalation_service ON public.approval_escalation_rules
  FOR ALL USING (auth.role () = 'service_role');

-- Slack message thread tracking (one ts per user + approval + type)
CREATE TABLE IF NOT EXISTS public.slack_notification_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  change_event_id uuid NOT NULL REFERENCES public.change_events (id) ON DELETE CASCADE,
  approval_id uuid NOT NULL REFERENCES public.approvals (id) ON DELETE CASCADE,
  slack_channel_id text NOT NULL,
  slack_message_ts text NOT NULL,
  notification_type text NOT NULL DEFAULT 'approval_request',
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CLOSED', 'EXPIRED', 'ESCALATED')),
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, approval_id, notification_type)
);

CREATE INDEX IF NOT EXISTS idx_slack_notif_threads_org ON public.slack_notification_threads (org_id);

ALTER TABLE public.slack_notification_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY slack_notif_threads_service ON public.slack_notification_threads
  FOR ALL USING (auth.role () = 'service_role');

-- Per-user notification preferences (global per user)
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  slack_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  quiet_hours_start time NULL,
  quiet_hours_end time NULL,
  standing_delegate_user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  preferred_digest_time time NULL DEFAULT '09:00:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_notif_pref_own ON public.user_notification_preferences
  FOR ALL USING (user_id = auth.uid ());
CREATE POLICY user_notif_pref_service ON public.user_notification_preferences
  FOR ALL USING (auth.role () = 'service_role');

-- Org settings flags (Phase 4 Slack)
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS allow_delegate_approval boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS slack_first_mode boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS slack_require_high_risk_comment boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS slack_digest_daily_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_reminder_interval_minutes int NULL CHECK (
    approval_reminder_interval_minutes IS NULL
    OR (
      approval_reminder_interval_minutes >= 5
      AND approval_reminder_interval_minutes <= 1440
    )
  );

COMMENT ON COLUMN public.organization_settings.allow_delegate_approval IS 'Phase 4: delegate may satisfy approval when permitted';

-- Async processing for Slack interactive actions (ack < 3s; worker completes)
CREATE TABLE IF NOT EXISTS public.slack_interactive_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  dedupe_key text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'DONE', 'FAILED')),
  payload_json jsonb NOT NULL,
  attempt_count int NOT NULL DEFAULT 0,
  last_error text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_slack_interactive_jobs_pending
  ON public.slack_interactive_jobs (created_at)
  WHERE status = 'PENDING';

ALTER TABLE public.slack_interactive_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY slack_interactive_jobs_service ON public.slack_interactive_jobs
  FOR ALL USING (auth.role () = 'service_role');
