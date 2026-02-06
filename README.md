# Retroranks

Highscore and competition management platform.

## Dev
```bash
npm install
npm run dev
```

## Render Deploy
```bash
npm run db:migrate
```

Set these environment variables on Render:
- `DATABASE_URL` (API service)
- `JWT_SECRET` (API service)
- `PUBLIC_BASE_URL` (API service)
- `VITE_API_URL` (frontend build)
- `VITE_WS_URL` (frontend build)
- `VITE_MEDIA_BASE_URL` (optional, frontend build)

## Notes
- Admin, tournaments, achievements, and brackets live under `src/pages` and `src/components`.
- Database migrations live under `db/migrations` with a curated subset of `supabase/migrations`.
