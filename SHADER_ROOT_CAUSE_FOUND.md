# ✅ Mega Bezel Shader Root Cause Identified

## Problem
Black playfield + grey reflections border = No game rendering through shader pipeline

## Root Cause
**ALL 9 shader passes fail to compile** because they contain:

```glsl
uniform uint FrameCount;
```

Three.js with WebGL 1 **does NOT support unsigned integer uniforms**.

## Evidence
Console shows for EVERY shader pass:
```
[error] ❌ Pass hsm-fetch-drez-output.slang: No WebGL program created
[error] Vertex shader start:
uniform uint FrameCount;
```

## The Fix
Replace `uniform uint` with `uniform float` in all compiled GLSL code.

### Implementation
Add post-processing to `SlangShaderCompiler.ts`:

```typescript
private fixWebGLIncompatibilities(glslCode: string): string {
  let fixed = glslCode;

  // WebGL 1 doesn't support uint uniforms
  fixed = fixed.replace(/uniform\s+uint\s+/g, 'uniform float ');
  fixed = fixed.replace(/\buint\s+(\w+)\s*=/g, 'float $1 =');
  fixed = fixed.replace(/uint\(/g, 'float(');

  return fixed;
}
```

Call this on vertex and fragment shaders before creating `THREE.ShaderMaterial`.

## Affected Files
Based on console output, these shaders all have `uniform uint FrameCount`:
1. `hsm-drez-g-sharp_resampler.slang` - 41,569 char vertex shader
2. `cache-info-potato-params.slang` - 138,034 char vertex shader
3. `hsm-fetch-drez-output.slang` - 6,608 char vertex shader
4. `fxaa.slang` - 11,709 char vertex shader
5. `hsm-grade.slang` - 140,078 char vertex shader
6. `hsm-custom-fast-sharpen.slang` - 6,739 char vertex shader
7. `linearize.slang` - 48,510 char vertex shader
8. `hsm-screen-scale-g-sharp_resampler-potato.slang` - 138,659 char vertex shader
9. `post-crt-prep-potato.slang` - 7,652 char vertex shader

## Why This Breaks Everything
1. Three.js creates ShaderMaterial with `uniform uint`
2. WebGL 1 refuses to compile the shader
3. No WebGL program is created (`__webglProgram` is null)
4. MultiPassRenderer detects no program and returns early
5. No render target is populated
6. No texture flows through pipeline
7. Result: Black screen

## Next Steps
1. Implement `fixWebGLIncompatibilities()` method
2. Call it in shader compilation pipeline (likely in `SlangShaderCompiler.convertToGLSL()`)
3. Test with one shader first
4. Verify WebGL program is created
5. Verify texture flows through pipeline

## Expected Result After Fix
- ✅ All 9 passes compile successfully
- ✅ WebGL programs are created
- ✅ Render targets are populated
- ✅ Texture flows from input → pass 1 → pass 2 → ... → output
- ✅ Game appears on screen with CRT effects
- ✅ Reflections render in bezel area