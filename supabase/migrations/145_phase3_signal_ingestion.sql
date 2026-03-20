-- Phase 3 — Signal Ingestion and Event Normalization (§9).
-- raw_events, signal_definitions, normalized_signals, signal_entity_links, etc.

-- Evolve legacy signal_definitions (043: signal_key PK) to Phase 3 schema (id PK, canonical_entity_type, etc.)
DO $evolve$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'signal_definitions' AND column_name = 'signal_key')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'signal_definitions' AND column_name = 'id') THEN
    ALTER TABLE public.signal_definitions ADD COLUMN id uuid DEFAULT gen_random_uuid();
    UPDATE public.signal_definitions SET id = gen_random_uuid() WHERE id IS NULL;
    ALTER TABLE public.signal_definitions ALTER COLUMN id SET NOT NULL;
    ALTER TABLE public.signal_definitions DROP CONSTRAINT IF EXISTS signal_definitions_pkey;
    ALTER TABLE public.signal_definitions ADD PRIMARY KEY (id);
    CREATE UNIQUE INDEX IF NOT EXISTS signal_definitions_signal_key_key ON public.signal_definitions(signal_key);
    ALTER TABLE public.signal_definitions ADD COLUMN IF NOT EXISTS display_name text;
    UPDATE public.signal_definitions SET display_name = signal_key WHERE display_name IS NULL;
    ALTER TABLE public.signal_definitions ALTER COLUMN display_name SET NOT NULL;
    ALTER TABLE public.signal_definitions ADD COLUMN IF NOT EXISTS business_meaning text;
    ALTER TABLE public.signal_definitions ADD COLUMN IF NOT EXISTS source_providers text[] NOT NULL DEFAULT '{}';
    ALTER TABLE public.signal_definitions ADD COLUMN IF NOT EXISTS canonical_entity_type text;
    UPDATE public.signal_definitions SET canonical_entity_type = 'legacy' WHERE canonical_entity_type IS NULL;
    ALTER TABLE public.signal_definitions ALTER COLUMN canonical_entity_type SET NOT NULL;
    ALTER TABLE public.signal_definitions ADD COLUMN IF NOT EXISTS secondary_entity_types text[] NOT NULL DEFAULT '{}';
    ALTER TABLE public.signal_definitions ADD COLUMN IF NOT EXISTS schema_version int NOT NULL DEFAULT 1;
    ALTER TABLE public.signal_definitions ADD COLUMN IF NOT EXISTS required_dimensions text[] NOT NULL DEFAULT '{}';
    ALTER TABLE public.signal_definitions ADD COLUMN IF NOT EXISTS optional_dimensions text[] NOT NULL DEFAULT '{}';
    ALTER TABLE public.signal_definitions ADD COLUMN IF NOT EXISTS required_measures text[] NOT NULL DEFAULT '{}';
    ALTER TABLE public.signal_definitions ADD COLUMN IF NOT EXISTS optional_measures text[] NOT NULL DEFAULT '{}';
    ALTER TABLE public.signal_definitions ADD COLUMN IF NOT EXISTS required_references text[] NOT NULL DEFAULT '{}';
    ALTER TABLE public.signal_definitions ADD COLUMN IF NOT EXISTS timestamp_fields text[] NOT NULL DEFAULT '{}';
    ALTER TABLE public.signal_definitions ADD COLUMN IF NOT EXISTS idempotency_strategy text NOT NULL DEFAULT 'provider_object_time';
    ALTER TABLE public.signal_definitions ADD COLUMN IF NOT EXISTS quality_rules jsonb NOT NULL DEFAULT '{}';
    ALTER TABLE public.signal_definitions ADD COLUMN IF NOT EXISTS sample_payload jsonb;
    ALTER TABLE public.signal_definitions ADD COLUMN IF NOT EXISTS detector_dependencies text[] NOT NULL DEFAULT '{}';
    -- Legacy columns value_type, base_weight, domain: relax so Phase 3 seeds can omit them
    ALTER TABLE public.signal_definitions ALTER COLUMN value_type DROP NOT NULL;
    ALTER TABLE public.signal_definitions ALTER COLUMN value_type SET DEFAULT 'BOOLEAN';
    ALTER TABLE public.signal_definitions ALTER COLUMN base_weight DROP NOT NULL;
    ALTER TABLE public.signal_definitions ALTER COLUMN base_weight SET DEFAULT 0;
    ALTER TABLE public.signal_definitions ALTER COLUMN domain DROP NOT NULL;
  END IF;
END $evolve$;

