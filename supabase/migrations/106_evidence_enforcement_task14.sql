-- Task 14: Evidence enforcement - severity, provision fields, status semantics
-- severity: REQUIRED | RECOMMENDED (blocks approval vs warning)
-- status: MISSING | PROVIDED | WAIVED (current state)

ALTER TABLE public.change_evidence_items
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'REQUIRED'
    CHECK (severity IN ('REQUIRED', 'RECOMMENDED')),
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS url text,
  ADD COLUMN IF NOT EXISTS provided_at timestamptz,
  ADD COLUMN IF NOT EXISTS provided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Migrate status: REQUIRED -> MISSING, keep PROVIDED/WAIVED
ALTER TABLE public.change_evidence_items DROP CONSTRAINT IF EXISTS change_evidence_items_status_check;
UPDATE public.change_evidence_items SET status = 'MISSING' WHERE status = 'REQUIRED';
ALTER TABLE public.change_evidence_items
  ALTER COLUMN status SET DEFAULT 'MISSING';
ALTER TABLE public.change_evidence_items
  ADD CONSTRAINT change_evidence_items_status_check
  CHECK (status IN ('MISSING', 'PROVIDED', 'WAIVED'));

COMMENT ON COLUMN public.change_evidence_items.severity IS 'REQUIRED blocks approval; RECOMMENDED is advisory';
COMMENT ON COLUMN public.change_evidence_items.status IS 'MISSING=not satisfied, PROVIDED=satisfied, WAIVED=explicitly waived';
