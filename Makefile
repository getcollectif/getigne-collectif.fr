# Supabase local development & import prod → local
# Prérequis: Supabase CLI installée (https://supabase.com/docs/guides/cli)
# Pour l'import prod → local: avoir lié le projet une fois avec `supabase link --project-ref <ref>`
YARN=yarn
POSTGRES_CONTAINER=postgres:15
# --network host : le conteneur voit 127.0.0.1:54322 de l'hôte (Supabase local)
PSQL=docker run --rm -i --network host -v "$(CURDIR):/data" ${POSTGRES_CONTAINER} psql

.PHONY: supabase_start supabase_stop supabase_ensure_buckets install supabase_db_dump_prod supabase_db_import_prod_to_local supabase_functions_serve supabase_functions_sync supabase_status

# Démarrer Supabase local (DB, Auth, Storage, etc.).
# Les buckets Storage sont créés automatiquement depuis supabase/config.toml.
supabase_start:
	${YARN} supabase start

# Créer les buckets Storage manquants (utile en projet hébergé, ou si config.toml a changé).
# En local : injecte et exporte API_URL + SERVICE_ROLE_KEY depuis « supabase status -o env ».
# En hébergé : SUPABASE_SERVICE_ROLE_KEY dans .env (Dashboard → Settings → API).
supabase_ensure_buckets:
	@set -a && eval "$$(yarn supabase status -o env 2>/dev/null)" 2>/dev/null && set +a; ${YARN} ensure-buckets

# Install deps + Supabase local + buckets. À lancer après clone pour tout initialiser.
# Les buckets sont créés au démarrage (config.toml). ensure-buckets vérifie ou les crée (nécessite .env avec VITE_SUPABASE_URL + clé).
install:
	@echo "Installation des dépendances..."
	${YARN} install
	@echo "Démarrage de Supabase local (buckets créés depuis config.toml)..."
	${YARN} supabase start
	@echo "Vérification des buckets Storage..."
	@set -a && eval "$$(yarn supabase status -o env 2>/dev/null)" 2>/dev/null && set +a; \
	${YARN} ensure-buckets || echo "  (si erreur : en hébergé, ajoutez SUPABASE_SERVICE_ROLE_KEY dans .env puis « make supabase_ensure_buckets »)"
	@echo "Terminé. Supabase tourne ; les buckets sont prêts."

# Arrêter Supabase local
supabase_stop:
	${YARN} supabase stop

# Afficher le statut et les URLs locales
supabase_status:
	${YARN} supabase status

# Dump des données de la prod (lecture seule, ne modifie pas la prod).
# Nécessite d'avoir lié le projet: supabase link --project-ref <project_ref>
# Produit: prod_data.sql (données uniquement)
supabase_db_dump_prod:
	@echo "Dump des données depuis la base liée (prod)..."
	${YARN} supabase db dump --linked -f prod_data.sql --data-only
	@echo "Fichier prod_data.sql créé. Pour restaurer en local: make supabase_db_restore_to_local"

# Restaure prod_data.sql dans la base locale.
# À lancer après: make supabase_start puis make supabase_db_dump_prod
# Réinitialise d'abord la base locale (migrations), puis charge les données.
supabase_db_restore_to_local:
	@test -f prod_data.sql || (echo "Erreur: prod_data.sql manquant. Lancez d'abord: make supabase_db_dump_prod" && exit 1)
	@echo "Réinitialisation de la base locale (migrations)..."
	${YARN} supabase db reset
	@echo "Restauration des données prod..."
	${PSQL} "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /data/prod_data.sql
	@echo "Restauration terminée."

# Import complet prod → local: dump prod puis restaure en local.
# 1. Dump les données depuis la prod (lecture seule)
# 2. Reset la base locale (applique les migrations)
# 3. Restaure les données dans la base locale
# Prérequis: supabase link déjà fait, supabase start déjà lancé (ou sera lancé)
supabase_db_import_prod_to_local: supabase_db_dump_prod
	@echo "Réinitialisation de la base locale..."
	${YARN} supabase db reset
	@echo "Restauration des données dans la base locale..."
	${PSQL} "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f /data/prod_data.sql
	@echo "Import prod → local terminé."

# Servir les Edge Functions en local (pour les tester avec la stack locale)
supabase_functions_serve:
	${YARN} supabase functions serve

# Alias: sync = servir les fonctions en local (pas de déploiement prod)
supabase_functions_sync: supabase_functions_serve
