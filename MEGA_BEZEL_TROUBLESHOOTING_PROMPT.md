# Mega Bezel Shader Troubleshooting Guide for AI Assistants

## Problem Statement
The Mega Bezel CRT shader effects are not visible or active in the Pong game despite the shader system being initialized. The game uses a WebGL2-based rendering pipeline with post-processing shader support.

## Critical Background Context

### Architecture Overview
1. **Game Renderer**: `src/pages/Pong404WebGL.tsx` - Main game component using WebGL2D for rendering
2. **Shader Wrapper**: `src/utils/WebGL2DWithShaders.ts` - Wraps WebGL2D and applies post-processing shaders
3. **Multi-Pass System**: `src/utils/PureWebGL2MultiPassRenderer.ts` - Handles Slang shader preset rendering
4. **Shader Compiler**: `src/shaders/SlangShaderCompiler.ts` - Compiles Slang shaders to GLSL
5. **Base Renderer**: `src/utils/WebGL2D.ts` - Core 2D drawing API using WebGL2

### Current State (VERIFIED)
- ✅ Game is rendering successfully (120+ frames confirmed)
- ✅ WebGL2 context exists and is active
- ✅ Canvas is visible with correct dimensions
- ✅ No JavaScript errors in console
- ❌ Mega Bezel shader effects are NOT visible (game looks like plain WebGL2D rendering)

### Shader System Design
The game was REVERTED from a shader pre-loading system back to direct WebGL2D rendering. After `git checkout`, the following occurred:

**CRITICAL**: Check if `WebGL2DWithShaders` is actually being instantiated in `Pong404WebGL.tsx`

## Diagnostic Checklist

### 1. Verify Shader Initialization
**Location**: `src/pages/Pong404WebGL.tsx` around line 6996-7005

**What to check**:
```bash
grep -n "WebGL2DWithShaders\|webglWithShadersRef" src/pages/Pong404WebGL.tsx
```

**Expected**: Should find references to `WebGL2DWithShaders` being instantiated
**Actual Issue**: Currently only finds `new WebGL2D(canvas)` - shaders are NOT being initialized!

### 2. Check Import Statements
**Location**: Top of `src/pages/Pong404WebGL.tsx`

**Required imports**:
```typescript
import { WebGL2D } from '../utils/WebGL2D';
import { WebGL2DWithShaders } from '../utils/WebGL2DWithShaders'; // CHECK IF THIS EXISTS
```

**Verify**:
```bash
grep "^import.*WebGL2DWithShaders" src/pages/Pong404WebGL.tsx
```

### 3. Check Context Initialization Logic
**Location**: `src/pages/Pong404WebGL.tsx` around line 6996-7005 (render function)

**Current (WRONG) code**:
```typescript
if (!webglCtxRef.current) {
  try {
    webglCtxRef.current = new WebGL2D(canvas); // ← PLAIN WEBGL2D, NO SHADERS!
    console.log('✅ WebGL2D context initialized');
  } catch (error) {
    console.error('❌ Failed to initialize WebGL2D:', error);
    return;
  }
}
```

**Should be**:
```typescript
if (!webglCtxRef.current) {
  try {
    // Create WebGL2DWithShaders wrapper with Mega Bezel preset
    const wrapper = new WebGL2DWithShaders(canvas, {
      enabled: true,
      presetPath: '/shaders/mega-bezel/simple-working.slangp',
      bypassOnError: true,
    });

    webglWithShadersRef.current = wrapper;
    webglCtxRef.current = wrapper.getWebGL2D();

    console.log('✅ WebGL2DWithShaders initialized with Mega Bezel');
  } catch (error) {
    console.error('❌ Failed to initialize shaders:', error);
    // Fallback to plain rendering
    webglCtxRef.current = new WebGL2D(canvas);
  }
}
```

### 4. Check Ref Declarations
**Location**: `src/pages/Pong404WebGL.tsx` around line 770

**Required refs**:
```typescript
const webglCtxRef = useRef<WebGL2D | null>(null);
const webglWithShadersRef = useRef<WebGL2DWithShaders | null>(null); // CHECK IF THIS EXISTS
```

