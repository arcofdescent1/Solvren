-- Phase 0: change_issue_links (link change_events to issues)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'change_issue_link_type') THEN
    CREATE TYPE public.change_issue_link_type AS ENUM (
      'origin', 'related', 'caused', 'mitigates', 'blocked_by'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.change_issue_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id uuid NOT NULL REFERENCES public.change_events(id) ON DELETE CASCADE,
  issue_id uuid NOT NULL REFERENCES public.issues(id) ON DELETE CASCADE,
  link_type public.change_issue_link_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(change_id, issue_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_change_issue_links_change_id ON public.change_issue_links(change_id);
CREATE INDEX IF NOT EXISTS idx_change_issue_links_issue_id ON public.change_issue_links(issue_id);
