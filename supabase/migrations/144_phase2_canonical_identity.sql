-- Phase 2 — Canonical Data Model and Identity Graph (§8).
-- All tables org-scoped; RLS via organization_members.

-- 8.1 canonical_entities
CREATE TABLE IF NOT EXISTS public.canonical_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  display_name text,
  canonical_key text,
  preferred_attributes_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'active',
  merge_parent_id uuid REFERENCES public.canonical_entities(id) ON DELETE SET NULL,
  created_by_type text NOT NULL DEFAULT 'system',
  created_by_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_canonical_entities_org_type ON public.canonical_entities(org_id, entity_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_canonical_entities_org_type_key
  ON public.canonical_entities(org_id, entity_type, canonical_key) WHERE canonical_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_canonical_entities_org_status ON public.canonical_entities(org_id, status);

-- 8.2 entity_links
CREATE TABLE IF NOT EXISTS public.entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  canonical_entity_id uuid NOT NULL REFERENCES public.canonical_entities(id) ON DELETE CASCADE,
  provider text NOT NULL,
  integration_account_id uuid REFERENCES public.integration_accounts(id) ON DELETE SET NULL,
  external_object_type text NOT NULL,
  external_id text NOT NULL,
  external_key text,
  link_status text NOT NULL DEFAULT 'linked',
  confidence_score numeric(5,4) NOT NULL,
  match_strategy text NOT NULL,
  match_reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  linked_by_type text NOT NULL DEFAULT 'system',
  linked_by_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  unlinked_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_links_org_provider_type_external
  ON public.entity_links(org_id, provider, external_object_type, external_id) WHERE link_status = 'linked';
CREATE INDEX IF NOT EXISTS idx_entity_links_canonical_entity ON public.entity_links(canonical_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_org_provider_type ON public.entity_links(org_id, provider, external_object_type);
CREATE INDEX IF NOT EXISTS idx_entity_links_org_confidence ON public.entity_links(org_id, confidence_score);

-- 8.3 canonical_relationships
CREATE TABLE IF NOT EXISTS public.canonical_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_entity_id uuid NOT NULL REFERENCES public.canonical_entities(id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  to_entity_id uuid NOT NULL REFERENCES public.canonical_entities(id) ON DELETE CASCADE,
  directionality text NOT NULL DEFAULT 'directed',
  confidence_score numeric(5,4) NOT NULL DEFAULT 1.0000,
  source_type text NOT NULL,
  source_ref text,
  relationship_attributes_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_canonical_relationships_org_from ON public.canonical_relationships(org_id, from_entity_id);
CREATE INDEX IF NOT EXISTS idx_canonical_relationships_org_to ON public.canonical_relationships(org_id, to_entity_id);
CREATE INDEX IF NOT EXISTS idx_canonical_relationships_org_type ON public.canonical_relationships(org_id, relationship_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_canonical_relationships_unique_active
  ON public.canonical_relationships(org_id, from_entity_id, relationship_type, to_entity_id) WHERE ended_at IS NULL;

-- 8.4 entity_match_candidates
CREATE TABLE IF NOT EXISTS public.entity_match_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  candidate_type text NOT NULL,
  primary_provider text NOT NULL,
  primary_object_type text NOT NULL,
  primary_external_id text NOT NULL,
  proposed_entity_type text NOT NULL,
  proposed_canonical_entity_id uuid REFERENCES public.canonical_entities(id) ON DELETE SET NULL,
  confidence_score numeric(5,4) NOT NULL,
  score_breakdown_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  reasons_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  review_status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_entity_match_candidates_org_review ON public.entity_match_candidates(org_id, review_status);
CREATE INDEX IF NOT EXISTS idx_entity_match_candidates_org_confidence ON public.entity_match_candidates(org_id, confidence_score);
CREATE INDEX IF NOT EXISTS idx_entity_match_candidates_org_entity_type ON public.entity_match_candidates(org_id, proposed_entity_type);

-- 8.5 entity_attribute_values
CREATE TABLE IF NOT EXISTS public.entity_attribute_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  canonical_entity_id uuid NOT NULL REFERENCES public.canonical_entities(id) ON DELETE CASCADE,
  attribute_key text NOT NULL,
  attribute_value_json jsonb NOT NULL,
  provider text NOT NULL,
  external_object_type text NOT NULL,
  external_id text NOT NULL,
  is_preferred boolean NOT NULL DEFAULT false,
  precedence_rank integer NOT NULL,
  confidence_score numeric(5,4) NOT NULL DEFAULT 1.0000,
  observed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_attribute_values_entity_key ON public.entity_attribute_values(canonical_entity_id, attribute_key);
CREATE INDEX IF NOT EXISTS idx_entity_attribute_values_org_preferred ON public.entity_attribute_values(org_id, attribute_key, is_preferred);

-- 8.6 entity_resolution_events
CREATE TABLE IF NOT EXISTS public.entity_resolution_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  canonical_entity_id uuid REFERENCES public.canonical_entities(id) ON DELETE SET NULL,
  related_entity_id uuid REFERENCES public.canonical_entities(id) ON DELETE SET NULL,
  link_id uuid REFERENCES public.entity_links(id) ON DELETE SET NULL,
  candidate_id uuid REFERENCES public.entity_match_candidates(id) ON DELETE SET NULL,
  actor_type text NOT NULL,
  actor_ref text,
  event_payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_resolution_events_org_type ON public.entity_resolution_events(org_id, event_type);
CREATE INDEX IF NOT EXISTS idx_entity_resolution_events_entity ON public.entity_resolution_events(canonical_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_resolution_events_created ON public.entity_resolution_events(created_at);

-- 8.7 entity_resolution_rules (optional)
CREATE TABLE IF NOT EXISTS public.entity_resolution_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  rule_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_resolution_rules_org_type ON public.entity_resolution_rules(org_id, entity_type);

-- RLS (reuse is_org_member from Phase 1 if present)
DO $outer$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'is_org_member') THEN
    CREATE OR REPLACE FUNCTION public.is_org_member(p_org_id uuid) RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
      AS $func$ SELECT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.org_id = p_org_id AND m.user_id = auth.uid()); $func$;
  END IF;
END $outer$;

ALTER TABLE public.canonical_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_match_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_attribute_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_resolution_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_resolution_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS canonical_entities_select ON public.canonical_entities;
CREATE POLICY canonical_entities_select ON public.canonical_entities FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS canonical_entities_insert ON public.canonical_entities;
CREATE POLICY canonical_entities_insert ON public.canonical_entities FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS canonical_entities_update ON public.canonical_entities;
CREATE POLICY canonical_entities_update ON public.canonical_entities FOR UPDATE USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS entity_links_select ON public.entity_links;
CREATE POLICY entity_links_select ON public.entity_links FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS entity_links_insert ON public.entity_links;
CREATE POLICY entity_links_insert ON public.entity_links FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS entity_links_update ON public.entity_links;
CREATE POLICY entity_links_update ON public.entity_links FOR UPDATE USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS canonical_relationships_select ON public.canonical_relationships;
CREATE POLICY canonical_relationships_select ON public.canonical_relationships FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS canonical_relationships_insert ON public.canonical_relationships;
CREATE POLICY canonical_relationships_insert ON public.canonical_relationships FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS canonical_relationships_update ON public.canonical_relationships;
CREATE POLICY canonical_relationships_update ON public.canonical_relationships FOR UPDATE USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS entity_match_candidates_select ON public.entity_match_candidates;
CREATE POLICY entity_match_candidates_select ON public.entity_match_candidates FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS entity_match_candidates_insert ON public.entity_match_candidates;
CREATE POLICY entity_match_candidates_insert ON public.entity_match_candidates FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS entity_match_candidates_update ON public.entity_match_candidates;
CREATE POLICY entity_match_candidates_update ON public.entity_match_candidates FOR UPDATE USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS entity_attribute_values_select ON public.entity_attribute_values;
CREATE POLICY entity_attribute_values_select ON public.entity_attribute_values FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS entity_attribute_values_insert ON public.entity_attribute_values;
CREATE POLICY entity_attribute_values_insert ON public.entity_attribute_values FOR INSERT WITH CHECK (public.is_org_member(org_id));

DROP POLICY IF EXISTS entity_resolution_events_select ON public.entity_resolution_events;
CREATE POLICY entity_resolution_events_select ON public.entity_resolution_events FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS entity_resolution_events_insert ON public.entity_resolution_events;
CREATE POLICY entity_resolution_events_insert ON public.entity_resolution_events FOR INSERT WITH CHECK (public.is_org_member(org_id));

DROP POLICY IF EXISTS entity_resolution_rules_select ON public.entity_resolution_rules;
CREATE POLICY entity_resolution_rules_select ON public.entity_resolution_rules FOR SELECT USING (public.is_org_member(org_id));
DROP POLICY IF EXISTS entity_resolution_rules_insert ON public.entity_resolution_rules;
CREATE POLICY entity_resolution_rules_insert ON public.entity_resolution_rules FOR INSERT WITH CHECK (public.is_org_member(org_id));
DROP POLICY IF EXISTS entity_resolution_rules_update ON public.entity_resolution_rules;
CREATE POLICY entity_resolution_rules_update ON public.entity_resolution_rules FOR UPDATE USING (public.is_org_member(org_id));
