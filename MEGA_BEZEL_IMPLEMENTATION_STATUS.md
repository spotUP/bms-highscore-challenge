# Mega Bezel Reflection Shader Implementation Status

**Date**: 2025-10-11
**Current Status**: 🟡 IN PROGRESS - 4 out of 15 passes compiling successfully
**Goal**: Implement full 36-pass Mega Bezel reflection shader for Pong game

---

## 🎯 Current Progress

### Working Passes (std-working.slangp)
- ✅ **Pass 0**: `hsm-drez-g-sharp_resampler.slang` - Derez/downscaling
- ✅ **Pass 1**: `cache-info-all-params.slang` - Parameter caching
- ✅ **Pass 2**: `hsm-fetch-drez-output.slang` - Fetch derez output
- ✅ **Pass 3**: `fxaa.slang` - Anti-aliasing
- ❌ **Pass 4**: `hsm-custom-fast-sharpen.slang` - **BLOCKED: Macro redefinition errors**

### Compilation Statistics
- **Passes Compiling**: 4 / 15 (std-working preset)
- **Target**: 36 passes (full MBZ__3__STD__GDV.slangp)
- **Success Rate**: 26.7% of working preset, 11.1% of full preset

---

## 🔧 Major Fixes Implemented

### 1. Function Extraction System ✅
**Problem**: Stub functions were being used instead of extracting real function implementations.

**Solution**:
- Removed stub function skip list in `SlangShaderCompiler.ts` line 450
- Functions are now extracted from source files directly
- 112+ functions extracted per complex pass

**Files Modified**:
- `src/shaders/SlangShaderCompiler.ts` lines 447-459

### 2. Array Parameter with #define Constants ✅
**Problem**: Function `hrg_get_ideal_global_eye_pos_for_points` has parameter `vec3 global_coords[HRG_MAX_POINT_CLOUD_SIZE]` which WebGL doesn't handle.

**Solution**:
- Replace all instances of `HRG_MAX_POINT_CLOUD_SIZE` with literal value `9` in function bodies
- Prevents WebGL GLSL errors with #define array sizes

**Files Modified**:
- `src/shaders/SlangShaderCompiler.ts` lines 1303-1306

**Code**:
```typescript
// Fix array declarations and variable assignments with HRG_MAX_POINT_CLOUD_SIZE
fixed = fixed.replace(/\bHRG_MAX_POINT_CLOUD_SIZE\b/g, '9');
```

### 3. Missing Shader File Path ✅
**Problem**: Pass 2 tried to load `shaders/base/fetch-drez-output.slang` which doesn't exist.

**Solution**:
- Corrected path to `shaders/guest/extras/hsm-fetch-drez-output.slang`

**Files Modified**:
- `public/shaders/mega-bezel/std-working.slangp` line 22

### 4. Frame Clearing Issue ✅
**Problem**: Game was not clearing frames between renders when using shaders.

**Solution**:
- Clear framebuffer AFTER `beginFrame()` call, not before
- Prevents accumulation of old frame content

**Files Modified**:
- `src/pages/Pong404WebGL.tsx` lines 7380-7385

---

## 🚧 Current Blockers

### Pass 4: Macro Redefinition Errors
**Error**:
```
ERROR: 0:162: 'CSHARPEN' : macro redefined
ERROR: 0:163: 'CCONTR' : macro redefined
ERROR: 0:164: 'CDETAILS' : macro redefined
```

**Analysis**:
- Shader: `shaders/guest/hsm-custom-fast-sharpen.slang`
- Macros CSHARPEN, CCONTR, CDETAILS are being defined multiple times
- Deduplication code EXISTS (`removeDuplicateDefines()` at line 3663) but may not be working at compiled shader level
- Currently removes FXAA_* duplicates but not C* duplicates

