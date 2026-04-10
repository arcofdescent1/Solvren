-- Phase 2 — Attention routing: org settings extensions, delegation audit, delivery log

-- Organization settings: attention routing (single source of truth; executive threshold remains Phase 1 column)
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS senior_tech_revenue_escalation_threshold_usd numeric NULL DEFAULT 50000,
  ADD COLUMN IF NOT EXISTS department_leader_revenue_escalation_threshold_usd numeric NULL DEFAULT 25000,
  ADD COLUMN IF NOT EXISTS immediate_deploy_window_hours int NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS digest_include_medium_risk boolean NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS suppress_low_risk_exec_notifications boolean NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS executive_default_route text NULL DEFAULT 'IMMEDIATE'
    CHECK (executive_default_route IS NULL OR executive_default_route IN ('IMMEDIATE', 'DAILY_DIGEST', 'WEEKLY_DIGEST')),
  ADD COLUMN IF NOT EXISTS senior_tech_default_route text NULL DEFAULT 'IMMEDIATE'
    CHECK (senior_tech_default_route IS NULL OR senior_tech_default_route IN ('IMMEDIATE', 'DAILY_DIGEST', 'WEEKLY_DIGEST')),
  ADD COLUMN IF NOT EXISTS department_leader_default_route text NULL DEFAULT 'IMMEDIATE'
    CHECK (department_leader_default_route IS NULL OR department_leader_default_route IN ('IMMEDIATE', 'DAILY_DIGEST', 'WEEKLY_DIGEST')),
  ADD COLUMN IF NOT EXISTS operator_default_route text NULL DEFAULT 'IMMEDIATE'
    CHECK (operator_default_route IS NULL OR operator_default_route IN ('IMMEDIATE', 'DAILY_DIGEST', 'WEEKLY_DIGEST')),
  ADD COLUMN IF NOT EXISTS attention_daily_digest_enabled boolean NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attention_weekly_digest_enabled boolean NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS attention_fallback_operator_user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.organization_settings.senior_tech_revenue_escalation_threshold_usd IS
  'Phase 2: revenue at risk (USD) threshold for senior technical leader routing; default 50000 when null.';
COMMENT ON COLUMN public.organization_settings.department_leader_revenue_escalation_threshold_usd IS
  'Phase 2: revenue threshold for department leader routing; default 25000 when null.';
COMMENT ON COLUMN public.organization_settings.attention_fallback_operator_user_id IS
  'Phase 2: optional org-wide fallback operator for delegation target resolution.';

CREATE TABLE IF NOT EXISTS public.attention_delegation_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  change_id uuid NOT NULL REFERENCES public.change_events (id) ON DELETE CASCADE,
  from_persona text NOT NULL,
  from_user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  to_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reason text NOT NULL,
  snapshot_json jsonb NULL,
  event_type text NULL,
  routing_reason_hash text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attention_delegation_org_change
  ON public.attention_delegation_decisions (org_id, change_id, created_at DESC);

ALTER TABLE public.attention_delegation_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attention_delegation_select ON public.attention_delegation_decisions;
CREATE POLICY attention_delegation_select ON public.attention_delegation_decisions
  FOR SELECT USING (public.is_org_member (org_id));

DROP POLICY IF EXISTS attention_delegation_insert ON public.attention_delegation_decisions;
CREATE POLICY attention_delegation_insert ON public.attention_delegation_decisions
  FOR INSERT WITH CHECK (public.is_org_admin (org_id));

COMMENT ON TABLE public.attention_delegation_decisions IS
  'Phase 2: persisted delegation decisions for audit and digest/preview.';

CREATE TABLE IF NOT EXISTS public.notification_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  change_id uuid NOT NULL REFERENCES public.change_events (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  route_type text NOT NULL,
  channel text NOT NULL,
  delivery_template text NOT NULL,
  reason_hash text NOT NULL,
  primary_reason_code text NULL,
  material_snapshot_json jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_user_change_created
  ON public.notification_delivery_log (user_id, change_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_org_created
  ON public.notification_delivery_log (org_id, created_at DESC);

ALTER TABLE public.notification_delivery_log ENABLE ROW LEVEL SECURITY;

-- Inserts use service role in workers; members may read own rows for future UI
DROP POLICY IF EXISTS notification_delivery_log_select_own ON public.notification_delivery_log;
CREATE POLICY notification_delivery_log_select_own ON public.notification_delivery_log
  FOR SELECT USING (
    auth.uid () = user_id
    OR public.is_org_admin (org_id)
  );

COMMENT ON TABLE public.notification_delivery_log IS
  'Phase 2: successful notification deliveries for suppression, material baselines, and analytics.';
