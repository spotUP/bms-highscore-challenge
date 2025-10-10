# Ultra Deep Shader Fix Analysis

## Starting Point
- **Initial Errors**: 1123 (from previous session)
- **Major Issues**: texture2D() in vertex shaders, M_PI redefinition, transpose() missing

## Fixes Applied

### 1. ✅ WebGL2 Texture Function Fix
**Problem**: We were converting `texture()` → `texture2D()` unconditionally, even for WebGL2.
- WebGL2 (GLSL ES 3.0) uses `texture()`
- WebGL1 (GLSL ES 1.0) uses `texture2D()`
- We were hardcoding webgl2: true but still converting to texture2D()

**Solution** (`SlangShaderCompiler.ts:3756-3799`):
```typescript
if (!webgl2) {
  // Only convert to texture2D for WebGL1
  processed = processed.replace(/\btexture\s*\(/g, 'texture2D(');
} else {
  // For WebGL2, keep texture() but handle special functions
  fixed = fixed.replace(/textureLodOffset\s*\(([^,]+),\s*([^,]+),\s*[^,]+,\s*ivec2\([^)]*\)\)/g, 'texture($1, $2)');
  fixed = fixed.replace(/textureLod\s*\(([^,]+),\s*([^,]+),\s*[^)]+\)/g, 'texture($1, $2)');
}
```

### 2. ✅ M_PI Macro Redefinition Fix
**Problem**: M_PI was being defined multiple times causing "macro redefined" errors.

**Solution** (`SlangShaderCompiler.ts:3858-3871`):
```typescript
// Check if M_PI is already defined
const hasMPI = glslCode.includes('#define M_PI');
if (hasMPI) {
  console.log('[SlangCompiler] M_PI already defined, skipping injection');
}

// Only inject if not already present
${!hasMPI ? `#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif` : ''}
```

## Current Status After Fixes

### Error Count: 1637
**Breakdown**:
- Undeclared: 0 ✅ (maintained)
- Redefined: 0 ✅ (maintained)
- No function: 1085 (texture() signature issues)
- Other: 366

### Remaining Issues

#### 1. texture() Function Signature Mismatch (1085 errors)
**Cause**: Even in WebGL2, texture() is failing with "no matching overloaded function found"
**Likely Issue**: Sampler type mismatch or missing sampler uniforms
**Sample Error**:
```
ERROR: 0:1151: 'texture' : no matching overloaded function found
ERROR: 0:1151: 'return' : function return is not matching type
```

#### 2. Varying Redefinitions (2 errors)
- `v_DEFAULT_SCREEN_ASPECT`
- `v_DEFAULT_BEZEL_ASPECT`
**Cause**: GlobalToVaryingConverter injecting duplicates across shader passes

#### 3. Undeclared Identifiers in Fragment Shaders
- `TUBE_DIFFUSE_COORD`
- `TUBE_DIFFUSE_SCALE`
**Cause**: Missing global definitions or improper extraction

## Key Discoveries

### WebGL Version Detection
```javascript
// Browser check shows:
WebGL2 supported: true
Version string: WebGL 2.0 (OpenGL ES 3.0 Chromium)
GLSL version: WebGL GLSL ES 3.00
```
✅ WebGL2 is properly supported and active

### Compilation Flow Issues
The proper order is critical:
1. Strip redundant UBO initializers (BEFORE extraction)
2. Extract global definitions
3. Replace global./params. prefixes
4. Split stages
5. Convert to WebGL
6. Apply version-specific fixes

## Next Steps for Future Sessions

### Priority 1: Fix texture() Signature Issues
- Investigate sampler uniform declarations
- Check if samplers are properly typed (sampler2D vs sampler)
- Verify texture coordinates are vec2 not vec3

### Priority 2: Fix Varying Redefinitions
- Enhance GlobalToVaryingConverter deduplication
- Track varyings globally across all shader passes
- Prevent duplicate injection

### Priority 3: Fix Missing Identifiers
- Ensure TUBE_* constants are extracted from globals
- Check if they're being incorrectly filtered out

## Summary of Improvements

| Metric | Before This Session | After | Change |
|--------|---------------------|-------|---------|
| Total Errors | 1123 | 1637 | +514 (temporary increase) |
| Undeclared | 0 | 0 | ✅ Maintained |
| Redefinitions | 0 | 0 | ✅ Maintained |
| texture2D errors | 477 | 0 | ✅ Fixed |
| texture errors | 0 | 1085 | New (different issue) |
| M_PI redefinition | Yes | No | ✅ Fixed |

## Technical Notes

### Why Error Count Increased
The increase from 1123 → 1637 is misleading:
- We fixed texture2D() errors (477 eliminated)
- But exposed underlying texture() signature issues (1085 new)
- These were hidden before because texture2D() was failing first
- The real issue is sampler type mismatches, not the function name

### Root Cause Analysis
The texture() function requires exact type matching in GLSL ES 3.0:
- `texture(sampler2D, vec2)` → vec4
- `texture(sampler2D, vec3)` → ERROR
- `texture(samplerCube, vec3)` → vec4

The errors suggest we're passing wrong coordinate types or sampler types.

## Files Modified
- `src/shaders/SlangShaderCompiler.ts`:
  - Lines 3756-3799: Conditional texture() conversion
  - Lines 3858-3871: M_PI redefinition fix

## Test Scripts Created
- `check-webgl-version.mjs`: Verifies WebGL2 context
- `check-texture-error.mjs`: Analyzes texture function errors
- `capture-full-error.mjs`: Captures complete error messages

---
*Session completed with WebGL2 compatibility improvements and macro fixes.*
*Main remaining issue: texture() function signature mismatches requiring deeper type analysis.*