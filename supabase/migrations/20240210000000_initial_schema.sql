-- Schéma initial généré depuis la prod (supabase db dump --linked -f schema.sql).
-- Une seule migration = état actuel du schéma prod.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pgsodium";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'moderator',
    'user',
    'program_manager',
    'program_team'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."education_level" AS ENUM (
    'brevet',
    'cap_bep',
    'bac_general',
    'bac_technologique',
    'bac_professionnel',
    'bac_plus_1_2',
    'bac_plus_3',
    'bac_plus_4_5',
    'bac_plus_6_plus'
);


ALTER TYPE "public"."education_level" OWNER TO "postgres";


CREATE TYPE "public"."max_engagement_level" AS ENUM (
    'positions_1_8',
    'positions_9_21',
    'positions_22_29'
);


ALTER TYPE "public"."max_engagement_level" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_program_team_role_on_committee_add"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Si user_id est défini (et non NULL)
    IF NEW.user_id IS NOT NULL THEN
        -- Vérifie si l'utilisateur a déjà le rôle
        IF NOT EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = NEW.user_id AND role = 'program_team'
        ) THEN
            -- Ajoute le rôle program_team
            INSERT INTO public.user_roles (user_id, role)
            VALUES (NEW.user_id, 'program_team');
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."add_program_team_role_on_committee_add"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."convert_markdown_inline_to_html"("text_input" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
  result TEXT;
BEGIN
  result := text_input;
  result := regexp_replace(result, '\*\*([^\*]+)\*\*', '<b>\1</b>', 'g');
  result := regexp_replace(result, '__([^_]+)__', '<b>\1</b>', 'g');
  result := regexp_replace(result, '\*([^\*]+)\*', '<i>\1</i>', 'g');
  result := regexp_replace(result, '_([^_]+)_', '<i>\1</i>', 'g');
  result := regexp_replace(result, '`([^`]+)`', '<code>\1</code>', 'g');
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."convert_markdown_inline_to_html"("text_input" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_program_likes"("program_id" "uuid") RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT COUNT(*)::INTEGER 
  FROM public.program_likes 
  WHERE program_likes.program_item_id = program_id;
$$;


ALTER FUNCTION "public"."count_program_likes"("program_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_project_likes"("project_id" "uuid") RETURNS integer
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT COUNT(*)::INTEGER 
  FROM public.project_likes 
  WHERE project_likes.project_id = count_project_likes.project_id;
$$;


ALTER FUNCTION "public"."count_project_likes"("project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_single_active_electoral_list"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF NEW.is_active = true THEN
        UPDATE electoral_list
        SET is_active = false
        WHERE id != NEW.id AND is_active = true;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_single_active_electoral_list"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_roles"("uid" "uuid") RETURNS SETOF "public"."app_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role 
  FROM public.user_roles
  WHERE user_id = uid;
$$;


ALTER FUNCTION "public"."get_user_roles"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (new.id, new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'last_name');
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_user_comment_deletion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  comment_record RECORD;
  has_replies BOOLEAN;
BEGIN
  -- Traiter les commentaires de news
  FOR comment_record IN 
    SELECT id 
    FROM comments 
    WHERE user_id = OLD.id
  LOOP
    -- Vérifier si le commentaire a des réponses
    SELECT EXISTS(SELECT 1 FROM comments WHERE parent_comment_id = comment_record.id) INTO has_replies;
    
    IF has_replies THEN
      -- Si oui, marquer comme deleted (user_id sera mis à NULL par SET NULL)
      UPDATE comments 
      SET status = 'deleted'
      WHERE id = comment_record.id;
    ELSE
      -- Si non, supprimer définitivement
      DELETE FROM comments WHERE id = comment_record.id;
    END IF;
  END LOOP;

  -- Traiter les commentaires de programme
  FOR comment_record IN 
    SELECT id 
    FROM program_comments 
    WHERE user_id = OLD.id
  LOOP
    -- Vérifier si le commentaire a des réponses
    SELECT EXISTS(SELECT 1 FROM program_comments WHERE parent_comment_id = comment_record.id) INTO has_replies;
    
    IF has_replies THEN
      -- Si oui, marquer comme deleted (user_id sera mis à NULL par SET NULL)
      UPDATE program_comments 
      SET status = 'deleted'
      WHERE id = comment_record.id;
    ELSE
      -- Si non, supprimer définitivement
      DELETE FROM program_comments WHERE id = comment_record.id;
    END IF;
  END LOOP;

  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."handle_user_comment_deletion"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_user_comment_deletion"() IS 'Fonction qui gère la suppression en cascade des commentaires lors de la suppression d''un utilisateur. Supprime définitivement les commentaires sans réponses, et marque comme deleted ceux avec des réponses.';



CREATE OR REPLACE FUNCTION "public"."is_committee_member"("user_id" "uuid", "committee_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.committee_members
    WHERE user_id = is_committee_member.user_id
    AND committee_id = is_committee_member.committee_id
  )
$$;


ALTER FUNCTION "public"."is_committee_member"("user_id" "uuid", "committee_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_markdown_content"("content_text" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
  IF content_text IS NULL OR trim(content_text) = '' THEN
    RETURN false;
  END IF;
  
  BEGIN
    IF content_text::jsonb ? 'blocks' THEN
      RETURN false;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;
  
  IF content_text ~ '^#{1,6}\s+' OR content_text ~ '^\*\s+' OR content_text ~ '^-\s+' OR content_text ~ '^\+\s+' OR content_text ~ '^\d+\.\s+' OR content_text ~ '\*\*[^*]+\*\*' OR content_text ~ '`[^`]+`' OR content_text ~ '^>\s+' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$;


ALTER FUNCTION "public"."is_markdown_content"("content_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."markdown_to_editorjs_improved"("markdown_text" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  result JSONB;
  blocks JSONB := '[]'::JSONB;
  lines TEXT[];
  line TEXT;
  cleaned_line TEXT;
  in_list BOOLEAN := false;
  list_items TEXT[] := '{}';
  list_style TEXT := 'unordered';
  i INTEGER;
  header_level INTEGER;
  header_text TEXT;
BEGIN
  IF markdown_text IS NULL OR trim(markdown_text) = '' THEN
    RETURN jsonb_build_object('time', extract(epoch from now())::bigint * 1000, 'blocks', '[]'::JSONB, 'version', '2.28.0');
  END IF;

  lines := string_to_array(markdown_text, E'\n');

  FOR i IN 1..array_length(lines, 1) LOOP
    line := lines[i];
    cleaned_line := trim(line);
    
    IF cleaned_line = '' THEN
      IF in_list AND array_length(list_items, 1) > 0 THEN
        blocks := blocks || jsonb_build_object('type', 'list', 'data', jsonb_build_object('style', list_style, 'items', array_to_json(list_items)::jsonb));
        list_items := '{}';
        in_list := false;
      END IF;
      CONTINUE;
    END IF;
    
    IF cleaned_line ~ '^[\-\*\+]\s+' THEN
      IF NOT in_list THEN
        in_list := true;
        list_style := 'unordered';
      END IF;
      cleaned_line := trim(regexp_replace(cleaned_line, '^[\-\*\+]\s+', ''));
      cleaned_line := convert_markdown_inline_to_html(cleaned_line);
      list_items := array_append(list_items, cleaned_line);
      CONTINUE;
    END IF;
    
    IF cleaned_line ~ '^\d+\.\s+' THEN
      IF NOT in_list THEN
        in_list := true;
        list_style := 'ordered';
      END IF;
      cleaned_line := trim(regexp_replace(cleaned_line, '^\d+\.\s+', ''));
      cleaned_line := convert_markdown_inline_to_html(cleaned_line);
      list_items := array_append(list_items, cleaned_line);
      CONTINUE;
    END IF;
    
    IF in_list AND array_length(list_items, 1) > 0 THEN
      blocks := blocks || jsonb_build_object('type', 'list', 'data', jsonb_build_object('style', list_style, 'items', array_to_json(list_items)::jsonb));
      list_items := '{}';
      in_list := false;
    END IF;
    
    IF cleaned_line ~ '^#{1,6}\s+' THEN
      header_level := length(regexp_replace(cleaned_line, '^(#{1,6}).*', '\1'));
      header_text := trim(regexp_replace(cleaned_line, '^#{1,6}\s+', ''));
      header_text := convert_markdown_inline_to_html(header_text);
      blocks := blocks || jsonb_build_object('type', 'header', 'data', jsonb_build_object('text', header_text, 'level', header_level));
      CONTINUE;
    END IF;
    
    cleaned_line := convert_markdown_inline_to_html(cleaned_line);
    blocks := blocks || jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', cleaned_line));
  END LOOP;
  
  IF in_list AND array_length(list_items, 1) > 0 THEN
    blocks := blocks || jsonb_build_object('type', 'list', 'data', jsonb_build_object('style', list_style, 'items', array_to_json(list_items)::jsonb));
  END IF;

  result := jsonb_build_object('time', extract(epoch from now())::bigint * 1000, 'blocks', blocks, 'version', '2.28.0');
  RETURN result;
END;
$$;


ALTER FUNCTION "public"."markdown_to_editorjs_improved"("markdown_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_faq_categories_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_faq_categories_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_faq_items_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_faq_items_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_faqs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_faqs_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_helloasso_memberships_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_helloasso_memberships_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_lexicon_entries_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_lexicon_entries_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_subject_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.observatory_subjects 
        SET 
            total_discussions = total_discussions + 1,
            last_mention_date = CASE 
                WHEN last_mention_date IS NULL OR (
                    SELECT meeting_date 
                    FROM public.observatory_documents 
                    WHERE id = NEW.document_id
                ) > last_mention_date 
                THEN (
                    SELECT meeting_date 
                    FROM public.observatory_documents 
                    WHERE id = NEW.document_id
                )
                ELSE last_mention_date
            END,
            first_mention_date = CASE 
                WHEN first_mention_date IS NULL OR (
                    SELECT meeting_date 
                    FROM public.observatory_documents 
                    WHERE id = NEW.document_id
                ) < first_mention_date 
                THEN (
                    SELECT meeting_date 
                    FROM public.observatory_documents 
                    WHERE id = NEW.document_id
                )
                ELSE first_mention_date
            END
        WHERE id = NEW.subject_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.observatory_subjects 
        SET 
            total_discussions = GREATEST(total_discussions - 1, 0)
        WHERE id = OLD.subject_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_subject_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_liked_project"("project_id" "uuid", "user_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.project_likes 
    WHERE project_likes.project_id = user_has_liked_project.project_id
    AND project_likes.user_id = user_has_liked_project.user_id
  );
$$;


ALTER FUNCTION "public"."user_has_liked_project"("project_id" "uuid", "user_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."citizen_committees" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "icon" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "team_photo_url" "text",
    "color" "text",
    "cover_photo_url" "text"
);


ALTER TABLE "public"."citizen_committees" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comment_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."comment_likes" OWNER TO "postgres";


COMMENT ON TABLE "public"."comment_likes" IS 'Table des likes sur les commentaires d''articles';



CREATE TABLE IF NOT EXISTS "public"."comment_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "comment_type" character varying(10) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "comment_views_comment_type_check" CHECK ((("comment_type")::"text" = ANY ((ARRAY['news'::character varying, 'program'::character varying])::"text"[])))
);


ALTER TABLE "public"."comment_views" OWNER TO "postgres";


COMMENT ON TABLE "public"."comment_views" IS 'Table de suivi des commentaires vus par les utilisateurs';



COMMENT ON COLUMN "public"."comment_views"."comment_id" IS 'ID du commentaire (peut être de la table comments ou program_comments)';



COMMENT ON COLUMN "public"."comment_views"."user_id" IS 'ID de l''utilisateur qui a vu le commentaire';



COMMENT ON COLUMN "public"."comment_views"."comment_type" IS 'Type de commentaire: news ou program';



CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "news_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "parent_comment_id" "uuid",
    "edited_at" timestamp with time zone,
    CONSTRAINT "comments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."comments"."parent_comment_id" IS 'Référence vers le commentaire parent si ce commentaire est une réponse';



COMMENT ON COLUMN "public"."comments"."edited_at" IS 'Date et heure de la dernière modification du commentaire';



CREATE TABLE IF NOT EXISTS "public"."committee_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "committee_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "role" "text" NOT NULL,
    "photo" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid"
);


ALTER TABLE "public"."committee_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."committee_works" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "committee_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "images" "jsonb" DEFAULT '[]'::"jsonb",
    "files" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."committee_works" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."electoral_list" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "election_date" "date" NOT NULL,
    "governance_content" "jsonb",
    "is_active" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."electoral_list" OWNER TO "postgres";


COMMENT ON TABLE "public"."electoral_list" IS 'Listes électorales municipales';



CREATE TABLE IF NOT EXISTS "public"."electoral_list_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "electoral_list_id" "uuid" NOT NULL,
    "team_member_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "electoral_list_members_position_check" CHECK ((("position" = 999) OR (("position" >= 1) AND ("position" <= 29))))
);


ALTER TABLE "public"."electoral_list_members" OWNER TO "postgres";


COMMENT ON TABLE "public"."electoral_list_members" IS 'Association entre membres d''équipe et positions sur la liste électorale';



CREATE TABLE IF NOT EXISTS "public"."electoral_member_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "electoral_list_member_id" "uuid" NOT NULL,
    "thematic_role_id" "uuid" NOT NULL,
    "is_primary" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."electoral_member_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."electoral_member_roles" IS 'Rôles thématiques assignés aux membres de la liste électorale';



CREATE TABLE IF NOT EXISTS "public"."event_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'registered'::"text" NOT NULL,
    "additional_guests" integer DEFAULT 0,
    CONSTRAINT "event_registrations_additional_guests_check" CHECK ((("additional_guests" >= 0) AND ("additional_guests" <= 9)))
);


ALTER TABLE "public"."event_registrations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."event_registrations"."additional_guests" IS 'Nombre de personnes additionnelles que l''utilisateur inscrit amène à l''événement (0-9)';



CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "date" timestamp without time zone NOT NULL,
    "location" "text" NOT NULL,
    "image" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "content" "text" DEFAULT ''::"text",
    "committee" "text",
    "committee_id" "uuid",
    "is_members_only" boolean DEFAULT false,
    "allow_registration" boolean DEFAULT true,
    "slug" "text",
    "status" "text" DEFAULT 'published'::"text",
    "event_type" "text" DEFAULT 'regular'::"text",
    "latitude" numeric(10,8),
    "longitude" numeric(11,8),
    "organizer_name" "text",
    "organizer_contact" "text",
    "kit_provided" boolean DEFAULT false,
    "member_present" boolean DEFAULT false,
    "max_participants" integer,
    "checklist_progress" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "events_event_type_check" CHECK (("event_type" = ANY (ARRAY['regular'::"text", 'neighborhood'::"text"])))
);


ALTER TABLE "public"."events" OWNER TO "postgres";


COMMENT ON COLUMN "public"."events"."max_participants" IS 'Nombre maximum de participants autorisés pour cet événement. NULL signifie pas de limite.';



COMMENT ON COLUMN "public"."events"."checklist_progress" IS 'Suivi des étapes de la checklist d''organisation. Format JSON: {"step1": true, "step2": false, etc.}';



CREATE TABLE IF NOT EXISTS "public"."external_contact_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "group_id" "uuid" NOT NULL,
    "role" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."external_contact_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."external_contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text",
    "photo_url" "text",
    "email" "text",
    "phone" "text",
    "city" "text",
    "note" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."external_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."external_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "logo_url" "text",
    "description" "text",
    "contact_email" "text",
    "city" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."external_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."faq_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "faq_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "icon" "text",
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."faq_categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."faq_categories" IS 'Table contenant les catégories dans une FAQ';



COMMENT ON COLUMN "public"."faq_categories"."icon" IS 'Nom de l''icône lucide-react pour la catégorie';



COMMENT ON COLUMN "public"."faq_categories"."position" IS 'Position de la catégorie dans la FAQ (pour l''ordre)';



CREATE TABLE IF NOT EXISTS "public"."faq_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "faq_category_id" "uuid" NOT NULL,
    "question" "text" NOT NULL,
    "answer" "jsonb" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "faq_items_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending'::"text", 'validated'::"text"])))
);


ALTER TABLE "public"."faq_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."faq_items" IS 'Table contenant les questions/réponses dans une catégorie FAQ';



COMMENT ON COLUMN "public"."faq_items"."question" IS 'Question de la FAQ';



COMMENT ON COLUMN "public"."faq_items"."answer" IS 'Réponse au format EditorJS (OutputData JSON)';



COMMENT ON COLUMN "public"."faq_items"."status" IS 'Statut de l''item: draft (brouillon), pending (à valider), validated (validé)';



COMMENT ON COLUMN "public"."faq_items"."position" IS 'Position de l''item dans la catégorie (pour l''ordre)';



CREATE TABLE IF NOT EXISTS "public"."faqs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."faqs" OWNER TO "postgres";


COMMENT ON TABLE "public"."faqs" IS 'Table contenant les FAQ principales';



COMMENT ON COLUMN "public"."faqs"."slug" IS 'Slug unique pour identifier la FAQ dans l''URL';



CREATE TABLE IF NOT EXISTS "public"."galaxy_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "baseline" "text" NOT NULL,
    "link" "text" NOT NULL,
    "icon" "text" NOT NULL,
    "color" "text",
    "is_external" boolean DEFAULT false NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "icon_fg" "text"
);


