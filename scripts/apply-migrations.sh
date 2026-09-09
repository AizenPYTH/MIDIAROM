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
# Trois états : pas de table profiles, la nôtre (colonne « role »), ou une table
# homonyme d'une autre origine (démarrage rapide Supabase, ancien projet).
STATE=$("${PSQL[@]}" -Atc "select case
  when to_regclass('public.profiles') is null then 'absent'
  when exists (select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='role') then 'notre-schema'
  else 'table-etrangere' end;")
echo "   tables dans public : ${EXISTING} · table profiles : ${STATE}"

if [ "$STATE" = "notre-schema" ] && [ "$MODE" != "--force" ]; then
  cat >&2 <<'MSG'
✘ public.profiles vient déjà de ces migrations : elles ont (au moins en partie) été
  appliquées. Les rejouer échouerait, car elles créent les tables sans garde.
  Comparez d'abord ce qui manque, puis n'appliquez que les fichiers restants :
      psql "$DB_URL" -c "select table_name from information_schema.tables where table_schema='public' order by 1;"
  Passez --force uniquement sur une base dont vous savez qu'elle est vide côté applicatif.
MSG
  exit 1
fi

if [ "$STATE" = "table-etrangere" ] && [ "$MODE" != "--force" ]; then
  cat >&2 <<'MSG'
✘ public.profiles existe mais ne vient pas de ces migrations (pas de colonne « role »).
  C'est typiquement la table du démarrage rapide Supabase. Elle empêche la migration
  de créer la nôtre, et l'application échoue ensuite en 42703.

  Vérifiez d'abord si des tables la référencent :
      psql "$DB_URL" -c "select tc.table_name, tc.constraint_name from information_schema.table_constraints tc join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name where ccu.table_schema='public' and ccu.table_name='profiles' and tc.constraint_type='FOREIGN KEY';"

  Puis mettez-la de côté sans perdre ses données, et relancez ce script :
      psql "$DB_URL" -c "begin; create table public.profiles_avant_migration as select * from public.profiles; drop table public.profiles cascade; commit;"

  Voir « Table profiles d'une autre origine » dans docs/DEPLOYMENT.md pour la
  recréation des profils et la reprise des noms.
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
