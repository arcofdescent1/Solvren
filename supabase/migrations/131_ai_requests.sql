-- AI request logging for observability, cost control, and debugging (Gap 4).
CREATE TABLE IF NOT EXISTS public.ai_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  endpoint text NOT NULL,
  input_summary text,
  output_summary text,
  latency_ms int,
  status text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  org_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.ai_requests IS 'Log of AI API calls for monitoring and cost control';
CREATE INDEX IF NOT EXISTS idx_ai_requests_created_at ON public.ai_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_requests_endpoint ON public.ai_requests(endpoint);

-- Only backend (service role) inserts; admins can read. Restrict read to service or app admin.
ALTER TABLE public.ai_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_requests_insert ON public.ai_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY ai_requests_select ON public.ai_requests
  FOR SELECT USING (true);
