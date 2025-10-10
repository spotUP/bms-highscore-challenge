# Continue Fixing Mega Bezel Shader Compilation

## Current State
The previous developer (Sonnet) has successfully fixed 7 major WebGL 1 compatibility issues, reducing errors from 200+ unique patterns to about 20. The foundation work is complete - now we need targeted fixes for the remaining issues.

## Your Mission
Fix the remaining shader compilation errors to get the Mega Bezel reflection shader working. Focus on these TOP PRIORITY issues that are causing thousands of errors:

### 🔴 CRITICAL - Fix These First (Causing 10,000+ Errors)

#### 1. Function Parameter Loss Bug (6,264 errors)
**Problem**: Function parameters are being stripped during compilation
```glsl
// Original function has 3 parameters:
float HHLP_GetMaskCenteredOnValue(float in_value, float value_to_match, float threshold)

// But after compilation only has 1:
float HHLP_GetMaskCenteredOnValue(float in_value)
```

**Impact**:
- 2,044 errors for 'value_to_match' undeclared
- 2,044 errors for 'threshold' undeclared
- Plus cascading type mismatch errors

**Fix Location**: `src/shaders/SlangShaderCompiler.ts`
- Check `removeDuplicateFunctions()` method (line ~3375)
- The regex for extracting parameters may be broken
- Add console logging to debug what's happening to parameters

#### 2. Dimension Mismatch Errors (3,293 errors)
**Problem**: Type conversions failing, likely cascading from parameter loss
- `'=' : dimension mismatch`
- `cannot convert from 'const mediump float' to 'highp 2-component vector of float'`

**Root Cause**: When functions lose parameters, return types don't match expected types

#### 3. HSM_POTATO_COLORIZE_CRT_WITH_BG Redefinition (629 errors)
**Problem**: Constant being defined twice
- Once in shader files
- Once in our `injectMissingConstants()`

**Fix**: Make injection conditional - check if constant exists before adding

### 🟡 SECONDARY - Fix After Critical Issues (2,000+ Errors)

#### 4. Missing Constants (1,900+ errors total)
Add these to `injectMissingConstants()` in `SlangShaderCompiler.ts`:
```javascript
// Add around line 3630
'TUBE_DIFFUSE_ASPECT': '1.0',
'TUBE_SCALE': 'vec2(1.0, 1.0)',
'TUBE_MASK': '1.0',
'TUBE_DIFFUSE_SCALE': '1.0',
'SCREEN_ASPECT': '1.77777',
'HSM_BG_OPACITY': '1.0',
'HSM_GLOBAL_CORNER_RADIUS': '0.0'
```

#### 5. Duplicate Function Bodies (1,404 errors)
Functions being defined multiple times:
- `HSM_Linearize` (510 errors)
- `HSM_Delinearize` (511 errors)
- `HSM_GetCurvedCoord` (383 errors)

**Debug**: Add logging to `removeDuplicateFunctions()` to see why these aren't being caught

### 🟢 MINOR - Fix Last (Under 1,000 Errors Each)

6. texture2D overload issues (627 errors)
7. Missing HSM_ helper functions (various ~383 each)
8. transpose() function not found (377 errors)

## File Structure

### Main File to Edit
`src/shaders/SlangShaderCompiler.ts` - All fixes go here

Key methods already created by previous developer:
- `convertStorageQualifiers()` - Line 3316 ✅ WORKING
- `convertDoWhileLoops()` - Line 3393 ✅ WORKING
- `removeDuplicateFunctions()` - Line 3375 ⚠️ NEEDS FIX (parameter loss bug)
- `fixWebGLIncompatibilities()` - Line 3540 ✅ WORKING
- `injectMissingConstants()` - Line 3630 ⚠️ NEEDS ADDITIONS

### Testing Commands

```bash
# Start dev server
killall -9 node && sleep 2 && npm run dev

# Count total errors
timeout 10s node capture-webgl-errors.mjs 2>&1 | grep -c "ERROR:"

# See unique error patterns with counts
timeout 10s node capture-webgl-errors.mjs 2>&1 | grep "ERROR:" | sed 's/ERROR: [0-9]*:[0-9]*:/ERROR:/' | sort | uniq -c | sort -rn | head -20

# Get detailed error examples
timeout 10s node capture-webgl-errors.mjs 2>&1 | grep "ERROR:" | head -100

# Quick test specific issues
timeout 10s node capture-webgl-errors.mjs 2>&1 | grep "value_to_match"
timeout 10s node capture-webgl-errors.mjs 2>&1 | grep "HSM_POTATO_COLORIZE"
```

## Debugging Strategy

### For Parameter Loss Bug:
1. Add console.log in `removeDuplicateFunctions()`:
```javascript
console.log(`[DEBUG] Function: ${functionName}`);
console.log(`[DEBUG] Original params: ${match[2]}`);
console.log(`[DEBUG] Normalized params: ${normalizedParams}`);
```

2. Look for functions like `HHLP_GetMaskCenteredOnValue` to see what's happening

3. Check if the regex is capturing the full parameter list:
```javascript
const functionRegex = /^[\s]*([a-zA-Z_][a-zA-Z0-9_]*)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*\{/gm;
```

### For Redefinition Issues:
1. Check if constant already exists before injecting:
```javascript
// In injectMissingConstants()
if (!processedCode.includes('HSM_POTATO_COLORIZE_CRT_WITH_BG')) {
    constantsToInject.push('#define HSM_POTATO_COLORIZE_CRT_WITH_BG 0.0');
}
```

### For Missing Functions:
Check if functions are in include files that aren't being processed correctly.

## Success Criteria

### Minimum Goal
- Reduce total errors from 38,000+ to under 5,000
- Fix the parameter loss bug (eliminates ~6,000 errors)
- Fix redefinition issues (eliminates ~600 errors)
- Add missing constants (eliminates ~2,000 errors)

### Stretch Goal
- Get total errors under 1,000
- Make shader actually render something (even if not perfect)

## Important Context

### What's Already Working ✅
- Do-while loops converted to while loops
- Storage qualifiers (in/out → varying) converted correctly
- Texture functions normalized to texture2D()
- Basic type conversions (mat3x3 → mat3, uint → float)
- Function overload preservation system (but has bugs)

### Architecture Notes
- WebGL 1 (GLSL ES 1.0) compatibility required
- Shaders are Slang format converted to GLSL
- Multi-pass rendering system with 40+ shader passes
- Three.js is the rendering engine

### Don't Break What's Working!
The previous developer's fixes are solid. Don't modify these working methods:
- `convertStorageQualifiers()`
- `convertDoWhileLoops()`
- `fixWebGLIncompatibilities()` texture conversions

Focus on:
1. Fixing the parameter stripping bug in `removeDuplicateFunctions()`
2. Adding missing constants
3. Making constant injection conditional

## Quick Start

1. Open `src/shaders/SlangShaderCompiler.ts`
2. Search for `removeDuplicateFunctions` (line ~3375)
3. Add debug logging to understand parameter loss
4. Fix the regex or parsing logic
5. Test with: `timeout 10s node capture-webgl-errors.mjs 2>&1 | grep "value_to_match" | wc -l`
6. Should see error count drop from 2,044 to 0

Good luck! The foundation is solid - you just need to fix these specific bugs to get the shader working.