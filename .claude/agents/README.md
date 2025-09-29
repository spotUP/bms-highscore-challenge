# RetroRanks Specialized Agents

This directory contains nine specialized agents designed to streamline development workflows for the **RetroRanks arcade gaming platform** - a comprehensive retro gaming hub featuring 1000+ classic games, global highscore leaderboards, tournament systems, and multiplayer gaming experiences.

## Available Agents

### 1. Database Schema Agent (`database-schema.md`)
**Role**: Supabase database operations, schema management, and data integrity for the full arcade platform
- **Primary Tasks**: Games database, highscore tables, user profiles, achievement systems, tournament brackets, RLS policies
- **Key Scripts**: `apply-migration.ts`, `verify-storage.ts`, `check-achievements.ts`, `check-existing-games.ts`
- **Safety Protocol**: Always prompts users to apply SQL fixes via Supabase Web UI
- **Platform Scope**: Manages 1000+ arcade games, millions of highscores, user accounts, tournaments

### 2. Game Data Scraper Agent (`game-data-scraper.md`)
**Role**: Arcade games database curation, metadata import, and logo asset management
- **Primary Tasks**: LaunchBox database imports (1000+ games), logo scraping, platform data management
- **Key Scripts**: `improved-clear-logo-scraper.ts`, `import-launchbox-data.ts`, `check-existing-games.ts`
- **Core Principle**: Always improve existing scraper, never create new ones
- **Platform Scope**: Manages comprehensive arcade game metadata from LaunchBox database exports

### 3. WebSocket Game Server Agent (`websocket-game-server.md`)
**Role**: Multiplayer arcade game servers, real-time gameplay, and highscore synchronization
- **Primary Tasks**: Multiplayer server management, game physics, player coordination, real-time leaderboard updates
- **Key Scripts**: `pong-websocket-server.ts` (port 3002), game-specific multiplayer implementations
- **Standards**: 60 FPS server loop, arcade-accurate physics, real-time highscore submission
- **Platform Scope**: Manages multiplayer for various arcade games with Pong as primary real-time example

### 4. Deployment Pipeline Agent (`deployment-pipeline.md`)
**Role**: Build processes, multi-platform deployments, CI/CD coordination
- **Primary Tasks**: Vercel (frontend) + Render.com (WebSocket) deployments, database preparation, asset optimization
- **Key Scripts**: `build-database-for-vercel.ts`, `deploy-tests.ts`
- **Platforms**: Vercel (primary frontend), Render.com (WebSocket backend), Netlify (backup/staging)

### 5. Tournament System Agent (`tournament-system.md`)
**Role**: Tournament management, competitive brackets, and achievement systems across arcade games
- **Primary Tasks**: Multi-game tournament brackets, achievement tracking, competitive scoring, leaderboard management
- **Key Scripts**: `simulate-double-elimination.ts`, `setup-achievements.ts`, tournament automation
- **Systems**: Auto-population, bracket repair, cross-game achievements, global leaderboards

### 6. Performance Monitor Agent (`performance-monitor.md`)
**Role**: Performance monitoring, console error detection (client + server), optimization
- **Primary Tasks**: Dual console monitoring, resource optimization, memory management, server health
- **Key Scripts**: Performance checking, server log monitoring, bundle optimization
- **Protocol**: Always check BOTH browser console AND server logs after feature updates

### 7. Data Scientist Agent (`data-scientist.md`)
**Role**: Analytics, player insights, and data-driven optimization across the arcade platform
- **Primary Tasks**: Arcade game analytics, highscore patterns, player behavior, tournament analysis, engagement optimization
- **Key Scripts**: Analytics pipeline, player segmentation, game performance analysis, KPI monitoring
- **Core Focus**: Transform platform-wide game data into actionable insights for growth and retention
- **Platform Scope**: Analyzes behavior across 1000+ games, global leaderboards, and user engagement patterns

### 8. Economy Agent (`economy.md`)
**Role**: Monetization strategy, user conversion optimization, and revenue generation
- **Primary Tasks**: Revenue stream optimization, conversion funnel design, pricing strategy, payment psychology
- **Key Scripts**: Revenue analytics, conversion tracking, pricing experiments, user lifetime value analysis
- **Core Focus**: Balance user experience with profitable growth through ethical monetization

