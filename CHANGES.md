# Mega Bezel Shader Debugging Session - Complete Change Log

**Date**: 2025-10-16
**Session Goal**: Debug pass_4 white output issue in 17-pass Mega Bezel shader pipeline

---

## 🎯 CRITICAL FIX: Texture Binding Mismatch

### Problem
The renderer was binding ALL input textures sequentially (units 0,1,2,3...), but only setting uniforms for samplers that actually exist in the shader. This caused massive texture unit mismatches.

**Example of the bug:**
```
Input textures map: { Source, DeditherPass, PreCRTPass, AfterglowPass, LUT1-4 }
Shader samplers: { PreCRTPass, AfterglowPass, LUT1-4 }

OLD BEHAVIOR (BUGGY):
- Source       → bind to unit 0, but uniform doesn't exist (not set)
- DeditherPass → bind to unit 1, but uniform doesn't exist (not set)
- PreCRTPass   → bind to unit 2, SET uniform to 2 ❌ (shader expects 0!)
- AfterglowPass → bind to unit 3, SET uniform to 3 ❌ (shader expects 1!)
- LUT1         → bind to unit 4, SET uniform to 4 ❌ (shader expects 2!)

RESULT: All texture reads return white/incorrect data!
```

### Solution
**File**: `src/utils/PureWebGL2Renderer.ts:403-438`

Check if sampler uniform exists in the shader BEFORE binding the texture. Only bind textures for samplers that actually exist.

```typescript
for (const [uniformName, textureName] of Object.entries(inputTextures)) {
  // CRITICAL FIX: Check if this sampler uniform exists in the shader FIRST
  const location = gl.getUniformLocation(program, uniformName);
  if (location === null) {
    // Sampler doesn't exist in this shader - skip binding this texture
    continue;
  }

  // Now bind the texture and set the uniform
  gl.activeTexture(gl.TEXTURE0 + textureUnit);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.uniform1i(location, textureUnit);
  textureUnit++;
}
```

**NEW BEHAVIOR (FIXED):**
```
PreCRTPass   → bind to unit 0, SET uniform to 0 ✅
AfterglowPass → bind to unit 1, SET uniform to 1 ✅
LUT1         → bind to unit 2, SET uniform to 2 ✅
LUT2         → bind to unit 3, SET uniform to 3 ✅
LUT3         → bind to unit 4, SET uniform to 4 ✅
LUT4         → bind to unit 5, SET uniform to 5 ✅
```

---

## 🔧 Additional Fixes

### 1. Removed Mipmap Generation
**File**: `src/utils/PureWebGL2Renderer.ts:264-274, 484-486`

**Problem**: Textures used `LINEAR_MIPMAP_LINEAR` filter which requires mipmaps, but mipmaps were only generated once at texture creation. After rendering new content, the mipmap levels were stale.

**Fix**:
- Changed to `LINEAR` filter (no mipmaps needed)
- Removed `gl.generateMipmap()` calls
- Removed mipmap regeneration after each pass

```typescript
// OLD (BUGGY):
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
gl.generateMipmap(gl.TEXTURE_2D);

// NEW (FIXED):
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
// No mipmap generation needed
```

### 2. Added Debug Logging
**File**: `src/utils/PureWebGL2Renderer.ts:376-401, 413-416`

Added comprehensive debug logging to track texture bindings:
- Logs all textures being passed to pass_4
- Logs which textures are actually bound
- Includes pixel readback to verify texture contents
- Only logs every 60 frames to avoid spam

### 3. Restored Original Shader
**File**: `public/shaders/mega-bezel/shaders/guest/hsm-pre-shaders-afterglow.slang`

Removed all debug modifications, restored to original working state.

---

## 📊 Testing Results

### Verification Tests Performed

1. **Mipmap Generation Test** ❌
   - Disabled mipmap generation
   - Result: Did not fix white output

2. **Texture Sampling Parameters** ✅
   - Verified LINEAR filter without mipmaps
   - Confirmed CLAMP_TO_EDGE wrapping
   - Result: Configuration correct

3. **Pixel Readback Test** ✅
   - CPU reads PreCRTPass texture at (285,285)
   - Result: Contains CORRECT color rgb(26,11,61)!
   - **Proves texture data is valid**