ALTER TABLE "public"."galaxy_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."helloasso_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "helloasso_order_id" "text",
    "membership_type" "text" DEFAULT 'standard'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "discord_user_id" "text",
    "discord_role_assigned" boolean DEFAULT false,
    "discord_role_assigned_at" timestamp with time zone
);


ALTER TABLE "public"."helloasso_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invited_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'invited'::"text"
);


ALTER TABLE "public"."invited_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lexicon_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "acronym" "text",
    "content" "jsonb",
    "external_link" "text",
    "logo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lexicon_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."lexicon_entries" IS 'Table contenant les entrées du lexique/dictionnaire d''acronymes';



COMMENT ON COLUMN "public"."lexicon_entries"."name" IS 'Nom complet du terme ou de l''entité';



COMMENT ON COLUMN "public"."lexicon_entries"."acronym" IS 'Acronyme optionnel du terme';



COMMENT ON COLUMN "public"."lexicon_entries"."content" IS 'Définition au format EditorJS (OutputData JSON)';



COMMENT ON COLUMN "public"."lexicon_entries"."external_link" IS 'Lien externe optionnel vers plus d''informations';



COMMENT ON COLUMN "public"."lexicon_entries"."logo_url" IS 'URL optionnelle du logo/image associé';



CREATE TABLE IF NOT EXISTS "public"."lift_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lift_post_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "message" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lift_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lift_posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "day" "text" NOT NULL,
    "time_start" time without time zone,
    "time_end" time without time zone,
    "is_flexible_time" boolean DEFAULT false,
    "recurrence" "text" NOT NULL,
    "departure_location" "text" NOT NULL,
    "arrival_location" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'published'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "date" "date" NOT NULL,
    "available_seats" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "lift_posts_available_seats_check" CHECK ((("available_seats" >= 1) AND ("available_seats" <= 8))),
    CONSTRAINT "lift_posts_recurrence_check" CHECK (("recurrence" = ANY (ARRAY['once'::"text", 'daily'::"text", 'weekly'::"text"]))),
    CONSTRAINT "lift_posts_status_check" CHECK (("status" = ANY (ARRAY['published'::"text", 'unpublished'::"text", 'deleted'::"text"]))),
    CONSTRAINT "lift_posts_type_check" CHECK (("type" = ANY (ARRAY['offer'::"text", 'request'::"text"])))
);


ALTER TABLE "public"."lift_posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."menu_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "label" "text" NOT NULL,
    "page_id" "uuid",
    "external_url" "text",
    "position" integer DEFAULT 0 NOT NULL,
    "parent_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "menu_item_target_check" CHECK (((("page_id" IS NOT NULL) AND ("external_url" IS NULL)) OR (("page_id" IS NULL) AND ("external_url" IS NOT NULL))))
);


ALTER TABLE "public"."menu_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."news" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "excerpt" "text" NOT NULL,
    "content" "text" NOT NULL,
    "date" "date" NOT NULL,
    "category" "text" NOT NULL,
    "image" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'published'::"text" NOT NULL,
    "author_id" "uuid",
    "publication_date" "date",
    "comments_enabled" boolean DEFAULT true,
    "category_id" "uuid",
    "slug" "text",
    "published_at" timestamp with time zone
);