### 5. Verify endFrame() Calls
**Location**: End of render function in `src/pages/Pong404WebGL.tsx`

**Required**:
```typescript
// After all rendering is complete, apply shader effects
if (webglWithShadersRef.current) {
  webglWithShadersRef.current.endFrame();
}
```

**Check**:
```bash
grep -n "endFrame()" src/pages/Pong404WebGL.tsx
```

If this is missing, shaders will never be applied even if initialized!

### 6. Verify Shader Preset Exists
**Check file exists**:
```bash
ls -la public/shaders/mega-bezel/simple-working.slangp
```

**Verify preset content**:
```bash
cat public/shaders/mega-bezel/simple-working.slangp
```

Expected: Should have 2 shader passes (derez → stock)

### 7. Check Console Logs
**When game loads, you should see**:
```
[WebGL2DWithShaders] Initialized base renderer
[WebGL2DWithShaders] Shader pipeline initialized
[WebGL2DWithShaders] 🔄 Loading shader preset, shadersEnabled = false
✅ [PureWebGL2MultiPass] Preset loaded successfully
[WebGL2DWithShaders] ✅ Preset loaded, enabling shaders NOW
[WebGL2DWithShaders] ✅ shadersEnabled = true (should be true)
[WebGL2DWithShaders] First frame with multi-pass shaders
```

**If you DON'T see these logs**: Shaders are not being initialized at all!

### 8. Check for Shader Bypass
**Location**: `src/utils/WebGL2DWithShaders.ts` in `endFrame()` method

**Look for bypass conditions**:
```typescript
if (!this.shadersEnabled || this.shadersFailed) {
  // Shaders bypassed - rendering directly
  return;
}
```

**Verify**:
```bash
grep -A5 "endFrame()" src/utils/WebGL2DWithShaders.ts | grep -E "shadersEnabled|shadersFailed"
```

## Most Likely Root Cause

Based on the code review, the **PRIMARY ISSUE** is:

**The game was reverted to use plain `WebGL2D` instead of `WebGL2DWithShaders`**

When `git checkout` was run to undo shader preloading changes, it also removed the shader initialization code entirely, leaving only:
```typescript
webglCtxRef.current = new WebGL2D(canvas);
```

This means NO SHADERS are being loaded at all!

## Fix Instructions

### Step 1: Verify Current State
```bash
# Check if WebGL2DWithShaders is imported
grep "import.*WebGL2DWithShaders" src/pages/Pong404WebGL.tsx

# Check if webglWithShadersRef exists
grep "webglWithShadersRef" src/pages/Pong404WebGL.tsx

# Check current initialization
grep -A10 "if (!webglCtxRef.current)" src/pages/Pong404WebGL.tsx
```

### Step 2: Add Missing Import (if needed)
At the top of `src/pages/Pong404WebGL.tsx`:
```typescript
import { WebGL2DWithShaders } from '../utils/WebGL2DWithShaders';
```

### Step 3: Add Missing Ref (if needed)
Around line 770 in `src/pages/Pong404WebGL.tsx`:
```typescript
const webglWithShadersRef = useRef<WebGL2DWithShaders | null>(null);
```

### Step 4: Replace Initialization Code
Find the `new WebGL2D(canvas)` line and replace with:
```typescript
if (!webglCtxRef.current) {
  try {
    console.log('[INIT] Creating WebGL2DWithShaders with Mega Bezel preset');

    const wrapper = new WebGL2DWithShaders(canvas, {
      enabled: true,
      presetPath: '/shaders/mega-bezel/simple-working.slangp',
      bypassOnError: true,
    });

    webglWithShadersRef.current = wrapper;
    webglCtxRef.current = wrapper.getWebGL2D();

    console.log('✅ Mega Bezel shaders initialized');
  } catch (error) {
    console.error('❌ Failed to initialize WebGL2DWithShaders:', error);
    // Fallback to plain rendering
    webglCtxRef.current = new WebGL2D(canvas);
    console.log('⚠️ Using plain WebGL2D (no shaders)');
  }
}
```

### Step 5: Add endFrame() Call
At the very end of the render function (after all drawing is complete):
```typescript
// CRITICAL: Apply shader post-processing
if (webglWithShadersRef.current) {
  webglWithShadersRef.current.endFrame();
}
```

