# Mega Bezel Shader Dependency Chain Analysis

**Date**: 2025-10-10
**Analysis**: Pass dependencies and blocking issues

---

## Dependency Discovery

**Your insight was correct!** Reflection and bezel shaders DO depend on earlier passes. Specifically, they require:
- **InfoCachePass** (Pass 1) - Caches screen parameters and values

---

## Full Potato-with-Reflection Chain

Here's the complete chain from the working `potato-with-reflection.slangp`:

```
Pass 0: hsm-drez-g-sharp_resampler.slang → alias "DerezedPass"
  ↓ ✅ WORKING
Pass 1: cache-info-potato-params.slang → alias "InfoCachePass"
  ↓ ❌ BLOCKED (100+ undeclared identifiers)
Pass 2: hsm-fetch-drez-output.slang
  ↓ ✅ WORKING
Pass 3: fxaa.slang → alias "DeditherPass"
  ↓ ✅ WORKING
Pass 4: hsm-grade.slang → alias "ColorCorrectPass"
  ↓ ❓ UNTESTED
Pass 5: hsm-custom-fast-sharpen.slang
  ↓ ❌ BLOCKED (macro redefinition)
Pass 6: linearize.slang → alias "LinearizePass"
  ↓ ❌ BLOCKED (fragment shader function issue)
Pass 7: hsm-screen-scale-g-sharp_resampler-potato.slang → alias "CRTPass"
  ↓ ❓ UNTESTED (actual CRT simulation!)
Pass 8: reflection.slang → alias "ReflectionPass"
  ↓ ❌ BLOCKED (function extraction bug)
  ↓ REQUIRES: InfoCachePass (binding 1), PostCRTPass (binding 5)
Pass 9: post-crt-prep-potato.slang → alias "PostCRTPass"
  ↓ ❓ UNTESTED
FINAL OUTPUT
```

---

## Key Dependencies

### Reflection Shader Requirements

**File**: `reflection.inc` line 78, 84, 105, 131

```glsl
layout(set = 0, binding = 1) uniform sampler2D InfoCachePass; // Line 78
layout(set = 0, binding = 5) uniform sampler2D PostCRTPass;   // Line 84

// Usage:
HSM_UpdateGlobalScreenValuesFromCache(InfoCachePass, vTexCoord); // Line 105
vec4 crt_linear = texture(PostCRTPass, UNFLIPPED_VIEWPORT_COORD.xy); // Line 131
```

**Needs**:
1. `InfoCachePass` (Pass 1) - Screen parameter cache
2. `PostCRTPass` (Pass 9, but comes BEFORE reflection in execution order)

### Bezel Shader Requirements

**File**: `bezel-images.inc` line 426+

```glsl
layout(set = 0, binding = 1) uniform sampler2D InfoCachePass; // Line 426
// Plus 10+ other texture bindings for bezel images
```

**Needs**:
1. `InfoCachePass` (Pass 1) - Screen parameter cache
2. Background images, LED images, device images, etc. (configured in .slangp)

---

## The Critical Blocker: InfoCachePass (Pass 1)

### What It Does
`cache-info-potato-params.slang` caches screen scale parameters that other passes need:
- Screen dimensions
- Aspect ratios
- Coordinate transformations
- Global state values

### Why It's Blocked
**Error**: 100+ undeclared identifiers

**Example errors** (from earlier session):
```
'HSM_RESOLUTION_DEBUG_ON' : undeclared identifier
'GAMMA_INPUT' : undeclared identifier
'HSM_GLOBAL_GRAPHICS_BRIGHTNESS' : undeclared identifier
... (100+ more)
```

### Root Cause
The cache-info shader uses MASSIVE parameter lists (350+ parameters) from:
- `params-0-screen-scale.inc` (67,382 chars)
- `params-4-image-layers.inc` (44,578 chars)
- `globals.inc` (29,651 chars)

Our shader compiler can't handle this level of complexity yet.

---

## Blocking Chain Analysis

### Can Reflection Work Without Cache?

**NO** - The reflection shader MUST have `InfoCachePass` because:

1. **Line 105**: Calls `HSM_UpdateGlobalScreenValuesFromCache(InfoCachePass, vTexCoord)`
2. **This function** (in base-functions.inc:140) reads cached values and updates global state
3. **Without it**: Global screen coordinates, aspect ratios, and transforms would be uninitialized
4. **Result**: Reflection would render at wrong position/scale/orientation

### Can Bezel Work Without Cache?

**NO** - Same reason as reflection. Bezel images need correct screen coordinates to position the bezel artwork.

