# Mega Bezel Shader Integration - Current Status

**Date**: 2025-10-10
**Session Goal**: Enable full Mega Bezel reflection shader WITHOUT black screen issues

---

## Current Implementation

### Architecture

The integration uses a **layered, incremental approach** designed to avoid the black screen issues that plagued previous attempts:

1. **WebGL2D** (base renderer) - Renders game using Canvas2D-compatible API on WebGL
2. **WebGL2DWithShaders** (optional wrapper) - Captures WebGL2D output to framebuffer
3. **Shader Post-Processing** - Applies effects to captured frame before displaying

### Key Design Principles

- **Non-destructive**: Game logic unchanged, rendering identical when shaders disabled
- **Fallback-safe**: Automatically disables shaders if errors occur
- **Incremental**: Test passthrough before adding complex shaders
- **Toggleable**: Ctrl+Shift+S to enable/disable shaders dynamically

---

## Files Created

### 1. `src/utils/WebGL2DWithShaders.ts` (390 lines)

**Purpose**: Wraps WebGL2D to add optional shader post-processing

**Features**:
- Framebuffer rendering (captures WebGL2D output)
- Passthrough shader (simple texture copy for testing)
- Multi-pass shader support (via PureWebGL2MultiPassRenderer)
- Error bypass (falls back to direct rendering if shaders fail)
- `beginFrame()` / `endFrame()` API

**Config**:
```typescript
interface ShaderConfig {
  enabled: boolean;
  presetPath?: string;  // Path to .slangp preset
  bypassOnError: boolean;  // Auto-disable on errors
}
```

---

## Files Modified

### 1. `src/pages/Pong404WebGL.tsx`

**Changes**:
- Added import: `WebGL2DWithShaders`
- Added state: `shadersEnabled` (default: false)
- Added ref: `webglWithShadersRef`
- Added keyboard toggle: Ctrl+Shift+S
- Added `beginFrame()` at start of render()
- Added `endFrame()` at end of render()
- Added `shadersEnabled` to render() dependency array

**Initialization Logic** (lines 7000-7020):
```typescript
if (shadersEnabled && !webglWithShadersRef.current) {
  // Create shader wrapper
  webglWithShadersRef.current = new WebGL2DWithShaders(canvas, {
    enabled: true,
    presetPath: undefined,  // Start with passthrough only
    bypassOnError: true
  });
  webglCtxRef.current = webglWithShadersRef.current.getWebGL2D();
} else if (!shadersEnabled) {
  // Direct rendering (no shaders)
  webglCtxRef.current = new WebGL2D(canvas);
}
```

**Frame Wrapping** (lines 7025-7028, 9351-9354):
```typescript
// Begin frame
if (webglWithShadersRef.current && shadersEnabled) {
  webglWithShadersRef.current.beginFrame();
}

// ... all game rendering ...

// End frame
if (webglWithShadersRef.current && shadersEnabled) {
  webglWithShadersRef.current.endFrame();
}
```

### 2. `src/utils/PureWebGL2MultiPassRenderer.ts`

**Fix**: Changed import path
```typescript
// Before:
import { SlangShaderCompiler } from './SlangShaderCompiler';

// After:
import { SlangShaderCompiler } from '../shaders/SlangShaderCompiler';
```

---

## How It Works

### Without Shaders (Default - shadersEnabled = false)

```
Game Logic → WebGL2D → Canvas (direct render)
```

- Zero overhead
- Identical to previous implementation
- No framebuffer, no shader compilation

### With Shaders (shadersEnabled = true)

```
Game Logic → WebGL2D → Framebuffer Texture
                           ↓
               Passthrough Shader (or Mega Bezel preset)
                           ↓
                    Final Screen Output
```

**Frame Cycle**:
1. `beginFrame()` - Binds framebuffer to capture WebGL2D output
2. Game renders normally using WebGL2D API
3. `endFrame()` - Unbinds framebuffer, applies shader to captured texture, renders to screen

---

## Testing Instructions

### Step 1: Verify Direct Rendering (No Shaders)

1. Open: http://localhost:8080/404
2. Game should work normally (no changes)
3. This confirms game logic is unchanged

### Step 2: Enable Passthrough Shader

1. Press: **Ctrl+Shift+S**
2. Console should log: `[SHADERS] ENABLED`
3. Game should look IDENTICAL (passthrough just copies pixels)
4. **If black screen appears here, passthrough shader has bug**

### Step 3: Check Console for Errors

