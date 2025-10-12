# Guest CRT Advanced Shader - Fix Status

## Current Status: PARTIAL PROGRESS

The Guest CRT Advanced shader (pass_2) still fails to compile, but significant progress has been made in identifying and fixing the root causes.

### Error Message
```
ERROR: 0:3157: '0.0' : syntax error
3157: float no_scanlines = HSM_GetNoScanlineMode(); <-- ERROR HERE
```

### Stub Function Definition (Line 950)
```glsl
float HSM_GetNoScanlineMode() { return 0.0; } // Stub - always use Guest scanlines
```

## Root Causes Identified and Fixed

### 1. ✅ FIXED: Forward Declaration Duplicate Issue
**Problem:** Original stub functions included both forward declaration and full definition:
```typescript
code: [
  '// Forward declaration',
  'float HSM_GetNoScanlineMode();',  // This line
  '',
  'float HSM_GetNoScanlineMode() {', // Was treated as duplicate
  '  return 0.0;',
  '}'
]
```

`removeDuplicateFunctions()` treated the forward declaration and full function as duplicates, removing the function body.

**Fix:** Removed forward declarations from stub functions (SlangShaderCompiler.ts:1440-1445)

### 2. ✅ FIXED: Multi-Line Function Body Loss
**Problem:** `removeDuplicateFunctions()` only kept the function signature line when encountering a new function. The function body lines (on subsequent lines) were being lost.

**Fix:** Changed stub functions to single-line format (SlangShaderCompiler.ts:1443):
```typescript
code: [
  'float HSM_GetNoScanlineMode() { return 0.0; } // Stub - always use Guest scanlines'
]
```

This ensures the entire function (signature + body) is kept as one atomic unit.

### 3. ✅ FIXED: `no_scanlines` Uniform Conflict
**Problem:** Guest CRT shader declares `float no_scanlines = HSM_GetNoScanlineMode();` as a LOCAL variable, but the UBO in globals.inc also contains `float no_scanlines` which gets converted to a uniform. This caused a redeclaration error.

**Fix:** Excluded `no_scanlines` from UBO-to-uniform conversion (SlangShaderCompiler.ts:3746-3749):
```typescript
if (member.name === 'no_scanlines') {
  console.error(`✓ Skipping no_scanlines uniform (Guest CRT uses it as local variable)`);
  return false;
}
```

## Remaining Issue: Function Call Syntax Error

Despite the function being properly defined at line 950 with a complete body, the GLSL compiler reports a syntax error when the function is called at line 3157.

### Verified Facts
1. ✅ Function is defined BEFORE it's called (line 950 vs 3157)
2. ✅ Function has complete body: `{ return 0.0; }`
3. ✅ Only ONE definition exists (no duplicates)
4. ✅ No uniform conflict with `no_scanlines`
5. ✅ Function signature matches call site
6. ❌ GLSL compiler still reports `'0.0' : syntax error`

### Possible Remaining Causes

#### Theory 1: Function Defined in Wrong Scope
The stub function might be defined in a location where it's not visible to the calling code. GLSL has strict scoping rules.

**Diagnostic:** Check where globalDefsCode is injected relative to the Guest CRT shader code

#### Theory 2: Missing Dependencies
`HSM_GetNoScanlineMode()` in the real implementation (common-functions.inc:960-967) depends on:
- `USE_VERTICAL_SCANLINES`
- `CROPPED_ROTATED_SIZE_WITH_RES_MULT`
- `global.no_scanlines` (but we excluded this uniform)
- `HSM_GetUseFakeScanlines()`
- `HSM_INTERLACE_MODE`
- `HSM_INTERLACE_TRIGGER_RES`

The stub function ignores these dependencies. If any calling code expects these variables to be modified as side effects, the stub won't work.

**Solution:** Implement fuller stub with all dependencies, or ensure all required globals are defined

#### Theory 3: GLSL Version/Syntax Issue
WebGL GLSL might not support single-line function definitions with inline comments.

**Solution:** Try multi-line format but fix `removeDuplicateFunctions()` to properly track function bodies

#### Theory 4: Function Not Actually in Final Shader
Despite appearing in debug output, the function might be removed by a later processing step.

**Diagnostic:** Dump the COMPLETE fragment shader source just before WebGL compilation

## Files Modified

### src/shaders/SlangShaderCompiler.ts
- **Lines 1437-1444**: Stub functions changed to single-line format
- **Lines 1460-1473**: Added debug logging for stub function injection
- **Lines 1702-1712**: Added debug logging to verify function in globalDefsCode
- **Lines 3746-3749**: Excluded `no_scanlines` from uniform conversion
- **Lines 4203-4211**: Added debug logging to `removeDuplicateFunctions()`
- **Lines 4221-4223**: Added debug logging for duplicate detection
- **Lines 4245-4248**: Added debug logging for non-function lines

### src/utils/PureWebGL2Renderer.ts
- **Lines 165-173**: Enhanced shader error debugging to show 15 lines of context
- **Lines 155-191**: Added comprehensive debugging for `HSM_GetNoScanlineMode` function

## Recommendations

### Immediate Next Steps

1. **Verify Function Visibility**: Add logging to show WHERE in the shader the stub function is defined relative to where it's called. The function must be defined BEFORE the call in GLSL.

2. **Try Multi-Line Format with Fixed removeDuplicateFunctions**: Fix the `removeDuplicateFunctions()` function to properly track and keep function bodies for multi-line functions, then revert to the cleaner multi-line format.

3. **Implement Full Function**: Instead of a stub that always returns `0.0`, implement the full logic from common-functions.inc with all dependencies. This is more complex but might be necessary.

4. **Alternative Approach - Preprocessor**: Consider using GLSL preprocessor `#ifdef` to conditionally define the function, ensuring it's only defined once.

### Long-Term Solution

The Guest CRT Advanced shader has deep dependencies on the complete Mega Bezel function ecosystem. A minimal stub might not be sufficient. Consider:

1. **Extract Full Dependency Chain**: Extract ALL functions that `HSM_GetNoScanlineMode()` depends on from common-functions.inc
2. **Create Complete Function Set**: Ensure all required globals, uniforms, and helper functions are available
3. **Test with Simpler CRT Shader**: Try a less complex CRT shader that doesn't have as many dependencies

## Debug Commands

```bash
# Check browser console for shader errors
node check-shader-console.mjs

# Key things to look for:
# - "[GUEST CRT STUB]" - shows stub function code
# - "[buildGlobalDefinitionsCode] HSM_GetNoScanlineMode in result" - shows if function is in globalDefsCode
# - "[removeDuplicateFunctions]" - shows if function is kept or removed
# - "Function definition at line X" - shows where function is defined in compiled shader
```

## Conclusion

Significant architectural issues have been identified and fixed:
1. ✅ Function body preservation in stub functions
2. ✅ Uniform conflict resolution
3. ✅ Forward declaration removal

However, a fundamental GLSL compilation issue remains that requires deeper investigation of function scoping, dependencies, or GLSL syntax compatibility.