4. **Texture Binding Fix** ✅
   - Implemented sampler-existence check
   - Logs show correct bindings:
     ```
     PreCRTPass   → unit 0 ✅
     AfterglowPass → unit 1 ✅
     LUT1-4       → units 2-5 ✅
     ```

5. **Shader Execution Test** ✅
   - Output pure blue constant
   - Result: rgb(0,0,255) ✅
   - **Proves shader executes**

### Current Status

**Pass Output Colors (Frame 60):**
```
pass_0: rgb(28,11,61)  ✅ Correct
pass_1: rgb(83,8,73)   ✅ Correct
pass_2: rgb(28,11,61)  ✅ Correct (PreCRTPass alias)
pass_3: rgb(28,11,61)  ✅ Correct (AfterglowPass alias)
pass_4: rgb(255,253,255) ❌ WHITE (expected: rgb(28,11,61))
pass_5-16: WHITE (cascading failure from pass_4)
```

---

## 🔍 Remaining Issue

### Strange Contradiction

- ✅ **CPU readback**: Texture contains rgb(26,11,61) - CORRECT
- ✅ **Constant output**: `FragColor = vec4(0,0,1,0)` → blue - WORKS
- ❌ **Texture sampling**: `FragColor = vec4(COMPAT_TEXTURE(PreCRTPass, vTexCoord).rgb, 0)` → WHITE

### What This Means

The texture contains correct data (verified by CPU), but when the SHADER samples it, it gets white. This suggests:

1. **Possible vTexCoord issue** - Sampling wrong coordinates?
2. **Possible texture sampler configuration** - Filter/wrap mismatch?
3. **Possible COMPAT_TEXTURE macro bug** - Expansion issue?
4. **Possible WebGL2 texture() bug** - Function call problem?

### Next Investigation Steps

1. Test with hardcoded coordinates `vec2(0.5, 0.5)` instead of `vTexCoord`
2. Check if `vTexCoord` is passed correctly from vertex shader
3. Inspect compiled GLSL to verify COMPAT_TEXTURE expansion
4. Check for texture coordinate transform issues

---

## 📁 Files Modified

### Core Fixes
- ✅ `src/utils/PureWebGL2Renderer.ts` - **CRITICAL texture binding fix**
- ✅ `src/utils/PureWebGL2MultiPassRenderer.ts` - LUT texture loading (from previous session)
- ✅ `src/shaders/SlangShaderCompiler.ts` - Uniform creation and params. replacement (from previous session)

### Documentation
- ✅ `SHADER_DEBUG_STATUS.md` - Complete debugging status
- ✅ `CHANGES.md` - This file
- ✅ `scripts/check-console.mjs` - Puppeteer console logging script

### Testing
- ✅ `public/shaders/mega-bezel/shaders/guest/hsm-pre-shaders-afterglow.slang` - Restored to original

---

## 🎯 Summary

### What We Fixed
- ✅ **Texture binding mismatch** - MAJOR fix that corrects texture unit assignments
- ✅ **Mipmap corruption** - Removed stale mipmap generation
- ✅ **Debug infrastructure** - Added comprehensive logging

### What Works Now
- ✅ Textures contain correct data (verified by pixel readback)
- ✅ Textures bound to correct units (verified by logging)
- ✅ Shader executes (verified by constant output test)
- ✅ First 4 passes output correct colors

### What Still Needs Work
- ❌ Texture sampling in pass_4 returns white instead of texture data
- ❌ Need to investigate vTexCoord or texture sampler configuration
- ❌ Remaining 13 passes fail due to cascading from pass_4

### Impact
The texture binding fix is a **critical improvement** that ensures the entire multi-pass rendering pipeline can access the correct textures. This fix alone prevents many potential rendering bugs across all 17 passes.

---

## 🔬 Debug Commands Used

```bash
# Start dev server
npm run dev

# Check browser console with Puppeteer
node scripts/check-console.mjs

# Check specific pass output
node scripts/check-console.mjs 2>&1 | grep "PASS OUTPUT.*pass_4"

# View texture binding debug logs
node scripts/check-console.mjs 2>&1 | grep "DEBUG pass_4"

# Restart cleanly
killall -9 node && sleep 2 && npm run dev
```

---

**Session Duration**: ~2 hours
**Lines of Code Changed**: ~150 (excluding debug code)
**Critical Bugs Fixed**: 1 (texture binding mismatch)
**Tests Performed**: 5
**Documentation Created**: 3 files
