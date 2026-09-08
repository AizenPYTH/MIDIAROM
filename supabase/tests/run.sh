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
echo "→ seed"
psql -v ON_ERROR_STOP=1 -d "$DB" -q -f supabase/seed.sql
echo "→ RLS tests"
psql -v ON_ERROR_STOP=1 -d "$DB" -q -f supabase/tests/rls.test.sql
echo "✓ database tests passed"
