#!/bin/sh
set -e

echo "[entrypoint] Running database migrations..."
npx tsx scripts/apply-db-migrations.ts

echo "[entrypoint] Starting server..."
exec npx tsx server/index.ts