ALTER TABLE "public"."news" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."news_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."news_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."news_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."news_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."news_to_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "news_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."news_to_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."observatory_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "file_name" "text",
    "file_path" "text",
    "file_size" bigint,
    "file_url" "text",
    "mime_type" "text" DEFAULT 'application/pdf'::"text",
    "meeting_date" "date",
    "meeting_type" "text" DEFAULT 'conseil_municipal'::"text",
    "status" "text" DEFAULT 'pending'::"text",
    "extracted_text" "text",
    "analysis_data" "jsonb",
    "error_message" "text",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "rolebase_meeting_id" "text",
    CONSTRAINT "observatory_documents_meeting_type_check" CHECK (("meeting_type" = ANY (ARRAY['conseil_municipal'::"text", 'commission'::"text", 'autre'::"text", 'internal_meeting'::"text"]))),
    CONSTRAINT "observatory_documents_mime_type_check" CHECK (("mime_type" = 'application/pdf'::"text")),
    CONSTRAINT "observatory_documents_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'ocr_processing'::"text", 'ocr_completed'::"text", 'ocr_error'::"text", 'analysis_processing'::"text", 'analysis_completed'::"text", 'analysis_error'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."observatory_documents" OWNER TO "postgres";


COMMENT ON TABLE "public"."observatory_documents" IS 'Documents municipaux uploadés pour analyse';



COMMENT ON COLUMN "public"."observatory_documents"."file_name" IS 'Nom du fichier (NULL pour les réunions internes synchronisées depuis Rolebase)';



COMMENT ON COLUMN "public"."observatory_documents"."file_path" IS 'Chemin du fichier dans le storage (NULL pour les réunions internes synchronisées depuis Rolebase)';



COMMENT ON COLUMN "public"."observatory_documents"."meeting_type" IS 'Type de réunion: conseil_municipal, commission, autre, ou internal_meeting (réunion interne synchronisée depuis Rolebase)';



COMMENT ON COLUMN "public"."observatory_documents"."rolebase_meeting_id" IS 'Identifiant unique de la réunion dans Rolebase, utilisé pour éviter les doublons lors de la synchronisation';



CREATE TABLE IF NOT EXISTS "public"."observatory_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "color_hex" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "observatory_groups_color_hex_check" CHECK (("color_hex" ~ '^#([A-Fa-f0-9]{6})$'::"text"))
);


ALTER TABLE "public"."observatory_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."observatory_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "role" "text" NOT NULL,
    "type" "text" DEFAULT 'elu'::"text",
    "party_affiliation" "text",
    "position_title" "text",
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "group_id" "uuid",
    "avatar_path" "text",
    CONSTRAINT "observatory_participants_type_check" CHECK (("type" = ANY (ARRAY['elu'::"text", 'citoyen'::"text", 'expert'::"text", 'autre'::"text"])))
);


ALTER TABLE "public"."observatory_participants" OWNER TO "postgres";


COMMENT ON TABLE "public"."observatory_participants" IS 'Participants identifiés (élus, citoyens, experts)';



COMMENT ON COLUMN "public"."observatory_participants"."avatar_path" IS 'Chemin du fichier avatar dans le bucket avatars';



CREATE TABLE IF NOT EXISTS "public"."observatory_positions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "subject_id" "uuid" NOT NULL,
    "participant_id" "uuid",
    "content" "text" NOT NULL,
    "position" "text",
    "context" "text",
    "page_number" integer,
    "confidence_score" numeric(3,2),
    "extracted_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "observatory_positions_confidence_score_check" CHECK ((("confidence_score" >= (0)::numeric) AND ("confidence_score" <= (1)::numeric))),
    CONSTRAINT "observatory_positions_position_check" CHECK (("position" = ANY (ARRAY['pour'::"text", 'contre'::"text", 'neutre'::"text", 'question'::"text"])))
);


ALTER TABLE "public"."observatory_positions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."observatory_subjects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "keywords" "text"[],
    "status" "text" DEFAULT 'active'::"text",
    "first_mention_date" "date",
    "last_mention_date" "date",
    "total_discussions" integer DEFAULT 0,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "observatory_subjects_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'closed'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."observatory_subjects" OWNER TO "postgres";


COMMENT ON TABLE "public"."observatory_subjects" IS 'Sujets et projets identifiés dans les documents';



CREATE TABLE IF NOT EXISTS "public"."pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "content" "text" NOT NULL,
    "parent_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'published'::"text" NOT NULL
);


ALTER TABLE "public"."pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "email" "text",
    "is_member" boolean DEFAULT false,
    "avatar_url" "text",
    "theme_preference" "text",
    CONSTRAINT "profiles_theme_preference_check" CHECK (("theme_preference" = ANY (ARRAY['light'::"text", 'dark'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."program_comment_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."program_comment_likes" OWNER TO "postgres";


COMMENT ON TABLE "public"."program_comment_likes" IS 'Table des likes sur les commentaires de programme';



CREATE TABLE IF NOT EXISTS "public"."program_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "program_item_id" "uuid",
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "program_point_id" "uuid",
    "parent_comment_id" "uuid",
    "edited_at" timestamp with time zone,
    "flagship_project_id" "uuid",
    CONSTRAINT "check_program_comment_reference" CHECK ((("program_item_id" IS NOT NULL) OR ("flagship_project_id" IS NOT NULL)))
);


ALTER TABLE "public"."program_comments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."program_comments"."parent_comment_id" IS 'Référence vers le commentaire parent si ce commentaire est une réponse';



COMMENT ON COLUMN "public"."program_comments"."edited_at" IS 'Date et heure de la dernière modification du commentaire';



COMMENT ON COLUMN "public"."program_comments"."flagship_project_id" IS 'Référence vers le projet phare si ce commentaire est associé à un projet phare';



CREATE TABLE IF NOT EXISTS "public"."program_competent_entities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "logo_url" "text",
    "logo_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."program_competent_entities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."program_flagship_projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "jsonb",
    "image_url" "text",
    "image_path" "text",
    "position" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "effects" "jsonb" DEFAULT '[]'::"jsonb",
    "timeline" "jsonb" DEFAULT '[]'::"jsonb",
    "file_url" "text",
    "file_path" "text",
    "file_label" "text",
    "timeline_horizon" "text" DEFAULT 'Début de mandat'::"text"
);


ALTER TABLE "public"."program_flagship_projects" OWNER TO "postgres";


COMMENT ON COLUMN "public"."program_flagship_projects"."effects" IS 'Liste ordonnée d''effets: [{id, name, icon?, color}]';



COMMENT ON COLUMN "public"."program_flagship_projects"."timeline" IS 'Liste ordonnée d''événements: [{id, name, icon?, date_text}]';



COMMENT ON COLUMN "public"."program_flagship_projects"."file_url" IS 'URL publique du fichier détaillé du projet';



COMMENT ON COLUMN "public"."program_flagship_projects"."file_path" IS 'Chemin du fichier dans le bucket Supabase';



COMMENT ON COLUMN "public"."program_flagship_projects"."file_label" IS 'Label personnalisé pour le fichier téléchargeable';



CREATE TABLE IF NOT EXISTS "public"."program_general" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "file" "text",
    "file_path" "text"
);


ALTER TABLE "public"."program_general" OWNER TO "postgres";


COMMENT ON TABLE "public"."program_general" IS 'Stores the general presentation text for the political program';



COMMENT ON COLUMN "public"."program_general"."file" IS 'Public URL of the downloadable program PDF';



COMMENT ON COLUMN "public"."program_general"."file_path" IS 'Storage object path in bucket program_files for the program PDF';



CREATE TABLE IF NOT EXISTS "public"."program_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "icon" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image" "text",
    "content" "text" DEFAULT ''::"text",
    "position" smallint,
    "slug" "text" NOT NULL
);


ALTER TABLE "public"."program_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."program_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "program_item_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "program_point_id" "uuid"
);


ALTER TABLE "public"."program_likes" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."program_points_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."program_points_number_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."program_points" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "program_item_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title" "text" DEFAULT 'Nouveau point'::"text" NOT NULL,
    "files" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'draft'::"text",
    "files_metadata" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "competent_entity_id" "uuid",
    "content" "jsonb",
    "number" integer DEFAULT "nextval"('"public"."program_points_number_seq"'::"regclass") NOT NULL,
    CONSTRAINT "program_points_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending'::"text", 'to_discuss'::"text", 'validated'::"text"])))
);


ALTER TABLE "public"."program_points" OWNER TO "postgres";


COMMENT ON COLUMN "public"."program_points"."content" IS 'Contenu au format EditorJS (JSON). Remplace l''ancien format Markdown.';



COMMENT ON COLUMN "public"."program_points"."number" IS 'Numéro unique attribué à la création, non modifiable.';



CREATE TABLE IF NOT EXISTS "public"."project_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."project_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "image" "text",
    "contact_info" "text",
    "contact_email" "text",
    "status" "text" DEFAULT 'active'::"text",
    "is_featured" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sort_order" integer DEFAULT 0,
    "url" "text",
    "development_status" "text" DEFAULT 'active'::"text" NOT NULL,
    CONSTRAINT "projects_development_status_check" CHECK (("development_status" = ANY (ARRAY['active'::"text", 'development'::"text"])))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proxy_matches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "requester_id" "uuid" NOT NULL,
    "volunteer_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "confirmed_at" timestamp with time zone,
    "confirmed_by" "uuid",
    CONSTRAINT "proxy_matches_check" CHECK (("requester_id" <> "volunteer_id")),
    CONSTRAINT "proxy_matches_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text"])))
);


ALTER TABLE "public"."proxy_matches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."proxy_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type" "text" NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "national_elector_number" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "email" "text" NOT NULL,
    "voting_bureau" smallint,
    "support_committee_consent" boolean DEFAULT true NOT NULL,
    "newsletter_consent" boolean DEFAULT true NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "disabled" boolean DEFAULT false NOT NULL,
    CONSTRAINT "proxy_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'matched'::"text"]))),
    CONSTRAINT "proxy_requests_type_check" CHECK (("type" = ANY (ARRAY['requester'::"text", 'volunteer'::"text"]))),
    CONSTRAINT "proxy_requests_voting_bureau_check" CHECK (("voting_bureau" = ANY (ARRAY[1, 2, 3])))
);


ALTER TABLE "public"."proxy_requests" OWNER TO "postgres";


COMMENT ON TABLE "public"."proxy_requests" IS 'Demandes et propositions de procuration. Données conservées pour le matching uniquement (pas de pièces d''identité). Prévoir suppression après l''élection.';



COMMENT ON COLUMN "public"."proxy_requests"."disabled" IS 'Si true, la personne est exclue des listes de matching (désactivée par l''admin).';



CREATE TABLE IF NOT EXISTS "public"."support_committee" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "city" "text",
    "subscribed_to_newsletter" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."support_committee" OWNER TO "postgres";


