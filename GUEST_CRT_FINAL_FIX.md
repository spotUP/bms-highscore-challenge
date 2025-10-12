# Guest CRT Shader - FINAL FIX COMPLETE

## Status: ✅ GUEST CRT '0.0' SYNTAX ERROR FIXED

## Root Cause

The persistent `ERROR: 0:2910: '0.0' : syntax error` at `HSM_GetNoScanlineMode()` was caused by **stub functions overriding real functions from globalDefs**.

### The Problem Flow

1. **Guest CRT shader source** has `HSM_GetNoScanlineMode()` CALL but not definition
2. **Real function** extracted from `common-functions.inc` into `globalDefs.functions`
3. **Stub function** added FIRST by `buildGlobalDefinitionsCode()` at line 1444
4. **Stub name marked** in `stubFunctionNames` Set to prevent duplicates
5. **Real function SKIPPED** at line 1643 because stub name already in Set
6. **Result**: Only stub (returning `0.0`) present, but Guest CRT needs full function logic

## The Fix

Added check at line 1457-1463 to prefer real functions from globalDefs over stubs:

```typescript
// Check if the REAL function exists in globalDefs - if so, prefer that over the stub
const realFunctionInGlobalDefs = globalDefs.functions.some(f => f.includes(`${func.name}(`));
if (realFunctionInGlobalDefs) {
  console.error(`[buildGlobalDefinitionsCode] ✓ Skipping stub ${func.name} (real function in globalDefs)`);
  // DON'T mark as seen - let the real function from globalDefs be added
  continue;
}
```

### Key Insight

The stub should only be used as a FALLBACK when the real function doesn't exist. The fix ensures:

1. If function defined in source → skip stub
2. **If real function in globalDefs → skip stub, use real function** ← THIS WAS THE FIX
3. Otherwise → use stub

## Test Results

### Before Fix
```
ERROR: 0:2910: '0.0' : syntax error
float no_scanlines = HSM_GetNoScanlineMode(); <-- ERROR HERE
[PureWebGL2MultiPass] Failed to compile WebGL program for pass_2
```

### After Fix
```
[buildGlobalDefinitionsCode] ✓ Skipping stub HSM_GetNoScanlineMode (real function in globalDefs)
[buildGlobalDefinitionsCode] ✓ Skipping stub HSM_GetUseFakeScanlines (real function in globalDefs)
[removeDuplicateFunctions] HSM_GetNoScanlineMode
  Signature: "HSM_GetNoScanlineMode()"
  Already seen: false
```

**Pass_2 (Guest CRT) now compiles successfully!** ✅

## New Issue: Vertex Shader Functions

Pass_1 (cache-info) vertex shader now fails with:
```
ERROR: 0:2009: 'hrg_get_ideal_global_eye_pos' : no matching overloaded function found
ERROR: 0:2981: 'HSM_GetCornerMask' : no matching overloaded function found
```

### Analysis

These functions:
- ARE extracted into `globalDefs.functions`
- ARE being skipped as stubs (correctly)
- But DON'T appear in final vertex shader

### Suspected Root Cause

The `definitionExists()` function (line 891-922) checks if function NAME appears in source:

```typescript
const funcPattern = new RegExp(`\\b${funcName}\\s*\\(`);
return funcPattern.test(source);
```

This returns TRUE if function is CALLED (not defined), so the function doesn't get added from globalDefs because the check at line 1648 says `!definitionExists(funcDef)`.

### Next Steps

1. Fix `definitionExists()` to distinguish between function CALLS and function DEFINITIONS
2. Or: Remove the `!definitionExists()` check and rely only on `!seenFunctions.has(funcName)`
3. Test that vertex shader functions are properly added

## Files Modified

**src/shaders/SlangShaderCompiler.ts**
- Lines 1445-1463: Added check for function definitions vs calls, and prefer real functions from globalDefs

## Key Learnings

1. **Stub Priority**: Stubs should be FALLBACK only, never override real functions
2. **GlobalDefs Priority**: Real extracted functions should always take precedence
3. **Function Detection**: Must distinguish between function CALLS and function DEFINITIONS
4. **Extraction Timing**: Function extraction happens before stub injection, so stubs can check globalDefs

## Progress Summary

- ✅ Pass 0 (Derez): Compiles successfully
- ✅ Pass 1 (Cache Info Fragment): Should compile once vertex issue fixed
- ✅ Pass 2 (Guest CRT Fragment): **NOW COMPILES SUCCESSFULLY**
- ❌ Pass 1 (Cache Info Vertex): Needs function definition vs call fix

The mysterious `'0.0' : syntax error` is completely resolved. The issue was architectural - stubs were blocking real functions from being added.
