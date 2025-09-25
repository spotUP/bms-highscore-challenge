# Clear Logo System

This document describes the Clear Logo system that provides high-quality game logos from the LaunchBox Games Database.

## Overview

The Clear Logo system consists of three main components:

1. **Clear Logo Importer** - Downloads and stores Clear Logo images from LaunchBox metadata
2. **Clear Logo API Server** - Express server that provides API access to the Clear Logo database
3. **Clear Logo Service** - Frontend service that integrates with React components

## Database

- **Location**: `public/clear-logos.db`
- **Current Size**: ~10GB with 21,472+ Clear Logos
- **Source**: LaunchBox Games Database daily metadata exports
- **Format**: SQLite database with base64-encoded PNG images

## API Server

### Starting the API Server

```bash
npx tsx clear-logo-api-server.ts
```

The server runs on `http://localhost:3001` and provides the following endpoints:

### Endpoints

#### `POST /api/clear-logos`
Get Clear Logos for multiple games by name.

**Request Body:**
```json
{
  "gameNames": ["Street Fighter II", "Pac-Man", "Super Mario Bros."]
}
```

**Response:**
```json
{
  "Street Fighter II": "iVBORw0KGgoAAAANSUhEUgAAAZAAAADgCAYAAAAt6jC5...",
  "Pac-Man": "iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eA...",
  "Super Mario Bros.": "iVBORw0KGgoAAAANSUhEUgAAASwAAACoCAMAAABt9SM9A..."
}
```

#### `GET /api/clear-logos/:launchboxId`
Get Clear Logo by LaunchBox database ID.

#### `GET /api/clear-logos/search/:searchTerm`
Search Clear Logos by game name pattern.

#### `GET /api/clear-logos/stats`
Get database statistics including total count and platform breakdown.

#### `GET /health`
Health check endpoint.

## Frontend Integration

The `clearLogoService` in `src/services/clearLogoService.ts` handles communication with the API server.

### Usage in Components

```typescript
import { clearLogoService } from '@/services/clearLogoService';

// Get logos for multiple games
const logoMap = await clearLogoService.getClearLogosForGames(['Street Fighter II', 'Pac-Man']);

// Use in component
const base64Logo = logoMap['Street Fighter II'];
if (base64Logo) {
  const dataUrl = `data:image/png;base64,${base64Logo}`;
  // Use dataUrl as src for img element
}
```

The `GameLogo` component in `src/components/GameLogo.tsx` automatically uses Clear Logos with lazy loading and fallback placeholders.

## Importing Clear Logos

### Full Import Process

1. **Download LaunchBox Metadata** (automated in importer):
   ```
   https://gamesdb.launchbox-app.com/Metadata.zip (92MB, refreshed daily)
   ```

2. **Run the Importer**:
   ```bash
   npx tsx scripts/full-clear-logo-importer.ts
   ```

3. **Monitor Progress**:
   ```bash
   npx tsx scripts/clear-logo-progress-monitor.ts
   ```

### Features

- **Resumable**: Uses checkpoint system to resume from interruptions
- **Concurrent Downloads**: 5 parallel downloads with rate limiting
- **Progress Monitoring**: Beautiful terminal UI with real-time stats
- **Duplicate Prevention**: Checks existing logos to avoid re-downloading
- **Memory Efficient**: Streams XML parsing for 459MB metadata files

### Current Progress

As of the latest checkpoint:
- Total Available: 109,202 Clear Logos
- Downloaded: 21,500+ Clear Logos
- Success Rate: ~100% (improved from 0% with web scraping)

## Development

### Running Both Servers

For development, you need both the main Vite server and the Clear Logo API server:

```bash
# Terminal 1: Main Vite server
npm run dev

# Terminal 2: Clear Logo API server
npx tsx clear-logo-api-server.ts
```

### Database Schema

```sql
CREATE TABLE clear_logos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  launchbox_database_id INTEGER NOT NULL,
  game_name TEXT NOT NULL,
  platform_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  logo_base64 TEXT NOT NULL,
  region TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(launchbox_database_id, region)
);

CREATE INDEX idx_clear_logos_game_platform ON clear_logos(game_name, platform_name);
CREATE INDEX idx_clear_logos_launchbox_id ON clear_logos(launchbox_database_id);
```

## Troubleshooting

### Common Issues

1. **"Clear Logo database not initialized"**
   - Ensure the API server is running on port 3001
   - Check that `public/clear-logos.db` exists

2. **CORS Errors**
   - The API server includes CORS middleware for cross-origin requests

3. **Large Response Times**
   - The database contains 21,472+ logos; complex queries may take time
   - Consider implementing caching for frequently requested games

### Logs

The API server provides detailed logging:
- Request details (games requested)
- Success/failure for each logo lookup
- Response statistics

Example log output:
```
🔍 API request for 2 games: [ 'Street Fighter II', 'Pac-Man' ]
✅ Found logo for: Street Fighter II [Global]
✅ Found logo for: Pac-Man [Global]
📋 Returning 2/2 logos
```