```bash
# In browser console, look for:
✅ WebGL2DWithShaders initialized (passthrough mode)
✅ Framebuffer created successfully
✅ Passthrough shader created

# Errors to watch for:
❌ Failed to create framebuffer
❌ Passthrough shader error
❌ Framebuffer incomplete
```

### Step 4: Load Mega Bezel Preset (Future)

Once passthrough works, modify initialization:
```typescript
webglWithShadersRef.current = new WebGL2DWithShaders(canvas, {
  enabled: true,
  presetPath: '/shaders/mega-bezel/potato.slangp',  // Add preset path
  bypassOnError: true
});
```

---

## Current Status

### Completed

- [x] WebGL2DWithShaders wrapper created
- [x] Framebuffer capture implemented
- [x] Passthrough shader implemented
- [x] Integration into Pong404WebGL
- [x] Keyboard toggle (Ctrl+Shift+S)
- [x] Error fallback mechanism
- [x] Fixed PureWebGL2MultiPassRenderer imports

### In Progress

- [ ] **TEST PASSTHROUGH** - Verify no black screen with passthrough enabled
- [ ] Console error checking
- [ ] Performance validation (should be identical to direct rendering)

### Pending

- [ ] Simple CRT shader (scanlines + curvature)
- [ ] Full Mega Bezel preset integration
- [ ] Parameter controls
- [ ] Performance optimization

---

## Known Issues

### Issue 1: Vite Cache (Resolved)

**Problem**: Vite cached old import paths
**Solution**: Touched file to force rebuild
**Status**: FIXED - import now points to `../shaders/SlangShaderCompiler`

### Issue 2: No Visual Confirmation Yet

**Problem**: Haven't tested in browser yet
**Next Step**: Open http://localhost:8080/404 and test Ctrl+Shift+S toggle

---

## Next Steps

### Immediate (Next 5 minutes)

1. Open browser: http://localhost:8080/404
2. Test direct rendering (should work as before)
3. Press Ctrl+Shift+S to enable shaders
4. Check for black screen or console errors

### If Passthrough Works

1. Add simple CRT shader with scanlines
2. Test that CRT effects render correctly
3. Gradually increase complexity

### If Black Screen Appears

1. Check framebuffer creation logs
2. Verify texture dimensions match canvas
3. Check passthrough shader compilation
4. Verify `beginFrame()`/`endFrame()` timing

---

## Success Criteria

**Phase 1: Passthrough** (Current Goal)
- [x] Code compiles without errors
- [ ] No black screen when shaders enabled
- [ ] Game identical with/without shaders
- [ ] No console errors
- [ ] Performance identical

**Phase 2: Simple CRT**
- [ ] Scanlines visible
- [ ] Curvature working
- [ ] Game still playable
- [ ] FPS stable

**Phase 3: Mega Bezel**
- [ ] Full preset loads
- [ ] All effects render
- [ ] Reflections working
- [ ] No performance issues

---

## Architecture Benefits

### Why This Approach Works

1. **Minimal Changes**: Only 3 small changes to Pong404WebGL.tsx
2. **Zero Risk**: Disabled by default, opt-in only
3. **Incremental**: Test each layer before adding complexity
4. **Debuggable**: Clear logs at each step
5. **Fallback**: Auto-disables on errors

### Comparison to Previous Attempts

**Previous (Failed)**:
- Tried to integrate shaders directly into WebGL2D
- No fallback mechanism
- All-or-nothing approach
- Hard to debug black screens

**Current (Better)**:
- Shaders are optional wrapper
- Automatic fallback
- Test passthrough before complex shaders
- Clear separation of concerns

---

## Developer Notes

### Important Code Locations

**Shader Toggle**:
`src/pages/Pong404WebGL.tsx:6115-6129`

**Initialization**:
`src/pages/Pong404WebGL.tsx:7000-7020`

**Frame Wrapping**:
`src/pages/Pong404WebGL.tsx:7025-7028` (begin)
`src/pages/Pong404WebGL.tsx:9351-9354` (end)

**Shader Wrapper**:
`src/utils/WebGL2DWithShaders.ts`

### Key Insights

1. **Context Caching Critical**: Don't recreate WebGL2DWithShaders every frame
2. **Dependency Array**: Must include `shadersEnabled` in render() deps
3. **Error Handling**: bypassOnError prevents infinite error loops
4. **Testing Philosophy**: Passthrough first, complexity later

---

**Last Updated**: 2025-10-10 12:22 PM
**Status**: Ready for browser testing
