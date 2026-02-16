-- Ajoute les 3 documents administratifs sur team_members
-- et configure le bucket privé associé.

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS identity_card_url text,
  ADD COLUMN IF NOT EXISTS cerfa_14997_04_url text,
  ADD COLUMN IF NOT EXISTS commune_attachment_proof_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('team-member-documents', 'team-member-documents', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "Admins can upload to app buckets" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read app bucket objects" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update app bucket objects" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete app bucket objects" ON storage.objects;

CREATE POLICY "Admins can upload to app buckets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN (
    'site-assets', 'news_images', 'program_files', 'team-members',
    'public', 'event_images', 'cms_assets', 'external-directory', 'program-files',
    'team-member-documents'
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
    'public', 'event_images', 'cms_assets', 'external-directory', 'program-files',
    'team-member-documents'
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
    'public', 'event_images', 'cms_assets', 'external-directory', 'program-files',
    'team-member-documents'
  )
  AND (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'::public.app_role))
)
WITH CHECK (
  bucket_id IN (
    'site-assets', 'news_images', 'program_files', 'team-members',
    'public', 'event_images', 'cms_assets', 'external-directory', 'program-files',
    'team-member-documents'
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
    'public', 'event_images', 'cms_assets', 'external-directory', 'program-files',
    'team-member-documents'
  )
  AND (auth.uid() IN (SELECT user_id FROM public.user_roles WHERE role = 'admin'::public.app_role))
);
