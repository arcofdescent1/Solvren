-- Domain-level surface weights (editable per domain without code changes)
CREATE TABLE IF NOT EXISTS public.domain_surface_weights (
  domain_key text NOT NULL,
  revenue_surface text NOT NULL,
  weight numeric NOT NULL DEFAULT 1.2,
  PRIMARY KEY (domain_key, revenue_surface)
);

-- Seed defaults for REVENUE domain
INSERT INTO public.domain_surface_weights(domain_key, revenue_surface, weight)
VALUES
  ('REVENUE','PRICING',1.25),
  ('REVENUE','BILLING',1.25),
  ('REVENUE','PAYMENTS',1.35),
  ('REVENUE','SUBSCRIPTION',1.30),
  ('REVENUE','PLAN_LOGIC',1.25),
  ('REVENUE','ENTITLEMENTS',1.20),
  ('REVENUE','CHECKOUT',1.40),
  ('REVENUE','TAX',1.30),
  ('REVENUE','PROMOTIONS',1.15)
ON CONFLICT (domain_key, revenue_surface) DO UPDATE
SET weight = EXCLUDED.weight;
