-- Ensure domain_governance_templates has required_approval_areas (text[]) and checklist_sections (jsonb).
-- Convert checklist_sections from text[] to jsonb with shape [{ "title": "...", "items": ["..."] }].

-- Add columns if missing (no-op if 028 already created them)
ALTER TABLE public.domain_governance_templates
  ADD COLUMN IF NOT EXISTS required_approval_areas text[] NULL;

-- Convert checklist_sections: text[] -> jsonb (one section "Governance checklist" with items = old array)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'domain_governance_templates'
      AND column_name = 'checklist_sections'
      AND data_type = 'ARRAY'
  ) THEN
    ALTER TABLE public.domain_governance_templates
      ADD COLUMN IF NOT EXISTS checklist_sections_jsonb jsonb NULL;

    UPDATE public.domain_governance_templates
    SET checklist_sections_jsonb = CASE
      WHEN checklist_sections IS NULL OR array_length(checklist_sections, 1) IS NULL THEN '[]'::jsonb
      ELSE jsonb_build_array(
        jsonb_build_object(
          'title', 'Governance checklist',
          'items', to_jsonb(checklist_sections)
        )
      )
    END;

    ALTER TABLE public.domain_governance_templates DROP COLUMN checklist_sections;
    ALTER TABLE public.domain_governance_templates RENAME COLUMN checklist_sections_jsonb TO checklist_sections;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'domain_governance_templates'
      AND column_name = 'checklist_sections'
  ) THEN
    ALTER TABLE public.domain_governance_templates
      ADD COLUMN checklist_sections jsonb NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Optional: index for lookups
CREATE INDEX IF NOT EXISTS idx_domain_gov_templates_lookup
  ON public.domain_governance_templates (domain, risk_bucket)
  WHERE enabled = true;

-- Verify columns (run manually):
-- SELECT column_name, data_type, udt_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'domain_governance_templates'
-- ORDER BY ordinal_position;
-- Expected: required_approval_areas -> ARRAY/text[], checklist_sections -> jsonb
