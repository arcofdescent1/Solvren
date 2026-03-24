-- Phase 3 — Storage bucket for CSV/integration file uploads.
-- Service role (admin client) bypasses RLS; bucket creation enables uploads.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'integration-uploads',
  'integration-uploads',
  false,
  10485760,
  ARRAY['text/csv', 'application/csv', 'text/plain']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
