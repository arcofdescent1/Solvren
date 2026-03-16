CREATE TABLE IF NOT EXISTS public.approval_role_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_key text NOT NULL DEFAULT 'REVENUE',
  role_label text NOT NULL,
  approval_area text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_approval_role_map
  ON public.approval_role_map(domain_key, role_label);

INSERT INTO public.approval_role_map(domain_key, role_label, approval_area)
VALUES
  ('REVENUE','Finance','FINANCE'),
  ('REVENUE','RevOps','REVOPS'),
  ('REVENUE','Billing Eng','BILLING'),
  ('REVENUE','Payments Eng','PAYMENTS'),
  ('REVENUE','Data Eng','DATA'),
  ('REVENUE','Analytics','ANALYTICS'),
  ('REVENUE','Legal','LEGAL'),
  ('REVENUE','Security','SECURITY'),
  ('REVENUE','Support','SUPPORT')
ON CONFLICT (domain_key, role_label) DO NOTHING;
