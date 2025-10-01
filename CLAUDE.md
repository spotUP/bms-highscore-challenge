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

## 📦 PROCESS FOR ADDING/ENABLING PICKUPS (IMPORTANT - READ THIS WHEN ADDING PICKUPS)

When adding or enabling a new pickup, follow these 10 steps in order:

**Server-Side (scripts/pong-websocket-server.ts):**
1. Add pickup name to `pickupTypes` array (line ~3113)
2. Add `case 'pickup_name':` handler in `applyPickupEffect()` method (line ~3142+)
   - Set game state properties
   - Set effect.duration if needed
   - Add console log for debugging
3. Add cleanup `case 'pickup_name':` in effect expiration handler if needed (line ~3780+)
   - Reset game state properties to default values
   - Add console log for debugging

**Client-Side (src/pages/Pong404.tsx):**
4. Add pickup config to `PICKUP_CONFIGS` array with pattern, color, description, scale, note (line ~200+)
5. Add pattern definition to `PRECALC_PICKUP_PATTERNS` object (line ~412+)
   - Use 4x4 boolean array for pixel pattern
6. Add state properties to `GameState` interface if needed (line ~50+)
7. Initialize state values in initial game state (line ~1000+)
8. Add rendering/gameplay logic where needed (search for similar pickups)

**CRITICAL - Client/Server State Sync (src/pages/Pong404.tsx):**
9. Add state property syncing in WebSocket message handler `case 'game_state_updated':` (line ~2690+)
   - Add `if (message.data.yourProperty !== undefined) networkState.yourProperty = message.data.yourProperty;`
   - This ensures client receives state changes from server when effect activates/expires
   - **Without this step, the pickup will not work properly in multiplayer!**

**Apply Time Warp Factor (if pickup affects speed):**
10. If pickup affects game speed, apply the time warp factor to movement:
    - Server AI paddle movement: line ~1726 (multiply movement by `gameState.timeWarpFactor`)
    - Client paddle movement: line ~5912 and ~5961 (multiply velocity by `timeWarpFactor`)
    - Ball movement: Already applied on server (line ~2732) and should use synced factor

**Testing:**
- Restart servers: `killall -9 node && sleep 1 && npm run dev`
- Open: http://localhost:8080/404
- Check browser console for errors
- Wait for pickup to spawn and test effect
- Verify effect expires after duration
- Check that state returns to normal after expiration

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