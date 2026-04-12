-- Phase 3 — Adoption & Executive Value: org state, membership dept, invites, executive prefs, usage interactions

-- 1) org_onboarding_states — Phase 3 + expansion baselines
ALTER TABLE public.org_onboarding_states
  ADD COLUMN IF NOT EXISTS phase3_status text,
  ADD COLUMN IF NOT EXISTS phase3_current_step text,
  ADD COLUMN IF NOT EXISTS phase3_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS phase3_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS expanded_integration_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS active_department_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS executive_engagement_at timestamptz,
  ADD COLUMN IF NOT EXISTS executive_engaged_user_id uuid,
  ADD COLUMN IF NOT EXISTS first_value_story_id uuid REFERENCES public.value_stories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS phase3_active_weeks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phase3_usage_interaction_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phase3_baseline_connected_integrations integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS phase3_baseline_enabled_workflows integer NOT NULL DEFAULT 0;

-- 2) organization_members — department / title for multi-team + executive heuristics
ALTER TABLE public.organization_members
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS title text;

-- 3) org_invites — optional department before acceptance
ALTER TABLE public.org_invites
  ADD COLUMN IF NOT EXISTS department text;

-- 4) Executive summary preferences (one row per org)
CREATE TABLE IF NOT EXISTS public.org_executive_summary_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true,
  delivery_channel text NOT NULL,
  destination text NOT NULL,
  schedule_day text NOT NULL,
  schedule_time text NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS org_executive_summary_preferences_org_id_unique
  ON public.org_executive_summary_preferences(org_id);

CREATE INDEX IF NOT EXISTS idx_org_executive_summary_preferences_org ON public.org_executive_summary_preferences(org_id);

DROP TRIGGER IF EXISTS trg_org_executive_summary_preferences_updated_at ON public.org_executive_summary_preferences;
CREATE TRIGGER trg_org_executive_summary_preferences_updated_at
  BEFORE UPDATE ON public.org_executive_summary_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.org_executive_summary_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_executive_summary_preferences_rw ON public.org_executive_summary_preferences;
CREATE POLICY org_executive_summary_preferences_rw ON public.org_executive_summary_preferences
  FOR ALL USING (public.is_org_member(org_id))
  WITH CHECK (public.is_org_member(org_id));

-- 5) Qualifying usage interactions (habit + department attribution; server-inserted)
CREATE TABLE IF NOT EXISTS public.org_phase3_usage_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interaction_type text NOT NULL,
  ref_type text,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_phase3_usage_interactions_org_created
  ON public.org_phase3_usage_interactions(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_phase3_usage_interactions_user
  ON public.org_phase3_usage_interactions(org_id, user_id, created_at DESC);

ALTER TABLE public.org_phase3_usage_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_phase3_usage_interactions_select ON public.org_phase3_usage_interactions;
CREATE POLICY org_phase3_usage_interactions_select ON public.org_phase3_usage_interactions
  FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS org_phase3_usage_interactions_insert ON public.org_phase3_usage_interactions;
CREATE POLICY org_phase3_usage_interactions_insert ON public.org_phase3_usage_interactions
  FOR INSERT WITH CHECK (public.is_org_member(org_id) AND user_id = auth.uid());

-- 6) Backfill: Phase 2 complete orgs start Phase 3 as NOT_STARTED when unset
UPDATE public.org_onboarding_states o
SET phase3_status = 'NOT_STARTED'
WHERE o.phase2_status = 'COMPLETED'
  AND o.phase3_status IS NULL;