ALTER TABLE "public"."support_committee" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."support_committee_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "role" "text",
    "bio" "text",
    "image" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_board_member" boolean DEFAULT false,
    "is_elected" boolean DEFAULT false,
    "profession" "text",
    "phone" "text",
    "email" "text",
    "gender" "text",
    "birth_date" "date",
    "address" "text",
    "latitude" double precision,
    "longitude" double precision,
    "education_level" "public"."education_level",
    "max_engagement_level" "public"."max_engagement_level",
    "vignoble_arrival_year" integer,
    "national_elector_number" "text",
    CONSTRAINT "team_members_gender_check" CHECK (("gender" = ANY (ARRAY['homme'::"text", 'femme'::"text", 'autre'::"text"]))),
    CONSTRAINT "team_members_vignoble_arrival_year_check" CHECK ((("vignoble_arrival_year" >= 1900) AND (("vignoble_arrival_year")::numeric <= EXTRACT(year FROM CURRENT_DATE))))
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


COMMENT ON COLUMN "public"."team_members"."address" IS 'Adresse postale complète du membre';



COMMENT ON COLUMN "public"."team_members"."latitude" IS 'Latitude calculée automatiquement depuis l''adresse via Google Maps API';



COMMENT ON COLUMN "public"."team_members"."longitude" IS 'Longitude calculée automatiquement depuis l''adresse via Google Maps API';



COMMENT ON COLUMN "public"."team_members"."education_level" IS 'Niveau d''étude du membre (peut être null)';



COMMENT ON COLUMN "public"."team_members"."max_engagement_level" IS 'Niveau d''engagement maximum envisagé sur la liste électorale (peut être null). Si la position sur la liste est supérieure, la carte sera surlignée en rouge. Si inférieure ou égale, en bleu.';



COMMENT ON COLUMN "public"."team_members"."vignoble_arrival_year" IS 'Année d''arrivée dans le vignoble nantais. Utilisé pour analyser l''ancrage territorial des membres de la liste électorale';



COMMENT ON COLUMN "public"."team_members"."national_elector_number" IS 'Numéro national d''électeur (carte électorale), optionnel.';



CREATE TABLE IF NOT EXISTS "public"."thematic_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "color" "text",
    "icon" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "acronym" "text",
    "is_commission" boolean DEFAULT false NOT NULL,
    "parent_role_id" "uuid"
);


ALTER TABLE "public"."thematic_roles" OWNER TO "postgres";


COMMENT ON TABLE "public"."thematic_roles" IS 'Rôles thématiques pour les membres de la liste électorale';



CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."citizen_committees"
    ADD CONSTRAINT "citizen_committees_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_comment_id_user_id_key" UNIQUE ("comment_id", "user_id");



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comment_views"
    ADD CONSTRAINT "comment_views_comment_id_user_id_comment_type_key" UNIQUE ("comment_id", "user_id", "comment_type");



ALTER TABLE ONLY "public"."comment_views"
    ADD CONSTRAINT "comment_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."committee_members"
    ADD CONSTRAINT "committee_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."committee_works"
    ADD CONSTRAINT "committee_works_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."electoral_list_members"
    ADD CONSTRAINT "electoral_list_members_electoral_list_id_position_key" UNIQUE ("electoral_list_id", "position");



ALTER TABLE ONLY "public"."electoral_list_members"
    ADD CONSTRAINT "electoral_list_members_electoral_list_id_team_member_id_key" UNIQUE ("electoral_list_id", "team_member_id");



ALTER TABLE ONLY "public"."electoral_list_members"
    ADD CONSTRAINT "electoral_list_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."electoral_list"
    ADD CONSTRAINT "electoral_list_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."electoral_member_roles"
    ADD CONSTRAINT "electoral_member_roles_electoral_list_member_id_thematic_ro_key" UNIQUE ("electoral_list_member_id", "thematic_role_id");



