# Shader System Fix Report
**Date**: 2025-10-09
**Status**: Basic pipeline working, complex presets need texture dependencies

## Problem Summary

The Mega Bezel shader system was producing a black screen when rendering through the multi-pass pipeline, despite successful shader compilation.

## Root Cause Analysis

### Investigation Process

1. **Initial State**: Black screen with "Mega Bezel render successful" message
2. **Bypass Testing**: Confirmed input texture renders correctly when bypassing all shader systems
3. **Pipeline Testing**: Confirmed MultiPassRenderer works with simple passthrough shader
4. **Pass Isolation**: Tested each shader pass individually to identify failure point

### Identified Issues

#### Issue #1: MultiPassRenderer was functional but untested
- **Location**: `src/shaders/MultiPassRenderer.ts`
- **Problem**: The render pipeline was working but producing black output for complex shaders
- **Fix**: Added bypass mode for testing and pixel validation logging

#### Issue #2: Complex shader dependencies not satisfied
- **Location**: `public/shaders/mega-bezel/shaders/base/cache-info-potato-params.slang`
- **Problem**: Shader requires textures that aren't being provided:
  - `InfoCachePassFeedback` - Previous frame feedback texture
  - `ScreenPlacementImage` - Screen placement/positioning texture
- **Impact**: Shader returns black output, which propagates to all subsequent passes

## Working Configuration

### Successful Test Cases

1. ✅ **Direct input texture rendering** (bypass all shaders)
   - Location: `MegaBezelPresetLoader.ts:231` - `BYPASS_MULTIPASS = true`
   - Proves input texture is valid

2. ✅ **Simple passthrough shader**
   - Preset: `public/shaders/mega-bezel/passthrough.slangp`
   - Proves shader compilation and pipeline work correctly

3. ✅ **Single derez pass**
   - Preset: `public/shaders/mega-bezel/test-pass-0-only.slangp`
   - Proves complex guest shaders compile correctly

### Failed Test Cases

1. ❌ **Two-pass with cache-info shader**
   - Preset: `public/shaders/mega-bezel/test-pass-0-1.slangp`
   - Pass 0 (derez) works, Pass 1 (cache-info) returns black
   - Cause: Missing feedback and placement textures

2. ❌ **Full Mega Bezel preset**
   - Preset: `public/shaders/mega-bezel/test-remove-last.slangp`
   - 6 passes, fails at pass 1 (cache-info)

## Code Changes Made

### 1. MultiPassRenderer Debugging
**File**: `src/shaders/MultiPassRenderer.ts`

```typescript
// Line 459-465: Added error handling for individual passes
try {
  const result = this.executePass(pass, context);
  passResults.push(result);
} catch (passError) {
  console.error(`[MultiPassRenderer] Pass ${i} (${pass.name}) FAILED:`, passError);
  throw new Error(`Shader pass ${i} (${pass.name}) failed: ${passError instanceof Error ? passError.message : String(passError)}`);
}

// Line 573-587: Added pixel validation logging
if (this.frameCount === 1 && outputTarget) {
  const gl = this.renderer.getContext();
  const pixel = new Uint8Array(4);
  gl.readPixels(
    Math.floor(outputTarget.width / 2),
    Math.floor(outputTarget.height / 2),
    1, 1,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    pixel
  );
  console.log(`[MultiPassRenderer] Pass ${pass.name} center pixel:`, pixel);
}
```

### 2. MegaBezelPresetLoader Bypass Modes
**File**: `src/shaders/MegaBezelPresetLoader.ts`

```typescript
// Line 230-258: Added BYPASS_MULTIPASS flag for testing
const BYPASS_MULTIPASS = false; // Set to true to skip shader pipeline

if (BYPASS_MULTIPASS) {
  console.log('[MegaBezelLoader] BYPASS MODE: Using input texture directly');
  processedTexture = inputTexture;
} else {
  // Normal multi-pass rendering...
}

// Line 292-293: Added TEST_BYPASS_BEZEL flag
const TEST_BYPASS_BEZEL = true; // Set to false to use bezel composition

if (TEST_BYPASS_BEZEL && processedTexture) {
  this.renderDirectToScreen(processedTexture);
}
```

### 3. Test Presets Created

**Passthrough Test** - `public/shaders/mega-bezel/passthrough.slangp`:
```ini
shaders = 1
shader0 = shaders/test-passthrough.slang
filter_linear0 = true
scale_type0 = source
scale0 = 1.0
```

**Single Pass Test** - `public/shaders/mega-bezel/test-pass-0-only.slangp`:
```ini
shaders = 1
shader0 = shaders/guest/extras/hsm-drez-g-sharp_resampler.slang
filter_linear0 = false
scale_type_x0 = viewport
scale_x0 = 1.0
scale_type_y0 = viewport
scale_y0 = 1.0
wrap_mode0 = "clamp_to_edge"
alias0 = "DerezedPass"
```

