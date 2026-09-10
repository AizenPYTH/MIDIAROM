#!/usr/bin/env bash
# Applies the shim + all migrations + seed on a throwaway local PostgreSQL
# database and runs the SQL RLS tests. Requires psql and a reachable server.
#   PGHOST/PGPORT/PGUSER/PGPASSWORD are honoured (defaults: localhost, postgres).
set -euo pipefail
cd "$(dirname "$0")/../.."

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}"
export PGPASSWORD="${PGPASSWORD:-postgres}"
DB="${TEST_DB:-console_repair_test}"

psql -v ON_ERROR_STOP=1 -d postgres -qc "drop database if exists ${DB};"
psql -v ON_ERROR_STOP=1 -d postgres -qc "create database ${DB};"

echo "→ shim"
psql -v ON_ERROR_STOP=1 -d "$DB" -q -f supabase/tests/shim.sql
for f in supabase/migrations/*.sql; do
  echo "→ migration $(basename "$f")"
  psql -v ON_ERROR_STOP=1 -d "$DB" -q -f "$f"
done
echo "→ catalogue (applicable en production)"
psql -v ON_ERROR_STOP=1 -d "$DB" -q -f supabase/catalog.sql
echo "→ catalogue de réparation du client (PDF)"
psql -v ON_ERROR_STOP=1 -d "$DB" -q -f supabase/catalog-reparations.sql
echo "→ seed de développement"
psql -v ON_ERROR_STOP=1 -d "$DB" -q -f supabase/seed.sql
# Rejoués une seconde fois : catalogue et seed doivent rester idempotents, y
# compris sur des comptes déjà présents (régression : mot de passe de
# développement jamais réappliqué, identités manquantes).
echo "→ catalogue + seed (rejoués, idempotence)"
psql -v ON_ERROR_STOP=1 -d "$DB" -q -f supabase/catalog.sql
psql -v ON_ERROR_STOP=1 -d "$DB" -q -f supabase/catalog-reparations.sql
psql -v ON_ERROR_STOP=1 -d "$DB" -q -f supabase/seed.sql
psql -v ON_ERROR_STOP=1 -d "$DB" -q -f supabase/tests/accounts.test.sql
echo "→ RLS tests"
psql -v ON_ERROR_STOP=1 -d "$DB" -q -f supabase/tests/rls.test.sql

# Nettoyage des données de démonstration, joué deux fois : la seconde exécution
# ne doit plus rien trouver à supprimer et ne doit pas échouer. La base porte à
# ce stade exactement ce que portait la production — catalogue, 887 prestations
# du document, 98 anciennes prestations désactivées, 51 produits de démonstration.
echo "→ nettoyage des données de démonstration (rejoué, idempotence)"
psql -v ON_ERROR_STOP=1 -d "$DB" -q -f supabase/cleanup-demo-data.sql > /dev/null
psql -v ON_ERROR_STOP=1 -d "$DB" -q -f supabase/cleanup-demo-data.sql > /dev/null
psql -v ON_ERROR_STOP=1 -d "$DB" -q -f supabase/cleanup-non-pdf-models.sql > /dev/null
psql -v ON_ERROR_STOP=1 -d "$DB" -q -f supabase/cleanup-non-pdf-models.sql > /dev/null
psql -v ON_ERROR_STOP=1 -d "$DB" -q -f supabase/tests/cleanup.test.sql

# Import de production : les deux fichiers de données doivent suffire à garnir
# une base qui vient d'être migrée, et donner le même résultat à chaque rejeu.
# C'est le scénario réel du client, qui n'a que le SQL Editor de Supabase.
echo "→ fichiers de production à jour"
node scripts/build-production-seeds.mjs --check

PROD_DB="${TEST_PROD_DB:-console_repair_prod_test}"
echo "→ import de production sur une base fraîchement migrée (${PROD_DB})"
psql -v ON_ERROR_STOP=1 -d postgres -qc "drop database if exists ${PROD_DB};"
psql -v ON_ERROR_STOP=1 -d postgres -qc "create database ${PROD_DB};"
psql -v ON_ERROR_STOP=1 -d "$PROD_DB" -q -f supabase/tests/shim.sql
for f in supabase/migrations/*.sql; do
  psql -v ON_ERROR_STOP=1 -d "$PROD_DB" -q -f "$f"
done
# Deux passages, le second dans la même session que le premier : le SQL Editor
# de Supabase réutilise ses connexions, une table temporaire y survit d'un
# « Run » à l'autre.
cat supabase/seed-production-catalog.sql supabase/seed-production-repairs.sql \
    supabase/seed-production-catalog.sql supabase/seed-production-repairs.sql |
  psql -v ON_ERROR_STOP=1 -d "$PROD_DB" -q
psql -v ON_ERROR_STOP=1 -d "$PROD_DB" -q -f supabase/tests/production-seeds.test.sql

echo "✓ database tests passed"
