-- Phase 6 — Learning / calibration substrate (additive).
-- Canonical trace: policy_decision_logs.id = governance trace_id.

-- ---------------------------------------------------------------------------
-- Labels (explicit + implicit; append-only with superseded_by chain)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.governance_decision_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id uuid NOT NULL REFERENCES public.policy_decision_logs(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label_type text NOT NULL,
  label_source text NOT NULL CHECK (label_source IN ('HUMAN', 'IMPLICIT')),
  label_actor_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  confidence numeric NOT NULL DEFAULT 1 CHECK (confidence >= 0 AND confidence <= 1),
  rationale text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  superseded_by uuid NULL REFERENCES public.governance_decision_labels(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_governance_labels_trace ON public.governance_decision_labels(trace_id);
CREATE INDEX IF NOT EXISTS idx_governance_labels_org_created ON public.governance_decision_labels(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_governance_labels_type ON public.governance_decision_labels(org_id, label_type);

ALTER TABLE public.governance_decision_labels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS governance_decision_labels_select ON public.governance_decision_labels;
CREATE POLICY governance_decision_labels_select ON public.governance_decision_labels
  FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS governance_decision_labels_insert ON public.governance_decision_labels;
CREATE POLICY governance_decision_labels_insert ON public.governance_decision_labels
  FOR INSERT WITH CHECK (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Rule / calibration suggestions (review workflow; never auto-activate)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.governance_rule_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  suggestion_type text NOT NULL,
  target_policy_id uuid NULL REFERENCES public.policies(id) ON DELETE SET NULL,
  suggested_rule_json jsonb NOT NULL DEFAULT '{}',
  evidence_summary_json jsonb NOT NULL DEFAULT '{}',
  simulation_summary_json jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'REVIEWED', 'ACCEPTED', 'REJECTED')),
  generation_version text NULL,
  dataset_snapshot_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NULL,
  review_rationale text NULL
);

CREATE INDEX IF NOT EXISTS idx_governance_suggestions_org_status ON public.governance_rule_suggestions(org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_governance_suggestions_policy ON public.governance_rule_suggestions(target_policy_id) WHERE target_policy_id IS NOT NULL;

ALTER TABLE public.governance_rule_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS governance_rule_suggestions_select ON public.governance_rule_suggestions;
CREATE POLICY governance_rule_suggestions_select ON public.governance_rule_suggestions
  FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS governance_rule_suggestions_insert ON public.governance_rule_suggestions;
CREATE POLICY governance_rule_suggestions_insert ON public.governance_rule_suggestions
  FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS governance_rule_suggestions_update ON public.governance_rule_suggestions;
CREATE POLICY governance_rule_suggestions_update ON public.governance_rule_suggestions
  FOR UPDATE USING (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Bounded calibration proposals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.governance_calibration_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  parameter_key text NOT NULL,
  current_value_json jsonb NOT NULL DEFAULT 'null',
  proposed_value_json jsonb NOT NULL,
  min_bound_json jsonb NULL,
  max_bound_json jsonb NULL,
  evidence_summary_json jsonb NOT NULL DEFAULT '{}',
  simulation_summary_json jsonb NOT NULL DEFAULT '{}',
  trace_window_start timestamptz NULL,
  trace_window_end timestamptz NULL,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'REVIEWED', 'ACCEPTED', 'REJECTED')),
  calibration_job_version text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz NULL,
  review_rationale text NULL
);

CREATE INDEX IF NOT EXISTS idx_governance_calib_org_status ON public.governance_calibration_recommendations(org_id, status, created_at DESC);

ALTER TABLE public.governance_calibration_recommendations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS governance_calibration_recommendations_select ON public.governance_calibration_recommendations;
CREATE POLICY governance_calibration_recommendations_select ON public.governance_calibration_recommendations
  FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS governance_calibration_recommendations_insert ON public.governance_calibration_recommendations;
CREATE POLICY governance_calibration_recommendations_insert ON public.governance_calibration_recommendations
  FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS governance_calibration_recommendations_update ON public.governance_calibration_recommendations;
