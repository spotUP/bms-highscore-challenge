# Deployment Validation System

This document describes the comprehensive environment validation system that prevents deployment loops by ensuring all prerequisites are met before deployment.

## Overview

The validation system consists of two main scripts:

1. **`scripts/check-env.ts`** - Basic environment validation (runs during dev/build)
2. **`scripts/pre-deploy-validation.ts`** - Comprehensive pre-deployment validation

## Features

### 🚀 Enhanced Environment Checks
- **Detailed validation** of all environment variables with specific error messages
- **Format validation** for URLs, API keys, and port numbers
- **Legacy variable detection** with migration suggestions
- **Connectivity testing** for external services

### 🔗 Database Connectivity
- **Supabase connection testing** with authentication verification
- **Permission validation** (handles expected anon key restrictions)
- **Error categorization** (network vs. auth vs. service issues)

### 🌐 WebSocket Server Validation
- **Health endpoint checking** with timeout handling
- **Server status reporting** (active rooms, players, instance ID)
- **Graceful handling** of missing servers in development

### 📦 Build Artifacts Integrity
- **Production build verification** (existence and freshness)
- **Essential file checking** (index.html, assets)
- **Build age validation** (prevents deployment of stale builds)

### ⚙️ Configuration Consistency
- **Package.json validation** (required scripts and metadata)
- **Configuration file presence** checks
- **TypeScript compilation** verification

### 📚 Dependencies & Compilation
- **Node modules verification**
- **TypeScript compilation** testing
- **Import validation** for critical dependencies

## Usage

### Development
The basic environment check runs automatically:
```bash
npm run dev    # Runs check-env.ts before starting dev server
npm run build  # Runs check-env.ts before building
```

### Pre-Deployment
Run comprehensive validation before deploying:
```bash
npm run validate-deploy  # Runs pre-deploy-validation.ts
```

### CI/CD Integration
Add to your deployment pipeline:
```yaml
# Example GitHub Actions
- name: Validate Deployment Readiness
  run: npm run validate-deploy
```

## Validation Checks

| Check | Required | Description |
|-------|----------|-------------|
| Environment Variables | ✅ | Validates VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY |
| Supabase Connectivity | ✅ | Tests database connection and basic queries |
| WebSocket Server | ❌ | Checks server health endpoint (optional for static deployments) |
| Build Artifacts | ✅ | Verifies production build exists and is recent |
| Configuration Consistency | ❌ | Validates package.json and config files |
| Dependencies | ✅ | Ensures node_modules and critical imports work |
| TypeScript Compilation | ❌ | Runs tsc --noEmit to check for type errors |

## Error Messages & Solutions

### Common Issues

#### ❌ Missing environment variables
```
❌ Missing required environment variable: VITE_SUPABASE_URL
💡 Suggestions for VITE_SUPABASE_URL:
   • Check your Supabase project settings
   • Ensure you're using the correct project URL
   • Verify the URL starts with https://
```

**Solution**: Add the missing variable to your `.env` file or deployment environment.

#### ❌ Supabase connection failed
```
❌ Supabase connectivity test failed: permission denied
💡 Check your Supabase project status and API keys
💡 Verify your database is accessible and not paused
```

**Solution**: Check Supabase dashboard, verify API keys, ensure project is not paused.

#### ❌ Build artifacts missing
```
❌ Production build directory does not exist
💡 Run "npm run build" to create the production build
```

**Solution**: Run `npm run build` to generate the production build.

#### ❌ Build too old
```
❌ Build is 25.3 hours old
💡 Rebuild with "npm run build" for deployment
```

**Solution**: Rebuild the project with `npm run build`.

## Configuration

### Environment Variables

Required for production:
- `VITE_SUPABASE_URL` - Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anonymous/public API key

Optional:
- `PORT` - WebSocket server port (defaults to 3002)
- `SKIP_CONNECTIVITY_CHECKS` - Set to 'true' to skip network tests

### Validation Thresholds

- **Build age limit**: 24 hours (configurable in script)
- **WebSocket timeout**: 5 seconds
- **Supabase query timeout**: Uses default fetch timeout

## Exit Codes

- `0` - All validations passed
- `1` - One or more required validations failed

## Integration Examples

### Vercel Deployment
```json
{
  "scripts": {
    "build": "npm run validate-deploy && vite build"
  }
}
```

### GitHub Actions
```yaml
name: Deploy
on: [push]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run validate-deploy
      - run: npm run build
      # ... deployment steps
```

### Docker
```dockerfile
# Build stage
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run validate-deploy
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
```

## Troubleshooting

### Validation fails in CI but passes locally
- Check environment variable injection in CI
- Ensure secrets are properly configured
- Verify network access to external services

### WebSocket server check fails
- For static deployments, this check can be skipped
- Ensure WebSocket server is running during validation
- Check firewall/network configuration

### Supabase connection issues
- Verify API keys are correct and not expired
- Check if Supabase project is active (not paused)
- Ensure network connectivity to Supabase endpoints

## Benefits

✅ **Prevents deployment loops** - Fail fast with clear error messages
✅ **Reduces debugging time** - Actionable error messages tell you exactly what to fix
✅ **Improves reliability** - Comprehensive checks catch issues before they reach production
✅ **Developer experience** - Clear guidance on how to resolve issues
✅ **CI/CD integration** - Automated validation in deployment pipelines

## Future Enhancements

- Database schema validation
- Performance benchmark checks
- Security vulnerability scanning
- Integration with deployment platforms
- Custom validation rules per environment