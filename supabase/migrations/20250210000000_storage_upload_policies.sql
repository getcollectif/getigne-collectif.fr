-- Politiques RLS pour permettre aux utilisateurs **admin** (public.user_roles) d’uploader dans les buckets Storage.
-- Sans ces politiques, les uploads (logo du wizard, paramètres, etc.) échouent avec une erreur de permission.

-- Condition : l’utilisateur doit avoir le rôle 'admin' dans public.user_roles.
-- Buckets concernés : site-assets, news_images, program_files, team-members, public, event_images, cms_assets, external-directory, program-files.

CREATE POLICY "Admins can upload to app buckets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN (
    'site-assets', 'news_images', 'program_files', 'team-members',
    'public', 'event_images', 'cms_assets', 'external-directory', 'program-files'
  )
  AND (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'::public.app_role))
);

CREATE POLICY "Admins can read app bucket objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id IN (
    'site-assets', 'news_images', 'program_files', 'team-members',
    'public', 'event_images', 'cms_assets', 'external-directory', 'program-files'
  )
  AND (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'::public.app_role))
);

CREATE POLICY "Admins can update app bucket objects"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id IN (
    'site-assets', 'news_images', 'program_files', 'team-members',
    'public', 'event_images', 'cms_assets', 'external-directory', 'program-files'
  )
  AND (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'::public.app_role))
)
WITH CHECK (
  bucket_id IN (
    'site-assets', 'news_images', 'program_files', 'team-members',
    'public', 'event_images', 'cms_assets', 'external-directory', 'program-files'
  )
  AND (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'::public.app_role))
);

CREATE POLICY "Admins can delete app bucket objects"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id IN (
    'site-assets', 'news_images', 'program_files', 'team-members',
    'public', 'event_images', 'cms_assets', 'external-directory', 'program-files'
  )
  AND (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'::public.app_role))
);

-- Bucket avatars : tout utilisateur authentifié peut uploader son avatar (profil) ; mise à jour/suppression uniquement sur ses objets (owner_id).
CREATE POLICY "Authenticated can upload avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Authenticated can read avatars"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated can update own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND owner_id = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Authenticated can delete own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND owner_id = auth.uid()::text);
