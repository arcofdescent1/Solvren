-- Task 19: Approval Role Mapping (org-scoped, trigger-based)

CREATE TABLE IF NOT EXISTS public.approval_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role_name text NOT NULL,
  description text NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_approval_roles_org_name
  ON public.approval_roles (org_id, lower(role_name));

CREATE TABLE IF NOT EXISTS public.approval_role_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.approval_roles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_approval_role_members_org_role
  ON public.approval_role_members (org_id, role_id);

CREATE TABLE IF NOT EXISTS public.approval_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  trigger_type text NOT NULL,
  trigger_value text NOT NULL,
  approval_role_id uuid NOT NULL REFERENCES public.approval_roles(id) ON DELETE CASCADE,
  priority int NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT approval_mappings_trigger_type_chk
    CHECK (trigger_type IN ('DOMAIN', 'SYSTEM', 'CHANGE_TYPE'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_approval_mappings_unique
  ON public.approval_mappings (org_id, trigger_type, lower(trigger_value), approval_role_id);

CREATE INDEX IF NOT EXISTS idx_approval_mappings_match
  ON public.approval_mappings (org_id, trigger_type, lower(trigger_value), enabled, priority DESC);

DROP TRIGGER IF EXISTS trg_approval_roles_updated_at ON public.approval_roles;
CREATE TRIGGER trg_approval_roles_updated_at
BEFORE UPDATE ON public.approval_roles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_approval_mappings_updated_at ON public.approval_mappings;
CREATE TRIGGER trg_approval_mappings_updated_at
BEFORE UPDATE ON public.approval_mappings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.approval_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_role_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS approval_roles_select ON public.approval_roles;
CREATE POLICY approval_roles_select ON public.approval_roles
  FOR SELECT USING (is_org_member(org_id));

DROP POLICY IF EXISTS approval_roles_write ON public.approval_roles;
CREATE POLICY approval_roles_write ON public.approval_roles
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

DROP POLICY IF EXISTS approval_role_members_select ON public.approval_role_members;
CREATE POLICY approval_role_members_select ON public.approval_role_members
  FOR SELECT USING (is_org_member(org_id));

DROP POLICY IF EXISTS approval_role_members_write ON public.approval_role_members;
CREATE POLICY approval_role_members_write ON public.approval_role_members
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));

DROP POLICY IF EXISTS approval_mappings_select ON public.approval_mappings;
CREATE POLICY approval_mappings_select ON public.approval_mappings
  FOR SELECT USING (is_org_member(org_id));

DROP POLICY IF EXISTS approval_mappings_write ON public.approval_mappings;
CREATE POLICY approval_mappings_write ON public.approval_mappings
  FOR ALL USING (is_org_member(org_id))
  WITH CHECK (is_org_member(org_id));
