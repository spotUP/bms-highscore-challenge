# Shader Compilation Status

## Current Status

### ✅ Major Achievement: Duplicate Function Prevention
Successfully implemented tracking system to prevent duplicate function definitions from stub functions and globalDefs extractions.

### ❌ Persistent Issue: Guest CRT Function Call Syntax Error

**Error**: `ERROR: 0:2910: '0.0' : syntax error` at line `float no_scanlines = HSM_GetNoScanlineMode();`

**Function Definition** (Line 940): `float HSM_GetNoScanlineMode() { return 0.0; }`

**Mystery**: The function is properly defined with correct signature, placed before the call site, has no duplicates, but GLSL compiler refuses to accept the function call, specifically reporting an error on the return value literal `'0.0'`.

## Fixes Applied

### 1. ✅ Duplicate Function Prevention (Lines 1438-1467, 1624-1628)
```typescript
// Track stub function names
const stubFunctionNames = new Set<string>();
for (const func of stubFunctions) {
  stubFunctionNames.add(func.name);
}

// Skip globalDefs functions that match stubs
if (funcName && stubFunctionNames.has(funcName)) {
  console.error(`[buildGlobalDefinitionsCode] ⚠ Skipping ${funcName} from globalDefs (stub already added)`);
  continue;
}
```

### 2. ✅ Single-Line Function Format
Converted multi-line stub functions to single-line to prevent body-stripping by `removeDuplicateFunctions()`:
- `HSM_GetTubeCurvedCoord`
- `HSM_GetMirrorWrappedCoord`
- `HSM_GetRotatedCoreOriginalSize`
- `HSM_GetRotatedDerezedSize`
- `HSM_GetUseFakeScanlines`
- `HSM_GetNoScanlineMode`
- `HSM_UpdateGlobalScreenValuesFromCache`

### 3. ✅ Function Signature Corrections
Fixed parameter mismatches:
- `HSM_GetMirrorWrappedCoord`: Changed from `(vec2, float, float)` to `(vec2)`
- `HSM_UpdateGlobalScreenValuesFromCache`: Changed from `void (sampler2D)` to `vec4 (sampler2D, vec2)`

## Test Results

### Pass 0 (Derez): ✅ SUCCESS
### Pass 1 (Cache Info): ✅ SUCCESS
### Pass 2 (Guest CRT): ❌ FAILS with `'0.0' : syntax error`

## The Persistent Mystery

Despite all fixes:
- ✅ Function is defined: `float HSM_GetNoScanlineMode() { return 0.0; }`
- ✅ Function is defined BEFORE call site (line 940 vs 2910)
- ✅ No duplicate definitions
- ✅ Correct return type (float)
- ✅ Correct parameter count (0)
- ✅ No uniform conflicts
- ❌ GLSL compiler reports syntax error on the return value literal

### Theories

1. **Scope Issue**: Function might be defined in wrong scope (inside another function/block)
2. **GLSL Version Incompatibility**: WebGL GLSL ES might not support certain function syntax
3. **Compilation Order**: Function might not be visible due to shader stage separation
4. **Name Collision**: Function name might conflict with a built-in or reserved identifier
5. **Context-Specific Issue**: The specific calling context in Guest CRT shader has unique requirements

### Recommendations

1. **Accept 3-Pass Configuration**: Use the working tier1-test-no-crt.slangp (derez + cache-info + stock) and proceed with bezel implementation
2. **Try Alternative CRT Shader**: Test with a simpler CRT shader that doesn't use these function calls
3. **Full Dependency Implementation**: Implement complete versions of all HSM functions with proper dependencies (significant work)
4. **Report to Mega Bezel Community**: This appears to be a fundamental compatibility issue between Mega Bezel shaders and WebGL GLSL

## Progress Summary

- ✅ Fixed duplicate function extraction
- ✅ Fixed function body preservation in stubs
- ✅ Fixed function signature mismatches
- ✅ Pass 0 and Pass 1 compile successfully
- ❌ Pass 2 (Guest CRT) still fails with mysterious syntax error

## Files Modified

**src/shaders/SlangShaderCompiler.ts:**
- Lines 1158: Single-line `HSM_GetTubeCurvedCoord`
- Lines 1184: Single-line `HSM_GetMirrorWrappedCoord` with correct signature
- Lines 1317, 1323: Single-line size functions
- Lines 1372: Fixed `HSM_UpdateGlobalScreenValuesFromCache` return type
- Lines 1427-1434: Single-line scanline functions
- Lines 1438-1467: Stub name tracking system
- Lines 1624-1628: Skip globalDefs duplicates

## Next Steps

Given the persistent and mysterious nature of the Guest CRT error, recommend:
1. Use the working 3-pass setup
2. Focus on implementing bezel/reflection passes
3. Consider this a known limitation for now
4. Revisit if community provides WebGL-compatible Guest CRT implementation