-- 9.1 raw_events
CREATE TABLE IF NOT EXISTS public.raw_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  integration_account_id uuid REFERENCES public.integration_accounts(id) ON DELETE SET NULL,
  provider text NOT NULL,
  source_channel text NOT NULL,
  external_event_id text,
  external_object_type text,
  external_object_id text,
  event_type text NOT NULL,
  event_time timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  payload_json jsonb NOT NULL,
  headers_json jsonb,
  payload_hash text NOT NULL,
  idempotency_key text NOT NULL,
  processing_status text NOT NULL DEFAULT 'pending',
  processing_attempts int NOT NULL DEFAULT 0,
  last_error_code text,
  last_error_message text,
  mapper_key text,
  mapper_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_raw_events_org_provider_received
  ON public.raw_events(org_id, provider, received_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_raw_events_idempotency
  ON public.raw_events(org_id, provider, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_raw_events_processing
  ON public.raw_events(processing_status, received_at);
CREATE INDEX IF NOT EXISTS idx_raw_events_external_object
  ON public.raw_events(external_object_type, external_object_id) WHERE external_object_id IS NOT NULL;

-- 9.2 signal_definitions
CREATE TABLE IF NOT EXISTS public.signal_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  category text NOT NULL,
  description text,
  business_meaning text,
  source_providers text[] NOT NULL DEFAULT '{}',
  canonical_entity_type text NOT NULL,
  secondary_entity_types text[] NOT NULL DEFAULT '{}',
  schema_version int NOT NULL DEFAULT 1,
  required_dimensions text[] NOT NULL DEFAULT '{}',
  optional_dimensions text[] NOT NULL DEFAULT '{}',
  required_measures text[] NOT NULL DEFAULT '{}',
  optional_measures text[] NOT NULL DEFAULT '{}',
  required_references text[] NOT NULL DEFAULT '{}',
  timestamp_fields text[] NOT NULL DEFAULT '{}',
  idempotency_strategy text NOT NULL DEFAULT 'provider_object_time',
  quality_rules jsonb NOT NULL DEFAULT '{}',
  sample_payload jsonb,
  detector_dependencies text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signal_definitions_category ON public.signal_definitions(category);
CREATE INDEX IF NOT EXISTS idx_signal_definitions_entity_type ON public.signal_definitions(canonical_entity_type);

-- 9.3 normalized_signals
CREATE TABLE IF NOT EXISTS public.normalized_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  raw_event_id uuid NOT NULL REFERENCES public.raw_events(id) ON DELETE CASCADE,
  signal_definition_id uuid NOT NULL REFERENCES public.signal_definitions(id) ON DELETE RESTRICT,
  signal_key text NOT NULL,
  schema_version int NOT NULL,
  provider text NOT NULL,
  integration_account_id uuid REFERENCES public.integration_accounts(id) ON DELETE SET NULL,
  source_ref text,
  primary_canonical_entity_id uuid REFERENCES public.canonical_entities(id) ON DELETE SET NULL,
  signal_time timestamptz NOT NULL,
  dimensions_json jsonb NOT NULL DEFAULT '{}',
  measures_json jsonb NOT NULL DEFAULT '{}',
  references_json jsonb NOT NULL DEFAULT '{}',
  quality_score numeric(5,2) NOT NULL DEFAULT 0,
  quality_flags_json jsonb NOT NULL DEFAULT '[]',
  mapper_key text NOT NULL,
  mapper_version text NOT NULL,
  processing_lineage_json jsonb NOT NULL DEFAULT '{}',
  idempotency_key text,
  processing_run_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_normalized_signals_org_signal_time
  ON public.normalized_signals(org_id, signal_key, signal_time DESC);
CREATE INDEX IF NOT EXISTS idx_normalized_signals_org_provider
  ON public.normalized_signals(org_id, provider);
CREATE INDEX IF NOT EXISTS idx_normalized_signals_primary_entity
  ON public.normalized_signals(primary_canonical_entity_id) WHERE primary_canonical_entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_normalized_signals_raw_event
  ON public.normalized_signals(raw_event_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_normalized_signals_idempotency
  ON public.normalized_signals(org_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- 9.4 signal_entity_links
CREATE TABLE IF NOT EXISTS public.signal_entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  normalized_signal_id uuid NOT NULL REFERENCES public.normalized_signals(id) ON DELETE CASCADE,
  canonical_entity_id uuid NOT NULL REFERENCES public.canonical_entities(id) ON DELETE CASCADE,
  link_role text NOT NULL DEFAULT 'primary',
  confidence_score numeric(5,4) NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(normalized_signal_id, canonical_entity_id, link_role)
);

CREATE INDEX IF NOT EXISTS idx_signal_entity_links_signal ON public.signal_entity_links(normalized_signal_id);
CREATE INDEX IF NOT EXISTS idx_signal_entity_links_entity ON public.signal_entity_links(canonical_entity_id);

-- 9.5 signal_processing_runs
CREATE TABLE IF NOT EXISTS public.signal_processing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  run_type text NOT NULL,
  trigger_source text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  raw_events_processed int NOT NULL DEFAULT 0,
  signals_produced int NOT NULL DEFAULT 0,
  errors_count int NOT NULL DEFAULT 0,
  dead_letter_count int NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  metadata_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signal_processing_runs_org ON public.signal_processing_runs(org_id);
CREATE INDEX IF NOT EXISTS idx_signal_processing_runs_started ON public.signal_processing_runs(started_at DESC);

-- 9.6 dead_letter_events
CREATE TABLE IF NOT EXISTS public.dead_letter_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  raw_event_id uuid NOT NULL REFERENCES public.raw_events(id) ON DELETE CASCADE,
  failure_code text NOT NULL,
  failure_message text,
  retry_count int NOT NULL DEFAULT 0,
  last_retry_at timestamptz,
  status text NOT NULL DEFAULT 'pending',
  resolution text,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dead_letter_events_org_status ON public.dead_letter_events(org_id, status);
CREATE INDEX IF NOT EXISTS idx_dead_letter_events_raw_event ON public.dead_letter_events(raw_event_id);

-- 9.7 signal_replay_requests
CREATE TABLE IF NOT EXISTS public.signal_replay_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id),
  provider text,
  signal_key text,
  time_from timestamptz,
  time_to timestamptz,
  status text NOT NULL DEFAULT 'pending',
  raw_events_matched int,
  signals_produced int,
  errors_count int,
  processing_run_id uuid REFERENCES public.signal_processing_runs(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_signal_replay_requests_org ON public.signal_replay_requests(org_id);

-- RLS
ALTER TABLE public.raw_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.normalized_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_entity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_processing_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dead_letter_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_replay_requests ENABLE ROW LEVEL SECURITY;

-- signal_definitions: readable by all org members (seeded platform data)
DROP POLICY IF EXISTS signal_definitions_select ON public.signal_definitions;
CREATE POLICY signal_definitions_select ON public.signal_definitions FOR SELECT USING (true);

-- raw_events, normalized_signals, etc: org-scoped
DROP POLICY IF EXISTS raw_events_select ON public.raw_events;
CREATE POLICY raw_events_select ON public.raw_events FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS raw_events_insert ON public.raw_events;
CREATE POLICY raw_events_insert ON public.raw_events FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS raw_events_update ON public.raw_events;
CREATE POLICY raw_events_update ON public.raw_events FOR UPDATE USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS normalized_signals_select ON public.normalized_signals;
CREATE POLICY normalized_signals_select ON public.normalized_signals FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS signal_entity_links_select ON public.signal_entity_links;
CREATE POLICY signal_entity_links_select ON public.signal_entity_links FOR SELECT USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS signal_processing_runs_select ON public.signal_processing_runs;
CREATE POLICY signal_processing_runs_select ON public.signal_processing_runs FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS signal_processing_runs_insert ON public.signal_processing_runs;
CREATE POLICY signal_processing_runs_insert ON public.signal_processing_runs FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS signal_processing_runs_update ON public.signal_processing_runs;
CREATE POLICY signal_processing_runs_update ON public.signal_processing_runs FOR UPDATE USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS dead_letter_events_select ON public.dead_letter_events;
CREATE POLICY dead_letter_events_select ON public.dead_letter_events FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS dead_letter_events_insert ON public.dead_letter_events;
CREATE POLICY dead_letter_events_insert ON public.dead_letter_events FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS dead_letter_events_update ON public.dead_letter_events;
CREATE POLICY dead_letter_events_update ON public.dead_letter_events FOR UPDATE USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS signal_replay_requests_select ON public.signal_replay_requests;
CREATE POLICY signal_replay_requests_select ON public.signal_replay_requests FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS signal_replay_requests_insert ON public.signal_replay_requests;
CREATE POLICY signal_replay_requests_insert ON public.signal_replay_requests FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS signal_replay_requests_update ON public.signal_replay_requests;
CREATE POLICY signal_replay_requests_update ON public.signal_replay_requests FOR UPDATE USING (public.is_org_member(org_id));
