-- Phase 4 — Detector Framework (§9).
-- detector_packs, detector_definitions, detector_configs, detector_runs, detector_findings,
-- detector_health_snapshots, detector_suppression_state

-- 9.1 detector_packs
CREATE TABLE IF NOT EXISTS public.detector_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text NOT NULL,
  business_theme text NOT NULL,
  recommended_integrations_json jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_detector_packs_status ON public.detector_packs(status);

-- 9.2 detector_definitions
CREATE TABLE IF NOT EXISTS public.detector_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  detector_key text NOT NULL UNIQUE,
  detector_pack_id uuid NOT NULL REFERENCES public.detector_packs(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  business_problem text NOT NULL,
  why_it_matters text NOT NULL,
  required_integrations_json jsonb NOT NULL DEFAULT '[]',
  required_signal_keys_json jsonb NOT NULL DEFAULT '[]',
  optional_signal_keys_json jsonb NOT NULL DEFAULT '[]',
  required_entity_types_json jsonb NOT NULL DEFAULT '[]',
  evaluation_mode text NOT NULL,
  evaluation_window_json jsonb NOT NULL DEFAULT '{}',
  grouping_strategy_json jsonb NOT NULL DEFAULT '{}',
  condition_definition_json jsonb NOT NULL DEFAULT '{}',
  threshold_defaults_json jsonb NOT NULL DEFAULT '{}',
  noise_controls_json jsonb NOT NULL DEFAULT '{}',
  dedupe_strategy_json jsonb NOT NULL DEFAULT '{}',
  suppression_strategy_json jsonb NOT NULL DEFAULT '{}',
  issue_template_key text NOT NULL DEFAULT 'default',
  default_severity text NOT NULL DEFAULT 'medium',
  default_priority_band text NOT NULL DEFAULT 'medium',
  evidence_schema_json jsonb NOT NULL DEFAULT '{}',
  impact_prerequisites_json jsonb NOT NULL DEFAULT '[]',
  routing_hints_json jsonb NOT NULL DEFAULT '{}',
  verification_hints_json jsonb NOT NULL DEFAULT '{}',
  detector_version text NOT NULL DEFAULT '1.0',
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_detector_definitions_pack ON public.detector_definitions(detector_pack_id);
CREATE INDEX IF NOT EXISTS idx_detector_definitions_status ON public.detector_definitions(status);
CREATE INDEX IF NOT EXISTS idx_detector_definitions_key ON public.detector_definitions(detector_key);

-- 9.3 detector_configs
CREATE TABLE IF NOT EXISTS public.detector_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  detector_definition_id uuid NOT NULL REFERENCES public.detector_definitions(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  threshold_overrides_json jsonb NOT NULL DEFAULT '{}',
  noise_control_overrides_json jsonb NOT NULL DEFAULT '{}',
  routing_overrides_json jsonb NOT NULL DEFAULT '{}',
  severity_override text,
  priority_override text,
  schedule_override_json jsonb,
  rollout_state text NOT NULL DEFAULT 'off',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, detector_definition_id)
);

CREATE INDEX IF NOT EXISTS idx_detector_configs_org ON public.detector_configs(org_id);
CREATE INDEX IF NOT EXISTS idx_detector_configs_enabled ON public.detector_configs(org_id, enabled) WHERE enabled = true;

-- 9.4 detector_runs
CREATE TABLE IF NOT EXISTS public.detector_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  detector_definition_id uuid NOT NULL REFERENCES public.detector_definitions(id) ON DELETE CASCADE,
  run_mode text NOT NULL,
  trigger_signal_id uuid REFERENCES public.normalized_signals(id) ON DELETE SET NULL,
  window_start timestamptz,
  window_end timestamptz,
  status text NOT NULL DEFAULT 'running',
  candidate_count integer NOT NULL DEFAULT 0,
  detection_count integer NOT NULL DEFAULT 0,
  suppressed_count integer NOT NULL DEFAULT 0,
  error_count integer NOT NULL DEFAULT 0,
  metrics_json jsonb NOT NULL DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_detector_runs_org ON public.detector_runs(org_id);
CREATE INDEX IF NOT EXISTS idx_detector_runs_detector ON public.detector_runs(detector_definition_id);
CREATE INDEX IF NOT EXISTS idx_detector_runs_started ON public.detector_runs(started_at DESC);

