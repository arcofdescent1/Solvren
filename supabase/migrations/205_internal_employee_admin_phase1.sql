-- Phase 1 — Solvren employee internal admin (customer support portal)

-- 1) Internal employee accounts (service-role access only from API; no member self-read)
CREATE TABLE IF NOT EXISTS public.internal_employee_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL,
  employee_role text NOT NULL CHECK (
    employee_role IN ('support_admin', 'billing_support', 'account_ops', 'super_admin')
  ),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  notes text NULL,
  CONSTRAINT internal_employee_accounts_email_lower CHECK (email = lower(email))
);

CREATE INDEX IF NOT EXISTS idx_internal_employee_accounts_active_role
  ON public.internal_employee_accounts(employee_role)
  WHERE is_active = true;

DROP TRIGGER IF EXISTS trg_internal_employee_accounts_updated_at ON public.internal_employee_accounts;
CREATE TRIGGER trg_internal_employee_accounts_updated_at
  BEFORE UPDATE ON public.internal_employee_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.internal_employee_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS internal_employee_accounts_service ON public.internal_employee_accounts;
CREATE POLICY internal_employee_accounts_service ON public.internal_employee_accounts
  FOR ALL USING (auth.role () = 'service_role')
  WITH CHECK (auth.role () = 'service_role');

-- 2) Internal admin audit log (employee actions on customer orgs)
CREATE TABLE IF NOT EXISTS public.internal_admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
  employee_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  employee_email text NOT NULL,
  employee_role text NOT NULL,
  org_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NULL,
  reason text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_internal_admin_audit_org_created
  ON public.internal_admin_audit_log(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_admin_audit_employee_created
  ON public.internal_admin_audit_log(employee_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internal_admin_audit_action_created
  ON public.internal_admin_audit_log(action, created_at DESC);

ALTER TABLE public.internal_admin_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS internal_admin_audit_log_service ON public.internal_admin_audit_log;
CREATE POLICY internal_admin_audit_log_service ON public.internal_admin_audit_log
  FOR ALL USING (auth.role () = 'service_role')
  WITH CHECK (auth.role () = 'service_role');
