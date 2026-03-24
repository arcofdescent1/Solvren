-- Phase 0 — Security baseline (Solvren): org helper + indexes.
-- Note: public.is_org_member already exists (SECURITY DEFINER). This adds is_org_admin for policies and docs.

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members m
    WHERE m.org_id = p_org_id
      AND m.user_id = auth.uid()
      AND lower(trim(m.role)) IN ('owner', 'admin')
  );
$$;

COMMENT ON FUNCTION public.is_org_admin(uuid) IS
  'Phase 0: true if auth.uid() is owner or admin in p_org_id. Use in RLS when stricter than is_org_member.';

REVOKE ALL ON FUNCTION public.is_org_admin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid) TO service_role;

-- Membership lookups in API + RLS subqueries
CREATE INDEX IF NOT EXISTS idx_organization_members_user_org
  ON public.organization_members (user_id, org_id);

CREATE INDEX IF NOT EXISTS idx_organization_members_org_user
  ON public.organization_members (org_id, user_id);

COMMENT ON INDEX idx_organization_members_user_org IS 'Phase 0: accelerate authz resolution by user then org.';
