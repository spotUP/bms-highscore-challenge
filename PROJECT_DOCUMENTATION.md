# RetroRanks - Complete Project Documentation

**Live URL**: https://retroranks.com
**Repository**: https://github.com/spotUP/bms-highscore-challenge

A modern arcade highscore leaderboard platform featuring tournament management, real-time multiplayer Pong, and retro CRT shader effects.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Getting Started](#getting-started)
4. [Project Structure](#project-structure)
5. [Key Components](#key-components)
6. [Development Guide](#development-guide)
7. [Deployment](#deployment)
8. [Database Schema](#database-schema)
9. [API Documentation](#api-documentation)
10. [Shader System](#shader-system)
11. [Performance](#performance)
12. [Troubleshooting](#troubleshooting)

---

## Features

### Core Features
- 🏆 **Tournament Management** - Single/double elimination brackets
- 🎮 **Multiplayer 4-Player Pong** - Real-time WebSocket gameplay
- 📊 **Leaderboards** - Track scores across arcade games
- 🎯 **Achievements** - Unlock achievements and track stats
- 📱 **QR Code Submission** - Submit scores via QR codes
- 🎨 **CRT Shader Effects** - Mega Bezel retro visuals
- 🎮 **Game Browser** - Searchable arcade game database

### Technical Features
- ⚡ Real-time multiplayer synchronization
- 🖼️ Clear logo integration from LaunchBox
- 🎨 VHS & hyperspace visual effects
- 🔐 Role-based access control
- 📊 Supabase real-time database

---

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS + shadcn/ui
- Three.js (3D/shaders)
- Tone.js (generative music)

### Backend
- Supabase (PostgreSQL + real-time)
- Custom WebSocket server (Node.js)
- Edge Functions (serverless)
- Row Level Security (RLS)

### Shaders
- Mega Bezel CRT system
- GLSL/WebGL
- Custom Slang compiler

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm
- Supabase account

### Installation

```bash
git clone https://github.com/spotUP/bms-highscore-challenge
cd bms-highscore-challenge
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials
```

### Environment Variables

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Development

```bash
# Start all servers (Vite + WebSocket + Logo Proxy)
npm run dev

# Servers:
# - Vite: http://localhost:8080
# - WebSocket: ws://localhost:3002
# - Logo Proxy: http://localhost:3001
```

**Important**: Always use `npm run dev` - it runs all servers simultaneously.

---

## Project Structure

```
bms-highscore-challenge/
├── src/
│   ├── pages/              # Route components
│   │   ├── Index.tsx       # Home/leaderboards
│   │   ├── Pong404.tsx     # Multiplayer Pong (~6000 lines)
│   │   ├── Admin.tsx       # Admin panel
│   │   └── GamesBrowser.tsx
│   ├── components/         # UI components
│   │   ├── ui/            # shadcn components
│   │   └── Layout.tsx
│   ├── hooks/             # Custom hooks
│   │   ├── useAuth.ts
│   │   └── useScoreSubmissions.ts
│   ├── contexts/          # React contexts
│   │   ├── TournamentContext.tsx
│   │   └── AchievementContext.tsx
│   ├── shaders/           # Mega Bezel system
│   │   ├── SlangShaderCompiler.ts  # Core compiler
│   │   ├── MegaBezelPresetLoader.ts
│   │   └── MultiPassRenderer.ts
│   └── integrations/
│       └── supabase/      # Supabase client
├── scripts/
│   ├── pong-websocket-server.ts  # Game server (~4200 lines)
│   └── improved-clear-logo-scraper.ts
├── supabase/
│   ├── migrations/        # DB migrations
│   ├── functions/         # Edge functions
│   └── policies/          # RLS policies
└── public/
    └── shaders/
        └── mega-bezel/    # CRT shader files
```

---

## Key Components

### 1. Pong404 Multiplayer Game

**Client** (`src/pages/Pong404.tsx`):
- Real-time 4-player Pong with AI
- WebSocket multiplayer sync
- Pickup system (time warp, size changes, etc.)
- Tone.js generative music

**Server** (`scripts/pong-websocket-server.ts`):
- Server-authoritative physics
- Room management + spectators
- Collision detection
- Pickup effect management

**Architecture**:
```
Client Input → WebSocket → Server Physics → Server Broadcasts State → Client Renders
```

### 2. Tournament System

**Features**:
- Single/double elimination
- Real-time updates
- Match scheduling
- Bracket visualization

**Implementation**:
- `TournamentContext.tsx` - State management
- `BracketContext.tsx` - Bracket logic
- Supabase real-time subscriptions

### 3. Shader System

**Mega Bezel CRT Shaders**:
- 631 → 0 compilation errors achieved
- 9-pass Potato preset for web performance
- See `MEGA_BEZEL_IMPLEMENTATION.md` for details

**Key Files**:
- `SlangShaderCompiler.ts` - Slang → GLSL conversion
- `MegaBezelPresetLoader.ts` - Preset loading
- `MultiPassRenderer.ts` - 9-pass rendering
- `BezelCompositionRenderer.ts` - Final composition

---

## Development Guide

### Port Configuration

**DO NOT CHANGE** these without updating all references:
- Vite: `8080` (vite.config.ts:13)
- WebSocket: `3002` (pong-websocket-server.ts:4194)
- Logo Proxy: `3001` (auto-started)

### Adding a Pong Pickup

See `CLAUDE.md` for full details. Quick summary:

1. **Server** (`pong-websocket-server.ts`):
   - Add to `Pickup` type (~line 397)
   - Add to `pickupTypes` array (~3117)
   - Add case in `applyPickupEffect()` (~3142)

2. **Client** (`Pong404.tsx`):
   - Add to `PICKUP_CONFIGS` (~200)
   - Add pattern to `PRECALC_PICKUP_PATTERNS` (~412)
   - Add effect in `game_state_updated` handler (~2055)

3. Test with keys `1` or `2` at http://localhost:8080/404

### Code Style

- TypeScript strict mode
- Functional React components
- Absolute imports via `@/` alias
- Prettier formatting

### Git Workflow

```bash
git checkout -b feature/your-feature
git commit -m "Description"
git push origin feature/your-feature
# Create PR on GitHub
```

---

## Deployment

### Build Commands

```bash
# Comprehensive validation
npm run validate-deploy

# Production build
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Deployment Process

1. Run `npm run validate-deploy`
2. Run `npm run build`
3. Deploy `dist/` to Vercel/Netlify
4. Trigger Render.com deploy for WebSocket server:
   ```
   https://api.render.com/deploy/srv-d3bcuf3e5dus73cf273g?key=bXyKnAwwSXU
   ```

### Environment Setup

**Supabase**:
- Set RLS policies via Dashboard
- Configure Edge Function secrets
- Enable real-time on required tables

**Vercel**:
- Add environment variables
- Configure custom domain
- Enable automatic deployments

---

## Database Schema

### Core Tables

**profiles**
- User profiles + roles
- Linked to Supabase auth

**score_submissions**
- Individual score submissions
- Links users + games

**tournaments**
- Tournament metadata
- Status tracking

**tournament_matches**
- Match data
- Bracket positions

**achievements**
- Achievement definitions
- Progress tracking

**games**
- Arcade game database
- Clear logo URLs

### Row Level Security

- Admins: Full access
- Users: Read public, write own
- Spectators: Read only

---

## API Documentation

### WebSocket Server (Port 3002)

**Connect**:
```javascript
const ws = new WebSocket('ws://localhost:3002');
```

**Client Messages**:
```typescript
// Join room
{ type: 'join_room', roomId: 'main' }

// Move paddle
{ type: 'paddle_move', position: 0.5 }

// Test pickup
{ type: 'test_pickup', pickupType: 'TIME_WARP_SLOW' }
```

**Server Messages**:
```typescript
// Game state
{
  type: 'game_state_updated',
  data: {
    ball: { x, y, velocityX, velocityY },
    paddles: { left, right, top, bottom },
    scores: {...},
    pickups: [...],
    effects: [...]
  }
}

// Player joined
{ type: 'player_joined', playerId, role }
```

### Edge Functions

**manage-users**
- Admin user management
- Role updates
- Health: `GET /functions/v1/manage-users?action=health`

**invite-user**
- Email invitations
- Role assignment
- Health: `GET /functions/v1/invite-user?action=health`

**search-game-logos**
- Logo search
- LaunchBox API proxy

---

## Shader System

### Mega Bezel Implementation

**Achievement**: 631 → 0 WebGL errors

**Architecture**:
1. Include preprocessing
2. Pragma extraction
3. Binding extraction
4. UBO → uniform conversion
5. Global definition extraction
6. Stage splitting (vertex/fragment)
7. Smart stub injection
8. 9-pass rendering

**Potato Preset**:
- 9 shader passes (vs 36 in Standard)
- Optimized for web
- Smart stubs for stripped features
- See `MEGA_BEZEL_IMPLEMENTATION.md`

**Shader Passes**:
```
0: Derez/downscale
1: Cache parameters
2: Fetch derez output
3: FXAA anti-aliasing
4: Color grading
5: Sharpening
6: Linearize
7: Screen scaling
8: Post-CRT effects
```

---

## Performance

### Optimization Features

**Performance Mode**:
- Toggle: Ctrl+Shift+P
- Disables VHS/hyperspace effects
- Reduces shader complexity

**Code Splitting** (vite.config.ts):
- React in separate chunk
- Three.js in separate chunk
- Tone.js in separate chunk

**Lazy Loading**:
- Route-based code splitting
- React.lazy() for heavy components

### Monitoring

**PerformanceMonitor**:
- FPS tracking
- Memory usage
- Frame times
- Toggle: Ctrl+Shift+P

---

## Troubleshooting

### WebSocket Connection Failed
- Ensure `npm run dev` is running
- Check port 3002 availability
- Verify URL in Pong404.tsx

### Shader Errors
- Check browser console
- Verify files in `public/shaders/mega-bezel/`
- See `MEGA_BEZEL_IMPLEMENTATION.md`

### Supabase Issues
- Verify `.env` credentials
- Check Supabase Dashboard
- Review RLS policies

### Build Failures
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Type check
npm run typecheck

# Check imports
npm run lint
```

---

## Testing

### Manual Testing

```bash
npm run dev

# Test URLs:
# - Home: http://localhost:8080
# - Pong: http://localhost:8080/404
# - Shader Demo: http://localhost:8080/slang-demo
# - Admin: http://localhost:8080/admin
```

### Shader Validation

```bash
node capture-shader-console.mjs
# Expected: WebGL ERROR lines: 0
```

### Pre-deployment

```bash
npm run validate-deploy
# Should pass all checks
```

---

## Credits

- **Mega Bezel** - HyperspaceMadness
- **shadcn/ui** - Component library
- **LaunchBox** - Game database
- **RetroArch** - Shader format

---

## Links

- **Live Site**: https://retroranks.com
- **Repository**: https://github.com/spotUP/bms-highscore-challenge
- **Issues**: https://github.com/spotUP/bms-highscore-challenge/issues

---

## Additional Documentation

- `CLAUDE.md` - Development guidelines for Claude Code
- `MEGA_BEZEL_IMPLEMENTATION.md` - Shader system details
- `CHANGELOG.md` - Version history
- `STATUS.md` - Current project status
- `CLAUDE_HANDOVER.md` - Handover notes

---

*Last Updated: October 2025*
*Built with ❤️ for the retro gaming community*
