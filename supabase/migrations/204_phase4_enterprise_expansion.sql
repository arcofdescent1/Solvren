-- Phase 4 — Enterprise Expansion & Renewal Readiness

-- 1) org_onboarding_states — Phase 4 denormalized milestones + baseline BU count
ALTER TABLE public.org_onboarding_states
  ADD COLUMN IF NOT EXISTS phase4_status text,
  ADD COLUMN IF NOT EXISTS phase4_current_step text,
  ADD COLUMN IF NOT EXISTS phase4_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS phase4_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS phase4_expanded_unit_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phase4_connected_integrations integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phase4_enabled_workflows integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phase4_consecutive_executive_weeks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phase4_system_of_record_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phase4_renewal_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phase4_expansion_recommendation_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phase4_baseline_business_unit_count integer NOT NULL DEFAULT 0;

-- 2) Business units (org-scoped)
CREATE TABLE IF NOT EXISTS public.org_business_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_business_units_type_check CHECK (
    type IN ('BUSINESS_UNIT', 'REGION', 'SUBSIDIARY', 'DIVISION')
  )
);

CREATE INDEX IF NOT EXISTS idx_org_business_units_org ON public.org_business_units(org_id, created_at DESC);

ALTER TABLE public.org_business_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_business_units_select ON public.org_business_units;
CREATE POLICY org_business_units_select ON public.org_business_units
  FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS org_business_units_insert ON public.org_business_units;
CREATE POLICY org_business_units_insert ON public.org_business_units
  FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS org_business_units_update ON public.org_business_units;
CREATE POLICY org_business_units_update ON public.org_business_units
  FOR UPDATE USING (public.is_org_member(org_id)) WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS org_business_units_delete ON public.org_business_units;
CREATE POLICY org_business_units_delete ON public.org_business_units
  FOR DELETE USING (public.is_org_member(org_id));

-- 3) organization_members — optional BU assignment (SET NULL when BU deleted)
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS business_unit_id uuid NULL;

ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS organization_members_business_unit_id_fkey;

ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_business_unit_id_fkey
  FOREIGN KEY (business_unit_id)
  REFERENCES public.org_business_units(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_organization_members_business_unit
  ON public.organization_members(org_id, business_unit_id)
  WHERE business_unit_id IS NOT NULL;

-- 4) QBR / executive report metadata (wrapper around generated_reports)
CREATE TABLE IF NOT EXISTS public.org_qbr_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_type text NOT NULL CHECK (
    report_type IN (
      'WEEKLY_EXECUTIVE_SUMMARY',
      'MONTHLY_BUSINESS_REVIEW',
      'QUARTERLY_BUSINESS_REVIEW'
    )
  ),
  period_start date NOT NULL,
  period_end date NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  storage_url text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_report_id uuid NULL REFERENCES public.generated_reports(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_org_qbr_reports_org_created
  ON public.org_qbr_reports(org_id, generated_at DESC);

ALTER TABLE public.org_qbr_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_qbr_reports_select ON public.org_qbr_reports;
CREATE POLICY org_qbr_reports_select ON public.org_qbr_reports
  FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS org_qbr_reports_insert ON public.org_qbr_reports;
DROP POLICY IF EXISTS org_qbr_reports_update ON public.org_qbr_reports;
DROP POLICY IF EXISTS org_qbr_reports_delete ON public.org_qbr_reports;
DROP POLICY IF EXISTS org_qbr_reports_service ON public.org_qbr_reports;
CREATE POLICY org_qbr_reports_service ON public.org_qbr_reports
  FOR ALL USING (auth.role () = 'service_role')
  WITH CHECK (auth.role () = 'service_role');

-- 5) Adoption / system-of-record signals
CREATE TABLE IF NOT EXISTS public.org_adoption_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  signal_type text NOT NULL CHECK (
    signal_type IN (
      'PRIMARY_DASHBOARD_SET',
      'QBR_REFERENCED',
      'CS_CONFIRMED_SYSTEM_OF_RECORD'
    )
  ),
  signal_value text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_adoption_signals_org_type
  ON public.org_adoption_signals(org_id, signal_type, created_at DESC);

ALTER TABLE public.org_adoption_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_adoption_signals_select ON public.org_adoption_signals;
CREATE POLICY org_adoption_signals_select ON public.org_adoption_signals
  FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS org_adoption_signals_insert ON public.org_adoption_signals;
DROP POLICY IF EXISTS org_adoption_signals_delete ON public.org_adoption_signals;
DROP POLICY IF EXISTS org_adoption_signals_service ON public.org_adoption_signals;
CREATE POLICY org_adoption_signals_service ON public.org_adoption_signals
  FOR ALL USING (auth.role () = 'service_role')
  WITH CHECK (auth.role () = 'service_role');

-- 6) Organization settings — primary dashboard + explicit “primary source” for reporting
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS primary_dashboard text NULL,
  ADD COLUMN IF NOT EXISTS executive_reporting_primary_source boolean NOT NULL DEFAULT false;

-- 7) generated_reports — optional flag for QBR primary-source narrative
ALTER TABLE public.generated_reports
  ADD COLUMN IF NOT EXISTS is_primary_source boolean NOT NULL DEFAULT false;

-- 8) Backfill Phase 4 status for Phase-3-complete orgs
UPDATE public.org_onboarding_states o
SET phase4_status = 'NOT_STARTED'
WHERE o.phase3_status = 'COMPLETED'
  AND o.phase4_status IS NULL;