## Required Fixes for Full Mega Bezel Support

### Priority 1: Feedback Texture System

**Issue**: `cache-info-potato-params.slang` requires previous frame as input

**Implementation needed**:
```typescript
// Location: src/shaders/MultiPassRenderer.ts

class MultiPassRenderer {
  private feedbackTextures: Map<string, THREE.WebGLRenderTarget> = new Map();

  private updateFeedbackTextures(pass: ShaderPass): void {
    // After rendering each pass with an alias, store its output
    if (pass.alias && pass.renderTarget) {
      const feedbackKey = pass.alias + 'Feedback';

      // Create or update feedback texture
      if (!this.feedbackTextures.has(feedbackKey)) {
        const feedbackRT = pass.renderTarget.clone();
        this.feedbackTextures.set(feedbackKey, feedbackRT);
      } else {
        // Copy current frame to feedback
        const feedbackRT = this.feedbackTextures.get(feedbackKey)!;
        this.renderer.copyTextureToTexture(
          new THREE.Vector2(0, 0),
          pass.renderTarget.texture,
          feedbackRT.texture
        );
      }
    }
  }

  private bindFeedbackTextures(pass: ShaderPass): void {
    // Bind feedback textures to uniforms
    // Example: InfoCachePassFeedback uniform gets previous InfoCachePass output
    for (const [uniformName, uniform] of Object.entries(pass.uniforms)) {
      if (uniformName.endsWith('Feedback')) {
        const feedbackRT = this.feedbackTextures.get(uniformName);
        if (feedbackRT) {
          uniform.value = feedbackRT.texture;
        }
      }
    }
  }
}
```

### Priority 2: Placement Image Texture

**Issue**: `ScreenPlacementImage` texture not provided

**Implementation needed**:
```typescript
// Location: src/shaders/MegaBezelPresetLoader.ts

export class MegaBezelPresetLoader {
  private placementTexture: THREE.Texture | null = null;

  async loadPreset(presetPath: string): Promise<PresetLoadResult> {
    // ... existing code ...

    // Load placement image if specified in preset
    if (preset.textures?.ScreenPlacementImage) {
      this.placementTexture = await this.loadTexture(preset.textures.ScreenPlacementImage);
    } else {
      // Create default transparent 16x16 placeholder
      this.placementTexture = this.createPlaceholderTexture(16, 16);
    }

    // Pass to MultiPassRenderer
    this.multiPassRenderer.setPlacementTexture(this.placementTexture);
  }

  private createPlaceholderTexture(width: number, height: number): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(0, 0, 0, 0)';
    ctx.fillRect(0, 0, width, height);
    return new THREE.CanvasTexture(canvas);
  }
}
```

### Priority 3: Global Parameter Uniforms

**Issue**: Cache-info shader uses many global parameters (HSM_*) that may not be initialized

**Implementation needed**:
```typescript
// Location: src/shaders/ParameterManager.ts

export class ParameterManager {
  private initializeDefaultMegaBezelParams(): void {
    // Add default values for all HSM_* parameters used in cache-info
    const defaults = {
      'HSM_DUALSCREEN_MODE': 0,
      'HSM_ROTATE_CORE_IMAGE': 0,
      'HSM_ASPECT_RATIO_MODE': 0,
      'HSM_ASPECT_RATIO_EXPLICIT': 1.333,
      'HSM_CROP_MODE': 0,
      'HSM_CROP_PERCENT_ZOOM': 0,
      'HSM_VIEWPORT_ZOOM': 1.0,
      'HSM_CACHE_GRAPHICS_ON': 1.0,
      // ... add all HSM_* parameters with sensible defaults
    };

    for (const [name, value] of Object.entries(defaults)) {
      if (!this.hasParameter(name)) {
        this.setValue(name, value);
      }
    }
  }
}
```

### Priority 4: Semantic Texture Binding

**Issue**: Textures need to be bound to correct uniform names

**Implementation needed**:
```typescript
// Location: src/shaders/MultiPassRenderer.ts

private updatePassUniformsWithTextures(pass: ShaderPass, context: RenderContext): void {
  // Bind Source texture
  if (pass.uniforms['Source']) {
    pass.uniforms['Source'].value = context.inputTexture;
  }

  // Bind aliased pass outputs
  for (const prevPass of this.preset!.passes) {
    if (prevPass.alias && prevPass.renderTarget) {
      const uniformName = prevPass.alias;
      if (pass.uniforms[uniformName]) {
        pass.uniforms[uniformName].value = prevPass.renderTarget.texture;
      }
    }
  }

  // Bind feedback textures
  this.bindFeedbackTextures(pass);

  // Bind preset textures (LUTs, placement images, etc)
  this.bindPresetTextures(pass);
}
```

## Testing Recommendations

### Phase 1: Feedback System
1. Implement feedback texture storage
2. Test with `cache-info-potato-params.slang` isolated
3. Verify pixel output is non-black
4. Check feedback loop stability (no oscillation)