### Can We Skip Cache?

**Theoretically YES** - If we:
1. Calculate screen parameters directly in each shader instead of caching
2. Provide stub implementation of `HSM_UpdateGlobalScreenValuesFromCache()` that uses hardcoded values
3. Accept that multi-screen configs won't work

**Practically NO** - Would require rewriting significant portions of Mega Bezel's coordinate system.

---

## Alternative: Bypass InfoCachePass

### Option A: Stub Implementation

Create a fake InfoCachePass that returns dummy data:

```glsl
// In SlangShaderCompiler stubFunctions:
{
  name: 'HSM_UpdateGlobalScreenValuesFromCache',
  code: [
    'vec4 HSM_UpdateGlobalScreenValuesFromCache(sampler2D cache, vec2 coord) {',
    '  // Stub: return dummy values',
    '  // Real implementation reads cached screen parameters',
    '  return vec4(1.0, 1.0, 1.0, 1.0);',
    '}'
  ]
}
```

**Problems**:
- Global state won't be initialized
- Screen coordinates will be wrong
- Reflection/bezel won't render correctly
- **BUT**: Shaders might compile and run (incorrectly)

### Option B: Fix cache-info-potato-params.slang

Debug and fix the 100+ undeclared identifier errors:

**Time estimate**: 10-20 hours
**Complexity**: Very high - involves parameter extraction and UBO handling

### Option C: Find Simpler Cache Pass

Maybe there's a minimal cache pass that doesn't use all 350+ parameters?

**Action**: Search for alternative cache passes in Mega Bezel codebase

---

## What CAN Work Without Cache?

These passes don't require InfoCachePass:

1. ✅ `hsm-drez-g-sharp_resampler.slang` - Works
2. ✅ `hsm-fetch-drez-output.slang` - Works
3. ✅ `fxaa.slang` - Works
4. ❓ `hsm-grade.slang` - Might work (color grading doesn't need cached coordinates)
5. ❓ `hsm-bloom_horizontal.slang` / `hsm-bloom_vertical.slang` - Might work
6. ❓ `hsm-crt-guest-advanced-potato.slang` - Might work (CRT simulation)

**These are independent effects** that operate on the current pass's output without needing cached screen state.

---

## Recommended Path Forward

### Immediate Testing (0-2 hours)

Test shaders that DON'T need InfoCachePass:

1. **CRT Simulation**:
   ```
   Pass 0: drez
   Pass 1: fetch
   Pass 2: fxaa
   Pass 3: hsm-crt-guest-advanced-potato.slang (CRT with scanlines!)
   Pass 4: hsm-screen-scale-g-sharp_resampler-potato.slang (final scale)
   ```

2. **Bloom/Glow**:
   ```
   Pass 0: drez
   Pass 1: fetch
   Pass 2: fxaa
   Pass 3: hsm-bloom_horizontal.slang
   Pass 4: hsm-bloom_vertical.slang
   ```

3. **Color Grading**:
   ```
   Pass 0: drez
   Pass 1: fetch
   Pass 2: fxaa
   Pass 3: hsm-grade.slang (color correction)
   ```

### Long-term Fix (10-20 hours)

1. **Fix InfoCachePass** (cache-info-potato-params.slang)
   - Debug 100+ undeclared identifier errors
   - Fix parameter extraction for massive param lists
   - Get cache pass working

2. **Fix Function Extraction Bug**
   - Deep debug why opening braces are lost
   - Get common-functions-bezel.inc functions working

3. **Then Test**:
   - Reflection with proper cache
   - Bezel with proper cache
   - Full Mega Bezel chain

---

## Your Question: "Do They Depend On Earlier Pass?"

**Answer**: **YES!**

Reflection and bezel absolutely require:
1. **InfoCachePass** (Pass 1) - REQUIRED, currently BLOCKED
2. **CRTPass** (Pass 7) - Reflection needs this for the CRT image to reflect

**However**: The current compilation error (missing opening brace) happens BEFORE dependencies are checked. So we have TWO separate problems:
1. Compilation fails due to function extraction bug
2. Even if compilation worked, execution would fail without InfoCachePass

---

## Next Step?

Would you like me to:
1. **Test CRT simulation** (bypass cache, test CRT effects directly)
2. **Test bloom/glow** (bypass cache, add glow effects)
3. **Attempt to fix InfoCachePass** (10-20 hour deep dive)
4. **Give up on Mega Bezel** (use simpler shaders)

The most promising is **#1 - Test CRT simulation** since that might work without the cache pass.