CREATE POLICY governance_calibration_recommendations_update ON public.governance_calibration_recommendations
  FOR UPDATE USING (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Org-level learning kill switches (feature flags)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.org_learning_settings (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  learning_disabled boolean NOT NULL DEFAULT false,
  calibration_disabled boolean NOT NULL DEFAULT false,
  rule_suggestions_disabled boolean NOT NULL DEFAULT false,
  autonomy_suggestions_disabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.org_learning_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_learning_settings_select ON public.org_learning_settings;
CREATE POLICY org_learning_settings_select ON public.org_learning_settings
  FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS org_learning_settings_all ON public.org_learning_settings;
CREATE POLICY org_learning_settings_all ON public.org_learning_settings
  FOR ALL USING (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Canonical analytics views (read-only projections)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.governance_decision_facts AS
SELECT
  pdl.id AS trace_id,
  pdl.org_id,
  pdl.created_at AS decision_timestamp,
  COALESCE(
    pdl.evaluation_context_json #>> '{metadata,governanceResourceType}',
    pdl.evaluation_context_json ->> 'primaryEntityType'
  ) AS resource_type,
  COALESCE(
    pdl.evaluation_context_json #>> '{metadata,changeEventId}',
    pdl.evaluation_context_json ->> 'primaryEntityId'
  ) AS resource_id,
  pdl.action_key,
  pdl.playbook_key,
  pdl.workflow_step_key,
  pdl.evaluation_context_json ->> 'provider' AS provider,
  pdl.final_disposition AS disposition,
  pdl.decision_reason_code,
  pdl.effective_autonomy_mode AS autonomy_effective,
  (pdl.final_disposition = 'REQUIRE_APPROVAL') AS approval_required,
  pdl.evaluation_context_json ->> 'environment' AS environment,
  pdl.evaluation_context_json ->> 'severity' AS issue_severity,
  NULLIF((pdl.evaluation_context_json ->> 'impactAmount')::numeric, NULL)::double precision AS impact_amount,
  NULLIF((pdl.evaluation_context_json ->> 'confidenceScore')::numeric, NULL)::double precision AS confidence,
  pdl.matched_rules_json,
  pdl.blocked_rules_json,
  pdl.approval_rules_json,
  pdl.evaluation_context_json
FROM public.policy_decision_logs pdl;

CREATE OR REPLACE VIEW public.governance_approval_outcome_facts AS
SELECT
  ar.source_policy_decision_log_id AS trace_id,
  ar.org_id,
  ar.id AS approval_request_id,
  ar.status AS approval_status,
  ar.created_at AS approval_requested_at,
  ar.resolved_at,
  CASE
    WHEN ar.resolved_at IS NOT NULL AND pdl.created_at IS NOT NULL
    THEN EXTRACT(EPOCH FROM (ar.resolved_at - pdl.created_at)) * 1000
    ELSE NULL
  END AS approval_latency_ms
FROM public.approval_requests ar
JOIN public.policy_decision_logs pdl ON pdl.id = ar.source_policy_decision_log_id;

CREATE OR REPLACE VIEW public.governance_feedback_facts AS
SELECT
  l.id AS label_id,
  l.trace_id,
  l.org_id,
  l.label_type,
  l.label_source,
  l.confidence,
  l.rationale,
  l.created_at,
  l.superseded_by,
  pdl.final_disposition AS related_disposition,
  pdl.action_key,
  pdl.issue_id
FROM public.governance_decision_labels l
JOIN public.policy_decision_logs pdl ON pdl.id = l.trace_id
WHERE l.superseded_by IS NULL;

COMMENT ON VIEW public.governance_decision_facts IS 'Phase 6 canonical projection of policy_decision_logs for learning.';
COMMENT ON VIEW public.governance_approval_outcome_facts IS 'Phase 6 approval outcomes keyed by governance trace_id.';
COMMENT ON VIEW public.governance_feedback_facts IS 'Phase 6 active (non-superseded) labels joined to decision context.';

-- Optional forward link from executions to governance trace (populate when execution follows a logged decision)
ALTER TABLE public.integration_action_executions
  ADD COLUMN IF NOT EXISTS governance_trace_id uuid NULL REFERENCES public.policy_decision_logs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_integration_action_exec_governance_trace
  ON public.integration_action_executions(governance_trace_id)
  WHERE governance_trace_id IS NOT NULL;
