# MBZ__3__STD__GDV.slangp - Pass Status Report

## Working Passes ✅

| Pass | Shader | Status | Notes |
|------|--------|--------|-------|
| 0 | hsm-drez-g-sharp_resampler.slang | ✅ WORKING | High-quality resampling |
| 1 | cache-info-all-params.slang | ✅ WORKING | Required by all later passes |
| 34 | reflection.slang | ✅ WORKING | Glass reflections (needs setup) |

## Broken Passes ❌ (Need Fixing)

| Pass | Shader | Issue | Fix Difficulty |
|------|--------|-------|----------------|
| 2 | text-pass.slang | Not tested | Low (optional) |
| 3 | fetch-drez-output.slang | Load error | Medium |
| 4 | fxaa.slang | Not tested | Low |
| 5 | intro.slang | Not tested | Low (optional) |
| 9 | hsm-grade.slang | Matrix type mismatch | High |
| 13 | hsm-interlace-and-linearize.slang | Missing uniforms (interm, iscan) | **VERY HIGH** |
| 15 | bezel-and-image-layers.slang | **50+ missing constants** | **VERY HIGH** |
| 17 | height-and-normals.slang | Depends on pass 15 | High |
| 19 | tubelayers-default.slang | Depends on pass 15 | High |
| 35 | final-composite.slang | Not tested (needs pass 15) | Medium |

## Performance Impact 🔥

### Low Impact (Recommended)
- Pass 0: Derez (✅ include)
- Pass 1: Cache Info (✅ include - required)
- Pass 2-5: Pre-processing (⚠️ optional)

### Medium Impact
- Pass 21-24: Gaussian blur + Bloom (4 passes)
- Pass 27-29: Reflection prep blurs (3 passes)

### High Impact (Skip for Performance)
- Pass 30-32: Additional blurs (3 passes)
- Pass 25-26: CRT Guest Advanced + Deconvergence (complex)

## Recommended Configuration

### Option A: Maximum Quality (if we can fix bezel-and-image-layers)
**Total**: 36 passes (original STD preset)
**Performance**: Medium-Heavy
**Visual**: Full Mega Bezel experience with frame, reflections, CRT effects

### Option B: High Quality + Good Performance (Current Best)
**Total**: 4 passes
```
Pass 0: Derez
Pass 1: Cache Info
Pass 2: Simple Bezel (custom - WORKING)
Pass 3: Reflection
```
**Performance**: Excellent (60 FPS+)
**Visual**: Frame with reflections, good quality

### Option C: Medium Quality (if we skip bezel)
**Total**: 10 passes
```
Pass 0-1: Derez + Cache
Pass 2-5: Blur passes for glow
Pass 6: Reflection prep
Pass 7: Reflection
```
**Performance**: Good
**Visual**: No frame, but nice glow/reflection effects

## Critical Blockers

### 1. bezel-and-image-layers.slang ❌
**Missing 50+ constants**:
- MASK_MODE_* (9 constants)
- CUTOUT_MODE_* (2 constants)
- FOLLOW_LAYER_* (8 constants)
- PassFeedback sampler
- Type mismatches (float vs int comparisons)

**Fix Required**: Add all missing constants to SlangShaderCompiler.ts or extract from proper include files.

**Estimated Work**: 4-6 hours to properly fix

### 2. hsm-interlace-and-linearize.slang ❌
**Missing uniforms**: interm, iscan, inter, intres, iscans

**Fix Required**: Add these as shader parameters or uniforms

**Estimated Work**: 2-3 hours (we attempted this earlier)

### 3. hsm-grade.slang ❌
**Issue**: Matrix/vector type mismatches

**Fix Required**: Fix type conversions in shader compiler

**Estimated Work**: 1-2 hours

## Current Best Working Preset

**File**: `ultra-simple-bezel.slangp`
**Passes**: 1
**Status**: ✅ FULLY WORKING
**Performance**: Excellent
**Visual**: Shows carbonfiber frame around game

**To Use**:
1. http://localhost:8080/404
2. Press `S` (enable shaders)
3. Press `M` (enable Mega Bezel)

## Next Steps

### Immediate (Works Now)
1. ✅ Use ultra-simple-bezel.slangp
2. ✅ You see a frame immediately
3. ✅ Great performance

### Short Term (1-2 hours work)
1. Fix FXAA pass
2. Add blur passes for glow effect
3. Add final-composite pass

### Long Term (4-6 hours work)
1. Fix bezel-and-image-layers.slang (add all missing constants)
2. Fix hsm-grade.slang (type conversions)
3. Fix hsm-interlace-and-linearize.slang (uniforms)
4. Full STD preset working

## Summary

**Current Status**: 3 out of 36 passes working (8%)

**Blocking Issues**:
- bezel-and-image-layers.slang (main blocker for frame generation)
- Missing shader constants and uniforms throughout pipeline

**Working Alternative**:
- Custom simple-bezel.slang (shows frame NOW)
- Can be expanded with more passes incrementally

**Recommendation**: Use ultra-simple-bezel.slangp now, fix bezel-and-image-layers.slang separately as a dedicated task.
