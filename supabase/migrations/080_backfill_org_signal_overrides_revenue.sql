-- Create overrides for existing orgs for REVENUE signals (safe to run repeatedly)
INSERT INTO public.org_signal_overrides (org_id, domain_key, signal_key, enabled, weight_override, config_override)
SELECT
  od.org_id,
  ds.domain_key,
  ds.signal_key,
  true,
  NULL,
  '{}'::jsonb
FROM public.org_domains od
JOIN public.domain_signals ds
  ON ds.domain_key = od.domain_key
WHERE od.domain_key = 'REVENUE'
ON CONFLICT (org_id, domain_key, signal_key) DO NOTHING;
