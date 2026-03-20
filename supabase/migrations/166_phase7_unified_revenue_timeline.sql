-- Phase 7 — Unified Revenue Timeline (Hero View)

-- 8.1 revenue_timeline_events
CREATE TABLE IF NOT EXISTS public.revenue_timeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  issue_id uuid REFERENCES public.issues(id) ON DELETE SET NULL,
  finding_id uuid NULL,
  workflow_run_id uuid NULL,

  primary_entity_type text NULL,
  primary_entity_id uuid NULL,

  category text NOT NULL,
  event_type text NOT NULL,

  headline text NOT NULL,
  summary text NOT NULL,

  amount numeric(18,2) NULL,
  currency_code text NULL,
  value_type text NULL,

  actor_type text NOT NULL,
  actor_user_id uuid NULL,

  source_module text NOT NULL,
  source_ref_id text NULL,

  status text NULL,
  detail_payload_json jsonb NOT NULL DEFAULT '{}',
  display_priority integer NOT NULL DEFAULT 50,

  event_time timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revenue_timeline_issue_time
  ON public.revenue_timeline_events(issue_id, event_time ASC, created_at ASC)
  WHERE issue_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_revenue_timeline_org_time
  ON public.revenue_timeline_events(org_id, event_time DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_revenue_timeline_entity
  ON public.revenue_timeline_events(primary_entity_type, primary_entity_id, event_time DESC)
  WHERE primary_entity_type IS NOT NULL AND primary_entity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_revenue_timeline_type
  ON public.revenue_timeline_events(event_type, event_time DESC);

-- 8.2 revenue_timeline_aggregates
CREATE TABLE IF NOT EXISTS public.revenue_timeline_aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  aggregate_type text NOT NULL,
  aggregate_key text NOT NULL,

  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,

  event_count integer NOT NULL DEFAULT 0,
  recovered_amount numeric(18,2) NOT NULL DEFAULT 0,
  avoided_amount numeric(18,2) NOT NULL DEFAULT 0,
  savings_amount numeric(18,2) NOT NULL DEFAULT 0,
  loss_amount numeric(18,2) NOT NULL DEFAULT 0,

  metrics_json jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_revenue_timeline_aggregates_org_type_key
  ON public.revenue_timeline_aggregates(org_id, aggregate_type, aggregate_key);

-- 8.3 timeline_event_corrections
CREATE TABLE IF NOT EXISTS public.timeline_event_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  original_event_id uuid NOT NULL REFERENCES public.revenue_timeline_events(id) ON DELETE CASCADE,
  correction_event_id uuid NOT NULL REFERENCES public.revenue_timeline_events(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timeline_event_corrections_original
  ON public.timeline_event_corrections(original_event_id);

-- RLS
ALTER TABLE public.revenue_timeline_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY revenue_timeline_events_select ON public.revenue_timeline_events
  FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY revenue_timeline_events_insert ON public.revenue_timeline_events
  FOR INSERT WITH CHECK (public.is_org_member(org_id));
CREATE POLICY revenue_timeline_events_service ON public.revenue_timeline_events
  FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.revenue_timeline_aggregates ENABLE ROW LEVEL SECURITY;
CREATE POLICY revenue_timeline_aggregates_select ON public.revenue_timeline_aggregates
  FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY revenue_timeline_aggregates_service ON public.revenue_timeline_aggregates
  FOR ALL USING (auth.role() = 'service_role');

ALTER TABLE public.timeline_event_corrections ENABLE ROW LEVEL SECURITY;
CREATE POLICY timeline_event_corrections_select ON public.timeline_event_corrections
  FOR SELECT USING (public.is_org_member(org_id));
CREATE POLICY timeline_event_corrections_insert ON public.timeline_event_corrections
  FOR INSERT WITH CHECK (public.is_org_member(org_id));
