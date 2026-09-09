#!/usr/bin/env bash
# Applique les migrations sur une base Supabase distante depuis un poste de travail,
# sans passer par « supabase link ».
#
#   scripts/apply-migrations.sh "postgresql://postgres.<ref>:<mot-de-passe>@aws-0-<region>.pooler.supabase.com:5432/postgres"
#   scripts/apply-migrations.sh "$DATABASE_URL" --dry-run
#
# Garanties :
#   - tout ou rien : les neuf fichiers sont appliqués dans UNE transaction, une
#     erreur annule l'ensemble et ne laisse pas la base à moitié migrée ;
#   - refus par défaut si le schéma applicatif est déjà présent (les migrations
#     créent les tables sans « if not exists » : les rejouer échouerait) ;
#   - les versions sont ensuite enregistrées dans supabase_migrations.schema_migrations,
#     pour qu'un « supabase db push » ultérieur ne tente pas de tout réappliquer.
set -euo pipefail
cd "$(dirname "$0")/.."

DB_URL="${1:-${DATABASE_URL:-}}"
MODE="${2:-}"
if [ -z "$DB_URL" ]; then
  echo "usage: scripts/apply-migrations.sh <url-postgres> [--dry-run|--force]" >&2
  exit 2
fi

PSQL=(psql "$DB_URL" -v ON_ERROR_STOP=1 -X -q)

echo "→ connexion"
"${PSQL[@]}" -Atc "select 'serveur ' || current_setting('server_version') || ' · base ' || current_database() || ' · rôle ' || current_user;"

echo "→ état actuel du schéma"
EXISTING=$("${PSQL[@]}" -Atc "select count(*) from information_schema.tables where table_schema = 'public';")
HAS_APP=$("${PSQL[@]}" -Atc "select case when to_regclass('public.profiles') is null then 'non' else 'oui' end;")
echo "   tables dans public : ${EXISTING} · schéma applicatif déjà présent : ${HAS_APP}"

if [ "$HAS_APP" = "oui" ] && [ "$MODE" != "--force" ]; then
  cat >&2 <<'MSG'
✘ La table public.profiles existe déjà : les migrations ont (au moins en partie)
  été appliquées. Les rejouer échouerait, car elles créent les tables sans garde.
  Comparez d'abord ce qui manque, puis n'appliquez que les fichiers restants :
      psql "$DB_URL" -c "select table_name from information_schema.tables where table_schema='public' order by 1;"
  Passez --force uniquement sur une base dont vous savez qu'elle est vide côté applicatif.
MSG
  exit 1
fi

FILES=(supabase/migrations/*.sql)
echo "→ ${#FILES[@]} migrations à appliquer :"
for f in "${FILES[@]}"; do echo "   $(basename "$f")"; done

if [ "$MODE" = "--dry-run" ]; then
  echo "→ --dry-run : rien n'a été appliqué."
  exit 0
fi

echo "→ application (transaction unique)"
ARGS=()
for f in "${FILES[@]}"; do ARGS+=(-f "$f"); done
psql "$DB_URL" -v ON_ERROR_STOP=1 -X -q --single-transaction "${ARGS[@]}"

echo "→ enregistrement des versions appliquées"
{
  echo "create schema if not exists supabase_migrations;"
  echo "create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);"
  for f in "${FILES[@]}"; do
    base=$(basename "$f" .sql)
    version="${base%%_*}"
    name="${base#*_}"
    echo "insert into supabase_migrations.schema_migrations (version, name) values ('${version}', '${name}') on conflict (version) do nothing;"
  done
} | "${PSQL[@]}" -f -

echo "→ vérification"
"${PSQL[@]}" -c "select
  (select count(*) from information_schema.tables where table_schema = 'public') as tables_public,
  (select count(*) from pg_policies where schemaname = 'public') as policies_rls,
  (select count(*) from storage.buckets) as buckets,
  (select count(*) from supabase_migrations.schema_migrations) as migrations_enregistrees;"
echo "✓ migrations appliquées"
