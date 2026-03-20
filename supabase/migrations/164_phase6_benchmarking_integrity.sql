-- Phase 6 — Benchmarking Integrity Layer

-- 14.1 benchmark_metrics
CREATE TABLE IF NOT EXISTS public.benchmark_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key text NOT NULL,
  display_name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  unit_type text NOT NULL,
  normalization_method text NOT NULL,
  minimum_org_count integer NOT NULL,
  minimum_coverage_rate numeric(5,4) NOT NULL,
  customer_visible boolean NOT NULL DEFAULT true,
  metric_version text NOT NULL,
  higher_is_better boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_benchmark_metrics_key_version
  ON public.benchmark_metrics(metric_key, metric_version);

-- 14.2 benchmark_cohorts
CREATE TABLE IF NOT EXISTS public.benchmark_cohorts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_key text NOT NULL,
  display_name text NOT NULL,
  cohort_definition_json jsonb NOT NULL,
  minimum_org_count integer NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_benchmark_cohorts_key ON public.benchmark_cohorts(cohort_key);

-- 14.3 benchmark_snapshots — Phase 6 schema (per cohort+metric)
-- Phase 8 had simpler cohort-level snapshots; Phase 6 uses per-metric snapshots
DROP TABLE IF EXISTS public.benchmark_snapshots CASCADE;
CREATE TABLE public.benchmark_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id uuid NOT NULL REFERENCES public.benchmark_cohorts(id) ON DELETE CASCADE,
  metric_id uuid NOT NULL REFERENCES public.benchmark_metrics(id) ON DELETE CASCADE,

  snapshot_time timestamptz NOT NULL,

  org_count integer NOT NULL,
  metric_coverage_rate numeric(5,4) NOT NULL,

  median_value numeric(18,6) NULL,
  p25_value numeric(18,6) NULL,
  p75_value numeric(18,6) NULL,
  mean_value numeric(18,6) NULL,
  stddev_value numeric(18,6) NULL,

  confidence_score numeric(5,2) NOT NULL,
  confidence_band text NOT NULL,

  metrics_json jsonb NOT NULL DEFAULT '{}',
  reasons_json jsonb NOT NULL DEFAULT '[]',

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_snapshots_cohort_metric_time
  ON public.benchmark_snapshots(cohort_id, metric_id, snapshot_time DESC);

-- 14.4 org_benchmark_dimensions
CREATE TABLE IF NOT EXISTS public.org_benchmark_dimensions (
  org_id uuid PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_size_band text NULL,
  arr_band text NULL,
  business_model text NULL,
  sales_motion text NULL,
  industry_family text NULL,
  integration_footprint_tier text NULL,
  operational_maturity_tier text NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 14.5 benchmark_result_logs
CREATE TABLE IF NOT EXISTS public.benchmark_result_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  cohort_key text NOT NULL,
  snapshot_id uuid NULL REFERENCES public.benchmark_snapshots(id) ON DELETE SET NULL,

  customer_value numeric(18,6) NULL,
  percentile_rank numeric(5,2) NULL,
  normalized_gap numeric(18,6) NULL,

  confidence_score numeric(5,2) NOT NULL,
  confidence_band text NOT NULL,

  safe_to_display boolean NOT NULL,
  hidden_reason_code text NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benchmark_result_logs_org_created
  ON public.benchmark_result_logs(org_id, created_at DESC);

-- RLS
ALTER TABLE public.benchmark_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY benchmark_metrics_select ON public.benchmark_metrics FOR SELECT USING (true);

ALTER TABLE public.benchmark_cohorts ENABLE ROW LEVEL SECURITY;
CREATE POLICY benchmark_cohorts_select ON public.benchmark_cohorts FOR SELECT USING (true);

ALTER TABLE public.benchmark_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY benchmark_snapshots_select ON public.benchmark_snapshots FOR SELECT USING (true);
CREATE POLICY benchmark_snapshots_service ON public.benchmark_snapshots FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.org_benchmark_dimensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_benchmark_dimensions_select ON public.org_benchmark_dimensions FOR SELECT
  USING (public.is_org_member(org_id));
CREATE POLICY org_benchmark_dimensions_insert ON public.org_benchmark_dimensions FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY org_benchmark_dimensions_update ON public.org_benchmark_dimensions FOR UPDATE
  USING (auth.role() = 'service_role');

ALTER TABLE public.benchmark_result_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY benchmark_result_logs_select ON public.benchmark_result_logs FOR SELECT
  USING (public.is_org_member(org_id));
CREATE POLICY benchmark_result_logs_insert ON public.benchmark_result_logs FOR INSERT
  WITH CHECK (public.is_org_member(org_id));
