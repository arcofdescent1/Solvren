-- Phase 1 Gap 1 — Detector → Issue Linkage + Evidence Graph Completion

-- 4.1 Alter issues: add detector/explainability fields
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS detector_key text;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS issue_type text;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS issue_subtype text;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS issue_confidence numeric(5,2);
-- status already exists as issue_status enum
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS primary_entity_id uuid REFERENCES public.canonical_entities(id) ON DELETE SET NULL;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS primary_entity_type text;
-- summary, description, opened_at, closed_at - summary/description exist; opened_at exists; closed_at via resolved_at/dismissed_at

-- 4.2 issue_entities: add role and confidence for linkage spec
ALTER TABLE public.issue_entities ADD COLUMN IF NOT EXISTS role text;
ALTER TABLE public.issue_entities ADD COLUMN IF NOT EXISTS confidence numeric(5,2) NOT NULL DEFAULT 1.0;
ALTER TABLE public.issue_entities ALTER COLUMN external_system DROP NOT NULL;
ALTER TABLE public.issue_entities ALTER COLUMN external_id DROP NOT NULL;

-- 4.3 issue_signal_links
CREATE TABLE IF NOT EXISTS public.issue_signal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  signal_id uuid NOT NULL REFERENCES public.normalized_signals(id) ON DELETE CASCADE,
  relevance_score numeric(5,2) NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_signal_links_issue ON public.issue_signal_links(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_signal_links_signal ON public.issue_signal_links(signal_id);

-- 4.4 issue_evidence
CREATE TABLE IF NOT EXISTS public.issue_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  evidence_type text NOT NULL,
  evidence_key text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}',
  confidence numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT issue_evidence_payload_size CHECK (octet_length(payload_json::text) <= 262144)
);

CREATE INDEX IF NOT EXISTS idx_issue_evidence_issue ON public.issue_evidence(issue_id);

-- 4.5 issue_lineage
CREATE TABLE IF NOT EXISTS public.issue_lineage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  source_type text NOT NULL,
  source_ref text NOT NULL,
  metadata_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_issue_lineage_issue ON public.issue_lineage(issue_id);

-- RLS
ALTER TABLE public.issue_signal_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_lineage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS issue_signal_links_select ON public.issue_signal_links;
CREATE POLICY issue_signal_links_select ON public.issue_signal_links FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_signal_links.issue_id AND public.is_org_member(i.org_id)));

DROP POLICY IF EXISTS issue_signal_links_insert ON public.issue_signal_links;
CREATE POLICY issue_signal_links_insert ON public.issue_signal_links FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_signal_links.issue_id AND public.is_org_member(i.org_id)));

DROP POLICY IF EXISTS issue_evidence_select ON public.issue_evidence;
CREATE POLICY issue_evidence_select ON public.issue_evidence FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_evidence.issue_id AND public.is_org_member(i.org_id)));

DROP POLICY IF EXISTS issue_evidence_insert ON public.issue_evidence;
CREATE POLICY issue_evidence_insert ON public.issue_evidence FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_evidence.issue_id AND public.is_org_member(i.org_id)));

DROP POLICY IF EXISTS issue_lineage_select ON public.issue_lineage;
CREATE POLICY issue_lineage_select ON public.issue_lineage FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_lineage.issue_id AND public.is_org_member(i.org_id)));

DROP POLICY IF EXISTS issue_lineage_insert ON public.issue_lineage;
CREATE POLICY issue_lineage_insert ON public.issue_lineage FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.issues i WHERE i.id = issue_lineage.issue_id AND public.is_org_member(i.org_id)));
