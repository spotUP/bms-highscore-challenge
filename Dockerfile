# ── Stage 1: Build frontend ──
FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Accept VITE_* build-time variables
ARG VITE_API_URL
ARG VITE_WS_URL
ARG VITE_MEDIA_BASE_URL
ARG VITE_CLOUDFLARE_R2_DOMAIN
ARG VITE_RAWG_API_KEY
ARG VITE_IGDB_CLIENT_ID
ARG VITE_IGDB_ACCESS_TOKEN
ENV VITE_API_URL=$VITE_API_URL \
    VITE_WS_URL=$VITE_WS_URL \
    VITE_MEDIA_BASE_URL=$VITE_MEDIA_BASE_URL \
    VITE_CLOUDFLARE_R2_DOMAIN=$VITE_CLOUDFLARE_R2_DOMAIN \
    VITE_RAWG_API_KEY=$VITE_RAWG_API_KEY \
    VITE_IGDB_CLIENT_ID=$VITE_IGDB_CLIENT_ID \
    VITE_IGDB_ACCESS_TOKEN=$VITE_IGDB_ACCESS_TOKEN

# Build frontend only (skip prebuild DB script)
RUN npx vite build

# ── Stage 2: Production runtime ──
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy built frontend from build stage
COPY --from=build /app/dist ./dist

# Copy server, migrations, and entrypoint
COPY server/ ./server/
COPY db/migrations/ ./db/migrations/
COPY scripts/apply-db-migrations.ts ./scripts/apply-db-migrations.ts
COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
RUN chmod +x ./scripts/docker-entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
