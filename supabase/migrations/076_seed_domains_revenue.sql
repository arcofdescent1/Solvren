-- Seed REVENUE domain for Phase 3 (enableDomainForOrg)

INSERT INTO public.domains (key, name, description, is_active)
VALUES ('REVENUE', 'Revenue', 'Revenue risk and billing impact', true)
ON CONFLICT (key) DO NOTHING;