ALTER TABLE ONLY "public"."electoral_member_roles"
    ADD CONSTRAINT "electoral_member_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_user_id_event_id_key" UNIQUE ("user_id", "event_id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_contact_groups"
    ADD CONSTRAINT "external_contact_groups_contact_id_group_id_key" UNIQUE ("contact_id", "group_id");



ALTER TABLE ONLY "public"."external_contact_groups"
    ADD CONSTRAINT "external_contact_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_contacts"
    ADD CONSTRAINT "external_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_groups"
    ADD CONSTRAINT "external_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."faq_categories"
    ADD CONSTRAINT "faq_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."faq_items"
    ADD CONSTRAINT "faq_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."faqs"
    ADD CONSTRAINT "faqs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."faqs"
    ADD CONSTRAINT "faqs_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."galaxy_items"
    ADD CONSTRAINT "galaxy_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."helloasso_memberships"
    ADD CONSTRAINT "helloasso_memberships_helloasso_order_id_key" UNIQUE ("helloasso_order_id");



ALTER TABLE ONLY "public"."helloasso_memberships"
    ADD CONSTRAINT "helloasso_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invited_users"
    ADD CONSTRAINT "invited_users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."invited_users"
    ADD CONSTRAINT "invited_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lexicon_entries"
    ADD CONSTRAINT "lexicon_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lift_messages"
    ADD CONSTRAINT "lift_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lift_posts"
    ADD CONSTRAINT "lift_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."news_categories"
    ADD CONSTRAINT "news_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."news_categories"
    ADD CONSTRAINT "news_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."news"
    ADD CONSTRAINT "news_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."news_tags"
    ADD CONSTRAINT "news_tags_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."news_tags"
    ADD CONSTRAINT "news_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."news_to_tags"
    ADD CONSTRAINT "news_to_tags_news_id_tag_id_key" UNIQUE ("news_id", "tag_id");



ALTER TABLE ONLY "public"."news_to_tags"
    ADD CONSTRAINT "news_to_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."observatory_documents"
    ADD CONSTRAINT "observatory_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."observatory_groups"
    ADD CONSTRAINT "observatory_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."observatory_participants"
    ADD CONSTRAINT "observatory_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."observatory_positions"
    ADD CONSTRAINT "observatory_positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."observatory_subjects"
    ADD CONSTRAINT "observatory_subjects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pages"
    ADD CONSTRAINT "pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pages"
    ADD CONSTRAINT "pages_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."program_comment_likes"
    ADD CONSTRAINT "program_comment_likes_comment_id_user_id_key" UNIQUE ("comment_id", "user_id");



ALTER TABLE ONLY "public"."program_comment_likes"
    ADD CONSTRAINT "program_comment_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."program_comments"
    ADD CONSTRAINT "program_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."program_competent_entities"
    ADD CONSTRAINT "program_competent_entities_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."program_competent_entities"
    ADD CONSTRAINT "program_competent_entities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."program_flagship_projects"
    ADD CONSTRAINT "program_flagship_projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."program_general"
    ADD CONSTRAINT "program_general_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."program_items"
    ADD CONSTRAINT "program_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."program_items"
    ADD CONSTRAINT "program_items_slug_unique" UNIQUE ("slug");



ALTER TABLE ONLY "public"."program_likes"
    ADD CONSTRAINT "program_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."program_likes"
    ADD CONSTRAINT "program_likes_unique_like" UNIQUE ("program_item_id", "user_id", "program_point_id");



ALTER TABLE ONLY "public"."program_points"
    ADD CONSTRAINT "program_points_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_likes"
    ADD CONSTRAINT "project_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_likes"
    ADD CONSTRAINT "project_likes_project_id_user_id_key" UNIQUE ("project_id", "user_id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proxy_matches"
    ADD CONSTRAINT "proxy_matches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."proxy_matches"
    ADD CONSTRAINT "proxy_matches_requester_id_key" UNIQUE ("requester_id");



ALTER TABLE ONLY "public"."proxy_matches"
    ADD CONSTRAINT "proxy_matches_volunteer_id_key" UNIQUE ("volunteer_id");



ALTER TABLE ONLY "public"."proxy_requests"
    ADD CONSTRAINT "proxy_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."support_committee"
    ADD CONSTRAINT "support_committee_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."support_committee"
    ADD CONSTRAINT "support_committee_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."thematic_roles"
    ADD CONSTRAINT "thematic_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



CREATE INDEX "idx_comment_likes_comment_id" ON "public"."comment_likes" USING "btree" ("comment_id");



CREATE INDEX "idx_comment_likes_user_id" ON "public"."comment_likes" USING "btree" ("user_id");



CREATE INDEX "idx_comment_views_comment_id" ON "public"."comment_views" USING "btree" ("comment_id");



CREATE INDEX "idx_comment_views_comment_type" ON "public"."comment_views" USING "btree" ("comment_type");



CREATE INDEX "idx_comment_views_user_comment_type" ON "public"."comment_views" USING "btree" ("user_id", "comment_type");



CREATE INDEX "idx_comment_views_user_id" ON "public"."comment_views" USING "btree" ("user_id");



CREATE INDEX "idx_comments_edited_at" ON "public"."comments" USING "btree" ("edited_at") WHERE ("edited_at" IS NOT NULL);



CREATE INDEX "idx_comments_parent_comment_id" ON "public"."comments" USING "btree" ("parent_comment_id");



CREATE INDEX "idx_electoral_list_is_active" ON "public"."electoral_list" USING "btree" ("is_active");



CREATE INDEX "idx_electoral_list_members_list_id" ON "public"."electoral_list_members" USING "btree" ("electoral_list_id");



CREATE INDEX "idx_electoral_list_members_position" ON "public"."electoral_list_members" USING "btree" ("electoral_list_id", "position");



CREATE INDEX "idx_electoral_member_roles_list_member_id" ON "public"."electoral_member_roles" USING "btree" ("electoral_list_member_id");



CREATE INDEX "idx_event_registrations_additional_guests" ON "public"."event_registrations" USING "btree" ("event_id", "additional_guests");



CREATE INDEX "idx_events_coordinates" ON "public"."events" USING "btree" ("latitude", "longitude") WHERE (("latitude" IS NOT NULL) AND ("longitude" IS NOT NULL));



CREATE INDEX "idx_events_event_type" ON "public"."events" USING "btree" ("event_type");



CREATE INDEX "idx_external_contact_groups_contact_id" ON "public"."external_contact_groups" USING "btree" ("contact_id");



CREATE INDEX "idx_external_contact_groups_group_id" ON "public"."external_contact_groups" USING "btree" ("group_id");



CREATE INDEX "idx_external_contacts_city" ON "public"."external_contacts" USING "btree" ("city");



CREATE INDEX "idx_external_contacts_first_name" ON "public"."external_contacts" USING "btree" ("first_name");



CREATE INDEX "idx_external_contacts_last_name" ON "public"."external_contacts" USING "btree" ("last_name");



CREATE INDEX "idx_external_contacts_tags" ON "public"."external_contacts" USING "gin" ("tags");



CREATE INDEX "idx_external_groups_city" ON "public"."external_groups" USING "btree" ("city");



CREATE INDEX "idx_external_groups_name" ON "public"."external_groups" USING "btree" ("name");



CREATE INDEX "idx_external_groups_tags" ON "public"."external_groups" USING "gin" ("tags");



CREATE INDEX "idx_faq_categories_faq_id" ON "public"."faq_categories" USING "btree" ("faq_id");



CREATE INDEX "idx_faq_categories_position" ON "public"."faq_categories" USING "btree" ("faq_id", "position");



CREATE INDEX "idx_faq_items_category_id" ON "public"."faq_items" USING "btree" ("faq_category_id");



CREATE INDEX "idx_faq_items_position" ON "public"."faq_items" USING "btree" ("faq_category_id", "position");



CREATE INDEX "idx_faq_items_status" ON "public"."faq_items" USING "btree" ("status");



CREATE INDEX "idx_faqs_slug" ON "public"."faqs" USING "btree" ("slug");



CREATE INDEX "idx_helloasso_memberships_discord_user_id" ON "public"."helloasso_memberships" USING "btree" ("discord_user_id");



CREATE INDEX "idx_helloasso_memberships_email" ON "public"."helloasso_memberships" USING "btree" ("email");



CREATE INDEX "idx_helloasso_memberships_order_id" ON "public"."helloasso_memberships" USING "btree" ("helloasso_order_id");



CREATE INDEX "idx_lexicon_entries_acronym" ON "public"."lexicon_entries" USING "btree" ("acronym") WHERE ("acronym" IS NOT NULL);



CREATE INDEX "idx_lexicon_entries_name" ON "public"."lexicon_entries" USING "btree" ("name");



CREATE INDEX "idx_news_published_at" ON "public"."news" USING "btree" ("published_at");



CREATE INDEX "idx_observatory_documents_meeting_date" ON "public"."observatory_documents" USING "btree" ("meeting_date");



CREATE INDEX "idx_observatory_documents_meeting_type" ON "public"."observatory_documents" USING "btree" ("meeting_type");



CREATE UNIQUE INDEX "idx_observatory_documents_rolebase_meeting_id" ON "public"."observatory_documents" USING "btree" ("rolebase_meeting_id") WHERE ("rolebase_meeting_id" IS NOT NULL);



CREATE INDEX "idx_observatory_documents_status" ON "public"."observatory_documents" USING "btree" ("status");



CREATE INDEX "idx_observatory_participants_active" ON "public"."observatory_participants" USING "btree" ("is_active");



CREATE INDEX "idx_observatory_participants_type" ON "public"."observatory_participants" USING "btree" ("type");



CREATE INDEX "idx_observatory_positions_document" ON "public"."observatory_positions" USING "btree" ("document_id");



CREATE INDEX "idx_observatory_positions_participant" ON "public"."observatory_positions" USING "btree" ("participant_id");



CREATE INDEX "idx_observatory_positions_position" ON "public"."observatory_positions" USING "btree" ("position");



CREATE INDEX "idx_observatory_positions_subject" ON "public"."observatory_positions" USING "btree" ("subject_id");



CREATE INDEX "idx_observatory_subjects_category" ON "public"."observatory_subjects" USING "btree" ("category");



CREATE INDEX "idx_observatory_subjects_fts" ON "public"."observatory_subjects" USING "gin" ("to_tsvector"('"french"'::"regconfig", (("title" || ' '::"text") || COALESCE("description", ''::"text"))));



CREATE INDEX "idx_observatory_subjects_keywords" ON "public"."observatory_subjects" USING "gin" ("keywords");



CREATE INDEX "idx_observatory_subjects_status" ON "public"."observatory_subjects" USING "btree" ("status");



CREATE INDEX "idx_program_comment_likes_comment_id" ON "public"."program_comment_likes" USING "btree" ("comment_id");



CREATE INDEX "idx_program_comment_likes_user_id" ON "public"."program_comment_likes" USING "btree" ("user_id");



CREATE INDEX "idx_program_comments_edited_at" ON "public"."program_comments" USING "btree" ("edited_at") WHERE ("edited_at" IS NOT NULL);



CREATE INDEX "idx_program_comments_flagship_project_id" ON "public"."program_comments" USING "btree" ("flagship_project_id") WHERE ("flagship_project_id" IS NOT NULL);



CREATE INDEX "idx_program_comments_parent_comment_id" ON "public"."program_comments" USING "btree" ("parent_comment_id");



CREATE INDEX "idx_program_items_slug" ON "public"."program_items" USING "btree" ("slug");



CREATE INDEX "idx_program_points_content" ON "public"."program_points" USING "gin" ("content");



CREATE INDEX "idx_program_points_item_status" ON "public"."program_points" USING "btree" ("program_item_id", "status");



CREATE INDEX "idx_program_points_number" ON "public"."program_points" USING "btree" ("number");



CREATE INDEX "idx_program_points_status" ON "public"."program_points" USING "btree" ("status");



CREATE INDEX "idx_proxy_matches_requester" ON "public"."proxy_matches" USING "btree" ("requester_id");



CREATE INDEX "idx_proxy_matches_status" ON "public"."proxy_matches" USING "btree" ("status");



CREATE INDEX "idx_proxy_matches_volunteer" ON "public"."proxy_matches" USING "btree" ("volunteer_id");



CREATE INDEX "idx_proxy_requests_created_at" ON "public"."proxy_requests" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_proxy_requests_disabled" ON "public"."proxy_requests" USING "btree" ("disabled") WHERE ("disabled" = false);



CREATE INDEX "idx_proxy_requests_status" ON "public"."proxy_requests" USING "btree" ("status");



CREATE INDEX "idx_proxy_requests_type" ON "public"."proxy_requests" USING "btree" ("type");



CREATE INDEX "idx_thematic_roles_sort_order" ON "public"."thematic_roles" USING "btree" ("sort_order");



CREATE UNIQUE INDEX "news_slug_idx" ON "public"."news" USING "btree" ("slug");



CREATE INDEX "program_flagship_projects_position_idx" ON "public"."program_flagship_projects" USING "btree" ("position");



CREATE INDEX "program_points_competent_entity_id_idx" ON "public"."program_points" USING "btree" ("competent_entity_id");



CREATE INDEX "thematic_roles_parent_role_id_idx" ON "public"."thematic_roles" USING "btree" ("parent_role_id");



CREATE OR REPLACE TRIGGER "add_program_team_role_trigger" AFTER INSERT ON "public"."committee_members" FOR EACH ROW EXECUTE FUNCTION "public"."add_program_team_role_on_committee_add"();



CREATE OR REPLACE TRIGGER "ensure_single_active_list" BEFORE INSERT OR UPDATE ON "public"."electoral_list" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_single_active_electoral_list"();



CREATE OR REPLACE TRIGGER "trigger_update_faq_categories_updated_at" BEFORE UPDATE ON "public"."faq_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_faq_categories_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_faq_items_updated_at" BEFORE UPDATE ON "public"."faq_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_faq_items_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_faqs_updated_at" BEFORE UPDATE ON "public"."faqs" FOR EACH ROW EXECUTE FUNCTION "public"."update_faqs_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_helloasso_memberships_updated_at" BEFORE UPDATE ON "public"."helloasso_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."update_helloasso_memberships_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_lexicon_entries_updated_at" BEFORE UPDATE ON "public"."lexicon_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_lexicon_entries_updated_at"();



CREATE OR REPLACE TRIGGER "update_electoral_list_members_updated_at" BEFORE UPDATE ON "public"."electoral_list_members" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_electoral_list_updated_at" BEFORE UPDATE ON "public"."electoral_list" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_external_contacts_updated_at" BEFORE UPDATE ON "public"."external_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_external_groups_updated_at" BEFORE UPDATE ON "public"."external_groups" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_observatory_documents_updated_at" BEFORE UPDATE ON "public"."observatory_documents" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_observatory_participants_updated_at" BEFORE UPDATE ON "public"."observatory_participants" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_observatory_positions_updated_at" BEFORE UPDATE ON "public"."observatory_positions" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_observatory_subjects_updated_at" BEFORE UPDATE ON "public"."observatory_subjects" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_thematic_roles_updated_at" BEFORE UPDATE ON "public"."thematic_roles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_views"
    ADD CONSTRAINT "comment_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."committee_members"
    ADD CONSTRAINT "committee_members_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "public"."citizen_committees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."committee_members"
    ADD CONSTRAINT "committee_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."committee_works"
    ADD CONSTRAINT "committee_works_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "public"."citizen_committees"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."electoral_list_members"
    ADD CONSTRAINT "electoral_list_members_electoral_list_id_fkey" FOREIGN KEY ("electoral_list_id") REFERENCES "public"."electoral_list"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."electoral_list_members"
    ADD CONSTRAINT "electoral_list_members_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "public"."team_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."electoral_member_roles"
    ADD CONSTRAINT "electoral_member_roles_electoral_list_member_id_fkey" FOREIGN KEY ("electoral_list_member_id") REFERENCES "public"."electoral_list_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."electoral_member_roles"
    ADD CONSTRAINT "electoral_member_roles_thematic_role_id_fkey" FOREIGN KEY ("thematic_role_id") REFERENCES "public"."thematic_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_committee_id_fkey" FOREIGN KEY ("committee_id") REFERENCES "public"."citizen_committees"("id");



ALTER TABLE ONLY "public"."external_contact_groups"
    ADD CONSTRAINT "external_contact_groups_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."external_contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."external_contact_groups"
    ADD CONSTRAINT "external_contact_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."external_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."faq_categories"
    ADD CONSTRAINT "faq_categories_faq_id_fkey" FOREIGN KEY ("faq_id") REFERENCES "public"."faqs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."faq_items"
    ADD CONSTRAINT "faq_items_faq_category_id_fkey" FOREIGN KEY ("faq_category_id") REFERENCES "public"."faq_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."news"
    ADD CONSTRAINT "fk_news_author" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."program_comments"
    ADD CONSTRAINT "fk_program_comments_point" FOREIGN KEY ("program_point_id") REFERENCES "public"."program_points"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."program_likes"
    ADD CONSTRAINT "fk_program_likes_point" FOREIGN KEY ("program_point_id") REFERENCES "public"."program_points"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lift_messages"
    ADD CONSTRAINT "lift_messages_lift_post_id_fkey" FOREIGN KEY ("lift_post_id") REFERENCES "public"."lift_posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lift_messages"
    ADD CONSTRAINT "lift_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."lift_posts"
    ADD CONSTRAINT "lift_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_page_id_fkey" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id");



ALTER TABLE ONLY "public"."menu_items"
    ADD CONSTRAINT "menu_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."menu_items"("id");



ALTER TABLE ONLY "public"."news"
    ADD CONSTRAINT "news_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."news_categories"("id");



ALTER TABLE ONLY "public"."news_to_tags"
    ADD CONSTRAINT "news_to_tags_news_id_fkey" FOREIGN KEY ("news_id") REFERENCES "public"."news"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."news_to_tags"
    ADD CONSTRAINT "news_to_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."news_tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."observatory_documents"
    ADD CONSTRAINT "observatory_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."observatory_participants"
    ADD CONSTRAINT "observatory_participants_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."observatory_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."observatory_positions"
    ADD CONSTRAINT "observatory_positions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."observatory_documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."observatory_positions"
    ADD CONSTRAINT "observatory_positions_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "public"."observatory_participants"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."observatory_positions"
    ADD CONSTRAINT "observatory_positions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."observatory_subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pages"
    ADD CONSTRAINT "pages_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."program_comment_likes"
    ADD CONSTRAINT "program_comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."program_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."program_comment_likes"
    ADD CONSTRAINT "program_comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."program_comments"
    ADD CONSTRAINT "program_comments_flagship_project_id_fkey" FOREIGN KEY ("flagship_project_id") REFERENCES "public"."program_flagship_projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."program_comments"
    ADD CONSTRAINT "program_comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."program_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."program_comments"
    ADD CONSTRAINT "program_comments_program_item_id_fkey" FOREIGN KEY ("program_item_id") REFERENCES "public"."program_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."program_comments"
    ADD CONSTRAINT "program_comments_program_point_id_fkey" FOREIGN KEY ("program_point_id") REFERENCES "public"."program_points"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."program_comments"
    ADD CONSTRAINT "program_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."program_likes"
    ADD CONSTRAINT "program_likes_program_item_id_fkey" FOREIGN KEY ("program_item_id") REFERENCES "public"."program_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."program_likes"
    ADD CONSTRAINT "program_likes_program_point_id_fkey" FOREIGN KEY ("program_point_id") REFERENCES "public"."program_points"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."program_likes"
    ADD CONSTRAINT "program_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."program_points"
    ADD CONSTRAINT "program_points_competent_entity_id_fkey" FOREIGN KEY ("competent_entity_id") REFERENCES "public"."program_competent_entities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."program_points"
    ADD CONSTRAINT "program_points_program_item_id_fkey" FOREIGN KEY ("program_item_id") REFERENCES "public"."program_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_likes"
    ADD CONSTRAINT "project_likes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_likes"
    ADD CONSTRAINT "project_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proxy_matches"
    ADD CONSTRAINT "proxy_matches_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."proxy_matches"
    ADD CONSTRAINT "proxy_matches_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "public"."proxy_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."proxy_matches"
    ADD CONSTRAINT "proxy_matches_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "public"."proxy_requests"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."thematic_roles"
    ADD CONSTRAINT "thematic_roles_parent_role_id_fkey" FOREIGN KEY ("parent_role_id") REFERENCES "public"."thematic_roles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Active electoral list is viewable by everyone" ON "public"."electoral_list" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



CREATE POLICY "Admin can delete external_contact_groups" ON "public"."external_contact_groups" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admin can delete external_contacts" ON "public"."external_contacts" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admin can delete external_groups" ON "public"."external_groups" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admin can insert external_contact_groups" ON "public"."external_contact_groups" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admin can insert external_contacts" ON "public"."external_contacts" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admin can insert external_groups" ON "public"."external_groups" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admin can update external_contact_groups" ON "public"."external_contact_groups" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admin can update external_contacts" ON "public"."external_contacts" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admin can update external_groups" ON "public"."external_groups" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins and moderators can manage all committee works" ON "public"."committee_works" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'admin'::"public"."app_role") OR ("user_roles"."role" = 'moderator'::"public"."app_role"))))));



CREATE POLICY "Admins and moderators can manage committee members" ON "public"."committee_members" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'admin'::"public"."app_role") OR ("user_roles"."role" = 'moderator'::"public"."app_role"))))));



