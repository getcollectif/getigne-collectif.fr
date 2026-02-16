-- Ajoute un slug unique pour chaque membre d'equipe
-- afin d'exposer des URLs propres /equipe/:slug

ALTER TABLE public.team_members
ADD COLUMN IF NOT EXISTS slug text;

CREATE OR REPLACE FUNCTION public.team_member_slugify(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    regexp_replace(
      regexp_replace(
        lower(
          translate(
            coalesce(value, ''),
            'àáâäãåæçèéêëìíîïñòóôöõœùúûüýÿ',
            'aaaaaaaceeeeiiiinoooooeuuuuyy'
          )
        ),
        '[^a-z0-9]+',
        '-',
        'g'
      ),
      '(^-|-$)',
      '',
      'g'
    );
$$;

CREATE OR REPLACE FUNCTION public.team_members_assign_slug()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug text;
  final_slug text;
  suffix integer := 1;
BEGIN
  base_slug := public.team_member_slugify(NEW.name);
  IF base_slug IS NULL OR base_slug = '' THEN
    base_slug := 'membre';
  END IF;

  final_slug := base_slug;
  WHILE EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.slug = final_slug
      AND tm.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) LOOP
    suffix := suffix + 1;
    final_slug := base_slug || '-' || suffix;
  END LOOP;

  NEW.slug := final_slug;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_team_members_slug ON public.team_members;
CREATE TRIGGER set_team_members_slug
BEFORE INSERT OR UPDATE OF name
ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.team_members_assign_slug();

WITH base AS (
  SELECT
    tm.id,
    tm.created_at,
    CASE
      WHEN public.team_member_slugify(tm.name) = '' THEN 'membre'
      ELSE public.team_member_slugify(tm.name)
    END AS base_slug
  FROM public.team_members tm
),
ranked AS (
  SELECT
    b.id,
    b.base_slug,
    row_number() OVER (
      PARTITION BY b.base_slug
      ORDER BY b.created_at, b.id
    ) AS slug_rank
  FROM base b
)
UPDATE public.team_members tm
SET slug = CASE
  WHEN r.slug_rank = 1 THEN r.base_slug
  ELSE r.base_slug || '-' || r.slug_rank
END
FROM ranked r
WHERE tm.id = r.id
  AND (tm.slug IS NULL OR tm.slug = '');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.team_members WHERE slug IS NULL OR slug = '') THEN
    RAISE EXCEPTION 'Migration aborted: at least one team_members.slug is empty';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS team_members_slug_key
ON public.team_members (slug);

ALTER TABLE public.team_members
ALTER COLUMN slug SET NOT NULL;
