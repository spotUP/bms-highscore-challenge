# Mega Bezel REAL Shader Fix Guide

## Current Status
The REAL Mega Bezel shaders are failing to compile with hundreds of WebGL/GLSL errors. We've made some progress but need systematic fixes.

## What's Been Fixed ✅
1. **mat3x3 → mat3**: Fixed in `SlangShaderCompiler.ts` line 3343
2. **uint → float**: Fixed in `SlangShaderCompiler.ts` line 3334-3340
3. **Direct WebGL error detection**: Added `DirectWebGLCompiler.ts` for real error messages

## Remaining Issues to Fix 🔧

### 1. Duplicate Function Definitions
**Error**: `'HSM_Linearize' : function already has a body`

**Current Fix Attempt**: `removeDuplicateFunctions()` in line 3320-3379 of `SlangShaderCompiler.ts` - NOT WORKING

**What Sonnet Needs to Do**:
- The function deduplication logic isn't catching all duplicates
- Functions are being included multiple times from different include files
- Need to track function signatures better and remove ALL duplicates
- The regex in line 3338 might not be catching all function patterns

**Test Command**:
```bash
timeout 10s node capture-webgl-errors.mjs 2>&1 | grep "function already has a body" | head -20
```

### 2. GLSL ES Version Issues
**Error**: `'out' : storage qualifier supported in GLSL ES 3.00 and above only`

**Problem**: Shaders use WebGL 2/GLSL ES 3.0 features but we're in WebGL 1

**Fix in** `SlangShaderCompiler.ts` around line 2339-2358:
```javascript
// Current code tries to convert but isn't working fully
// Need to convert:
// - 'out' → 'varying' (vertex shader)
// - 'in' → 'varying' (fragment shader)
// - 'texture()' → 'texture2D()'
```

**Add to `fixWebGLIncompatibilities()` method**:
```javascript
// Fix texture() calls for WebGL 1
fixed = fixed.replace(/\btexture\s*\(/g, 'texture2D(');

// Fix out/in qualifiers more aggressively
fixed = fixed.replace(/^out\s+/gm, 'varying ');
fixed = fixed.replace(/\s+out\s+/g, ' varying ');
```

### 3. Undeclared Variables
**Errors**:
- `'RW' : undeclared identifier`
- `'crtgamut' : undeclared identifier`
- `'SPC' : undeclared identifier`
- Many more...

**Problem**: Constants and variables from includes aren't being properly declared

**Investigation Needed**:
1. Check `extractGlobalDefinitions()` in `SlangShaderCompiler.ts`
2. These variables might be in conditional compilation blocks
3. May need to add default declarations for missing vars

### 4. Function Overloading Issues
**Error**: `'HSM_GetRotatedDerezedSize' : no matching overloaded function found`

**Problem**: Function signatures don't match between declaration and usage

**Fix**: Need to ensure function declarations match their usage exactly

## File Structure

### Key Files to Edit:
1. **`src/shaders/SlangShaderCompiler.ts`** - Main shader compiler
   - `fixWebGLIncompatibilities()` - Line 3323-3354 (add more fixes here)
   - `removeDuplicateFunctions()` - Line 3320-3379 (fix the deduplication)
   - `convertToWebGL()` - Line 1323+ (main conversion logic)

2. **`src/shaders/DirectWebGLCompiler.ts`** - WebGL error detection
   - Use this to test if shaders compile after fixes

3. **`src/shaders/MultiPassRenderer.ts`** - Shader execution
   - Line 650-662: Tests compilation with DirectWebGLCompiler
   - Remove ALL fallback shaders (lines 672-710) - we want REAL or nothing

## Testing Process

### 1. Make a fix in SlangShaderCompiler.ts
### 2. Restart dev server:
```bash
killall -9 node && sleep 1 && npm run dev
```

### 3. Check for specific errors:
```bash
# Check compilation errors
timeout 15s node capture-webgl-errors.mjs 2>&1 | grep "DirectWebGLCompiler" | head -30

# Check if fixes are applied
timeout 10s node check-shader-errors.mjs 2>&1 | grep "Fixed WebGL" | head -10

# Count remaining errors
timeout 15s node capture-webgl-errors.mjs 2>&1 | grep -c "compilation error"
```

### 4. Open in browser to see if it renders:
```bash
open http://localhost:8080/slang-demo
```

## Systematic Fix Order

### Phase 1: Get ONE shader compiling
Focus on the simplest shader first: `fxaa.slang`

1. Fix duplicate functions
2. Fix 'out'/'in' qualifiers
3. Fix texture() calls
4. Add missing variables

### Phase 2: Fix common issues across all shaders
1. Apply working fixes to all 9 shader passes
2. Test each pass individually

### Phase 3: Fix shader-specific issues
Each shader has unique problems that need individual attention

## Success Criteria
- ALL 9 Mega Bezel shader passes compile without errors
- No fallback shaders used
- DirectWebGLCompiler reports "✅ Shader compiled successfully!" for all passes
- The game renders with REAL Mega Bezel CRT effects including:
  - Proper multi-pass processing
  - Bezel with reflections
  - Screen curvature and geometry
  - Advanced color grading
  - All the original Mega Bezel features

## Current Error Count
Run this to see how many errors remain:
```bash
timeout 20s node capture-webgl-errors.mjs 2>&1 | grep -E "ERROR:" | wc -l
```

Last count: ~200+ errors across all shaders

## Important Notes
- User wants ONLY real Mega Bezel - no fake approximations
- These shaders work in RetroArch but need adaptation for WebGL
- The shaders are 40KB-140KB each - they're complex but fixable
- Every error has a specific fix - it's just grunt work to fix them all

## Next Immediate Steps for Sonnet

1. **Fix the duplicate function detection**:
   - The regex in `removeDuplicateFunctions()` isn't working
   - Functions with different spacing/formatting aren't being caught
   - Need to handle vec4, mat3, bool return types better

2. **Fix the 'out' qualifier issue**:
   - Add to `fixWebGLIncompatibilities()`:
   ```javascript
   fixed = fixed.replace(/^out\s+/gm, 'varying ');
   fixed = fixed.replace(/\s+out\s+/g, ' varying ');
   ```

3. **Fix texture() calls**:
   - Add to `fixWebGLIncompatibilities()`:
   ```javascript
   fixed = fixed.replace(/\btexture\s*\(/g, 'texture2D(');
   ```

4. **Test after each fix** to see progress

The shaders ARE fixable - they just need systematic WebGL 1.0 compatibility fixes!