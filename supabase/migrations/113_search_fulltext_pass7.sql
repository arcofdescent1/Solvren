-- Pass 7: Search hardening — full-text search for change_events
-- Enables better ranking and multi-word query support.

-- Add tsvector column for change_events search
ALTER TABLE public.change_events
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Build search vector from title, change_type, domain, systems, intake description
CREATE OR REPLACE FUNCTION public.change_events_search_vector_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.change_type::text, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.domain, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(NEW.systems_involved, ' '), '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.structured_change_type, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.intake::text, '')), 'C');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_change_events_search_vector ON public.change_events;
CREATE TRIGGER trg_change_events_search_vector
  BEFORE INSERT OR UPDATE OF title, change_type, domain, systems_involved, intake, structured_change_type
  ON public.change_events
  FOR EACH ROW
  EXECUTE FUNCTION public.change_events_search_vector_update();

-- Backfill existing rows
UPDATE public.change_events SET search_vector = (
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(change_type::text, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(domain, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(array_to_string(systems_involved, ' '), '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(structured_change_type, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(intake::text, '')), 'C')
)
WHERE search_vector IS NULL;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_change_events_search_vector
  ON public.change_events USING gin(search_vector);

-- RPC for full-text search: returns change IDs with rank, org-scoped
-- API applies visibility filtering after fetching full rows
CREATE OR REPLACE FUNCTION public.search_changes_fts(
  p_org_ids uuid[],
  p_query text,
  p_limit int DEFAULT 50
)
RETURNS TABLE(change_id uuid, rank real)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_query IS NULL OR length(trim(p_query)) < 2 THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    ce.id AS change_id,
    ts_rank(ce.search_vector, plainto_tsquery('simple', trim(p_query)))::real AS rank
  FROM public.change_events ce
  WHERE ce.org_id = ANY(p_org_ids)
    AND ce.search_vector IS NOT NULL
    AND ce.search_vector @@ plainto_tsquery('simple', trim(p_query))
  ORDER BY rank DESC, ce.submitted_at DESC NULLS LAST, ce.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Search org members (users) by email or display name — admin workflows
-- SECURITY DEFINER to read auth.users; only returns users in caller's orgs
CREATE OR REPLACE FUNCTION public.search_org_users(
  p_org_ids uuid[],
  p_query text,
  p_limit int DEFAULT 10
)
RETURNS TABLE(user_id uuid, email text, display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF p_query IS NULL OR length(trim(p_query)) < 2 THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::text,
    coalesce((u.raw_user_meta_data->>'display_name')::text, u.email::text) AS display_name
  FROM auth.users u
  INNER JOIN public.organization_members om ON om.user_id = u.id AND om.org_id = ANY(p_org_ids)
  WHERE u.email ILIKE '%' || trim(p_query) || '%'
     OR (u.raw_user_meta_data->>'display_name') ILIKE '%' || trim(p_query) || '%'
  ORDER BY
    CASE WHEN u.email ILIKE trim(p_query) || '%' THEN 0 ELSE 1 END,
    u.email
  LIMIT p_limit;
END;
$$;
