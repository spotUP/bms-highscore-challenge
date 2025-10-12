# Guest CRT Shader Debugging - Session Summary

## Objective
Fix the Guest CRT Advanced shader compilation to enable the full Mega Bezel shader pipeline (derez → cache-info → Guest CRT → bezel).

## Root Cause Identified
The error `ERROR: 0:3161: '0.0' : syntax error` at the line:
```glsl
float no_scanlines = HSM_GetNoScanlineMode();
```

**Primary Issue**: The shader calls `HSM_GetNoScanlineMode()` but this function has complex dependencies on the Mega Bezel function ecosystem that weren't being properly extracted/compiled.

## Key Discoveries

### 1. Function Extraction Works
- ✅ Functions `HSM_GetNoScanlineMode()` and `HSM_GetUseFakeScanlines()` ARE being extracted from `common-functions.inc`
- ✅ Functions appear in `globalDefs.functions` correctly
- ✅ Functions are defined at line ~953, called at line ~3161 (2200+ lines apart - proper placement)
- ✅ No duplicate definitions detected

### 2. Uniform Conflict Fixed
**Discovery**: `no_scanlines` exists in the UBO (globals.inc:762) but Guest CRT uses it as a LOCAL variable (hsm-crt-guest-advanced.inc:297):
```glsl
// In globals.inc UBO:
float no_scanlines;  // Line 762

// In Guest CRT shader (commented out to show it's NOT a parameter):
// #pragma parameter no_scanlines ...  // Line 106 - COMMENTED OUT
// #define no_scanlines global.no_scanlines  // Line 107 - COMMENTED OUT
float no_scanlines = HSM_GetNoScanlineMode();  // Line 297 - LOCAL variable
```

**Fix Applied**: Modified `SlangShaderCompiler.ts:3746` to exclude `no_scanlines` from UBO-to-uniform conversion:
```typescript
if (member.name === 'no_scanlines') {
  console.error(`✓ Skipping no_scanlines uniform (Guest CRT uses it as local variable)`);
  return false;
}
```

**Result**: Uniform conflict resolved, but error persists.

### 3. Stub Functions Created
Created simple stub functions to replace complex extracted functions:
```glsl
// Forward declaration
float HSM_GetNoScanlineMode();

float HSM_GetNoScanlineMode() {
  // Always use Guest scanlines (return 0.0 = scanlines enabled)
  return 0.0;
}
```

**Result**: Function compiles correctly, but call site still reports syntax error.

## What We've Confirmed
1. ✅ Function is properly defined
2. ✅ Function is defined BEFORE the call (line 953 vs 3161)
3. ✅ No duplicate definitions
4. ✅ No conflicting uniform declaration
5. ✅ Function signature is correct (`float HSM_GetNoScanlineMode()`)
6. ✅ Return type matches expected type
7. ✅ Forward declaration added

## Persistent Mystery
Despite all fixes, GLSL compiler still reports:
```
ERROR: 0:3161: '0.0' : syntax error
```

The error references the literal `'0.0'` (the function's return value), suggesting GLSL can see the function but can't properly resolve/call it for an unknown reason.

## Files Modified

### SlangShaderCompiler.ts
1. **Lines 1434-1457**: Added stub functions for `HSM_GetUseFakeScanlines` and `HSM_GetNoScanlineMode`
   - Includes forward declarations
   - Simple implementations returning `false` and `0.0`

2. **Lines 3746-3749**: Excluded `no_scanlines` from UBO-to-uniform conversion
   - Prevents uniform/local variable conflict

3. **Lines 171-205**: Added Guest CRT function injection logic (used for testing)
   - Checks if functions need manual injection
   - Debug logging for troubleshooting

### PureWebGL2Renderer.ts
**Lines 155-191**: Added comprehensive shader debugging
- Checks if `HSM_GetNoScanlineMode` is defined
- Reports definition line number
- Shows function definition source
- Detects duplicate definitions

## Working 3-Pass Shader Setup
Successfully implemented and tested:
```
Pass 0: hsm-drez-g-sharp_resampler.slang (derez)
Pass 1: cache-info-potato-params.slang (coordinate/parameter calculations)
Pass 2: stock.slang (output)
```

**Preset**: `public/shaders/mega-bezel/tier1-test-no-crt.slangp`

**Console Output**:
```
✅ [PureWebGL2MultiPass] Preset loaded successfully
✅ All 3 passes executed successfully
First frame rendered through shader pipeline
```

## Attempted Solutions
1. ❌ Stub function injection - Function compiles but call fails
2. ❌ Forward declarations - No change
3. ❌ Removing duplicate functions - Only one definition exists
4. ❌ Fixing uniform conflicts - Resolved but error persists
5. ❌ Complex function extraction - Functions extract properly
6. ❌ Global variable dependencies - All variables declared correctly

## Theory: Why Guest CRT Still Fails
The Guest CRT Advanced shader likely has deep dependencies on the complete Mega Bezel function ecosystem. While individual functions compile, the shader may require:
- Specific initialization order
- Macro expansions we're not handling
- Implicit dependencies not visible in the code
- GLSL version-specific features
- Runtime state that stubs can't provide

## Recommendations

### Option 1: Use Working 3-Pass Setup
- Core Mega Bezel infrastructure (derez + cache-info) works
- Can add bezel passes later
- No CRT effects but framework is solid

### Option 2: Try Simpler CRT Shader
- Use basic CRT shader instead of Guest CRT Advanced
- Mega Bezel works with various CRT shaders
- Less complex dependencies

### Option 3: Continue Guest CRT Investigation
Required steps:
- Extract and provide ALL dependent functions (not just stubs)
- Implement complete function dependency chain
- May require significant Mega Bezel function library
- Fresh session recommended with this knowledge base

## Key Learnings
1. **Mega Bezel function extraction works** - `extractGlobalDefinitions()` successfully extracts functions from includes
2. **UBO conversion needs exclusions** - Some UBO members are meant to be local variables, not uniforms
3. **Stub functions aren't enough** - Guest CRT needs real function implementations with full dependency chains
4. **Console logging is heavily filtered** - Use `console.error()` for debug messages to bypass filters
5. **Error reporting is misleading** - GLSL reports error at call site, not actual problem location

## Next Steps
Document this session and decide on path forward:
- Accept 3-pass setup and move to bezel implementation
- Try simpler CRT shader alternative
- Continue Guest CRT debugging in new session
