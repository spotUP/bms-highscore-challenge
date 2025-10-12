# Pink Screen Issue Analysis

## Problem

The 8-pass potato preset shows a bright pink/magenta screen instead of rendering the game.

## Root Cause

The `hsm-screen-scale-g-sharp_resampler.inc` shader uses `HSM_GetCroppedTexSample()` which depends on three global variables that must be read from the cache-info pass:

1. `CROPPED_ROTATED_SIZE`
2. `CROPPED_ROTATED_SIZE_WITH_RES_MULT`
3. `SAMPLE_AREA_START_PIXEL_COORD`

These variables are defined in `globals.inc` with initializers (`= vec2(1)`), but they need to be dynamically updated by `HSM_UpdateGlobalScreenValuesFromCache()` which reads values from the cache texture.

## The Issue

Multiple compilation problems:

1. **Variables declared as `const`**: The `convertGlobalInitializers()` function was converting these to const, making them immutable
2. **Missing in VERTEX shader**: These globals are only added to fragment shaders, but `HSM_UpdateGlobalScreenValuesFromCache()` is called in BOTH vertex and fragment stages
3. **Scope mismatch**: Function tries to assign to undeclared variables

## Current Status

✅ Fixed `convertGlobalInitializers()` to skip cache variables (lines 3026-3042)
❌ Still getting "undeclared identifier" errors in vertex shader
❌ Shaders bypass due to compilation failure

## Next Steps

### Option 1: Simplify to Remove Cache Dependency (RECOMMENDED)

Instead of reading from cache, use a simpler approach:

1. **Remove cache-info pass** from the preset
2. **Use direct texture sampling** instead of `HSM_GetCroppedTexSample()`
3. **Modify screen-scale shader** to use `texture(Source, coord)` directly

This would require creating a modified version of `hsm-screen-scale-g-sharp_resampler-potato.slang` that doesn't use cropped sampling.

### Option 2: Fix Cache Variable Scope (COMPLEX)

Properly implement the cache system:

1. Declare cache variables in BOTH vertex and fragment shaders
2. Ensure they're mutable (not const)
3. Initialize from cache in each shader stage
4. Handle all the coordinate transformations

This is complex because the Mega Bezel system was designed for RetroArch's shader system which handles globals differently.

### Option 3: Use Simpler Shader (EASIEST)

Skip the screen-scale pass entirely and use a simpler CRT shader that doesn't need cache-info:

1. Use the basic `linearize.slang` as the final pass (already working as pass 7)
2. Add scanline effects via a simpler shader
3. Accept reduced quality but working shaders

## Recommendation

**Go with Option 3** - Use the working 7-pass preset (without screen-scale) as the final solution. The linearize pass already provides gamma correction, and we can add a simple scanline shader if needed.

File to use: Create `potato-working-7-pass.slangp` (same as 8-pass but stop at linearize)

This gives:
- ✅ Working shaders (no bypass)
- ✅ Proper color grading and gamma
- ✅ Anti-aliasing (FXAA)
- ✅ Sharpening
- ❌ No CRT scanlines (but game still playable)

We can add scanlines later with a custom simple shader that doesn't need the Mega Bezel infrastructure.
