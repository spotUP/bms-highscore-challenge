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

## 🗑️ PROCESS FOR REMOVING PICKUPS (IMPORTANT - READ THIS WHEN REMOVING PICKUPS)

When removing a pickup from the game, you MUST remove it from ALL of these locations:

**Server-Side (scripts/pong-websocket-server.ts):**
1. Remove from `Pickup` type interface (line ~397) - the union of pickup type strings
2. Remove from `ActiveEffect` type interface (line ~430) - the union of effect type strings
3. Remove from `pickupTypes` array (line ~3117) - the array that spawns pickups
4. Remove `case 'pickup_name':` handler from `applyPickupEffect()` method (line ~3142+)
5. Remove `case 'pickup_name':` handler from `reversePickupEffect()` method (line ~3780+)
6. Remove any specific state properties from `GameState` interface if the pickup added them (line ~500+)
7. Remove initialization of those state properties from `createInitialGameState()` (line ~1300+)

**Client-Side (src/pages/Pong404.tsx):**
8. Remove from `PICKUP_CONFIGS` array (line ~200+) - the visual/audio configuration
9. Remove any specific state properties from initial game state if added (line ~1000+)
10. Remove any rendering/gameplay logic specific to that pickup (search codebase)

**Important Notes:**
- Missing ANY of these locations will cause TypeScript errors or runtime bugs
- Always search both files for the pickup name to ensure complete removal
- Check for both snake_case ('pickup_name') and camelCase (pickupName) variants
- Test after removal to ensure no console errors

## 📦 PROCESS FOR ADDING/ENABLING PICKUPS

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
9. Add music/audio/visual activation logic in `case 'game_state_updated':` handler (line ~2055+)

   **IMPORTANT ARCHITECTURE NOTES:**
   - The server sends `game_state_updated` messages (NOT `delta_update` or `game_state`)
   - The server broadcasts the ENTIRE `gameState` object in these messages
   - The client has a `delta_update` handler but it's for CLIENT → SERVER updates, not SERVER → CLIENT
   - Pickup selector (keys 1/2) sends `test_pickup` to server, server responds with `game_state_updated`

   **CRITICAL BUG TO AVOID:**
   - The `handleTestPickup()` method (line ~1150) MUST send `type: 'game_state_updated'`
   - DO NOT send `type: 'game_state'` - the client doesn't have a handler for it!
   - The client ONLY handles `game_state_updated`, NOT `game_state`
   - If you send the wrong message type, pickups will activate on server but not trigger client effects

   **For pickups with music/audio/visual effects that need activation/deactivation:**

   Add activation logic in `case 'game_state_updated':` handler (line ~2055+), BEFORE `networkGameStateRef.current` is updated:

   ```typescript
   // Handle [Your Pickup] mode
   const prevGameState = networkGameStateRef.current;
   const hadEffect = prevGameState?.yourPickupMode || false;
   const hasEffect = message.data.yourPickupMode || false;

   console.log('[YOUR_PICKUP DEBUG] hadEffect:', hadEffect, 'hasEffect:', hasEffect);

   if (hasEffect && !hadEffect) {
     // Start music/effects
     console.log('[YOUR_PICKUP] Starting effect');
     if ((window as any).generativeMusic) {
       (window as any).generativeMusic.startPiece('your-piece');
     } else {
       console.log('[YOUR_PICKUP] ERROR: generativeMusic not available');
     }
   } else if (!hasEffect && hadEffect) {
     // Stop music/effects
     console.log('[YOUR_PICKUP] Stopping effect');
     if ((window as any).generativeMusic?.currentState?.currentPieceId === 'your-piece') {
       const pieces = (window as any).generativeMusic.availablePieces.filter((p: any) => p.id !== 'your-piece');
       const randomPiece = pieces[Math.floor(Math.random() * pieces.length)];
       (window as any).generativeMusic.startPiece(randomPiece.id);
     }
   }
   ```

   **WHY THIS LOCATION:**
   - `prevGameState = networkGameStateRef.current` gives you the previous state
   - `message.data` contains the new state from server
   - Must compare BEFORE updating `networkGameStateRef.current` (line ~2082+)
   - This ensures state change detection works correctly

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
- the ambient sound system is old and not used we use generated music with tone.js now
- remember the mega bezel reflection shader should never be implemented in the canvas, it should be implemented directly into the crt shader
- remember the playfield border belongs to the playfield
- don't screenshot the images gets to big