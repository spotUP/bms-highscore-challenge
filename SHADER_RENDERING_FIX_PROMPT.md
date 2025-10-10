# Shader Rendering Fix Required - For Sonnet

## Summary
The Mega Bezel shader compilation was fixed (39,392 errors eliminated), but the shaders still don't render the game. The MultiPassRenderer returns null and textures fail to load properly.

## Current Issues

### 1. Texture Loading Failures
```
Failed to load texture: /shaders/mega-bezel/1
Failed to load texture: /shaders/mega-bezel/0
[MegaBezelCompiler] Failed to load texture HSM_ASPECT_RATIO_MODE
[MegaBezelCompiler] Failed to load texture HSM_FXAA_ON
```

**Problem**: The texture paths are incorrect. Instead of actual texture paths, it's trying to load shader parameters as textures (values like "1" and "0").

**Location**: `src/shaders/MegaBezelCompiler.ts:590-603`

### 2. MultiPassRenderer Returns Null
The `render()` method in MultiPassRenderer doesn't return a texture, it just renders to screen. This causes issues when PongSlangDemo tries to use the return value.

**Problem Code** (`src/pages/PongSlangDemo.tsx:313`):
```typescript
slangSystem.megaBezel.render(gameRenderTargetRef.current!.texture);
```

But `render()` returns `void`, not a texture.

### 3. Missing Uniform Values
Many uniforms have null values:
```
[MultiPassRenderer] Uniform HSM_SINDEN_BORDER_OPACITY has null value, setting default
[MultiPassRenderer] Uniform HSM_BZL_INNER_EDGE_SHARPNESS has null value, setting default
```

### 4. No Visual Output
Despite shader compilation working, no game or shader effects are visible on screen.

## Root Causes

### Issue 1: Texture Path Confusion
In `MegaBezelCompiler.loadTexturesFromPreset()`, the code is incorrectly treating shader parameter values as texture paths.

**Current Code Analysis**:
- The preset data contains parameter values (like `HSM_ASPECT_RATIO_MODE = 1`)
- These are being mistakenly parsed as texture paths
- Need to distinguish between actual texture references and parameter values

### Issue 2: Render Method Interface
The MultiPassRenderer's `render()` method needs to:
1. Accept an input texture
2. Process it through the shader pipeline
3. Either return the result OR render directly to screen

### Issue 3: Parameter Initialization
Parameters aren't being properly initialized from the preset data, causing null uniform values.

## Required Fixes

### Fix 1: Correct Texture Loading
In `src/shaders/MegaBezelCompiler.ts`:

1. Parse the preset file to identify ACTUAL texture references (look for sampler2D declarations and texture assignments)
2. Skip parameter values that aren't texture paths
3. Only load valid texture paths like:
   - `/shaders/mega-bezel/textures/BackgroundImage_Carbon_3840x2160.png`
   - `/shaders/mega-bezel/textures/BackgroundVertImage_Carbon_3840x2160.png`
   - Not parameter values like "1" or "0"

### Fix 2: Fix Render Method
In `src/shaders/MultiPassRenderer.ts`:

Option A - Make render() return a texture:
```typescript
render(inputTexture?: THREE.Texture): THREE.Texture | null {
  // Set input texture
  this.setInputTexture(inputTexture || this.placeholderTexture);

  // Render pipeline
  const context = {
    renderer: this.renderer,
    inputTexture: this.inputTexture,
    frameCount: this.frameCount++,
    deltaTime: 1/60
  };

  this.renderPipeline(context);

  // Return the last render target's texture
  return this.lastRenderTarget ? this.lastRenderTarget.texture : null;
}
```

Option B - Add a separate method for getting the result:
```typescript
getRenderTarget(): THREE.WebGLRenderTarget | null {
  return this.lastRenderTarget;
}
```

### Fix 3: Initialize Parameters Properly
In `src/shaders/ParameterManager.ts`:

Ensure all HSM_ parameters are initialized with their default values from the preset, not left as null/undefined.

### Fix 4: Ensure Rendering Pipeline Works
1. Verify the shader pipeline actually processes the input texture
2. Make sure the final pass renders to screen (or returns a texture)
3. Add fallback rendering if shader pipeline fails

## Test Plan

After fixes:
1. The game should be visible
2. No "Failed to load texture" errors for parameter values
3. Shader effects should be applied to the game
4. No null uniform warnings

## Files to Modify
1. `src/shaders/MegaBezelCompiler.ts` - Fix texture loading logic
2. `src/shaders/MultiPassRenderer.ts` - Fix render method return value
3. `src/shaders/ParameterManager.ts` - Ensure proper parameter initialization
4. `src/pages/PongSlangDemo.tsx` - Update to handle render method properly

## Additional Context

The shader compilation itself is working (39,394 errors reduced to 2), but the rendering pipeline isn't properly configured. The main issue seems to be:

1. Confusion between shader parameters and texture paths
2. Incomplete render pipeline that doesn't output anything visible
3. Missing parameter initialization

## Success Criteria

When fixed:
- Game renders with Mega Bezel shader effects
- No texture loading errors for parameter values
- No null uniform warnings
- Visual output shows the Pong game with CRT/bezel effects

## Important Notes

- The shader COMPILATION is fixed (parameter preservation works)
- The issue is now in the RENDERING pipeline
- Don't modify the texture regex fix in SlangShaderCompiler.ts (lines 3630-3662)
- Focus on the texture loading and render output issues