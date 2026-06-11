-- User profiles and avatars.
-- Avatars are global to a user; visibility is limited to people who share an org.

CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  avatar_path text,
  avatar_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_display_name
  ON public.user_profiles (lower(display_name))
  WHERE display_name IS NOT NULL;

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profiles_select_shared_org ON public.user_profiles;
CREATE POLICY user_profiles_select_shared_org ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.organization_members viewer
      JOIN public.organization_members subject
        ON subject.org_id = viewer.org_id
      WHERE viewer.user_id = auth.uid()
        AND subject.user_id = user_profiles.user_id
    )
  );

DROP POLICY IF EXISTS user_profiles_insert_self ON public.user_profiles;
CREATE POLICY user_profiles_insert_self ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_profiles_update_self ON public.user_profiles;
CREATE POLICY user_profiles_update_self ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-avatars',
  'profile-avatars',
  true,
  1048576,
  ARRAY['image/webp', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS profile_avatars_insert_self ON storage.objects;
DROP POLICY IF EXISTS profile_avatars_select_authenticated ON storage.objects;
DROP POLICY IF EXISTS profile_avatars_update_self ON storage.objects;
DROP POLICY IF EXISTS profile_avatars_delete_self ON storage.objects;

CREATE POLICY profile_avatars_insert_self ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY profile_avatars_select_authenticated ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'profile-avatars');

CREATE POLICY profile_avatars_update_self ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY profile_avatars_delete_self ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
