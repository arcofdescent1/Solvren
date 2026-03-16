-- Checklist-style evidence items (from AI suggestions) with REQUIRED/PROVIDED/WAIVED status
CREATE TABLE IF NOT EXISTS public.change_evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_event_id uuid NOT NULL REFERENCES change_events(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind text NOT NULL,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'REQUIRED' CHECK (status IN ('REQUIRED', 'PROVIDED', 'WAIVED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_change_evidence_items_event ON change_evidence_items(change_event_id);

ALTER TABLE public.change_evidence_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS change_evidence_items_select ON public.change_evidence_items;
CREATE POLICY change_evidence_items_select ON public.change_evidence_items
FOR SELECT USING (
  exists (
    select 1 from change_events ce
    where ce.id = change_event_id and is_org_member(ce.org_id)
  )
);

DROP POLICY IF EXISTS change_evidence_items_insert ON public.change_evidence_items;
CREATE POLICY change_evidence_items_insert ON public.change_evidence_items
FOR INSERT WITH CHECK (is_org_member(org_id));

DROP POLICY IF EXISTS change_evidence_items_update ON public.change_evidence_items;
CREATE POLICY change_evidence_items_update ON public.change_evidence_items
FOR UPDATE USING (
  exists (
    select 1 from change_events ce
    where ce.id = change_event_id and is_org_member(ce.org_id)
  )
);
