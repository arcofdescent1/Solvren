-- Phase 8 — Demo System & Seed Data
-- demo_scenarios, demo_org_resets, demo_seed_manifests, org_demo_config

-- 8.1 demo_scenarios
CREATE TABLE IF NOT EXISTS public.demo_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  seed_version text NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_scenarios_key ON public.demo_scenarios(scenario_key);
CREATE INDEX IF NOT EXISTS idx_demo_scenarios_status ON public.demo_scenarios(status);

-- 8.2 demo_org_resets
CREATE TABLE IF NOT EXISTS public.demo_org_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  scenario_key text NOT NULL,
  seed_version text NOT NULL,
  reset_status text NOT NULL DEFAULT 'queued',
  requested_by_user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_org_resets_org ON public.demo_org_resets(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_demo_org_resets_status ON public.demo_org_resets(reset_status);

-- 8.3 demo_seed_manifests
CREATE TABLE IF NOT EXISTS public.demo_seed_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_key text NOT NULL,
  seed_version text NOT NULL,
  manifest_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_demo_seed_manifests_scenario_version
  ON public.demo_seed_manifests(scenario_key, seed_version);

-- 8.4 org_demo_config — demo org flags and environment
CREATE TABLE IF NOT EXISTS public.org_demo_config (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_demo_org boolean NOT NULL DEFAULT false,
  demo_scenario_key text NULL,
  demo_reset_allowed boolean NOT NULL DEFAULT true,
  demo_auto_refresh_enabled boolean NOT NULL DEFAULT false,
  demo_external_write_disabled boolean NOT NULL DEFAULT true,
  last_reset_at timestamptz NULL,
  validation_status text NULL DEFAULT 'unknown',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_demo_config_demo_org ON public.org_demo_config(is_demo_org) WHERE is_demo_org = true;

-- RLS
ALTER TABLE public.demo_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY demo_scenarios_select ON public.demo_scenarios FOR SELECT USING (true);

ALTER TABLE public.demo_org_resets ENABLE ROW LEVEL SECURITY;
CREATE POLICY demo_org_resets_select ON public.demo_org_resets FOR SELECT
  USING (public.is_org_member(org_id));
CREATE POLICY demo_org_resets_insert ON public.demo_org_resets FOR INSERT
  WITH CHECK (public.is_org_member(org_id));

ALTER TABLE public.demo_seed_manifests ENABLE ROW LEVEL SECURITY;
CREATE POLICY demo_seed_manifests_select ON public.demo_seed_manifests FOR SELECT USING (true);

ALTER TABLE public.org_demo_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_demo_config_select ON public.org_demo_config FOR SELECT
  USING (public.is_org_member(org_id));
CREATE POLICY org_demo_config_insert ON public.org_demo_config FOR INSERT
  WITH CHECK (public.is_org_member(org_id));
CREATE POLICY org_demo_config_update ON public.org_demo_config FOR UPDATE
  USING (public.is_org_member(org_id));

-- Service role bypass for demo operations (reset/seed)
CREATE POLICY demo_org_resets_service ON public.demo_org_resets FOR ALL
  USING (auth.role() = 'service_role');
CREATE POLICY org_demo_config_service ON public.org_demo_config FOR ALL
  USING (auth.role() = 'service_role');

-- Seed canonical demo scenarios
INSERT INTO public.demo_scenarios (scenario_key, display_name, description, status, seed_version, metadata_json)
VALUES
  ('failed_payment_recovery', 'Failed Payment Recovery', 'Detect failed payment, estimate revenue at risk, retry, recover revenue, show ROI', 'active', '1.0.0', '{"narrative":"payment_recovery","scenes":["issue_detected","impact_estimated","action_selected","payment_retried","revenue_recovered","executive_hero"]}'),
  ('qualified_lead_rescue', 'Qualified Lead Rescue', 'Lead goes untouched, SLA breach detected, owner assignment, meeting booked, avoided loss shown', 'active', '1.0.0', '{"narrative":"lead_rescue","scenes":["sla_breach","owner_assigned","meeting_booked","avoided_loss"]}'),
  ('duplicate_cleanup', 'Duplicate Data Cleanup', 'Duplicate contacts detected, operational burden quantified, merge executed, cleanup savings shown', 'active', '1.0.0', '{"narrative":"duplicate_cleanup","scenes":["cluster_detected","merge_recommended","cleanup_complete","savings_shown"]}'),
  ('change_risk_contained', 'Change Risk Blocked', 'Risky revenue-impacting change enters workflow, policy blocks progression, incident avoided', 'active', '1.0.0', '{"narrative":"change_risk","scenes":["change_entered","policy_blocked","approval_path","incident_avoided"]}'),
  ('executive_hero', 'Executive Hero Story', 'Hero dashboard with recovered revenue, avoided loss, active issues, major timeline events', 'active', '1.0.0', '{"narrative":"executive_overview","scenes":["hero_dashboard","recent_events","value_summary"]}')
ON CONFLICT (scenario_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  metadata_json = EXCLUDED.metadata_json,
  updated_at = now();
