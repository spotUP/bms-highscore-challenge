#!/bin/bash
set -euo pipefail

# ── Seed Docker Postgres from Supabase ──
# Run this once after the first `docker compose up -d` to import existing data.
#
# Prerequisites:
#   - SUPABASE_DB_URL: your Supabase Postgres connection string
#     (find it in Supabase Dashboard → Settings → Database → Connection string → URI)
#   - Docker Compose stack running (docker compose up -d)
#
# Usage:
#   SUPABASE_DB_URL="postgres://postgres.xxx:password@aws-0-xx.pooler.supabase.com:5432/postgres" \
#     bash scripts/seed-from-supabase.sh

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "Error: SUPABASE_DB_URL is not set."
  echo "Usage: SUPABASE_DB_URL=\"postgres://...\" bash scripts/seed-from-supabase.sh"
  exit 1
fi

DUMP_FILE="/tmp/retroranks-supabase-dump.sql"

echo "── Step 1: Dumping data from Supabase ──"
pg_dump "$SUPABASE_DB_URL" \
  --data-only \
  --no-owner \
  --no-privileges \
  --exclude-schema=storage \
  --exclude-schema=supabase_migrations \
  --exclude-schema=supabase_functions \
  --exclude-schema=graphql \
  --exclude-schema=graphql_public \
  --exclude-schema=realtime \
  --exclude-schema=pgsodium \
  --exclude-schema=vault \
  --exclude-schema=extensions \
  --exclude-table='schema_migrations' \
  > "$DUMP_FILE"

echo "── Step 2: Cleaning dump (remove Supabase-specific SET statements) ──"
sed -i.bak \
  -e '/^SET idle_in_transaction_session_timeout/d' \
  -e '/^SET row_security/d' \
  -e '/^SELECT pg_catalog.set_config/d' \
  "$DUMP_FILE"
rm -f "${DUMP_FILE}.bak"

echo "── Step 3: Restoring into Docker Postgres ──"
docker compose exec -T db psql -U retroranks -d retroranks < "$DUMP_FILE"

echo "── Step 4: Cleanup ──"
rm -f "$DUMP_FILE"

echo "Done! Data has been imported into the Docker Postgres container."
