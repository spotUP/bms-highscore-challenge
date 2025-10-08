# AGENTS.md

This file provides context and instructions for AI coding agents working on the BMS Highscore Challenge project.

## Project Overview

This is a React/TypeScript application featuring a Pong game with advanced graphics effects, including Mega Bezel shader integration, real-time multiplayer functionality, and a comprehensive achievement/tournament system.

### Key Technologies
- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Node.js, Socket.IO for real-time communication
- **Graphics**: Three.js, WebGL shaders (Slang GLSL compilation)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS, custom CSS
- **Shaders**: Mega Bezel preset system with custom GLSL compilation

## Development Environment

### Prerequisites
- Node.js 18+
- npm or pnpm
- Git

### Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Start WebSocket server (in separate terminal)
npm run websocket

# Build for production
npm run build
```

### Project Structure
```
src/
├── components/          # React components
├── pages/              # Page components
├── services/           # API services
├── shaders/            # GLSL shader compilation and management
├── three/              # Three.js utilities and renderers
├── contexts/           # React contexts
├── hooks/              # Custom React hooks
└── utils/              # Utility functions

public/
├── shaders/            # Shader preset files
└── assets/             # Static assets
```

## Development Guidelines

### Code Style
- Apply DRY (Don't Repeat Yourself), KISS (Keep It Simple, Stupid), and YAGNI (You Aren't Gonna Need It) principles
- Use TypeScript for all new code
- Follow React functional component patterns with hooks
- Use Tailwind CSS classes for styling
- Maintain consistent naming conventions (PascalCase for components, camelCase for variables)
- Add JSDoc comments for complex functions

### Shader Development
- Shaders are written in Slang GLSL and compiled to WebGL GLSL
- Use the `SlangShaderCompiler` for shader compilation
- Mega Bezel presets are stored in `public/shaders/mega-bezel/`
- Test shader changes in the PongSlangDemo page

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- src/components/AchievementManager.test.tsx
```

### Database
- Uses Supabase for data persistence
- Schema defined in `supabase/` directory
- Use the provided database services in `src/services/`

## Common Tasks

### Adding New Achievements
1. Define achievement in `src/utils/achievementUtils.ts`
2. Add UI components in `src/components/AchievementManagerV2.tsx`
3. Update achievement logic in relevant game components

### Modifying Shaders
1. Edit shader files in `public/shaders/`
2. Test compilation in `src/pages/PongSlangDemo.tsx`
3. Check browser console for compilation errors

### Adding New Game Features
1. Create components in `src/components/`
2. Add routing in `src/App.tsx` if needed
3. Update navigation in `src/components/TopNav.tsx`

## Build and Deployment

### Production Build
```bash
npm run build
npm run preview  # Test production build locally
```

### Deployment
The application is designed to run on modern web browsers with WebGL support. Ensure your deployment environment supports:
- ES2020+ JavaScript features
- WebGL 2.0 (with WebGL 1.0 fallback)
- WebSockets for real-time features

## Security Considerations

- All user inputs should be validated and sanitized
- Database queries use parameterized statements
- WebSocket connections are authenticated
- Shader compilation happens client-side only

## Performance Guidelines

- Use React.memo for expensive components
- Implement proper Three.js cleanup in useEffect cleanup functions
- Optimize shader compilation by caching results
- Use performance monitoring tools in development

## Troubleshooting

### Common Issues
- **Shader compilation failures**: Check browser console for GLSL errors
- **WebSocket connection issues**: Ensure both dev server and websocket server are running
- **Database connection errors**: Verify Supabase configuration

### Debug Tools
- Browser DevTools for React component debugging
- Three.js inspector for 3D scene debugging
- WebGL debugger for shader issues

## Documentation

### CHANGELOG.md
Document all major milestones and changes in CHANGELOG.md following semantic versioning:
- **Added**: New features
- **Changed**: Changes in existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security-related changes

### STATUS.md
Keep STATUS.md up-to-date with current project status so future agents know where to start:
- Current development focus
- Known issues and blockers
- Recent changes and their impact
- Next priority tasks
- Testing status and coverage

## Contributing

1. Create a feature branch from `main`
2. Make changes following the guidelines above
3. Test thoroughly (unit tests + manual testing)
4. Update CHANGELOG.md and STATUS.md as needed
5. Submit a pull request with a clear description

## Getting Help

- Check existing issues and documentation first
- Use descriptive commit messages
- Include screenshots/videos for UI changes
- Test on multiple browsers/devices when possible