-- Phase 3 — Storage RLS for integration-uploads bucket.
-- Path format: {org_id}/csv/{timestamp}-{filename}
-- Only org members can upload, read, update, delete files in their org's folder.

-- Do not ALTER storage.objects here: migration role is not table owner on hosted Supabase;
-- RLS is already enabled on storage.objects by default.

-- Drop if re-running migration
DROP POLICY IF EXISTS integration_uploads_insert ON storage.objects;
DROP POLICY IF EXISTS integration_uploads_select ON storage.objects;
DROP POLICY IF EXISTS integration_uploads_update ON storage.objects;
DROP POLICY IF EXISTS integration_uploads_delete ON storage.objects;

-- Allow authenticated org members to INSERT (upload) to their org's path
CREATE POLICY integration_uploads_insert ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'integration-uploads'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

-- Allow authenticated org members to SELECT (download) from their org's path
CREATE POLICY integration_uploads_select ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'integration-uploads'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

-- Allow authenticated org members to UPDATE their org's files
CREATE POLICY integration_uploads_update ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'integration-uploads'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.is_org_member(((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'integration-uploads'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.is_org_member(((storage.foldername(name))[1])::uuid)
  );

-- Allow authenticated org members to DELETE their org's files
CREATE POLICY integration_uploads_delete ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'integration-uploads'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND public.is_org_member(((storage.foldername(name))[1])::uuid)
  );
