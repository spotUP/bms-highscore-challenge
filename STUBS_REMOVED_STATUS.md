# All Stubs Removed - Real Functions Now Used ✅

## What Was Done

**Removed ALL stub functions** from `src/shaders/SlangShaderCompiler.ts` (lines 1150-1467).

Previously there were **30+ stub functions** that were blocking real implementations from globalDefs.

## Current Status

### ✅ Working (Using Real Functions from globalDefs)

These functions are now properly extracted from .inc files:
- `HSM_GetUseFakeScanlines()`
- `HSM_GetNoScanlineMode()`
- `HSM_GetCurvedCoord()`
- `HSM_Linearize()`
- `HSM_Delinearize()`
- `HHLP_GetMaskCenteredOnValue()`
- And many more...

### ❌ Still Missing (Not Extracted from .inc Files)

These functions are called in pass_1 (cache-info) vertex shader but not extracted:
- `hrg_get_ideal_global_eye_pos()` - from royale-geometry-functions.inc
- `HSM_GetCornerMask()` - from common-functions.inc

## Why These Functions Are Missing

The function extraction system (`extractGlobalDefinitions()`) processes #include directives and extracts functions. However:

1. **Nested Dependencies**: `hrg_get_ideal_global_eye_pos()` is called INSIDE `HRG_GetGeomCurvedCoord()`. When `HRG_GetGeomCurvedCoord()` is extracted, its dependency isn't automatically extracted.

2. **Selective Extraction**: The extraction might be filtering these functions out or not processing royale-geometry-functions.inc properly.

## Compilation Results

- ✅ **Pass 0 (Derez)**: COMPILES
- ❌ **Pass 1 (Cache Info)**: Vertex shader fails - missing `hrg_get_ideal_global_eye_pos` and `HSM_GetCornerMask`
- ✅ **Pass 2 (Guest CRT)**: COMPILES - uses real `HSM_GetNoScanlineMode()` from globalDefs

## The Core Issue

The Guest CRT shader error (`'0.0' : syntax error`) was **FIXED** by removing stubs and using real functions.

The pass_1 error is a **different issue** - the extraction system doesn't handle all nested dependencies from .inc files.

## Solution Path Forward

Instead of adding stubs back, the proper fix is:

1. **Improve extraction**: Make `extractGlobalDefinitions()` handle nested function dependencies
2. **Or use a simpler preset**: Use a shader preset that doesn't require these complex geometry functions
3. **Or use tier1-test-no-crt.slangp**: This preset works without Guest CRT

## Key Lesson Learned

**Stubs hide problems instead of fixing them.** By removing all stubs, we can now see exactly which functions the extraction system is missing, rather than masking the issue with fake implementations.

The Guest CRT issue the user asked to fix is **100% resolved** ✅.
