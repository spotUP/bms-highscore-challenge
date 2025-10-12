# Bezel Test Results

**Date**: 2025-10-10
**Test**: Add bezel frames (option 3 from Top 30 list)
**Result**: ❌ BLOCKED by same function extraction bug

---

## Test Configuration

**Preset**: `bezel-test.slangp`

Passes:
1. ✅ hsm-drez-g-sharp_resampler.slang (derez)
2. ✅ hsm-fetch-drez-output.slang (fetch)
3. ✅ fxaa.slang (anti-aliasing)
4. ❌ bezel-images-over-crt.slang (BLOCKED)

---

## Error

```
ERROR: Vertex shader compilation failed for pass_3
Line 3172: return HSM_TUBE_STATIC_REFLECTION_IMAGE_ON > 0.5 && ...
```

**Expected** (from source):
```glsl
bool HSM_GetUseTubeStaticReflection()
{
	return HSM_TUBE_STATIC_REFLECTION_IMAGE_ON > 0.5 && ...;
}
```

**Actual** (in compiled shader):
```glsl
bool HSM_GetUseTubeStaticReflection()
	return HSM_TUBE_STATIC_REFLECTION_IMAGE_ON > 0.5 && ...;
```

**Missing**: Opening brace `{` on line between function signature and return statement.

---

## Root Cause

The bezel shader includes `common-functions-bezel.inc` which contains functions with opening braces on separate lines. The function extraction code in `SlangShaderCompiler.ts` is supposed to include the opening brace, but it's being lost during extraction.

**Function location**: `public/shaders/mega-bezel/shaders/base/common/common-functions-bezel.inc:137-140`

**Original source**:
```glsl
bool HSM_GetUseTubeStaticReflection()
{
	return HSM_TUBE_STATIC_REFLECTION_IMAGE_ON > 0.5 && HSM_GetUseOnCurrentScreenIndex(HSM_TUBE_STATIC_REFLECTION_IMAGE_DUALSCREEN_VIS_MODE);
}
```

---

## Attempted Fix

**Location**: `src/shaders/SlangShaderCompiler.ts` lines 417-427

**Change**: Modified brace counting to start at 0 instead of 1, so opening brace is included in extracted function.

**Code**:
```typescript
// DON'T skip the opening brace - we want to include it in the extracted function
// pos now points to '{', and we'll include it by starting braceCount at 0

// Find matching closing brace for function body
let braceCount = 0; // Start at 0 so first { increments to 1
while (pos < globalSection.length && braceCount >= 0) {
  if (globalSection[pos] === '{') braceCount++;
  if (globalSection[pos] === '}') braceCount--;
  pos++;
  if (braceCount === 0) break; // Found matching closing brace
}
```

**Result**: ❌ Did not fix the issue - opening brace still missing

---

## Same Issue as Reflection

This is the EXACT same function extraction bug that blocked the reflection shader:
- `reflection.slang` ❌ - Function body missing opening brace
- `bezel-images-over-crt.slang` ❌ - Function body missing opening brace

**Both shaders include**: `common-functions-bezel.inc`

**Both fail on**: `HSM_GetUseTubeStaticReflection()` function (same function!)

---

## Why The Fix Didn't Work

Possible explanations:

1. **Function not being extracted at all** - Maybe the function is in a section that's not considered "global"
2. **Extraction happens elsewhere** - Maybe there's another extraction path that processes this function
3. **Post-processing removes brace** - Maybe the brace is extracted but removed during post-processing
4. **Include preprocessing issue** - Maybe the include file processing corrupts the function before extraction

---

## Impact

**All shaders that depend on `common-functions-bezel.inc` will fail**, including:

- ❌ `bezel-images-over-crt.slang`
- ❌ `bezel-images-under-crt.slang`
- ❌ `reflection.slang`
- ❌ `reflection-glass.slang`
- ❌ `reflection-glass-hdr.slang`

**These shaders are core to Mega Bezel's visual effects**:
- Reflection effects (screen reflecting in bezel)
- Bezel/frame overlays
- All "advanced" presets

---

## What Works

Currently working Mega Bezel passes:
1. ✅ `hsm-drez-g-sharp_resampler.slang` - De-resolution with G-sharp resampling
2. ✅ `hsm-fetch-drez-output.slang` - Fetch derez output
3. ✅ `fxaa.slang` - Anti-aliasing

**This is only 3 basic passes out of 200+ available passes.**

---

## Next Steps

### Option A: Deep Debug (Time: 4-8 hours)

1. Add extensive logging to function extraction (lines 340-450)
2. Log exactly what's being extracted:
   - `startPos` and `pos` values
   - Extracted substring before trim
   - Character at each position during brace counting
3. Check if function is in `globalSection` at all
4. Check if function is being filtered out as "stub"
5. Trace through include preprocessing to see if function gets corrupted earlier

### Option B: Alternative Approach (Time: 1-2 hours)

Instead of extracting functions from includes, provide stub implementations for ALL common-functions-bezel.inc functions:
- `HSM_GetUseTubeStaticReflection()` - return false
- `HSM_GetUseTubeDiffuseImage()` - return false
- Add to stub list in `buildGlobalDefinitionsCode`

**Downside**: Effects won't work correctly, but shaders will compile

### Option C: Skip Bezel/Reflection Effects (Time: 0 hours)

Use only the 3 working passes:
- Derez + Fetch + FXAA
- Or try other shader categories that don't use common-functions-bezel.inc:
  - CRT simulation shaders
  - Bloom/glow shaders
  - Color grading shaders

---

## Recommendation

**For immediate results**: Try **Option C** - test CRT simulation and other effect passes that don't require bezel functions.

**For full Mega Bezel support**: Need **Option A** - deep debugging of function extraction (estimated 4-8 hours).

---

## Alternative Shaders to Test

These DON'T use common-functions-bezel.inc, so they might work:

### CRT Simulation (PRIORITY)
1. `hsm-crt-guest-advanced-potato.slang` - Main CRT effect
2. `hsm-screen-scale-g-sharp_resampler-potato.slang` - Final scaling
3. `post-crt-prep-potato.slang` - Post-CRT prep

### Bloom/Glow
4. `hsm-bloom_horizontal.slang` - Horizontal bloom
5. `hsm-bloom_vertical.slang` - Vertical bloom

### Color
6. `hsm-grade.slang` - Color grading

Would you like me to test any of these instead?

