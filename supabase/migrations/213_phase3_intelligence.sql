-- Phase 3 — Prioritization + intelligence (single confidence_score; confidence_band derived in app)

ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS priority_band text NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS noise_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recurrence_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_recurred_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS intelligence_summary text NULL,
  ADD COLUMN IF NOT EXISTS priority_reason jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS related_issue_group_id uuid NULL,
  ADD COLUMN IF NOT EXISTS suppressed_until timestamptz NULL,
  ADD COLUMN IF NOT EXISTS suppression_reason text NULL;

-- confidence_score: canonical 0–100 (may already exist from Phase 0; ensure not null default)
UPDATE public.issues SET confidence_score = 50 WHERE confidence_score IS NULL;
ALTER TABLE public.issues
  ALTER COLUMN confidence_score SET DEFAULT 50;
ALTER TABLE public.issues
  ALTER COLUMN confidence_score SET NOT NULL;

-- priority_score from Phase 0 may exist
UPDATE public.issues SET priority_score = 0 WHERE priority_score IS NULL;
ALTER TABLE public.issues
  ALTER COLUMN priority_score SET DEFAULT 0;
ALTER TABLE public.issues
  ALTER COLUMN priority_score SET NOT NULL;

COMMENT ON COLUMN public.issues.priority_band IS 'Phase 3 — derived from priority_score bands; stored for query convenience.';
COMMENT ON COLUMN public.issues.confidence_score IS 'Phase 3 — canonical 0–100; confidence_band derived in app only.';

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.issue_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  priority_score integer NOT NULL,
  priority_band text NOT NULL,
  confidence_score integer NOT NULL,
  noise_score integer NOT NULL,
  score_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  score_reason jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_score_history_issue_created
  ON public.issue_score_history(issue_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_issue_score_history_org ON public.issue_score_history(org_id, created_at DESC);

ALTER TABLE public.issue_score_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS issue_score_history_select ON public.issue_score_history;
CREATE POLICY issue_score_history_select ON public.issue_score_history
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS issue_score_history_service ON public.issue_score_history;
CREATE POLICY issue_score_history_service ON public.issue_score_history
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.issue_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  group_key text NOT NULL,
  title text NOT NULL,
  description text NULL,
  primary_issue_id uuid NULL REFERENCES public.issues(id) ON DELETE SET NULL,
  issue_count integer NOT NULL DEFAULT 0,
  total_revenue_impact_cents bigint NOT NULL DEFAULT 0,
  highest_priority_score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'resolved', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, group_key)
);

CREATE INDEX IF NOT EXISTS idx_issue_groups_org ON public.issue_groups(org_id);

ALTER TABLE public.issue_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS issue_groups_select ON public.issue_groups;
CREATE POLICY issue_groups_select ON public.issue_groups
  FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS issue_groups_service ON public.issue_groups;
CREATE POLICY issue_groups_service ON public.issue_groups
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

DO $$
BEGIN
  ALTER TABLE public.issues
    ADD CONSTRAINT fk_issues_related_issue_group
    FOREIGN KEY (related_issue_group_id) REFERENCES public.issue_groups(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
