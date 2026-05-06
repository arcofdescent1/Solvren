-- Phase 4 — Verification + ROI (extend verification_status enum; events tables)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'verification_status' AND e.enumlabel = 'inconclusive'
  ) THEN
    ALTER TYPE public.verification_status ADD VALUE 'inconclusive';
  END IF;
END $$;

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS baseline_value numeric NULL,
  ADD COLUMN IF NOT EXISTS post_fix_value numeric NULL,
  ADD COLUMN IF NOT EXISTS actual_roi_cents bigint NULL,
  ADD COLUMN IF NOT EXISTS roi_confidence text NOT NULL DEFAULT 'medium'
    CHECK (roi_confidence IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS regression_detected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS regression_count integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.issues.baseline_value IS 'Phase 4 — primary metric snapshot at resolve (e.g. failed payment count).';
COMMENT ON COLUMN public.issues.post_fix_value IS 'Phase 4 — measured metric after verification window.';
COMMENT ON COLUMN public.issues.actual_roi_cents IS 'Phase 4 — latest roi_events.actual_value_cents mirror.';
COMMENT ON COLUMN public.issues.roi_confidence IS 'Phase 4 — confidence for recorded ROI.';

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.issue_verification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,

  verification_type text NOT NULL,
  result text NOT NULL CHECK (result IN ('passed', 'failed', 'inconclusive')),

  baseline_value numeric,
  measured_value numeric,

  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_verification_events_org_created
  ON public.issue_verification_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_issue_verification_events_issue
  ON public.issue_verification_events(issue_id, created_at DESC);

ALTER TABLE public.issue_verification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS issue_verification_events_select ON public.issue_verification_events;
CREATE POLICY issue_verification_events_select ON public.issue_verification_events
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS issue_verification_events_service ON public.issue_verification_events;
CREATE POLICY issue_verification_events_service ON public.issue_verification_events
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roi_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,

  roi_type text NOT NULL CHECK (roi_type IN ('recovered_revenue', 'prevented_loss', 'efficiency_gain')),

  estimated_value_cents bigint NOT NULL,
  actual_value_cents bigint NULL,

  confidence text NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),

  explanation text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_roi_events_org_created ON public.roi_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_roi_events_issue_created ON public.roi_events(issue_id, created_at DESC);

ALTER TABLE public.roi_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roi_events_select ON public.roi_events;
CREATE POLICY roi_events_select ON public.roi_events
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS roi_events_service ON public.roi_events;
CREATE POLICY roi_events_service ON public.roi_events
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_verification_runner
  ON public.issues (verification_status, status, resolved_at)
  WHERE status = 'resolved' AND verification_status = 'pending';
