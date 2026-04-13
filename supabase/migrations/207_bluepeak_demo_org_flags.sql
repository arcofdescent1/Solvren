-- BluePeak / sales demo org flags (seeded by scripts/seed-bluepeak-demo.ts)

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS demo_slug text NULL;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS demo_profile jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.organizations.is_demo IS 'Synthetic demo organization (sales / training). UI may show a demo banner.';
COMMENT ON COLUMN public.organizations.demo_slug IS 'Stable idempotent key for demo reset scripts (e.g. bluepeak-home-services).';
COMMENT ON COLUMN public.organizations.demo_profile IS 'Optional structured demo metadata (employee_count, industry, etc.).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_demo_slug_unique
  ON public.organizations (demo_slug)
  WHERE demo_slug IS NOT NULL;
