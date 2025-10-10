# Shader Rendering Fix - Applied

## Date: 2025-10-09

## Issue Summary

The Mega Bezel shader compilation was successful (39,392 errors eliminated in previous fix), but shaders were failing to render due to duplicate uniform declarations causing WebGL compilation errors.

## Root Cause

The shader compiler was declaring the same parameters twice in different forms:

1. As global mutable variables: `float HSM_POTATO_COLORIZE_CRT_WITH_BG = 0;`
2. As uniforms: `uniform float HSM_POTATO_COLORIZE_CRT_WITH_BG;`

This happened because:
- `buildGlobalDefinitionsCode()` injects global variables from extracted includes
- `convertBindingsToUniforms()` injects uniforms from UBO bindings
- The duplicate detection only checked for `uniform` declarations, not global variables

## The Fix

**File**: `src/shaders/SlangShaderCompiler.ts`
**Location**: Lines 3059-3076

**Before** (only detected uniform declarations):
```typescript
const declaredUniforms = new Set<string>();
const existingUniformRegex = /^\s*uniform\s+\w+\s+(\w+)\s*;/gm;
let match;
while ((match = existingUniformRegex.exec(source)) !== null) {
  declaredUniforms.add(match[1]);
}
```

**After** (detects both uniform and global variable declarations):
```typescript
const declaredUniforms = new Set<string>();

// Parse existing uniform declarations AND global variable declarations
const existingUniformRegex = /^\s*uniform\s+\w+\s+(\w+)\s*;/gm;
const existingVariableRegex = /^\s*(?:float|int|vec\d|mat\d|bool)\s+(\w+)\s*=/gm;

let match;
while ((match = existingUniformRegex.exec(source)) !== null) {
  declaredUniforms.add(match[1]);
}

while ((match = existingVariableRegex.exec(source)) !== null) {
  declaredUniforms.add(match[1]);
}
```

## Result

The fix prevents duplicate declarations by detecting both:
- Uniform declarations: `uniform float HSM_POTATO_COLORIZE_CRT_WITH_BG;`
- Global variables: `float HSM_POTATO_COLORIZE_CRT_WITH_BG = 0;`

When `convertBindingsToUniforms()` processes UBO members, it now skips any parameter that's already declared as a global variable.

## Testing Status

- First shader pass (hsm-drez-g-sharp_resampler) now compiles successfully
- No more "redefinition" errors for HSM_POTATO_COLORIZE_CRT_WITH_BG
- Second pass compilation in progress (browser test)

## Next Steps

1. Verify all shader passes compile successfully in browser
2. Check that game renders with shader effects applied
3. Confirm no WebGL compilation errors in console
4. Test visual output and shader pipeline functionality

## Related Files

- `src/shaders/SlangShaderCompiler.ts` - Main fix applied here
- `src/shaders/MultiPassRenderer.ts` - Shader rendering pipeline
- `src/pages/PongSlangDemo.tsx` - Test page for shader verification

## Previous Related Fixes

- **SHADER_FIX_COMPLETE.md**: Fixed parameter loss bug (39,392 errors eliminated)
- **MegaBezelCompiler.ts lines 584-625**: Added texture path validation to distinguish parameters from file paths
