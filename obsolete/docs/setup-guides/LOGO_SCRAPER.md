# Logo Scraper Documentation

## Overview
The hybrid logo scraper fetches game logos from LaunchBox GameDB and stores them in SQLite. It queries games from Supabase and stores logos locally for fast access.

## Primary Scraper
**File**: `scripts/hybrid-logo-scraper.ts`

This is the **ONLY** logo scraper that should be used. All other logo scrapers are obsolete.

## How to Start the Scraper

### Command
```bash
npx tsx scripts/hybrid-logo-scraper.ts
```

### Background Mode
```bash
# Run in background
npx tsx scripts/hybrid-logo-scraper.ts &

# Or using Claude Code Bash tool with run_in_background: true
```

## Scraper Features

### Architecture
- **Hybrid Design**: Queries games from Supabase PostgreSQL → Stores logos in SQLite
- **SQLite Database**: `production-turbo-logos.db` (WAL mode for performance)
- **Progress Tracking**: Automatic resume from last processed game
- **Platform Prioritization**: Processes popular platforms first (Windows, PS5, Xbox, etc.)

### Performance Settings (Optimized)
- **Page Timeout**: 20 seconds (balanced for LaunchBox server response times)
- **Image Timeout**: 10 seconds
- **Batch Size**: 20 games per batch
- **Retry Logic**: 2 attempts with 200ms/400ms delays
- **Game Delay**: 100ms between games
- **Batch Delay**: 1 second between batches
- **Error Recovery**: 1 second delay on errors

### Progress Files
The scraper updates multiple progress files for frontend consumption:
- `production-turbo-progress.json` (main progress file)
- `public/production-scraper-progress.json` (frontend reads this)
- `production-scraper-progress.json` (backup)

### Checkpoint System
- Saves checkpoints every 100 games: `hybrid-checkpoint-{N}.json`
- Automatically resumes from latest checkpoint on restart

## Current Status (as of Sep 2024)

### Database State
- **Total Games**: 169,625
- **Processed**: 45,202+ games
- **Success Rate**: ~27% (logos found and stored)
- **SQLite Location**: `production-turbo-logos.db`

### Known Issues
- **LaunchBox Server Timeouts**: The LaunchBox GameDB server frequently times out (30+ seconds response time)
- **Rate Limiting**: Possible rate limiting from LaunchBox affecting success rates
- **Network Issues**: Server overload causes many timeout failures

## Monitoring Progress

### Frontend Page
Visit `/logo-scraper` in the application to see real-time progress

### API Endpoints
- `public/api/recent-logos.json` - Recent processed games and statistics
- SQLite API server on port 3001 (if running)

### Log Output
The scraper provides detailed console output:
- ✅ Success: Logo found and stored
- ⚠️  Warning: Retry attempts
- ❌ Error: Failed after all retries
- 📊 Progress: Batch completion statistics

## Troubleshooting

### Common Issues

1. **All games showing "no logo"**
   - **Cause**: LaunchBox server timeouts
   - **Solution**: Wait for LaunchBox server to recover, or increase timeouts

2. **Scraper not resuming properly**
   - **Check**: SQLite database exists and contains data
   - **Check**: Progress files are readable
   - **Solution**: Scraper automatically detects and resumes from SQLite MAX(id)

3. **Frontend not updating**
   - **Cause**: Browser caching of progress files
   - **Solution**: Hard refresh browser (Cmd+Shift+R)

### Performance Tuning
If LaunchBox servers are slow, consider:
- Increasing page timeout (currently 20s)
- Increasing image timeout (currently 10s)
- Reducing batch size (currently 20)
- Increasing delays between requests

## File Locations

### Active Files (Keep These)
- `scripts/hybrid-logo-scraper.ts` - Main scraper
- `production-turbo-logos.db` - SQLite database
- `production-turbo-progress.json` - Progress tracking
- `hybrid-checkpoint-*.json` - Checkpoint files

### Obsolete Files (Can Delete)
- Any other `*-logo-scraper.ts` files
- Old progress JSON files not listed above
- Old checkpoint files from different scrapers

## Supporting Infrastructure

### SQLite API Server
- **File**: `scripts/sqlite-logo-api.ts`
- **Port**: 3001
- **Purpose**: Serves logos from SQLite to frontend

### Progress Updater
- **File**: `scripts/update-logo-api-data.ts`
- **Purpose**: Updates `public/api/recent-logos.json` with current stats

## Important Notes

1. **Do NOT create new scrapers** - Use the existing hybrid scraper
2. **The scraper is optimized** - Timeout and delay settings are balanced for current LaunchBox server performance
3. **Progress is persistent** - The scraper will always resume from where it left off
4. **Server issues are external** - Most "no logo" issues are due to LaunchBox server problems, not our code
5. **SQLite is the source of truth** - All logos are stored in SQLite, not Supabase

## Quick Start Checklist

When starting the scraper:
1. ✅ Use `scripts/hybrid-logo-scraper.ts`
2. ✅ Run in background mode for long operations
3. ✅ Monitor via `/logo-scraper` frontend page
4. ✅ Check console output for real-time status
5. ✅ Verify SQLite database is being updated
6. ❌ Do NOT create new scraper files
7. ❌ Do NOT modify timeout settings without testing LaunchBox response times first