### 9. Game Designer Agent (`game-designer.md`)
**Role**: Arcade gameplay design, user engagement mechanics, and platform-wide fun factor optimization
- **Primary Tasks**: Cross-game balance, progression systems, arcade game engagement, platform-wide retention mechanics
- **Key Scripts**: Gameplay analytics, balance testing, engagement optimization, platform satisfaction measurement
- **Core Focus**: Create engaging arcade experiences across all games while optimizing platform-wide retention
- **Platform Scope**: Designs engagement systems for 1000+ arcade games, global progression, and social features

## Agent Selection Guide

### For Database Issues:
- Games database schema → **Database Schema Agent**
- Highscore table optimization → **Database Schema Agent**
- User account management → **Database Schema Agent**
- Migration conflicts → **Database Schema Agent**
- RLS policy errors → **Database Schema Agent**

### For Arcade Games & Content:
- Game metadata imports (LaunchBox) → **Game Data Scraper Agent**
- Logo scraping and assets → **Game Data Scraper Agent**
- Platform and ROM management → **Game Data Scraper Agent**
- Game database curation → **Game Data Scraper Agent**

### For Multiplayer & Real-time Features:
- Multiplayer game servers → **WebSocket Game Server Agent**
- Real-time highscore updates → **WebSocket Game Server Agent**
- Game physics and collision → **WebSocket Game Server Agent**
- Real-time sync → **WebSocket Game Server Agent**

### For Deployments:
- Build failures → **Deployment Pipeline Agent**
- Environment issues → **Deployment Pipeline Agent**
- Multi-platform deploys → **Deployment Pipeline Agent**

### For Competitions & Leaderboards:
- Tournament brackets (any game) → **Tournament System Agent**
- Global leaderboards → **Tournament System Agent**
- Achievement tracking → **Tournament System Agent**
- Cross-game competitive scoring → **Tournament System Agent**

### For Quality Assurance:
- Client console errors → **Performance Monitor Agent**
- Server console errors → **Performance Monitor Agent**
- Performance issues → **Performance Monitor Agent**
- Memory leaks (client & server) → **Performance Monitor Agent**
- Process monitoring → **Performance Monitor Agent**

### For Analytics & Insights:
- Arcade game performance analytics → **Data Scientist Agent**
- Highscore pattern analysis → **Data Scientist Agent**
- Player behavior across games → **Data Scientist Agent**
- Global leaderboard analytics → **Data Scientist Agent**
- A/B testing and experimentation → **Data Scientist Agent**
- Platform-wide KPI monitoring → **Data Scientist Agent**

### For Monetization & Revenue:
- Revenue stream optimization → **Economy Agent**
- Conversion funnel analysis → **Economy Agent**
- Pricing strategy and testing → **Economy Agent**
- User payment behavior → **Economy Agent**
- Subscription and premium features → **Economy Agent**
- Tournament entry fee optimization → **Economy Agent**

### For Gameplay & Design:
- Arcade game balance and mechanics → **Game Designer Agent**
- Cross-game engagement systems → **Game Designer Agent**
- Platform-wide progression systems → **Game Designer Agent**
- Global leaderboard design → **Game Designer Agent**
- Arcade game mode design → **Game Designer Agent**
- Platform retention optimization → **Game Designer Agent**

## Integration Patterns

### Multi-Agent Coordination
- **Database + Tournament**: Schema changes for bracket systems
- **Scraper + Performance**: Monitor logo import performance
- **WebSocket + Performance**: Monitor multiplayer game performance
- **Data Scientist + Tournament**: Analytics for competitive balance optimization
- **Data Scientist + Performance**: Player behavior impact on system performance
- **Economy + Data Scientist**: Revenue analytics and user monetization insights
- **Economy + Tournament**: Tournament entry fee optimization and revenue analysis
- **Game Designer + Data Scientist**: Gameplay analytics and engagement optimization
- **Game Designer + Economy**: Monetization through engaging gameplay features
- **Game Designer + WebSocket**: Real-time gameplay mechanics and balance
- **Deployment + All**: Coordinate all systems for production releases

### Common Workflows
1. **New Feature Development**:
   - Performance Monitor → check console
   - Database Schema → handle schema changes
   - Deployment Pipeline → build and deploy

