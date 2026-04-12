-- Phase 2 — Internal employee portal: technical_support role + onboarding overrides

-- 1) Allow technical_support on internal_employee_accounts
ALTER TABLE public.internal_employee_accounts
  DROP CONSTRAINT IF EXISTS internal_employee_accounts_employee_role_check;

ALTER TABLE public.internal_employee_accounts
  ADD CONSTRAINT internal_employee_accounts_employee_role_check CHECK (
    employee_role IN (
      'support_admin',
      'billing_support',
      'account_ops',
      'technical_support',
      'super_admin'
    )
  );

-- 2) Append-only manual onboarding overrides (latest wins in application code)
CREATE TABLE IF NOT EXISTS public.internal_onboarding_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  item_key text NOT NULL,
  status text NOT NULL,
  reason text NOT NULL,
  employee_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  employee_email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_internal_onboarding_overrides_org_item_created
  ON public.internal_onboarding_overrides (org_id, item_key, created_at DESC);

ALTER TABLE public.internal_onboarding_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS internal_onboarding_overrides_service ON public.internal_onboarding_overrides;
CREATE POLICY internal_onboarding_overrides_service ON public.internal_onboarding_overrides
  FOR ALL USING (auth.role () = 'service_role')
  WITH CHECK (auth.role () = 'service_role');