-- 9.5 detector_findings
CREATE TABLE IF NOT EXISTS public.detector_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  detector_definition_id uuid NOT NULL REFERENCES public.detector_definitions(id) ON DELETE CASCADE,
  detector_run_id uuid NOT NULL REFERENCES public.detector_runs(id) ON DELETE CASCADE,
  grouping_key text NOT NULL,
  dedupe_key text NOT NULL,
  finding_status text NOT NULL,
  primary_canonical_entity_id uuid REFERENCES public.canonical_entities(id) ON DELETE SET NULL,
  severity text NOT NULL,
  priority_band text NOT NULL,
  confidence_score numeric(5,2) NOT NULL DEFAULT 0,
  evidence_bundle_json jsonb NOT NULL DEFAULT '{}',
  suppression_reason_json jsonb,
  issue_id uuid REFERENCES public.issues(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, detector_definition_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_detector_findings_org ON public.detector_findings(org_id);
CREATE INDEX IF NOT EXISTS idx_detector_findings_detector ON public.detector_findings(detector_definition_id);
CREATE INDEX IF NOT EXISTS idx_detector_findings_run ON public.detector_findings(detector_run_id);
CREATE INDEX IF NOT EXISTS idx_detector_findings_created ON public.detector_findings(org_id, detector_definition_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_detector_findings_status ON public.detector_findings(finding_status);

-- 9.6 detector_health_snapshots
CREATE TABLE IF NOT EXISTS public.detector_health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  detector_definition_id uuid NOT NULL REFERENCES public.detector_definitions(id) ON DELETE CASCADE,
  snapshot_time timestamptz NOT NULL DEFAULT now(),
  coverage_score numeric(5,2) NOT NULL DEFAULT 0,
  signal_availability_score numeric(5,2) NOT NULL DEFAULT 0,
  signal_freshness_score numeric(5,2) NOT NULL DEFAULT 0,
  noise_score numeric(5,2) NOT NULL DEFAULT 0,
  precision_proxy_score numeric(5,2),
  blind_spots_json jsonb NOT NULL DEFAULT '[]',
  metrics_json jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_detector_health_org ON public.detector_health_snapshots(org_id);
CREATE INDEX IF NOT EXISTS idx_detector_health_detector ON public.detector_health_snapshots(detector_definition_id);
CREATE INDEX IF NOT EXISTS idx_detector_health_time ON public.detector_health_snapshots(detector_definition_id, snapshot_time DESC);

-- 9.7 detector_suppression_state
CREATE TABLE IF NOT EXISTS public.detector_suppression_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  detector_definition_id uuid NOT NULL REFERENCES public.detector_definitions(id) ON DELETE CASCADE,
  suppression_scope_key text NOT NULL,
  active_until timestamptz,
  state_json jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_detector_suppression_scope ON public.detector_suppression_state(org_id, detector_definition_id, suppression_scope_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_detector_suppression_unique ON public.detector_suppression_state(org_id, detector_definition_id, suppression_scope_key);

-- RLS
ALTER TABLE public.detector_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detector_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detector_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detector_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detector_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detector_health_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detector_suppression_state ENABLE ROW LEVEL SECURITY;

-- detector_packs, detector_definitions: readable by all (platform catalog)
DROP POLICY IF EXISTS detector_packs_select ON public.detector_packs;
CREATE POLICY detector_packs_select ON public.detector_packs FOR SELECT USING (true);
DROP POLICY IF EXISTS detector_definitions_select ON public.detector_definitions;
CREATE POLICY detector_definitions_select ON public.detector_definitions FOR SELECT USING (true);

-- detector_configs: org-scoped
DROP POLICY IF EXISTS detector_configs_select ON public.detector_configs;
CREATE POLICY detector_configs_select ON public.detector_configs FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS detector_configs_insert ON public.detector_configs;
CREATE POLICY detector_configs_insert ON public.detector_configs FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS detector_configs_update ON public.detector_configs;
CREATE POLICY detector_configs_update ON public.detector_configs FOR UPDATE USING (public.is_org_member(org_id));

-- detector_runs, detector_findings, detector_health_snapshots, detector_suppression_state: org-scoped
DROP POLICY IF EXISTS detector_runs_select ON public.detector_runs;
CREATE POLICY detector_runs_select ON public.detector_runs FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS detector_runs_insert ON public.detector_runs;
CREATE POLICY detector_runs_insert ON public.detector_runs FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS detector_runs_update ON public.detector_runs;
CREATE POLICY detector_runs_update ON public.detector_runs FOR UPDATE USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS detector_findings_select ON public.detector_findings;
CREATE POLICY detector_findings_select ON public.detector_findings FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS detector_findings_insert ON public.detector_findings;
CREATE POLICY detector_findings_insert ON public.detector_findings FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS detector_findings_update ON public.detector_findings;
CREATE POLICY detector_findings_update ON public.detector_findings FOR UPDATE USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS detector_health_select ON public.detector_health_snapshots;
CREATE POLICY detector_health_select ON public.detector_health_snapshots FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS detector_health_insert ON public.detector_health_snapshots;
CREATE POLICY detector_health_insert ON public.detector_health_snapshots FOR INSERT WITH CHECK (public.is_org_member(org_id));

DROP POLICY IF EXISTS detector_suppression_select ON public.detector_suppression_state;
CREATE POLICY detector_suppression_select ON public.detector_suppression_state FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS detector_suppression_insert ON public.detector_suppression_state;
CREATE POLICY detector_suppression_insert ON public.detector_suppression_state FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS detector_suppression_update ON public.detector_suppression_state;
CREATE POLICY detector_suppression_update ON public.detector_suppression_state FOR UPDATE USING (public.is_org_member(org_id));
