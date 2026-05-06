-- Phase 4 — Customer-controlled employee access + break-glass (employee_profiles canonical for Phase 4)

CREATE TABLE IF NOT EXISTS public.employee_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users (id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('SUPPORT', 'IMPLEMENTATION', 'ENGINEERING', 'SECURITY', 'ADMIN')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'terminated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT employee_profiles_email_check CHECK (email LIKE '%@solvren.com')
);

CREATE INDEX IF NOT EXISTS idx_employee_profiles_active ON public.employee_profiles(status) WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_employee_profiles_updated_at ON public.employee_profiles;
CREATE TRIGGER trg_employee_profiles_updated_at
  BEFORE UPDATE ON public.employee_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_profiles_service_all ON public.employee_profiles;
CREATE POLICY employee_profiles_service_all ON public.employee_profiles
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Backfill from legacy internal_employee_accounts (idempotent)
INSERT INTO public.employee_profiles (user_id, email, role, status)
SELECT
  iea.user_id,
  lower(trim(iea.email)),
  CASE iea.employee_role
    WHEN 'super_admin' THEN 'ADMIN'
    WHEN 'technical_support' THEN 'ENGINEERING'
    WHEN 'account_ops' THEN 'IMPLEMENTATION'
    ELSE 'SUPPORT'
  END::text,
  CASE WHEN iea.is_active THEN 'active' ELSE 'suspended' END::text
FROM public.internal_employee_accounts iea
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.customer_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approved_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  access_level text NOT NULL CHECK (access_level IN ('masked', 'sensitive')),
  reason text NOT NULL,
  duration_hours int NOT NULL DEFAULT 4 CHECK (duration_hours IN (1, 4, 24, 72)),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'revoked', 'expired')),
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  revoked_at timestamptz,
  denied_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_customer_access_grants_org ON public.customer_access_grants(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_access_grants_employee ON public.customer_access_grants(employee_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_access_grants_one_pending_per_pair
  ON public.customer_access_grants(org_id, employee_user_id)
  WHERE status = 'pending';

ALTER TABLE public.customer_access_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customer_access_grants_org_select ON public.customer_access_grants;
CREATE POLICY customer_access_grants_org_select ON public.customer_access_grants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = customer_access_grants.org_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS customer_access_grants_org_update ON public.customer_access_grants;
CREATE POLICY customer_access_grants_org_update ON public.customer_access_grants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = customer_access_grants.org_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = customer_access_grants.org_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

CREATE TABLE IF NOT EXISTS public.break_glass_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  initiated_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('high', 'critical')),
  duration_minutes int NOT NULL CHECK (duration_minutes IN (15, 30, 60)),
  started_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  expires_at timestamptz,
  ended_at timestamptz,
  customer_notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_break_glass_org ON public.break_glass_access_events(org_id, created_at DESC);

ALTER TABLE public.break_glass_access_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS break_glass_events_org_select ON public.break_glass_access_events;
CREATE POLICY break_glass_events_org_select ON public.break_glass_access_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = break_glass_access_events.org_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS break_glass_events_service ON public.break_glass_access_events;
CREATE POLICY break_glass_events_service ON public.break_glass_access_events
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.break_glass_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.break_glass_access_events(id) ON DELETE CASCADE,
  approver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  approved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, approver_user_id)
);

CREATE INDEX IF NOT EXISTS idx_break_glass_approvals_event ON public.break_glass_approvals(event_id);

ALTER TABLE public.break_glass_approvals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS break_glass_approvals_service ON public.break_glass_approvals;
CREATE POLICY break_glass_approvals_service ON public.break_glass_approvals
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS public.employee_access_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  employee_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_type text NOT NULL CHECK (access_type IN ('metadata', 'masked', 'sensitive', 'break_glass')),
  access_level text NOT NULL CHECK (access_level IN ('tier_0', 'tier_1', 'tier_2', 'tier_3')),
  legal_basis text NOT NULL CHECK (legal_basis IN ('metadata_default', 'grant', 'break_glass')),
  resource_type text NOT NULL,
  resource_id text,
  reason text NOT NULL,
  grant_id uuid REFERENCES public.customer_access_grants(id) ON DELETE SET NULL,
  break_glass_event_id uuid REFERENCES public.break_glass_access_events(id) ON DELETE SET NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employee_access_audit_org ON public.employee_access_audit(org_id, created_at DESC);

ALTER TABLE public.employee_access_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_access_audit_org_select ON public.employee_access_audit;
CREATE POLICY employee_access_audit_org_select ON public.employee_access_audit
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.org_id = employee_access_audit.org_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS employee_access_audit_service ON public.employee_access_audit;
CREATE POLICY employee_access_audit_service ON public.employee_access_audit
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.employee_profiles IS 'Phase 4 — Solvren employees; server-only reads via service role.';
COMMENT ON TABLE public.customer_access_grants IS 'Phase 4 — customer-approved employee access grants.';
COMMENT ON TABLE public.employee_access_audit IS 'Phase 4 — employee customer-data access; service-role insert; org admins read.';