**Potential Fixes**:
1. Enhance `removeDuplicateDefines()` to work on fully compiled shader output (not just includes)
2. Skip Pass 4 and test remaining passes first
3. Check if macros are conditionally defined (#ifdef) which may confuse deduplicator

---

## 📁 Project Structure

### Key Files

**Shader Compiler**:
- `src/shaders/SlangShaderCompiler.ts` - Main compiler (4400+ lines)
  - Line 360-465: Function extraction logic
  - Line 844-1356: Global definitions builder
  - Line 1300-1350: Function fixing (int/float, arrays)
  - Line 1361-2750: WebGL conversion
  - Line 3663-3730: #define deduplication

**Renderer**:
- `src/utils/WebGL2DWithShaders.ts` - Shader wrapper for WebGL2D
- `src/utils/PureWebGL2MultiPassRenderer.ts` - Multi-pass shader executor
- `src/pages/Pong404WebGL.tsx` - Main game with shader integration

**Shader Presets**:
- `public/shaders/mega-bezel/std-working.slangp` - 15-pass working preset (CURRENT)
- `public/shaders/mega-bezel/MBZ__3__STD__GDV.slangp` - 36-pass full preset (TARGET)

---

## 🔄 Architecture Overview

### Shader Pipeline
```
1. Load .slangp preset file
   ↓
2. For each shader pass:
   - Load .slang shader file
   - Process #include directives (IncludePreprocessor)
   - Extract functions from global section
   - Extract #defines and parameters
   ↓
3. SlangShaderCompiler.compile():
   - Build global definitions (uniforms, functions, #defines)
   - Convert to WebGL-compatible GLSL
   - Replace Slang-specific syntax
   ↓
4. WebGL compilation:
   - Compile vertex shader
   - Compile fragment shader
   - Link program
   ↓
5. Multi-pass rendering:
   - Render to framebuffer for each pass
   - Each pass uses previous pass output as input
   - Final pass renders to screen
```

### beginFrame/endFrame Pattern
```typescript
// In game render function:
webglWithShadersRef.current.beginFrame();  // Bind framebuffer
// ... render game content to framebuffer ...
webglWithShadersRef.current.endFrame();    // Apply shader post-processing to screen
```

**Critical**: Must be called AFTER early returns (audio prompt, start screen) to prevent framebuffer leaks.

---

## 🧪 Testing

### How to Test
1. Start dev server: `npm run dev` (starts Vite on 8080 + WebSocket on 3002)
2. Open: http://localhost:8080/404
3. Click through audio prompt
4. Press SPACE to start game
5. Check browser console (F12) for shader compilation logs

### Test Scripts
- `test-full-mega-bezel.mjs` - Tests preset compilation, shows pass counts
- `check-preset-error.mjs` - Shows all console output including errors
- `simple-shader-check.mjs` - Quick check if beginFrame/endFrame are called

### Debug Logging
Enable in `SlangShaderCompiler.ts`:
- Function extraction: Lines 456-458
- HRG functions: Lines 1274-1276, 1284-1289
- #define deduplication: Line 1706

---

## 📊 Shader Pass Breakdown (std-working.slangp)

| Pass | Shader | Status | Purpose |
|------|--------|--------|---------|
| 0 | hsm-drez-g-sharp_resampler | ✅ | Derez/downscale with G-sharp resampling |
| 1 | cache-info-all-params | ✅ | Cache screen parameters for later passes |
| 2 | hsm-fetch-drez-output | ✅ | Fetch derez output texture |
| 3 | fxaa | ✅ | FXAA anti-aliasing |
| 4 | hsm-custom-fast-sharpen | ❌ | Sharpening (BLOCKED: macro redef) |
| 5 | stock (PrePass) | ⏳ | Passthrough |
| 6 | hsm-avg-lum | ⏳ | Average luminance calculation |
| 7 | hsm-interlace-and-linearize | ⏳ | Interlacing and linearization |
| 8 | hsm-crt-guest-advanced | ⏳ | CRT scanline effects |
| 9 | hsm-deconvergence | ⏳ | CRT deconvergence |
| 10 | linearize-crt | ⏳ | Linearize CRT output |
| 11-12 | blur passes | ⏳ | Blur for reflection |
| 13 | reflection | ⏳ | **REFLECTION EFFECT** |
| 14 | final-composite | ⏳ | Final composite |

---

## 🎯 Next Steps

### Immediate (Fix Pass 4)
1. **Option A**: Fix macro deduplication
   - Check if `removeDuplicateDefines()` runs on compiled shader
   - Ensure CSHARPEN/CCONTR/CDETAILS are caught
   - May need to run deduplication AFTER all includes are merged

2. **Option B**: Skip Pass 4 for now
   - Comment out Pass 4 in std-working.slangp
   - Test Passes 5-14 first
   - Come back to sharpen pass later

### Short Term (Complete std-working.slangp)
- Fix remaining passes 5-14
- Verify reflection effect appears (Pass 13)
- Test full rendering pipeline
- Check performance (target: 60 FPS)

### Long Term (Full 36-Pass Preset)
- Switch to `MBZ__3__STD__GDV.slangp`
- Fix additional shader compilation issues
- Add CRT curvature, bezel graphics, bloom
- Optimize for production use

---

## 🐛 Known Issues

1. **Macro Redefinition** (Pass 4)
   - CSHARPEN, CCONTR, CDETAILS defined multiple times
   - Deduplication not catching them

2. **beginFrame/endFrame Timing**
   - Must be after early returns
   - Debug logging enabled (window.__renderDebugCount <= 200)
   - Should be disabled in production

3. **HRG_MAX_POINT_CLOUD_SIZE**
   - Fixed by replacing with literal `9`
   - May need similar fixes for other #define constants in arrays

4. **Shader File Paths**
   - Some presets have wrong relative paths
   - Check all shader paths in .slangp files

---

## 💡 Key Learnings

### WebGL vs Slang Differences
- Array sizes must be literals, not #defines
- `mat3x3` must be `mat3`
- `texture()` must be `texture2D()`
- `in/out` must be `varying`
- Integer constants get converted to floats (add explicit `.0`)

### Function Extraction
- Regex pattern: `/^[ \t]*(?:void|float|int|...)(\w+)\s*\(/gm`
- Must handle multi-line function signatures
- Must track brace counting for function bodies
- Must deduplicate functions by signature, not just name

### Shader Compilation Order
1. Load and process includes
2. Extract global definitions
3. Build uniform declarations
4. Add extracted functions
5. Convert Slang → WebGL syntax
6. Deduplicate #defines
7. Compile vertex + fragment shaders

---

## 🔗 Useful Commands

```bash
# Start dev environment
npm run dev

# Kill all Node processes and restart
killall -9 node && sleep 1 && npm run dev

# Test shader compilation
node test-full-mega-bezel.mjs

# Check specific pass error
node check-preset-error.mjs 2>&1 | grep "pass_4" -A10

# Find shader files
find public/shaders -name "*sharpen*"

# Check function extraction
grep "Extracted function" console.log | head -20
```

---

## 📝 Summary

We've made **significant progress** on the Mega Bezel shader implementation:

**Achievements**:
- ✅ Function extraction working (no stubs!)
- ✅ Complex array parameters fixed
- ✅ 4 shader passes compiling successfully
- ✅ Frame clearing working properly
- ✅ beginFrame/endFrame pattern correct

**Current Challenge**:
- ❌ Pass 4 macro redefinition blocking progress

**Next Action**:
- Fix `removeDuplicateDefines()` to catch CSHARPEN/CCONTR/CDETAILS macros
- OR skip Pass 4 temporarily and continue testing other passes

**Path to Completion**:
1. Fix Pass 4 (macro dedup)
2. Test Passes 5-14 (expect more issues)
3. Fix issues as they arise
4. Verify reflection effects work
5. Expand to full 36-pass preset
6. Optimize and finalize

---

**Implementation Status**: 🟡 26.7% Complete (4/15 passes)
**Blocker**: Macro redefinition in Pass 4
**Next Session**: Fix macro deduplication or skip Pass 4 to test remaining passes