### Step 6: Verify Fix
Reload the page and check console for:
1. `[INIT] Creating WebGL2DWithShaders with Mega Bezel preset`
2. `✅ [PureWebGL2MultiPass] Preset loaded successfully`
3. `✅ Mega Bezel shaders initialized`
4. `[WebGL2DWithShaders] First frame with multi-pass shaders`

If you see all these logs, shaders should now be visible!

## Testing the Fix

### Visual Verification
The Mega Bezel shaders should produce:
- Slight CRT scanline effect
- Subtle screen curvature
- Soft glow/bloom around bright pixels
- Overall "vintage monitor" appearance

### Console Check
```bash
# Run this in browser console while game is running
console.log('Has wrapper:', !!webglWithShadersRef?.current);
console.log('Wrapper enabled:', webglWithShadersRef?.current?.shadersEnabled);
```

### Performance Check
- Frame rate should stay at 60 FPS
- No console errors about WebGL context loss
- No warnings about shader compilation

## Alternative Shader Presets to Test

If `simple-working.slangp` doesn't show visible effects, try:

1. **`minimal-working.slangp`** - Absolute minimum (passthrough only)
2. **`game-with-simple-frame.slangp`** - Adds visible frame/bezel
3. **`simple-reflection.slangp`** - Adds screen reflection effect
4. **`bezel-test.slangp`** - Full bezel with decorative frame

Change the preset path:
```typescript
presetPath: '/shaders/mega-bezel/game-with-simple-frame.slangp',
```

## Advanced Debugging

### Enable Detailed Logging
In `src/utils/WebGL2DWithShaders.ts`, find `endFrame()` and add:
```typescript
console.log(`[Frame ${this.frameCount}] Shaders: enabled=${this.shadersEnabled}, failed=${this.shadersFailed}, renderer=${!!this.shaderRenderer}`);
```

### Check WebGL State
```javascript
// In browser console
const canvas = document.querySelector('canvas');
const gl = canvas.getContext('webgl2');
console.log('WebGL extensions:', gl.getSupportedExtensions());
console.log('Max texture size:', gl.getParameter(gl.MAX_TEXTURE_SIZE));
```

### Verify Shader Compilation
Check for shader compilation errors:
```bash
grep -r "shader compilation failed\|shader linking failed" src/utils/
```

## Common Mistakes to Avoid

1. ❌ **Forgetting to call `endFrame()`** - Shaders won't apply without this!
2. ❌ **Using wrong preset path** - Must be `/shaders/...` not `public/shaders/...`
3. ❌ **Not storing wrapper ref** - Need both `webglCtxRef` AND `webglWithShadersRef`
4. ❌ **Calling `endFrame()` too early** - Must be AFTER all game rendering
5. ❌ **Not handling async preset loading** - Shaders enable after Promise resolves

## Expected Timeline

- **0ms**: WebGL2DWithShaders constructor called
- **~50ms**: Shader preset loaded and compiled (async)
- **~100ms**: `shadersEnabled` becomes true
- **Frame 1**: First shader-processed frame rendered
- **Frame 60+**: Continuous shader rendering

## Success Criteria

✅ Console shows shader initialization logs
✅ Console shows "✅ [PureWebGL2MultiPass] Preset loaded successfully"
✅ Console shows shader-processed frames being rendered
✅ Visual appearance changes (CRT effect visible)
✅ No errors in console
✅ 60 FPS maintained

## If Still Not Working

1. **Check browser compatibility**: Mega Bezel requires WebGL2 (not WebGL1)
2. **Try different preset**: Some presets are more visually obvious than others
3. **Check canvas size**: Shaders need minimum 400x400px to be visible
4. **Verify texture support**: Some GPUs don't support required texture formats
5. **Check for context loss**: WebGL context might be getting lost/recreated

## Final Notes

The root issue is almost certainly that `WebGL2DWithShaders` was removed during the git revert. The fix is to re-add the shader initialization code WITHOUT the problematic pre-loading system that was causing issues.

The shaders themselves work (as evidenced by past logs showing successful loading) - they're just not being initialized anymore after the revert.
