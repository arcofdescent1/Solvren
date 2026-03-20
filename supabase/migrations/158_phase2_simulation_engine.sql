-- Phase 2 — Deterministic Simulation Engine
-- Extends simulation_runs, adds snapshots, step/entity results, comparisons.

-- 8.1 simulation_input_snapshots (immutable source-of-truth)
CREATE TABLE IF NOT EXISTS public.simulation_input_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  snapshot_type text NOT NULL CHECK (snapshot_type IN ('HISTORICAL_WINDOW', 'ISSUE_SET', 'DEMO_SEED')),

  historical_window_start timestamptz NULL,
  historical_window_end timestamptz NULL,

  issues_snapshot_json jsonb NOT NULL DEFAULT '[]',
  findings_snapshot_json jsonb NOT NULL DEFAULT '[]',
  signals_snapshot_json jsonb NOT NULL DEFAULT '[]',
  entities_snapshot_json jsonb NOT NULL DEFAULT '[]',
  actions_snapshot_json jsonb NOT NULL DEFAULT '[]',
  outcomes_snapshot_json jsonb NOT NULL DEFAULT '[]',

  source_metadata_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_simulation_input_snapshots_org ON public.simulation_input_snapshots(org_id);

-- 8.2 Alter simulation_runs for Phase 2 schema
ALTER TABLE public.simulation_runs
  ADD COLUMN IF NOT EXISTS config_json jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS input_snapshot_id uuid REFERENCES public.simulation_input_snapshots(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS policy_snapshot_json jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS playbook_snapshot_json jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assumption_snapshot_json jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS engine_snapshot_json jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS deterministic_seed text NOT NULL DEFAULT '0',
  ADD COLUMN IF NOT EXISTS result_summary_json jsonb NULL,
  ADD COLUMN IF NOT EXISTS confidence_summary_json jsonb NULL,
  ADD COLUMN IF NOT EXISTS warning_summary_json jsonb NULL,
  ADD COLUMN IF NOT EXISTS started_at timestamptz NULL;

-- Status values: QUEUED, RUNNING, COMPLETED, FAILED, CANCELED (case-insensitive)

-- Backfill policy_snapshot from policy_set_snapshot_json if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'simulation_runs' AND column_name = 'policy_set_snapshot_json') THEN
    UPDATE public.simulation_runs
    SET policy_snapshot_json = COALESCE(policy_set_snapshot_json, '{}'::jsonb)
    WHERE policy_snapshot_json = '{}' OR policy_snapshot_json IS NULL;
  END IF;
END $$;

-- 8.3 simulation_step_results
CREATE TABLE IF NOT EXISTS public.simulation_step_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_run_id uuid NOT NULL REFERENCES public.simulation_runs(id) ON DELETE CASCADE,
  sequence_no integer NOT NULL,
  issue_id uuid NULL,
  finding_id uuid NULL,
  workflow_key text NULL,
  step_key text NOT NULL,
  step_type text NOT NULL,
  step_status text NOT NULL CHECK (step_status IN ('SKIPPED', 'COMPLETED', 'BLOCKED', 'SIMULATED', 'FAILED')),

  input_json jsonb NOT NULL DEFAULT '{}',
  output_json jsonb NOT NULL DEFAULT '{}',
  explanation_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_simulation_step_results_run_seq
  ON public.simulation_step_results(simulation_run_id, sequence_no);

-- 8.4 simulation_entity_results
CREATE TABLE IF NOT EXISTS public.simulation_entity_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulation_run_id uuid NOT NULL REFERENCES public.simulation_runs(id) ON DELETE CASCADE,
  issue_id uuid NULL,
  finding_id uuid NULL,
  primary_entity_id uuid NULL,

  projected_recovered_amount numeric(18,2) NULL,
  projected_avoided_amount numeric(18,2) NULL,
  projected_operational_savings_amount numeric(18,2) NULL,

  action_count integer NOT NULL DEFAULT 0,
  approval_count integer NOT NULL DEFAULT 0,
  blocked_action_count integer NOT NULL DEFAULT 0,

  confidence_score numeric(5,2) NOT NULL,
  confidence_band text NOT NULL,
  explanation_json jsonb NOT NULL DEFAULT '{}',

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_simulation_entity_results_run ON public.simulation_entity_results(simulation_run_id);

-- 8.5 simulation_comparisons
CREATE TABLE IF NOT EXISTS public.simulation_comparisons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  baseline_run_id uuid NOT NULL REFERENCES public.simulation_runs(id) ON DELETE CASCADE,
  candidate_run_id uuid NOT NULL REFERENCES public.simulation_runs(id) ON DELETE CASCADE,
  comparison_type text NOT NULL,
  comparison_result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_simulation_comparisons_org ON public.simulation_comparisons(org_id);

-- RLS
ALTER TABLE public.simulation_input_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_step_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_entity_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulation_comparisons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS simulation_input_snapshots_select ON public.simulation_input_snapshots;
CREATE POLICY simulation_input_snapshots_select ON public.simulation_input_snapshots FOR SELECT
  USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS simulation_input_snapshots_insert ON public.simulation_input_snapshots;
CREATE POLICY simulation_input_snapshots_insert ON public.simulation_input_snapshots FOR INSERT
  WITH CHECK (public.is_org_member(org_id));

DROP POLICY IF EXISTS simulation_step_results_select ON public.simulation_step_results;
CREATE POLICY simulation_step_results_select ON public.simulation_step_results FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.simulation_runs sr WHERE sr.id = simulation_step_results.simulation_run_id AND public.is_org_member(sr.org_id)));
DROP POLICY IF EXISTS simulation_step_results_insert ON public.simulation_step_results;
CREATE POLICY simulation_step_results_insert ON public.simulation_step_results FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.simulation_runs sr WHERE sr.id = simulation_step_results.simulation_run_id AND public.is_org_member(sr.org_id)));

DROP POLICY IF EXISTS simulation_entity_results_select ON public.simulation_entity_results;
CREATE POLICY simulation_entity_results_select ON public.simulation_entity_results FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.simulation_runs sr WHERE sr.id = simulation_entity_results.simulation_run_id AND public.is_org_member(sr.org_id)));
DROP POLICY IF EXISTS simulation_entity_results_insert ON public.simulation_entity_results;
CREATE POLICY simulation_entity_results_insert ON public.simulation_entity_results FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.simulation_runs sr WHERE sr.id = simulation_entity_results.simulation_run_id AND public.is_org_member(sr.org_id)));

DROP POLICY IF EXISTS simulation_comparisons_select ON public.simulation_comparisons;
CREATE POLICY simulation_comparisons_select ON public.simulation_comparisons FOR SELECT
  USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS simulation_comparisons_insert ON public.simulation_comparisons;
CREATE POLICY simulation_comparisons_insert ON public.simulation_comparisons FOR INSERT
  WITH CHECK (public.is_org_member(org_id));

-- Allow update for simulation_runs (status, results)
DROP POLICY IF EXISTS simulation_runs_update ON public.simulation_runs;
CREATE POLICY simulation_runs_update ON public.simulation_runs FOR UPDATE
  USING (public.is_org_member(org_id));
