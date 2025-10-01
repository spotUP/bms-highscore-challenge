- remember, never use emojis for buttons, use clean line art icons
- remember to always prompt user to apply sql fixes in the supabase web ui, don't try yourself
- remember The large database files (2GB+ SQLite files, XML metadata) were excluded from the commit as they're development artifacts that don't belong in
  version control. The essential code changes and smaller configuration files were successfully pushed.
- always work with this scraper: scripts/improved-clear-logo-scraper.ts never create a new one improve this one untill we have a working scraper
- LaunchBox provides daily database exports at:
  - https://gamesdb.launchbox-app.com/Metadata.zip (92MB, refreshed daily)
- remember this process to import clear logos, in the future when i ask you to import clear logos use this process
- remember to always start the logo proxy server in the background when starting/restarting the dev server
- always make sure that the logo proxy server is running
- remember to commit ro render.com via cli it's already set up
- remember the render deploy hook: https://api.render.com/deploy/srv-d3bcuf3e5dus73cf273g?key=bXyKnAwwSXU
- remember the pixel size in pong is 12x12
- remember the pixel size in pong404 is 4x4 (use this for every pickup etc that you draw)
- remember always check the console after adding/updating a new feature and fix all console errors
- remember that pickups always should be handled by the websocket
- remember we don't have a single player mode, only online multiplayer that can act as singleplayer with ai opponents.

## 🚀 SERVER SETUP (IMPORTANT - READ THIS EVERY TIME YOU RESTART SERVERS)

**The ONLY correct way to start the dev environment:**
```bash
npm run dev
```

**What this does:**
- Starts WebSocket server on port **3002** (scripts/pong-websocket-server.ts)
- Starts Vite dev server on port **8080** (configured in vite.config.ts)
- Both run simultaneously via `npm run websocket & vite`

**Port Configuration:**
- Frontend (Vite): http://localhost:8080
- WebSocket: ws://localhost:3002
- Client connects to WebSocket at `ws://localhost:3002` (see Pong404.tsx line 271)

**NEVER:**
- Don't add `PORT=8080` prefix when starting dev server
- Don't run WebSocket server on port 8080
- Don't try to connect to `ws://localhost:8080`
- Don't start multiple dev servers

**To restart servers cleanly:**
```bash
killall -9 node && sleep 1 && npm run dev
```

**Files to check if connection fails:**
- `vite.config.ts` line 13: Vite port (should be 8080)
- `scripts/pong-websocket-server.ts` line 4194: WebSocket port (defaults to 3002)
- `src/pages/Pong404.tsx` line 271: Client WebSocket URL (should be ws://localhost:3002)

**URL to open in browser:**
- http://localhost:8080/404 (NOT 8082, NOT 8083)