### Phase 2: Texture Dependencies
1. Load all preset textures (SamplerLUT1-4, ScreenPlacementImage, etc)
2. Bind textures to correct uniforms
3. Test with 2-pass preset (derez + cache-info)
4. Verify both passes produce valid output

### Phase 3: Full Pipeline
1. Enable all 6 passes from `test-remove-last.slangp`
2. Monitor each pass output with pixel validation
3. Check for performance issues (6 passes * 60fps = 360 shader executions/sec)
4. Optimize if needed (shader caching, texture pooling)

## Current Working Demo

**Preset**: `public/shaders/mega-bezel/passthrough.slangp`
**Status**: ✅ Renders correctly
**Usage**:
```typescript
// src/pages/PongSlangDemo.tsx line 113
const result = await megaBezelLoader.loadPreset('/shaders/mega-bezel/passthrough.slangp');
```

**What works**:
- Shader compilation (Slang → GLSL conversion)
- Uniform binding (MVP, Source texture, size uniforms)
- Single-pass rendering
- Simple multi-pass rendering (tested with 2 independent passes)

**What doesn't work**:
- Feedback textures (previous frame as input)
- Preset texture loading (LUTs, placement images)
- Complex parameter dependencies
- 6+ pass pipelines with interdependencies

## Performance Notes

### Current Configuration
- Canvas: 800x800
- Target: 60 FPS
- Render calls per frame: 1 (passthrough) or 2 (derez test)

### Full Mega Bezel Performance Impact
- 6 shader passes
- Each pass may render to intermediate texture (800x800 RGBA)
- Memory: ~6 * 800 * 800 * 4 bytes = ~15MB render targets
- GPU: 6 full-screen shader executions per frame
- Estimated impact: 5-10ms per frame (target: <16ms for 60fps)

### Optimization Opportunities
1. Shader caching (compile once, reuse)
2. Texture pooling (reuse render targets)
3. Conditional pass execution (skip passes when parameters unchanged)
4. LOD system (reduce quality on low-end devices)

## File Reference

### Modified Files
- `src/shaders/MegaBezelPresetLoader.ts` - Added bypass modes, debugging
- `src/shaders/MultiPassRenderer.ts` - Added error handling, pixel validation
- `src/pages/PongSlangDemo.tsx` - Updated preset path for testing

### New Files
- `public/shaders/mega-bezel/passthrough.slangp` - Working test preset
- `public/shaders/mega-bezel/shaders/test-passthrough.slang` - Simple passthrough shader
- `public/shaders/mega-bezel/test-pass-0-only.slangp` - Single derez pass test
- `public/shaders/mega-bezel/test-pass-0-1.slangp` - Two-pass failure test
- `public/shaders/mega-bezel/working-simple.slangp` - Attempted 3-pass preset
- `public/shaders/mega-bezel/test-derez-fetch.slangp` - Two-pass without cache
- `public/shaders/mega-bezel/final-derez.slangp` - Final single pass

### Key Files for Future Work
- `src/shaders/SemanticMapper.ts` - Maps texture aliases to uniforms
- `src/shaders/UBOManager.ts` - Manages uniform buffer objects
- `src/shaders/ParameterManager.ts` - Manages shader parameters
- `public/shaders/mega-bezel/shaders/base/cache-info-potato-params.slang` - Problematic shader (line 42: requires InfoCachePassFeedback)

## Next Steps

1. **Immediate** (1-2 hours):
   - Implement basic feedback texture system
   - Test cache-info shader with feedback enabled

2. **Short-term** (4-6 hours):
   - Implement preset texture loading
   - Bind all required textures to uniforms
   - Test 3-4 pass presets

3. **Medium-term** (8-12 hours):
   - Complete 6-pass Mega Bezel pipeline
   - Implement parameter caching
   - Add performance optimizations

4. **Long-term** (1-2 days):
   - Bezel composition renderer integration
   - Reflection system
   - Full Mega Bezel feature parity

## Success Criteria

### Minimum Viable Product
- ✅ Basic shader pipeline functional
- ✅ Simple shaders render correctly
- ❌ 3+ pass presets work (blocked by feedback textures)
- ❌ Mega Bezel visual effects visible

### Full Feature Parity
- ❌ All 6 Mega Bezel passes execute
- ❌ Bezel graphics overlay
- ❌ Screen reflections
- ❌ CRT effects (scanlines, curvature)
- ❌ Parameter UI controls
- ❌ Performance: 60 FPS on mid-range GPU

## Conclusion

The shader system foundation is **working correctly**. The issue is not with shader compilation or the rendering pipeline, but with **missing texture dependencies** required by complex Mega Bezel shaders.

**Current state**: Basic demo functional, complex presets blocked
**Blocking issue**: Feedback textures + preset texture loading
**Estimated time to fix**: 4-6 hours of focused implementation
**Risk level**: Low (clear path forward, well-understood problem)