CREATE POLICY "Admins and moderators can see all registrations" ON "public"."event_registrations" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'admin'::"public"."app_role") OR ("user_roles"."role" = 'moderator'::"public"."app_role"))))));



CREATE POLICY "Admins can delete proxy_matches" ON "public"."proxy_matches" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can insert proxy_matches" ON "public"."proxy_matches" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can manage all news" ON "public"."news" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can manage galaxy items" ON "public"."galaxy_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can manage settings" ON "public"."app_settings" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can read proxy_matches" ON "public"."proxy_matches" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can read proxy_requests" ON "public"."proxy_requests" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can update all profiles" ON "public"."profiles" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can update proxy_matches" ON "public"."proxy_matches" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Admins can update proxy_requests" ON "public"."proxy_requests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Allow admins and moderators to delete events" ON "public"."events" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'moderator'::"public"."app_role"]))))));



CREATE POLICY "Allow admins and moderators to insert events" ON "public"."events" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'moderator'::"public"."app_role"]))))));



CREATE POLICY "Allow admins and moderators to update events" ON "public"."events" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'moderator'::"public"."app_role"]))))));



CREATE POLICY "Allow admins and program managers to manage program general pre" ON "public"."program_general" USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'program_manager'::"public"."app_role"])))));



CREATE POLICY "Allow admins to delete committees" ON "public"."citizen_committees" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Allow admins to insert committees" ON "public"."citizen_committees" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Allow admins to update committees" ON "public"."citizen_committees" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Allow authenticated users to read program general presentation" ON "public"."program_general" FOR SELECT USING (true);



CREATE POLICY "Allow authenticated users to view committees" ON "public"."citizen_committees" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow public access to published events" ON "public"."events" FOR SELECT USING (("status" = 'published'::"text"));



CREATE POLICY "Allow public read access for citizen_committees" ON "public"."citizen_committees" FOR SELECT USING (true);



CREATE POLICY "Allow public read access for committee_members" ON "public"."committee_members" FOR SELECT USING (true);



CREATE POLICY "Allow public read access for committee_works" ON "public"."committee_works" FOR SELECT USING (true);



CREATE POLICY "Allow public read access for events" ON "public"."events" FOR SELECT USING (true);



CREATE POLICY "Allow public read access for news" ON "public"."news" FOR SELECT USING (true);



CREATE POLICY "Allow public read access for program_items" ON "public"."program_items" FOR SELECT USING (true);



CREATE POLICY "Allow public read access for program_points" ON "public"."program_points" FOR SELECT USING (true);



CREATE POLICY "Allow public read access for team_members" ON "public"."team_members" FOR SELECT USING (true);



CREATE POLICY "Anyone can insert proxy_requests" ON "public"."proxy_requests" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can read projects" ON "public"."projects" FOR SELECT USING (true);



CREATE POLICY "Anyone can read settings" ON "public"."app_settings" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can view active galaxy items" ON "public"."galaxy_items" FOR SELECT USING (("status" = 'active'::"text"));



CREATE POLICY "Anyone can view comment likes" ON "public"."comment_likes" FOR SELECT USING (true);



CREATE POLICY "Anyone can view comments" ON "public"."comments" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Anyone can view committee works" ON "public"."committee_works" FOR SELECT USING (true);



CREATE POLICY "Anyone can view program comment likes" ON "public"."program_comment_likes" FOR SELECT USING (true);



CREATE POLICY "Anyone can view published news" ON "public"."news" FOR SELECT USING (("status" = 'published'::"text"));



CREATE POLICY "Approved program comments are viewable by everyone" ON "public"."program_comments" FOR SELECT USING ((("status" = 'approved'::"text") OR ("auth"."uid"() = "user_id") OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'admin'::"public"."app_role") OR ("user_roles"."role" = 'moderator'::"public"."app_role")))))));



CREATE POLICY "Authenticated users can add comments" ON "public"."comments" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can create their own comment views" ON "public"."comment_views" FOR INSERT WITH CHECK ((("auth"."role"() = 'authenticated'::"text") AND ("auth"."uid"() = "user_id")));



CREATE POLICY "Authenticated users can delete projects" ON "public"."projects" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can delete team_members" ON "public"."team_members" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can insert projects" ON "public"."projects" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can insert team_members" ON "public"."team_members" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Authenticated users can like comments" ON "public"."comment_likes" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can like program comments" ON "public"."program_comment_likes" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Authenticated users can update projects" ON "public"."projects" FOR UPDATE TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can update team_members" ON "public"."team_members" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Committee members can manage their committee works" ON "public"."committee_works" USING ((EXISTS ( SELECT 1
   FROM "public"."committee_members"
  WHERE (("committee_members"."user_id" = "auth"."uid"()) AND ("committee_members"."committee_id" = "committee_works"."committee_id")))));



CREATE POLICY "Competent entities are viewable by everyone" ON "public"."program_competent_entities" FOR SELECT USING (true);



CREATE POLICY "Competent entities can be managed by admins" ON "public"."program_competent_entities" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'program_manager'::"public"."app_role", 'program_team'::"public"."app_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'program_manager'::"public"."app_role", 'program_team'::"public"."app_role"]))))));



CREATE POLICY "Electoral list members are editable by admins" ON "public"."electoral_list_members" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Electoral list members are viewable by admins" ON "public"."electoral_list_members" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Electoral list members are viewable by everyone" ON "public"."electoral_list_members" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."electoral_list"
  WHERE (("electoral_list"."id" = "electoral_list_members"."electoral_list_id") AND ("electoral_list"."is_active" = true)))));



CREATE POLICY "Electoral lists are editable by admins" ON "public"."electoral_list" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Electoral lists are viewable by admins" ON "public"."electoral_list" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Electoral member roles are editable by admins" ON "public"."electoral_member_roles" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Electoral member roles are viewable by admins" ON "public"."electoral_member_roles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Electoral member roles are viewable by everyone" ON "public"."electoral_member_roles" FOR SELECT TO "authenticated", "anon" USING ((EXISTS ( SELECT 1
   FROM ("public"."electoral_list_members"
     JOIN "public"."electoral_list" ON (("electoral_list"."id" = "electoral_list_members"."electoral_list_id")))
  WHERE (("electoral_list_members"."id" = "electoral_member_roles"."electoral_list_member_id") AND ("electoral_list"."is_active" = true)))));



