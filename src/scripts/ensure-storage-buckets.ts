/**
 * Crée les buckets Storage Supabase s'ils n'existent pas.
 * Utilisé après `supabase start` (local) ou pour un projet hébergé.
 *
 * Variables d'environnement (la clé service_role est requise, la clé anon est soumise à la RLS) :
 * - API_URL ou VITE_SUPABASE_URL ou SUPABASE_URL
 * - SERVICE_ROLE_KEY ou SUPABASE_SERVICE_ROLE_KEY (obligatoire pour créer les buckets)
 *
 * En local : `make supabase_ensure_buckets` injecte automatiquement API_URL et SERVICE_ROLE_KEY
 * depuis `supabase status -o env`.
 *
 * Usage : yarn ensure-buckets   ou   make supabase_ensure_buckets
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config();

const SUPABASE_URL =
  process.env.API_URL ??
  process.env.VITE_SUPABASE_URL ??
  process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY;
const isServiceRole =
  !!process.env.SERVICE_ROLE_KEY || !!process.env.SUPABASE_SERVICE_ROLE_KEY;

const BUCKETS: { name: string; public: boolean }[] = [
  { name: "site-assets", public: true },
  { name: "avatars", public: true },
  { name: "news_images", public: true },
  { name: "program_files", public: true },
  { name: "team-members", public: true },
  { name: "public", public: true },
  { name: "event_images", public: true },
  { name: "cms_assets", public: true },
  { name: "external-directory", public: true },
  { name: "program-files", public: true },
  { name: "team-member-documents", public: false },
];

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      "❌ Définir l’URL (API_URL ou VITE_SUPABASE_URL) et la clé service_role (SERVICE_ROLE_KEY ou SUPABASE_SERVICE_ROLE_KEY)."
    );
    console.error(
      "   En local : lancez « make supabase_ensure_buckets » (injecte les variables depuis supabase status)."
    );
    process.exit(1);
  }

  if (!isServiceRole) {
    console.error(
      "❌ La clé anon ne peut pas créer de buckets (RLS). Utilisez la clé service_role."
    );
    console.error(
      "   En local : « make supabase_ensure_buckets ». En hébergé : SUPABASE_SERVICE_ROLE_KEY dans .env."
    );
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (const { name, public: isPublic } of BUCKETS) {
    const { data: existing } = await supabase.storage.getBucket(name);
    if (existing) {
      console.log(`✓ Bucket "${name}" existe déjà`);
      continue;
    }
    const { error } = await supabase.storage.createBucket(name, { public: isPublic });
    if (error) {
      console.error(`✗ Bucket "${name}": ${error.message}`);
      continue;
    }
    console.log(`✓ Bucket "${name}" créé`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
