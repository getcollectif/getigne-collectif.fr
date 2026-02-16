# Bienvenue

## Infos du projet

**URL**: https://getigne-collectif.fr

## Installation

```bash
yarn install
```

## Démarrage

```bash
yarn dev
```

## Déploiement

Just push and deploy to Vercel

## Supabase

Le projet utilise Supabase pour plusieurs choses :

- l'authentification
- les données liées à notre collectif, notamment :
  - l'association / collectif
  - le programme
  - les commissions
  - l'agenda (événements) et inscriptions
  - le blog (actualités) et commentaires
  - ...
- fonctions (webhooks et API) pour :
  - synchroniser les calendriers
  - générer les flux RSS
  - notifications Discord
  - formulaire de contact
  - invitation d'utilisateur

### Supabase local (CLI + Makefile)

Pour développer avec une base locale et/ou importer les données de la prod en local (sans toucher à la prod) :

1. **Prérequis** :
   - [Supabase CLI](https://supabase.com/docs/guides/cli) installée
   - **Docker** (pour la restauration des données : le Makefile lance `psql` via un conteneur `postgres:15`, pas besoin d’installer PostgreSQL en local)

2. **Lier le projet prod** (une fois) :
   ```bash
   supabase link --project-ref jqpivqdwblrccjzicnxn
   ```

3. **Commandes Makefile** :
   - `make supabase_start` : démarre Supabase local (DB, Auth, Storage…).
   - `make supabase_stop` : arrête la stack locale.
   - `make supabase_status` : affiche les URLs et infos locales.
   - `make supabase_db_dump_prod` : dump des **données** de la prod (lecture seule) → crée `prod_data.sql`.
   - `make supabase_db_restore_to_local` : reset de la base locale (migrations) puis restauration de `prod_data.sql` (via Docker).
   - `make supabase_db_import_prod_to_local` : enchaîne dump prod → reset local → restauration (import complet).
   - `make supabase_functions_serve` / `make supabase_functions_sync` : sert les Edge Functions en local.

4. **Import prod → local** : lancer `make supabase_start`, puis `make supabase_db_import_prod_to_local`. La prod n’est jamais modifiée (dump en lecture seule). La restauration utilise un conteneur Docker en `--network host` pour atteindre le Postgres Supabase local sur le port 54322.

5. **Utiliser la base locale depuis le front** : si tu pointes `VITE_SUPABASE_URL` vers `http://localhost:54321`, tu **dois aussi** utiliser la **clé anon locale** pour `VITE_SUPABASE_ANON_KEY`. La clé anon de prod est un JWT signé par le projet prod ; en local, PostgREST rejette cette signature → 401 en anonyme (une fois connecté, le JWT est émis par Auth local, donc ça fonctionne). Récupère l’URL et la clé locale avec `make supabase_status` (ou `yarn supabase status`) et mets-les dans `.env.local` :
   ```
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_ANON_KEY=<Publishable / anon key affichée par make supabase_status>
   ```

Les fichiers `prod_data.sql` et `schema.sql` sont ignorés par git.

### Déploiement des fonctions

Pour déployer les fonctions, suivez la documentation [Supabase](https://supabase.com/docs/guides/functions) puis, une fois la fonction créé dans le répertoire `supabase/functions`, déployez-la comme ceci :

```
SUPABASE_ACCESS_TOKEN=<access-token> supabase functions deploy <nom-de-la-fonction> --project-ref <project-id>
```
> - `jqpivqdwblrccjzicnxn` est le project-id de notre projet
> - les access token peuvent être générés dans [Accounts > Access Tokens](https://supabase.com/dashboard/account/tokens)

## Variables d'environnement

### Frontend (Vite)

À définir dans un fichier `.env.local` (non commité) à la racine :

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_PUBLIC_URL=https://getigne-collectif.fr
VITE_DISCORD_INVITE_URL=
VITE_HELLOASSO_JOIN_URL=

# Configuration PostHog (analytics)
VITE_PUBLIC_POSTHOG_KEY=
VITE_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

- `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont requis pour le client. En dev local avec Supabase en local, utilise les valeurs affichées par `make supabase_status` (voir section « Supabase local »).
- `VITE_PUBLIC_POSTHOG_KEY` est requis pour activer PostHog (analytics et feature flags).
- `VITE_PUBLIC_POSTHOG_HOST` est optionnel, par défaut utilise l'instance cloud PostHog.
- Les autres sont optionnels mais pratiques pour éviter d'avoir des URLs codées en dur.

### Supabase Edge Functions (secrets)

Ces variables doivent être définies comme secrets du projet Supabase (ne pas les stocker côté client) :

```
SUPABASE_URL="https://<ref>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
PUBLIC_URL="https://getigne-collectif.fr"
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
DISCORD_BOT_TOKEN="<bot-token>"
DISCORD_GUILD_ID="<guild-id>"
CONTACT_EMAIL="contact@getigne-collectif.fr"
WEBSITE_URL="https://getigne-collectif.fr"
```

Commande type pour les secrets :

```
supabase secrets set \
  SUPABASE_URL="https://<ref>.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" \
  PUBLIC_URL="https://getigne-collectif.fr" \
  DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..." \
  DISCORD_BOT_TOKEN="<bot-token>" \
  DISCORD_GUILD_ID="<guild-id>" \
  CONTACT_EMAIL="contact@getigne-collectif.fr" \
  WEBSITE_URL="https://getigne-collectif.fr"
```

## PostHog

Le projet utilise PostHog pour l'analytics et les feature flags. Pour l'activer :

1. Créez un compte sur [PostHog](https://app.posthog.com)
2. Créez un nouveau projet
3. Récupérez votre clé API depuis les paramètres du projet
4. Ajoutez `VITE_PUBLIC_POSTHOG_KEY=votre_cle_api` dans votre fichier `.env.local`

### Utilisation

```typescript
import { usePostHog } from '@/hooks/usePostHog'

const MyComponent = () => {
  const { capture, identify, isFeatureEnabled } = usePostHog()
  
  // Capturer un événement
  capture('button_clicked', { button_name: 'submit' })
  
  // Identifier un utilisateur
  identify('user_123', { name: 'Jean Dupont' })
  
  // Vérifier un feature flag
  if (isFeatureEnabled('new_feature')) {
    // Afficher la nouvelle fonctionnalité
  }
  
  return <div>...</div>
}
```
