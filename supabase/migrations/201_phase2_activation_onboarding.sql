-- Phase 2 — Activation & team rollout: org state extensions, risk priorities, notification prefs, success card

-- 1) org_onboarding_states — Phase 2 columns (accepted members cache; delivery + operational event markers)
ALTER TABLE public.org_onboarding_states
  ADD COLUMN IF NOT EXISTS phase2_status text,
  ADD COLUMN IF NOT EXISTS phase2_current_step text,
  ADD COLUMN IF NOT EXISTS phase2_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS phase2_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_member_count_excluding_owner integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enabled_workflow_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS configured_alert_channel_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS configured_approval_rule_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_alert_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_alert_delivery_channel text,
  ADD COLUMN IF NOT EXISTS first_operational_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_operational_event_type text,
  ADD COLUMN IF NOT EXISTS first_operational_event_id uuid;

-- 2) Risk priorities (replace-all per org; canonical category keys)
CREATE TABLE IF NOT EXISTS public.org_risk_priorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  category text NOT NULL,
  priority_rank integer NOT NULL,
  departments jsonb NOT NULL DEFAULT '[]'::jsonb,
  severity_threshold text,
  notification_urgency text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_risk_priorities_org_category_unique UNIQUE (org_id, category),
  CONSTRAINT org_risk_priorities_org_rank_unique UNIQUE (org_id, priority_rank)
);

CREATE INDEX IF NOT EXISTS idx_org_risk_priorities_org ON public.org_risk_priorities(org_id);

DROP TRIGGER IF EXISTS trg_org_risk_priorities_updated_at ON public.org_risk_priorities;
CREATE TRIGGER trg_org_risk_priorities_updated_at
  BEFORE UPDATE ON public.org_risk_priorities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.org_risk_priorities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_risk_priorities_select ON public.org_risk_priorities;
CREATE POLICY org_risk_priorities_select ON public.org_risk_priorities FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS org_risk_priorities_insert ON public.org_risk_priorities;
CREATE POLICY org_risk_priorities_insert ON public.org_risk_priorities FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS org_risk_priorities_update ON public.org_risk_priorities;
CREATE POLICY org_risk_priorities_update ON public.org_risk_priorities FOR UPDATE USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS org_risk_priorities_delete ON public.org_risk_priorities;
CREATE POLICY org_risk_priorities_delete ON public.org_risk_priorities FOR DELETE USING (public.is_org_member(org_id));

-- 3) Notification destinations (configuration only)
CREATE TABLE IF NOT EXISTS public.org_notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  channel_type text NOT NULL,
  destination text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_notification_preferences_org_dest_unique UNIQUE (org_id, channel_type, destination)
);

CREATE INDEX IF NOT EXISTS idx_org_notification_preferences_org ON public.org_notification_preferences(org_id);

DROP TRIGGER IF EXISTS trg_org_notification_preferences_updated_at ON public.org_notification_preferences;
CREATE TRIGGER trg_org_notification_preferences_updated_at
  BEFORE UPDATE ON public.org_notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.org_notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_notification_preferences_select ON public.org_notification_preferences;
CREATE POLICY org_notification_preferences_select ON public.org_notification_preferences FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS org_notification_preferences_insert ON public.org_notification_preferences;
CREATE POLICY org_notification_preferences_insert ON public.org_notification_preferences FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS org_notification_preferences_update ON public.org_notification_preferences;
CREATE POLICY org_notification_preferences_update ON public.org_notification_preferences FOR UPDATE USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS org_notification_preferences_delete ON public.org_notification_preferences;
CREATE POLICY org_notification_preferences_delete ON public.org_notification_preferences FOR DELETE USING (public.is_org_member(org_id));

-- 4) Per-user dismiss for Phase 2 success card
CREATE TABLE IF NOT EXISTS public.user_phase2_success_card_state (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  dismissed_at timestamptz,
  PRIMARY KEY (user_id, org_id)
);

ALTER TABLE public.user_phase2_success_card_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_phase2_success_card_state_rw ON public.user_phase2_success_card_state;
CREATE POLICY user_phase2_success_card_state_rw ON public.user_phase2_success_card_state
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5) Grandfather: mature orgs → COMPLETED; others with Phase 1 done → SKIPPED so they are not blocked
UPDATE public.org_onboarding_states o
SET
  phase2_status = 'COMPLETED',
  phase2_completed_at = COALESCE(o.phase2_completed_at, now()),
  phase2_current_step = COALESCE(o.phase2_current_step, 'first_live_result')
WHERE o.phase2_status IS NULL
  AND o.guided_phase1_status = 'COMPLETED'
  AND (
    SELECT COUNT(*)::int FROM public.organization_members m WHERE m.org_id = o.org_id
  ) >= 3
  AND EXISTS (SELECT 1 FROM public.policies p WHERE p.org_id = o.org_id AND p.status = 'active' AND p.archived_at IS NULL)
  AND EXISTS (
    SELECT 1 FROM public.notification_outbox n
    WHERE n.org_id = o.org_id
      AND (n.delivered_at IS NOT NULL OR n.sent_at IS NOT NULL)
    LIMIT 1
  )
  AND (
    EXISTS (SELECT 1 FROM public.issues i WHERE i.org_id = o.org_id LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.approvals a JOIN public.change_events ce ON ce.id = a.change_event_id WHERE ce.org_id = o.org_id LIMIT 1)
  );