CREATE POLICY "Enable insert for anyone" ON "public"."support_committee" FOR INSERT WITH CHECK (true);



CREATE POLICY "Enable public read access" ON "public"."support_committee" FOR SELECT USING (true);



CREATE POLICY "Everyone can view menu items" ON "public"."menu_items" FOR SELECT USING (true);



CREATE POLICY "Everyone can view published pages" ON "public"."pages" FOR SELECT USING ((("status" = 'published'::"text") OR ("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Lecture documents observatoire" ON "public"."observatory_documents" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Lecture participants observatoire" ON "public"."observatory_participants" FOR SELECT USING (true);



CREATE POLICY "Lecture positions observatoire" ON "public"."observatory_positions" FOR SELECT USING (true);



CREATE POLICY "Lecture publique des FAQ" ON "public"."faqs" FOR SELECT USING (true);



CREATE POLICY "Lecture publique des catégories FAQ" ON "public"."faq_categories" FOR SELECT USING (true);



CREATE POLICY "Lecture publique des entrées du lexique" ON "public"."lexicon_entries" FOR SELECT USING (true);



CREATE POLICY "Lecture publique des items FAQ" ON "public"."faq_items" FOR SELECT USING (true);



CREATE POLICY "Lecture publique documents observatoire" ON "public"."observatory_documents" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Lecture publique sujets observatoire" ON "public"."observatory_subjects" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Lecture sujets observatoire" ON "public"."observatory_subjects" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Les administrateurs peuvent gérer les rôles" ON "public"."user_roles" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "user_roles_1"
  WHERE (("user_roles_1"."user_id" = "auth"."uid"()) AND ("user_roles_1"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Les admins peuvent créer des invitations" ON "public"."invited_users" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Les admins peuvent modifier des invitations" ON "public"."invited_users" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Les admins peuvent supprimer des invitations" ON "public"."invited_users" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Les admins peuvent voir les invitations" ON "public"."invited_users" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Les modérateurs peuvent modérer les commentaires" ON "public"."comments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'moderator'::"public"."app_role") OR ("user_roles"."role" = 'admin'::"public"."app_role"))))));



CREATE POLICY "Les modérateurs peuvent voir tous les commentaires" ON "public"."comments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'moderator'::"public"."app_role") OR ("user_roles"."role" = 'admin'::"public"."app_role"))))));



CREATE POLICY "Les utilisateurs authentifiés peuvent ajouter des likes" ON "public"."project_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Les utilisateurs authentifiés peuvent voir tous les profils" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Les utilisateurs ne peuvent supprimer que leurs propres likes" ON "public"."project_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Les utilisateurs peuvent voir leurs propres commentaires" ON "public"."comments" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Les utilisateurs peuvent voir leurs propres rôles" ON "public"."user_roles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Moderators can delete any program comments" ON "public"."program_comments" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'admin'::"public"."app_role") OR ("user_roles"."role" = 'moderator'::"public"."app_role"))))) OR ("auth"."uid"() = "user_id")));



CREATE POLICY "Only admins can delete menu items" ON "public"."menu_items" FOR DELETE USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = 'admin'::"public"."app_role"))));



CREATE POLICY "Only admins can delete pages" ON "public"."pages" FOR DELETE USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = 'admin'::"public"."app_role"))));



CREATE POLICY "Only admins can edit menu items" ON "public"."menu_items" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = 'admin'::"public"."app_role"))));



CREATE POLICY "Only admins can edit pages" ON "public"."pages" FOR INSERT WITH CHECK (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = 'admin'::"public"."app_role"))));



CREATE POLICY "Only admins can update menu items" ON "public"."menu_items" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = 'admin'::"public"."app_role"))));



CREATE POLICY "Only admins can update pages" ON "public"."pages" FOR UPDATE USING (("auth"."uid"() IN ( SELECT "user_roles"."user_id"
   FROM "public"."user_roles"
  WHERE ("user_roles"."role" = 'admin'::"public"."app_role"))));



CREATE POLICY "Program items are viewable by everyone" ON "public"."program_items" FOR SELECT USING (true);



CREATE POLICY "Program items can be created by admins" ON "public"."program_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'admin'::"public"."app_role") OR ("user_roles"."role" = 'program_manager'::"public"."app_role"))))));



CREATE POLICY "Program items can be deleted by admins" ON "public"."program_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'admin'::"public"."app_role") OR ("user_roles"."role" = 'program_manager'::"public"."app_role"))))));



CREATE POLICY "Program items can be updated by admins" ON "public"."program_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'admin'::"public"."app_role") OR ("user_roles"."role" = 'program_manager'::"public"."app_role"))))));



CREATE POLICY "Program likes are viewable by everyone" ON "public"."program_likes" FOR SELECT USING (true);



CREATE POLICY "Program points are viewable by everyone" ON "public"."program_points" FOR SELECT USING (true);



CREATE POLICY "Program points can be created by admins" ON "public"."program_points" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'admin'::"public"."app_role") OR ("user_roles"."role" = 'program_manager'::"public"."app_role"))))));



CREATE POLICY "Program points can be deleted by admins" ON "public"."program_points" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'admin'::"public"."app_role") OR ("user_roles"."role" = 'program_manager'::"public"."app_role"))))));



CREATE POLICY "Program points can be updated by admins" ON "public"."program_points" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'admin'::"public"."app_role") OR ("user_roles"."role" = 'program_manager'::"public"."app_role"))))));



CREATE POLICY "Public can view published news" ON "public"."news" FOR SELECT USING ((("status" = 'published'::"text") OR ("auth"."uid"() IS NOT NULL)));



CREATE POLICY "Public read access for external_contact_groups" ON "public"."external_contact_groups" FOR SELECT USING (true);



CREATE POLICY "Public read access for external_contacts" ON "public"."external_contacts" FOR SELECT USING (true);



CREATE POLICY "Public read access for external_groups" ON "public"."external_groups" FOR SELECT USING (true);



CREATE POLICY "Seuls les admins peuvent créer des FAQ" ON "public"."faqs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Seuls les admins peuvent créer des catégories FAQ" ON "public"."faq_categories" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Seuls les admins peuvent créer des entrées" ON "public"."lexicon_entries" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Seuls les admins peuvent créer des items FAQ" ON "public"."faq_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Seuls les admins peuvent modifier des FAQ" ON "public"."faqs" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Seuls les admins peuvent modifier des catégories FAQ" ON "public"."faq_categories" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Seuls les admins peuvent modifier des entrées" ON "public"."lexicon_entries" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Seuls les admins peuvent modifier des items FAQ" ON "public"."faq_items" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Seuls les admins peuvent supprimer des FAQ" ON "public"."faqs" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Seuls les admins peuvent supprimer des catégories FAQ" ON "public"."faq_categories" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Seuls les admins peuvent supprimer des entrées" ON "public"."lexicon_entries" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Seuls les admins peuvent supprimer des items FAQ" ON "public"."faq_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Temporary access policy" ON "public"."news" USING (true) WITH CHECK (true);



CREATE POLICY "Temporary admin policy" ON "public"."user_roles" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Thematic roles are editable by admins" ON "public"."thematic_roles" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND ("user_roles"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Thematic roles are viewable by everyone" ON "public"."thematic_roles" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Tout le monde peut voir les commentaires approuvés" ON "public"."comments" FOR SELECT USING (("status" = 'approved'::"text"));



CREATE POLICY "Tout le monde peut voir les likes" ON "public"."project_likes" FOR SELECT USING (true);



CREATE POLICY "Users can create messages" ON "public"."lift_messages" FOR INSERT WITH CHECK (("auth"."uid"() = "sender_id"));



CREATE POLICY "Users can create their own lift posts" ON "public"."lift_posts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own program comments" ON "public"."program_comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own program likes" ON "public"."program_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own comment views" ON "public"."comment_views" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own comments" ON "public"."comments" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own lift posts" ON "public"."lift_posts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own program likes" ON "public"."program_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their registrations" ON "public"."event_registrations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can register for events" ON "public"."event_registrations" FOR INSERT WITH CHECK ((("user_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "event_registrations"."user_id")))));



CREATE POLICY "Users can see all roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can unlike their own likes" ON "public"."comment_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unlike their own program comment likes" ON "public"."program_comment_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own comments" ON "public"."comments" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own lift posts" ON "public"."lift_posts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own pending program comments" ON "public"."program_comments" FOR UPDATE USING (((("auth"."uid"() = "user_id") AND ("status" = 'pending'::"text")) OR (EXISTS ( SELECT 1
   FROM "public"."user_roles"
  WHERE (("user_roles"."user_id" = "auth"."uid"()) AND (("user_roles"."role" = 'admin'::"public"."app_role") OR ("user_roles"."role" = 'moderator'::"public"."app_role")))))));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own registrations" ON "public"."event_registrations" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view committee members" ON "public"."committee_members" FOR SELECT USING (true);



