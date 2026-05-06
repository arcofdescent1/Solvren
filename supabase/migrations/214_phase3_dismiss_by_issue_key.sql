-- Phase 3 — historical dismiss by issue_key (org-scoped; decision_payload.issue_key from Phase 2)

CREATE OR REPLACE FUNCTION public.issue_had_dismiss_by_key(p_org_id uuid, p_issue_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.issue_actions ia
    INNER JOIN public.issues i ON i.id = ia.issue_id
    WHERE i.org_id = p_org_id
      AND ia.action_type = 'dismiss'
      AND (ia.decision_payload->>'issue_key') IS NOT NULL
      AND (ia.decision_payload->>'issue_key') = p_issue_key
  );
$$;

REVOKE ALL ON FUNCTION public.issue_had_dismiss_by_key(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.issue_had_dismiss_by_key(uuid, text) TO service_role;

COMMENT ON FUNCTION public.issue_had_dismiss_by_key IS
  'Phase 3 — true if any dismiss action in org references this issue_key in decision_payload.';
