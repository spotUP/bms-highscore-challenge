# Guest CRT Shader - FIXED ✅

## Status: Guest CRT '0.0' Syntax Error RESOLVED

The persistent `ERROR: 0:2910: '0.0' : syntax error` at `HSM_GetNoScanlineMode()` has been **FIXED**.

## The Solution

**File**: `src/shaders/SlangShaderCompiler.ts` lines 1457-1463

Added check to prefer REAL functions from globalDefs over stubs:

```typescript
// Check if the REAL function exists in globalDefs - if so, prefer that over the stub
const realFunctionInGlobalDefs = globalDefs.functions.some(f => f.includes(`${func.name}(`));
if (realFunctionInGlobalDefs) {
  console.error(`[buildGlobalDefinitionsCode] ✓ Skipping stub ${func.name} (real function in globalDefs)`);
  // DON'T mark as seen - let the real function from globalDefs be added
  continue;
}
```

## What Was Wrong

Stub functions were being added FIRST and preventing real extracted functions from globalDefs from being used. The Guest CRT shader needs the FULL implementation of `HSM_GetNoScanlineMode()` with all its logic, not a simple stub returning `0.0`.

## Current Status

- ✅ Pass 0 (Derez): COMPILES
- ✅ Pass 2 (Guest CRT): COMPILES
- ❌ Pass 1 (Cache Info): Needs fixes for vertex shader functions

The Guest CRT specific error is completely resolved. The shader now uses real functions from globalDefs.

##  Next Steps

Pass 1 still fails because functions aren't being extracted properly for the vertex shader. This is NOT a stub problem - it's a function extraction problem. The solution is to improve the extraction system, NOT add more stubs.

**DO NOT ADD MORE STUBS** - they cause more problems than they solve.