CREATE POLICY "Users can view messages for their posts or messages they sent" ON "public"."lift_messages" FOR SELECT USING ((("sender_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."lift_posts"
  WHERE (("lift_posts"."id" = "lift_messages"."lift_post_id") AND ("lift_posts"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view published lift posts" ON "public"."lift_posts" FOR SELECT USING (("status" = 'published'::"text"));



CREATE POLICY "Users can view their own comment views" ON "public"."comment_views" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their own registrations" ON "public"."event_registrations" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."citizen_committees" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comment_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comment_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."committee_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."committee_works" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."electoral_list" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."electoral_list_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."electoral_member_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."event_registrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."external_contact_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."external_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."external_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."faq_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."faq_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."faqs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."galaxy_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invited_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lexicon_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lift_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lift_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."menu_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."news" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."observatory_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."observatory_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."observatory_positions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."observatory_subjects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."program_comment_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."program_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."program_competent_entities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."program_general" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."program_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."program_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."program_points" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proxy_matches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."proxy_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."support_committee" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."thematic_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Écriture documents observatoire" ON "public"."observatory_documents" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Écriture participants observatoire" ON "public"."observatory_participants" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Écriture positions observatoire" ON "public"."observatory_positions" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Écriture sujets observatoire" ON "public"."observatory_subjects" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."user_roles" "ur"
  WHERE (("ur"."user_id" = "auth"."uid"()) AND ("ur"."role" = 'admin'::"public"."app_role")))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."observatory_documents";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."support_committee";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";




















































































































































































GRANT ALL ON FUNCTION "public"."add_program_team_role_on_committee_add"() TO "anon";
GRANT ALL ON FUNCTION "public"."add_program_team_role_on_committee_add"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_program_team_role_on_committee_add"() TO "service_role";



GRANT ALL ON FUNCTION "public"."convert_markdown_inline_to_html"("text_input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."convert_markdown_inline_to_html"("text_input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."convert_markdown_inline_to_html"("text_input" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."count_program_likes"("program_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."count_program_likes"("program_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_program_likes"("program_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."count_project_likes"("project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."count_project_likes"("project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_project_likes"("project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_single_active_electoral_list"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_single_active_electoral_list"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_single_active_electoral_list"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_roles"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_roles"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_roles"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_user_comment_deletion"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_user_comment_deletion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_user_comment_deletion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_committee_member"("user_id" "uuid", "committee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_committee_member"("user_id" "uuid", "committee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_committee_member"("user_id" "uuid", "committee_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_markdown_content"("content_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_markdown_content"("content_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_markdown_content"("content_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."markdown_to_editorjs_improved"("markdown_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."markdown_to_editorjs_improved"("markdown_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."markdown_to_editorjs_improved"("markdown_text" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_faq_categories_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_faq_categories_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_faq_categories_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_faq_items_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_faq_items_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_faq_items_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_faqs_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_faqs_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_faqs_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_helloasso_memberships_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_helloasso_memberships_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_helloasso_memberships_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_lexicon_entries_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_lexicon_entries_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_lexicon_entries_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_subject_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_subject_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_subject_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_liked_project"("project_id" "uuid", "user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_liked_project"("project_id" "uuid", "user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_liked_project"("project_id" "uuid", "user_id" "uuid") TO "service_role";



























GRANT ALL ON TABLE "public"."app_settings" TO "anon";
GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."app_settings" TO "service_role";



GRANT ALL ON TABLE "public"."citizen_committees" TO "anon";
GRANT ALL ON TABLE "public"."citizen_committees" TO "authenticated";
GRANT ALL ON TABLE "public"."citizen_committees" TO "service_role";



GRANT ALL ON TABLE "public"."comment_likes" TO "anon";
GRANT ALL ON TABLE "public"."comment_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."comment_likes" TO "service_role";



GRANT ALL ON TABLE "public"."comment_views" TO "anon";
GRANT ALL ON TABLE "public"."comment_views" TO "authenticated";
GRANT ALL ON TABLE "public"."comment_views" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."committee_members" TO "anon";
GRANT ALL ON TABLE "public"."committee_members" TO "authenticated";
GRANT ALL ON TABLE "public"."committee_members" TO "service_role";



GRANT ALL ON TABLE "public"."committee_works" TO "anon";
GRANT ALL ON TABLE "public"."committee_works" TO "authenticated";
GRANT ALL ON TABLE "public"."committee_works" TO "service_role";



GRANT ALL ON TABLE "public"."electoral_list" TO "anon";
GRANT ALL ON TABLE "public"."electoral_list" TO "authenticated";
GRANT ALL ON TABLE "public"."electoral_list" TO "service_role";



GRANT ALL ON TABLE "public"."electoral_list_members" TO "anon";
GRANT ALL ON TABLE "public"."electoral_list_members" TO "authenticated";
GRANT ALL ON TABLE "public"."electoral_list_members" TO "service_role";



GRANT ALL ON TABLE "public"."electoral_member_roles" TO "anon";
GRANT ALL ON TABLE "public"."electoral_member_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."electoral_member_roles" TO "service_role";



GRANT ALL ON TABLE "public"."event_registrations" TO "anon";
GRANT ALL ON TABLE "public"."event_registrations" TO "authenticated";
GRANT ALL ON TABLE "public"."event_registrations" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."external_contact_groups" TO "anon";
GRANT ALL ON TABLE "public"."external_contact_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."external_contact_groups" TO "service_role";



GRANT ALL ON TABLE "public"."external_contacts" TO "anon";
GRANT ALL ON TABLE "public"."external_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."external_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."external_groups" TO "anon";
GRANT ALL ON TABLE "public"."external_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."external_groups" TO "service_role";



GRANT ALL ON TABLE "public"."faq_categories" TO "anon";
GRANT ALL ON TABLE "public"."faq_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."faq_categories" TO "service_role";



GRANT ALL ON TABLE "public"."faq_items" TO "anon";
GRANT ALL ON TABLE "public"."faq_items" TO "authenticated";
GRANT ALL ON TABLE "public"."faq_items" TO "service_role";



GRANT ALL ON TABLE "public"."faqs" TO "anon";
GRANT ALL ON TABLE "public"."faqs" TO "authenticated";
GRANT ALL ON TABLE "public"."faqs" TO "service_role";



GRANT ALL ON TABLE "public"."galaxy_items" TO "anon";
GRANT ALL ON TABLE "public"."galaxy_items" TO "authenticated";
GRANT ALL ON TABLE "public"."galaxy_items" TO "service_role";



GRANT ALL ON TABLE "public"."helloasso_memberships" TO "anon";
GRANT ALL ON TABLE "public"."helloasso_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."helloasso_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."invited_users" TO "anon";
GRANT ALL ON TABLE "public"."invited_users" TO "authenticated";
GRANT ALL ON TABLE "public"."invited_users" TO "service_role";



GRANT ALL ON TABLE "public"."lexicon_entries" TO "anon";
GRANT ALL ON TABLE "public"."lexicon_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."lexicon_entries" TO "service_role";



GRANT ALL ON TABLE "public"."lift_messages" TO "anon";
GRANT ALL ON TABLE "public"."lift_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."lift_messages" TO "service_role";



GRANT ALL ON TABLE "public"."lift_posts" TO "anon";
GRANT ALL ON TABLE "public"."lift_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."lift_posts" TO "service_role";



GRANT ALL ON TABLE "public"."menu_items" TO "anon";
GRANT ALL ON TABLE "public"."menu_items" TO "authenticated";
GRANT ALL ON TABLE "public"."menu_items" TO "service_role";



GRANT ALL ON TABLE "public"."news" TO "anon";
GRANT ALL ON TABLE "public"."news" TO "authenticated";
GRANT ALL ON TABLE "public"."news" TO "service_role";



GRANT ALL ON TABLE "public"."news_categories" TO "anon";
GRANT ALL ON TABLE "public"."news_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."news_categories" TO "service_role";



GRANT ALL ON TABLE "public"."news_tags" TO "anon";
GRANT ALL ON TABLE "public"."news_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."news_tags" TO "service_role";



GRANT ALL ON TABLE "public"."news_to_tags" TO "anon";
GRANT ALL ON TABLE "public"."news_to_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."news_to_tags" TO "service_role";



GRANT ALL ON TABLE "public"."observatory_documents" TO "anon";
GRANT ALL ON TABLE "public"."observatory_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."observatory_documents" TO "service_role";



GRANT ALL ON TABLE "public"."observatory_groups" TO "anon";
GRANT ALL ON TABLE "public"."observatory_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."observatory_groups" TO "service_role";



GRANT ALL ON TABLE "public"."observatory_participants" TO "anon";
GRANT ALL ON TABLE "public"."observatory_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."observatory_participants" TO "service_role";



GRANT ALL ON TABLE "public"."observatory_positions" TO "anon";
GRANT ALL ON TABLE "public"."observatory_positions" TO "authenticated";
GRANT ALL ON TABLE "public"."observatory_positions" TO "service_role";



GRANT ALL ON TABLE "public"."observatory_subjects" TO "anon";
GRANT ALL ON TABLE "public"."observatory_subjects" TO "authenticated";
GRANT ALL ON TABLE "public"."observatory_subjects" TO "service_role";



GRANT ALL ON TABLE "public"."pages" TO "anon";
GRANT ALL ON TABLE "public"."pages" TO "authenticated";
GRANT ALL ON TABLE "public"."pages" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."program_comment_likes" TO "anon";
GRANT ALL ON TABLE "public"."program_comment_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."program_comment_likes" TO "service_role";



GRANT ALL ON TABLE "public"."program_comments" TO "anon";
GRANT ALL ON TABLE "public"."program_comments" TO "authenticated";
GRANT ALL ON TABLE "public"."program_comments" TO "service_role";



GRANT ALL ON TABLE "public"."program_competent_entities" TO "anon";
GRANT ALL ON TABLE "public"."program_competent_entities" TO "authenticated";
GRANT ALL ON TABLE "public"."program_competent_entities" TO "service_role";



GRANT ALL ON TABLE "public"."program_flagship_projects" TO "anon";
GRANT ALL ON TABLE "public"."program_flagship_projects" TO "authenticated";
GRANT ALL ON TABLE "public"."program_flagship_projects" TO "service_role";



GRANT ALL ON TABLE "public"."program_general" TO "anon";
GRANT ALL ON TABLE "public"."program_general" TO "authenticated";
GRANT ALL ON TABLE "public"."program_general" TO "service_role";



GRANT ALL ON TABLE "public"."program_items" TO "anon";
GRANT ALL ON TABLE "public"."program_items" TO "authenticated";
GRANT ALL ON TABLE "public"."program_items" TO "service_role";



GRANT ALL ON TABLE "public"."program_likes" TO "anon";
GRANT ALL ON TABLE "public"."program_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."program_likes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."program_points_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."program_points_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."program_points_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."program_points" TO "anon";
GRANT ALL ON TABLE "public"."program_points" TO "authenticated";
GRANT ALL ON TABLE "public"."program_points" TO "service_role";



GRANT ALL ON TABLE "public"."project_likes" TO "anon";
GRANT ALL ON TABLE "public"."project_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."project_likes" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."proxy_matches" TO "anon";
GRANT ALL ON TABLE "public"."proxy_matches" TO "authenticated";
GRANT ALL ON TABLE "public"."proxy_matches" TO "service_role";



GRANT ALL ON TABLE "public"."proxy_requests" TO "anon";
GRANT ALL ON TABLE "public"."proxy_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."proxy_requests" TO "service_role";



GRANT ALL ON TABLE "public"."support_committee" TO "anon";
GRANT ALL ON TABLE "public"."support_committee" TO "authenticated";
GRANT ALL ON TABLE "public"."support_committee" TO "service_role";



GRANT ALL ON SEQUENCE "public"."support_committee_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."support_committee_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."support_committee_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."thematic_roles" TO "anon";
GRANT ALL ON TABLE "public"."thematic_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."thematic_roles" TO "service_role";



GRANT ALL ON TABLE "public"."user_roles" TO "anon";
GRANT ALL ON TABLE "public"."user_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_roles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






























