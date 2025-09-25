# Obsolete Files Archive

This directory contains obsolete files that are no longer needed for the current RetroRanks application but are preserved for reference.

## Structure

### `/databases/`
Contains old database files from various logo scraping and import processes:
- **corrected-logos.db** - Early logo correction database
- **database.db** - Empty database file
- **dev-games.db** - 38MB development database (superseded by optimized games.db)
- **final-corrected-logos.db** - Final corrected logos (2.5MB)
- **games-index.db** - Small games index database
- **improved-clear-logos.db** - Empty improved logos database
- **logos.db** - Basic logos database
- **name-based-logos.db** - Name-based matching database
- **production-turbo-logos*.db** - Production turbo logo databases
- **standalone-logos.db** - Standalone logos (3.4MB)
- **turbo-logos.db** - Turbo processing logos (5.2MB)

### `/data-files/`
Contains obsolete JSON data files:
- **available-logos-list.json** - List of available logos (447KB)
- **games-with-logos.json** - Games with logo mappings (35KB)
- **improved-scraper-progress.json** - Scraper progress tracking
- **production-turbo-progress*.json** - Production progress files

### `/checkpoints/`
Contains checkpoint files from logo scraping processes:
- **improved-checkpoint-*.json** - Checkpoints from improved scraper

### `/platform-lists/`
Contains platform and genre list files:
- **all-game-genres.txt** - Complete genre list
- **downloaded-platforms.txt** - Downloaded platform list
- **excluded-genres.txt** - Excluded genre list
- **final-platforms-list.txt** - Final platform list (2KB)
- **included-platforms*.txt** - Various included platform lists
- **launchbox-platforms-list.txt** - LaunchBox platform mapping (3.6KB)
- **Platforms.xml** - Platform XML metadata (300KB)
- **remaining-platforms.txt** - Remaining platforms to process

### `/scripts/test/`
Contains 49+ test and debug scripts:
- Various test-*.ts and debug-*.ts files
- extract-genres.js and other utility scripts
- Comprehensive testing and debugging tools

## Current System
- **Games database**: Uses optimized 5.6MB games.db (without base64 logos)
- **Logo storage**: Uses S3 bucket via clearLogoService
- **Metadata**: Fetched from Supabase directly

## Note
These files are excluded from Vercel deployments via .vercelignore to keep deployment sizes small.