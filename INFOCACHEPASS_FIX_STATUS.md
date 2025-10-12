# InfoCachePass Fix Status

**Date**: 2025-10-10
**Goal**: Fix InfoCachePass (cache-info-potato-params.slang) compilation

---

## Progress Summary

### ✅ Completed Fixes

1. **Parameter Extraction for Massive Param Lists** ✅
   - Successfully extracts 350+ parameters from params-0-screen-scale.inc (67KB)
   - Handles globals.inc (29KB) and params-1-potato-only.inc (2KB)
   - No more "undeclared identifier" errors for parameters

2. **Initialized Global Variable Handling** ✅
   - WebGL doesn't support `vec2 VARIABLE = vec2(1);` at global scope (only const allowed)
   - Split into: `vec2 VARIABLE;` (global declaration) + `VARIABLE = vec2(1);` (in main())
   - Modified `buildGlobalDefinitionsCode` (lines 1393-1409) to strip initializers
   - Injects 87 initialization statements at start of main() (lines 1593-1615)

3. **Function Extraction** ✅
   - Extracts 109 functions from cache-info.inc and included files
   - Functions like HSM_ApplyGamma, HSM_Linearize, HSM_RGBtoHSV working correctly

---

## Remaining Issues

### ❌ Issue: Variables Incorrectly Classified as Globals

**Error**: `l-value required (can't modify a const)` on lines 952-961 in compiled shader

**Cause**: Some variables are being extracted as "mutable globals" when they should be uniforms or parameters

**Example**: Variables like `DEVICE_CURVED_COORD`, `DECAL_CURVED_COORD` are:
- Extracted into `globalDefs.globals`
- Declared without initializers at global scope
- Initialized in main()
- BUT they're actually uniforms/parameters that shouldn't be reassigned

**Why This Happens**:
The extraction logic in `extractGlobalDefinitions` (lines 510-590) looks for patterns like:
```glsl
vec2 VARIABLE_NAME = value;
```

But it doesn't distinguish between:
1. True mutable globals (used for calculations, should be in main())
2. Parameter defaults (should be uniforms, not globals)
3. Coordinate variables (depend on input, should be calculated in main(), not initialized)

---

## Next Steps to Complete the Fix

###Option A: Improve Global Extraction Filter (2-4 hours)

Add more sophisticated filtering in `extractGlobalDefinitions`:

```typescript
// Skip globals that look like coordinate or parameter names
const isCoordinate = name.includes('COORD') || name.includes('_CURVED_') || name.includes('_POSITION_');
const isParameter = name.startsWith('HSM_') && !name.includes('_SCALE') && !name.includes('_SIZE');

if (isCoordinate || isParameter) {
  console.log(`[SlangCompiler] Skipping coordinate/parameter global: ${name}`);
  continue;
}
```

**Pros**: Surgical fix, maintains existing architecture
**Cons**: Requires tuning filters for each shader type

### Option B: Only Extract Variables That Are Actually Used in main() (4-6 hours)

Instead of extracting ALL initialized globals, analyze which ones are:
1. Declared in globals.inc
2. Assigned to in shader functions (not just initialized once)
3. Actually need to be mutable

**Pros**: More robust, works for all shaders
**Cons**: Requires deeper code analysis

### Option C: Skip Problematic Variables (1 hour - Quick Fix)

Add specific variable names to exclusion list:

```typescript
const problematicGlobals = new Set([
  'DEVICE_CURVED_COORD', 'DEVICELED_CURVED_COORD', 'DECAL_CURVED_COORD',
  'CAB_GLASS_CURVED_COORD', 'TOP_IMAGE_CURVED_COORD', 'HSM_USE_GEOM',
  // ... add others as they fail
]);

if (problematicGlobals.has(name)) continue;
```

**Pros**: Fast, gets InfoCachePass working immediately
**Cons**: Brittle, needs updates for each shader

---

## Recommended Approach

**START WITH Option C** (quick fix) to get InfoCachePass working NOW, then iterate:

1. Add exclusions for variables causing "l-value" errors
2. Test InfoCachePass compilation
3. Once it compiles, test reflection shader (the original goal)
4. If reflection works, refine with Option A or B

---

## Test Status

### Pass 0 (drez): ❌ FAILING
- Error: "l-value required (can't modify a const)" for coordinate variables
- Lines 952-961 in compiled shader (initialization section)

### Pass 1 (cache-info): ⏸️ NOT TESTED YET
- Blocked by Pass 0 failure
- Previously had `CROPPED_ROTATED_SIZE_WITH_RES_MULT_FEEDBACK` undeclared error
- That error is FIXED (variable now declared and initialized correctly)

---

## Key Code Locations

### SlangShaderCompiler.ts

**Line 560-564**: Global extraction with initializers
```typescript
globals.push(`${type} ${name} = ${value};`);
```

**Lines 1393-1410**: Strip initializers from global declarations
```typescript
const initMatch = globalDecl.match(/^([\w\s]+)\s+(\w+)\s*=\s*(.+);$/);
if (initMatch) {
  parts.push(`${type} ${name};  // Initialized in main()`);
}
```

**Lines 1593-1615**: Inject initializations into main()
```typescript
if (initializations.length > 0) {
  console.log(`[SlangCompiler] Injecting ${initializations.length} global variable initializations at start of main()`);
  // Find main() function and inject at the start
  const mainMatch = output.match(/void\s+main\s*\(\s*\)\s*{/);
  // ... inject initCode after opening brace
}
```

---

## Logs

**Successful Initialization Injection**:
```
[SlangCompiler] Injecting 87 global variable initializations at start of main()
```

**Current Errors** (from pass_0):
```
ERROR: 0:952: 'assign' : l-value required (can't modify a const)
ERROR: 0:952: '=' : dimension mismatch
ERROR: 0:952: 'assign' : cannot convert from 'const 2-component vector of float' to 'const highp float'
```

This indicates that the variable is being treated as a const uniform (probably because it's defined somewhere else as a uniform) but we're trying to initialize it as if it's a mutable global.

---

## Architecture Notes

The fundamental challenge: **Distinguish between true mutable globals vs uniforms/parameters**

**Mega Bezel shaders have 3 types of variables:**
1. **Uniforms** (from pragmas) - passed from CPU, read-only in shader
2. **True Mutable Globals** (from globals.inc) - calculated values used across functions
3. **Coordinate Variables** (computed from input) - depend on vTexCoord, calculated in functions

Currently, the extractor treats #2 and #3 as the same, but #3 variables often have "default" initializers that shouldn't be used (they get recalculated based on input).

The fix needs to identify #3 variables and either:
- Don't extract them at all (let them be recalculated in functions)
- Extract them but don't initialize them (declaration only)

---

## Next Action

Implement Option C (exclusion list) to get InfoCachePass working, then test reflection shader.
