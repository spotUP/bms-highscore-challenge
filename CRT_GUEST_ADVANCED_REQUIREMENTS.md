# CRT Guest Advanced - Requirements and Limitations

## Test Results

**Status**: ⚠️ Compiles Successfully but Outputs Black Screen

### What We Tested

1. **Pass 12 (intermediate)**: CRT Guest Advanced with Simple CRT after it
   - Result: ❌ Black screen, timeout during loading

2. **Pass 14 (final)**: CRT Guest Advanced as final viewport output
   - Result: ❌ Black screen, but compiles and executes without errors

### Technical Findings

**Compilation**: ✅ SUCCESS
- Shader compiles correctly
- All 15 passes execute successfully
- No WebGL errors or console errors

**Output**: ❌ BLACK SCREEN
- Shader runs but produces black pixels
- Not a compilation or execution error
- Likely a parameter or input data issue

## Why CRT Guest Advanced Fails

### Analysis of Working Configuration

From `crt-guest-only.slangp` (original Mega Bezel preset), CRT Guest Advanced requires:

#### 1. **Specific Input Pipeline**

The shader is at **pass 17** of 18 in the working preset:

```
Pass 0-11: Preprocessing (derez, cache, FXAA, grade, sharpen, afterglow, linearize, upscale)
Pass 12: Gaussian Horizontal Blur (800x600 resolution)
Pass 13: Gaussian Vertical Blur (800x600 resolution) → GlowPass alias
Pass 14: Bloom Horizontal (800x600 resolution)
Pass 15: Bloom Vertical → BloomPass alias
Pass 16: CRT Guest Advanced (THIS IS THE MAIN CRT SHADER)
Pass 17: Deconvergence with TubeFX (FINAL - viewport output)
```

#### 2. **Required Previous Passes**

CRT Guest Advanced **depends on**:
- ✅ `LinearizePass` alias (we have this - pass 11)
- ❌ `GlowPass` alias (we don't have - requires gaussian blur)
- ❌ `BloomPass` alias (we don't have - requires bloom passes)
- ✅ `AvgLumPass` alias (we skip this - causes color inversion)

#### 3. **Framebuffer Configuration**

```
filter_linear = true
scale_type = source  (NOT viewport!)
scale_x = 1.0
scale_y = 1.0
float_framebuffer = true  (HDR/float output)
```

**Key Point**: CRT Guest outputs to `float_framebuffer`, NOT directly to screen. It's designed for intermediate processing.

#### 4. **Gaussian Blur Dependency**

The shader expects:
- Gaussian horizontal blur → creates glow effect
- Gaussian vertical blur → completes glow
- Both at 800x600 resolution with float framebuffer

**Problem**: We discovered that gaussian blur passes cause black screen in our implementation.

#### 5. **Bloom Dependency**

The shader also uses:
- Bloom horizontal pass
- Bloom vertical pass
- Both at 800x600 resolution with float framebuffer

**Problem**: We discovered that bloom passes cause black screen in our implementation.

## Root Cause

**CRT Guest Advanced requires a complete glow/bloom pipeline that we cannot currently support.**

The shader itself works, but it needs:
1. Gaussian blur (broken in our implementation)
2. Bloom passes (broken in our implementation)
3. Proper glow/bloom texture aliases
4. Float framebuffer chain
5. A final deconvergence pass after it

## Working Passes (Our 14-Pass Configuration)

Our current **14-pass hybrid** works because it:

1. ✅ Uses **simpler shaders** that don't require glow/bloom
2. ✅ Has **Simple CRT as final pass** - guaranteed visible output
3. ✅ Skips gaussian blur, bloom, and CRT Guest Advanced
4. ✅ Still provides authentic Mega Bezel preprocessing
5. ✅ Delivers visible CRT effects (curvature, scanlines, afterglow)

## Passes That Break

Based on systematic testing:

| Pass Type | Result | Reason |
|-----------|--------|--------|
| Gaussian Blur (horizontal/vertical) | ❌ BLACK SCREEN | Framebuffer format issue |
| Bloom (horizontal/vertical) | ❌ BLACK SCREEN | Framebuffer dependencies |
| Average Luminance | ❌ COLOR INVERSION | Gamma/color space handling |
| CRT Guest Advanced | ❌ BLACK SCREEN | Requires glow/bloom inputs |
| Pre-shaders-afterglow | ❌ BLACK SCREEN | Dependency conflict |

## Passes That Work

| Pass Type | Result | Notes |
|-----------|--------|-------|
| Derez (drez-g-sharp_resampler) | ✅ WORKS | Resolution downscaling |
| Cache Info (cache-info-potato) | ✅ WORKS | Parameter caching |
| Fetch Derez Output | ✅ WORKS | Retrieves downscaled data |
| FXAA | ✅ WORKS | Anti-aliasing |
| Stock (multiple) | ✅ WORKS | Passthrough/data flow |
| Color Grading (hsm-grade) | ✅ WORKS | Color correction |
| Sharpening (custom-fast-sharpen) | ✅ WORKS | Image sharpening |
| Sharpsmoother | ✅ WORKS | Balanced filtering |
| Afterglow (hsm-afterglow0) | ✅ WORKS | Phosphor persistence |
| Interlace & Linearize | ✅ WORKS | Interlacing + linearization |
| Do-Nothing (upscaling) | ✅ WORKS | 8x8 upscale |
| Simple CRT (custom) | ✅ WORKS | Final CRT effects |

## Future Work

### To Enable CRT Guest Advanced

Need to fix these blockers first:

1. **Fix Gaussian Blur**
   - Debug why gaussian blur outputs black
   - Check framebuffer format compatibility
   - Verify texture sampling in blur shaders

2. **Fix Bloom Passes**
   - Debug why bloom outputs black
   - May depend on working gaussian blur
   - Check framebuffer chain

3. **Fix Average Luminance**
   - Debug color inversion issue
   - Check gamma/color space conversion
   - Verify linearization interaction

4. **Implement Deconvergence Final Pass**
   - CRT Guest outputs to float framebuffer
   - Needs deconvergence-with-tubefx as final pass
   - Converts float to viewport

### Alternative Approach

Instead of CRT Guest Advanced, we could:

1. **Enhance Simple CRT shader**
   - Add more sophisticated scanline patterns
   - Implement phosphor mask (slot, shadow, aperture grille)
   - Add proper gamma handling
   - Include deconvergence effects

2. **Use CRT Easymode**
   - Simpler than CRT Guest Advanced
   - May not require glow/bloom
   - Test if compatible with our pipeline

3. **Incremental Complexity**
   - Start with working 14-pass base
   - Add one complex feature at a time
   - Test each addition thoroughly

## Current Recommendation

**Stick with 14-pass configuration** until gaussian blur and bloom are fixed.

The current hybrid provides:
- ✅ Authentic Mega Bezel preprocessing
- ✅ Visible CRT effects
- ✅ Stable performance
- ✅ No console errors
- ✅ 60 FPS at 570x570

**Maximum Stable Configuration**: 14 passes

---

**Date**: October 12, 2025
**Status**: CRT Guest Advanced blocked by gaussian blur/bloom dependencies
**Next Steps**: Document final 14-pass configuration, or investigate gaussian blur issue