2. **Game Content Updates**:
   - Game Data Scraper → import new content
   - Database Schema → update game tables
   - Performance Monitor → verify performance

3. **Tournament Operations**:
   - Tournament System → manage competitions
   - Database Schema → handle achievement data
   - WebSocket Game Server → real-time updates
   - Data Scientist → analyze competitive balance and player engagement

4. **Analytics & Optimization**:
   - Data Scientist → player behavior analysis and insights
   - Performance Monitor → system performance correlation
   - Tournament System → competitive metrics optimization
   - Database Schema → analytics data structure

5. **Monetization & Revenue**:
   - Economy → revenue stream optimization and conversion analysis
   - Data Scientist → user monetization behavior and predictive analytics
   - Tournament System → competitive monetization and prize optimization
   - Database Schema → payment and subscription data structure

6. **Gameplay & User Experience**:
   - Game Designer → gameplay mechanics and engagement optimization
   - Data Scientist → player behavior and satisfaction analytics
   - Economy → monetization through enhanced gameplay features
   - WebSocket Game Server → real-time gameplay implementation

## Project Context Integration

### CLAUDE.md Compliance
- ✓ Clean line art icons (no emojis in UI)
- ✓ Supabase Web UI for SQL operations
- ✓ Existing scraper improvement only
- ✓ Logo proxy server coordination
- ✓ 12x12 pixel sizing for Pong elements
- ✓ Console error checking mandatory
- ✓ WebSocket pickup handling

### Environment Coordination
- **Development**: Port 8080 (frontend) + 3002 (WebSocket) + 3001 (logo proxy)
- **Production**: Vercel (frontend) + Render.com (WebSocket backend) + Supabase (database)
- **Staging/Backup**: Netlify (alternative frontend)
- **Testing**: Local SQLite + development servers

## Usage Examples

### Invoke Database Schema Agent
```
"I need to fix RLS policies for the achievements table"
```

### Invoke Game Data Scraper Agent
```
"Import the latest LaunchBox metadata and scrape missing logos"
```

### Invoke WebSocket Game Server Agent
```
"The Pong multiplayer has collision detection issues"
```

### Invoke Deployment Pipeline Agent
```
"Deploy the latest changes to production with database preparation"
```

### Invoke Tournament System Agent
```
"Set up a new double-elimination tournament with achievements"
```

### Invoke Performance Monitor Agent
```
"Check for console errors and optimize loading performance"
```

### Invoke Data Scientist Agent
```
"Analyze player engagement and tournament participation trends"
```

### Invoke Economy Agent
```
"Optimize tournament entry fees and implement premium subscription features"
```

### Invoke Game Designer Agent
```
"Improve game balance and add new engagement mechanics to increase player retention"
```

## Agent Capabilities Summary

| Agent | Database | External APIs | Real-time | Build/Deploy | UI/Performance | Analytics | Monetization | Gameplay |
|-------|----------|---------------|-----------|--------------|----------------|-----------|--------------|----------|
| Database Schema | ✓✓✓ | - | - | - | - | ✓ | ✓ | ✓ |
| Game Data Scraper | ✓ | ✓✓✓ | - | - | ✓ | - | - | - |
| WebSocket Server | ✓ | - | ✓✓✓ | - | ✓ | ✓ | - | ✓ |
| Deployment Pipeline | ✓ | - | - | ✓✓✓ | ✓ | - | - | - |
| Tournament System | ✓✓✓ | - | ✓ | - | ✓ | ✓ | ✓ | ✓ |
| Performance Monitor | - | - | ✓ | ✓ | ✓✓✓ | ✓ | - | ✓ |
| Data Scientist | ✓✓✓ | ✓ | ✓ | ✓ | ✓ | ✓✓✓ | ✓ | ✓ |
| Economy | ✓✓✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓✓✓ | ✓ |
| Game Designer | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓✓✓ |

✓✓✓ = Primary expertise
✓ = Secondary capability
\- = Not applicable

These agents provide comprehensive coverage for all aspects of **RetroRanks arcade gaming platform** development, from managing 1000+ game databases and global highscore leaderboards to real-time multiplayer experiences, production deployments, data-driven insights, sustainable monetization strategies, and platform-wide engagement optimization.