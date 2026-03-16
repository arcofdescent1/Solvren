-- Phase 3 — Domain-scoped SLA + approval requirements

CREATE TABLE IF NOT EXISTS public.domain_sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_key text NOT NULL REFERENCES public.domains(key) ON DELETE CASCADE,
  policy_key text NOT NULL,
  due_hours integer NOT NULL,
  due_soon_hours integer NOT NULL DEFAULT 24,
  escalation_hours integer NOT NULL DEFAULT 72,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(domain_key, policy_key)
);

CREATE TABLE IF NOT EXISTS public.domain_approval_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_key text NOT NULL REFERENCES public.domains(key) ON DELETE CASCADE,
  approval_area text NOT NULL,
  required_kinds text[] NOT NULL DEFAULT '{}'::text[],
  required_approvals integer NOT NULL DEFAULT 1,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(domain_key, approval_area)
);

CREATE TABLE IF NOT EXISTS public.org_domain_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  domain_key text NOT NULL REFERENCES public.domains(key) ON DELETE CASCADE,
  sla_policy_key text NOT NULL DEFAULT 'DEFAULT',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(org_id, domain_key)
);

ALTER TABLE public.org_domain_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_domain_policies_select ON public.org_domain_policies;
CREATE POLICY org_domain_policies_select ON public.org_domain_policies
  FOR SELECT USING (is_org_member(org_id));

DROP POLICY IF EXISTS org_domain_policies_write ON public.org_domain_policies;
CREATE POLICY org_domain_policies_write ON public.org_domain_policies
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));
