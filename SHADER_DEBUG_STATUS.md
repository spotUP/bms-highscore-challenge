# Mega Bezel Shader Debug Status

**Date:** 2025-10-16
**Issue:** Pass_4 (hsm-pre-shaders-afterglow.slang) outputs white instead of correct colors

## ✅ FIXED Issues

### 1. Push Constant Parameter Uniforms Not Created
**Problem:** Parameters like `pre_bb` and `contr` that exist in both push constants AND pragma parameters were filtered out from uniform creation.

**Fix:** `src/shaders/SlangShaderCompiler.ts:2129-2154`
- Removed filter that prevented push constant members from getting uniforms
- Now ALL pragma parameters get uniforms, even if they're in push constants

### 2. Incorrect params. Replacement
**Problem:** Code replaced `params.pre_bb` with `PARAM_pre_bb` directly in shader code, but should use the global variable `pre_bb` which gets assigned from `PARAM_pre_bb` in main().

**Fix:** `src/shaders/SlangShaderCompiler.ts:4283-4290`
- Changed replacement from `params.X` → `PARAM_X` to `params.X` → `X`
- Global variable assignment happens via `_initParamGlobals()` functions injected at start of main()

### 3. LUT Texture Loading
**Fixed Earlier:** LUT textures (SamplerLUT1-4) now load correctly
- 4 LUTs, 1024x32 each, properly bound to all passes

## ❌ CURRENT ISSUE: Texture Corruption

### Problem
When pass_4 reads the PreCRTPass texture, it gets **WHITE (255,255,255)** instead of the correct **rgb(28,11,61)**.

### Testing Results
```glsl
// Test 1: Output pure red
FragColor = vec4(1.0, 0.0, 0.0, 0); // ✅ Works - outputs RED

// Test 2: Output pre_bb value
FragColor = vec4(pre_bb, pre_bb, pre_bb, 0); // ✅ Works - outputs WHITE (pre_bb=1.0)

// Test 3: Output raw texture
FragColor = vec4(imgColor.rgb, 0); // ❌ FAIL - outputs WHITE (should be rgb(28,11,61))
```

### Verified Facts
- ✅ Pass_2 outputs correct colors: rgb(28,11,61)
- ✅ PreCRTPass alias correctly points to pass_2_output
- ✅ All uniforms set correctly (PARAM_pre_bb=1, PARAM_contr=0, etc.)
- ✅ Global variables assigned correctly (pre_bb=1.0, contr=0.0)
- ✅ Shader code compiles without errors
- ❌ **PreCRTPass texture reads as WHITE in pass_4**

### Hypothesis
The issue is in texture management, not shader logic:
1. Possible mipmap generation corrupting texture (lines added at PureWebGL2Renderer.ts:449-457)
2. Possible texture binding issue
3. Possible pass_3 affecting pass_2's output texture
4. Possible texture sampling parameter mismatch

## Pass Output Summary
```
pass_0: rgb(28,11,61)  ✅ Correct
pass_1: rgb(83,8,73)   ✅ Correct
pass_2: rgb(28,11,61)  ✅ Correct (PreCRTPass)
pass_3: rgb(28,11,61)  ✅ Correct
pass_4: rgb(255,255,255) ❌ WHITE (should inherit from PreCRTPass)
pass_5-16: WHITE (cascading failure)
```

## Debugging Steps Completed

### 1. ✅ Mipmap Generation
- Disabled mipmap generation (lines 449-465 in PureWebGL2Renderer.ts)
- Changed texture filter from LINEAR_MIPMAP_LINEAR to LINEAR
- **Result**: Did NOT fix the issue

### 2. ✅ Texture Sampling Parameters
- Verified all textures use LINEAR filter without mipmaps
- Confirmed CLAMP_TO_EDGE wrapping
- **Result**: Not the cause

### 3. ✅ WebGL Texture State
- Added pixel readback to verify texture contents
- **Result**: PreCRTPass texture contains CORRECT colors rgb(26,11,61)!
- Texture is being read from framebuffer successfully

### 4. ✅ Texture Binding Fix
- Fixed texture unit mismatch (PureWebGL2Renderer.ts:403-438)
- Now only binds textures that exist as samplers in the shader
- Prevents binding unused textures that shift unit numbers
- **Current Bindings**:
  - Unit 0: PreCRTPass ✅
  - Unit 1: AfterglowPass ✅
  - Unit 2-5: SamplerLUT1-4 ✅

## ✅ MAJOR FIX: Texture Binding Mismatch

**ROOT CAUSE**: We were binding ALL input textures sequentially (units 0,1,2,3...), but only setting uniforms for samplers that exist in the shader. This caused texture unit mismatches.

**Example**: If pass_4 has samplers PreCRTPass, AfterglowPass, and 4 LUTs, we'd bind:
- Source → unit 0 (but PreCRTPass uniform doesn't exist, so not set)
- DeditherPass → unit 1 (doesn't exist in shader)
- PreCRTPass → unit 2 (SET to unit 2, but shader expects unit 0!)
- AfterglowPass → unit 3 (SET to unit 3, but shader expects unit 1!)

**SOLUTION** (PureWebGL2Renderer.ts:403-438): Check if sampler uniform exists BEFORE binding texture. Only bind textures that have corresponding uniforms.

**Result**: Textures now correctly bound:
- PreCRTPass → unit 0 ✅
- AfterglowPass → unit 1 ✅
- LUTs → units 2-5 ✅

## ❌ REMAINING ISSUE: Texture Sampling Returns Wrong Data

### Strange Behavior
- ✅ **Pixel readback test**: PreCRTPass texture contains rgb(26,11,61) - CORRECT!
- ✅ **Constant output test**: `FragColor = vec4(0,0,1,0)` outputs blue - shader runs!
- ❌ **Texture read test**: `FragColor = vec4(imgColor.rgb, 0)` outputs WHITE!

### This Means
The texture contains correct data (verified by CPU readback), but when the SHADER reads it via `COMPAT_TEXTURE(PreCRTPass, vTexCoord.xy)`, it gets white instead of the correct colors!

### Hypothesis
1. `COMPAT_TEXTURE` macro expansion issue
2. `vTexCoord` coordinate problem (sampling wrong location?)
3. Texture sampler configuration mismatch
4. WebGL2 texture() function issue

## Next Steps
1. Test with hardcoded texture coordinates (0.5, 0.5) instead of vTexCoord
2. Check if vTexCoord is being passed correctly from vertex shader
3. Inspect compiled GLSL to see COMPAT_TEXTURE expansion
4. Check texture wrap/clamp settings causing coordinate issues

## Files Modified
- `src/shaders/SlangShaderCompiler.ts` - Fixed uniform creation and params. replacement
- `src/utils/PureWebGL2MultiPassRenderer.ts` - Added LUT texture loading
- `src/utils/PureWebGL2Renderer.ts` - Added createTextureFromImage() method
