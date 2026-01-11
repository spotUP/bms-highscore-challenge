# Scripts

This folder contains operational scripts used for data imports, migrations, checks, and maintenance tasks.

## Organization
- `scripts/sql/`: SQL files used by `psql` or invoked by TS helpers
- `scripts/*.ts`: Task runners and automation scripts
- `scripts/*.js`: Legacy helpers that are still referenced

## Common entry points
- `scripts/pong-websocket-server.ts`: WebSocket server for Pong
- `scripts/build-database-for-vercel.ts`: Prebuild DB generation
- `scripts/check-env.ts`: Environment validation used by `predev`/`prebuild`
