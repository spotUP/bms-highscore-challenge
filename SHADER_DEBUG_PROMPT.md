# Mega Bezel Shader Pipeline Debugging Prompt

## Current Status
The Mega Bezel shader system compiles without errors, but the output shows:
- Black playfield where the game should be visible
- Grey border where reflections should appear
- No visible game content passing through the shader pipeline

## CRITICAL ROOT CAUSE IDENTIFIED ⚠️

**ALL shader passes are failing to create WebGL programs** because of **unsigned integer uniforms**:

```glsl
uniform uint FrameCount;  // ❌ NOT SUPPORTED in Three.js WebGL 1
```

Three.js with WebGL 1 does NOT support `uint` uniforms. They must be `float`:

```glsl
uniform float FrameCount;  // ✅ CORRECT
```

This affects multiple shaders:
- `hsm-fetch-drez-output.slang` - line contains `uniform uint FrameCount`
- `fxaa.slang` - line contains `uniform uint FrameCount`
- And likely others

## Critical Issues Identified

### 1. WebGL Shader Program Invalid - ROOT CAUSE FOUND
**Console Error**: `❌ Pass hsm-drez-g-sharp_resampler.slang: No WebGL program created`

**Root Cause**: Unsigned integer uniforms in GLSL code. Three.js with WebGL 1 does not support `uint` uniform types.

All 9 shader passes are failing because Three.js refuses to compile shaders with `uniform uint` declarations.

### 2. MultiPassRenderer Returns Null Texture
The `MultiPassRenderer.getRenderTarget()` returns `null`, meaning:
- No render target is being properly captured from the shader passes
- The `lastRenderTarget` tracking is failing
- The texture flow through the pipeline is broken

### 3. Input Texture Not Being Propagated
The game texture (from `gameRenderTarget`) is created correctly at 800x800 but:
- The placeholder texture (16x16 transparent) is never replaced
- The input texture is not properly flowing through the shader passes
- Each pass should output to a render target, but they're not

## Root Causes

### A. Shader Material Compilation Failure
The shader materials are created but the WebGL programs are invalid. This suggests:
1. **Vertex/Fragment shader mismatch**: The vertex and fragment shaders may have incompatible varying declarations
2. **Missing uniforms/attributes**: Required uniforms or attributes aren't being properly declared
3. **GLSL syntax errors**: The converted GLSL code has syntax issues not caught during string conversion

### B. Render Target Chain Breaking
The multi-pass pipeline requires each pass (except the last) to render to a target:
1. Render targets are created (`createRenderTarget` at line 405)
2. But the `executePass` method fails due to invalid shader programs
3. This breaks the texture chain, leaving `lastRenderTarget` as null

### C. Uniform Binding Issues
The unmapped parameters warning indicates:
1. Shaders declare uniforms that aren't in the parameter list
2. Semantic mapping is failing for some parameters
3. Texture uniforms (`Source`, `Original`) may not be properly bound

## IMMEDIATE FIX REQUIRED

### Convert all `uniform uint` to `uniform float` in SlangShaderCompiler

In `SlangShaderCompiler.ts`, add a post-processing step to replace unsigned integer uniforms:

```typescript
// After GLSL conversion, before returning the shader code
private fixWebGLIncompatibilities(glslCode: string): string {
  // Replace unsigned integer uniforms with float uniforms
  // WebGL 1 (and Three.js) doesn't support uint uniforms
  let fixed = glslCode;

  // Fix uniform declarations
  fixed = fixed.replace(/uniform\s+uint\s+/g, 'uniform float ');

  // Fix uint variable declarations (if any)
  fixed = fixed.replace(/\buint\s+(\w+)\s*=/g, 'float $1 =');

  // Fix uint casts to float casts
  fixed = fixed.replace(/uint\(/g, 'float(');

  return fixed;
}
```

This should be called on both vertex and fragment shader code before creating the ShaderMaterial.

## Fix Requirements

### 1. Debug Shader Compilation (COMPLETED ✅)
```javascript
// In SlangShaderCompiler.ts, add detailed error logging:
private compileShaderProgram(vertexSource: string, fragmentSource: string): void {
  const gl = this.renderer.getContext();

  // Compile vertex shader
  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, vertexSource);
  gl.compileShader(vertexShader);

  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(vertexShader);
    console.error('Vertex shader compilation failed:', error);
    console.error('Vertex source:', vertexSource);
    throw new Error(`Vertex shader compilation failed: ${error}`);
  }

  // Similar for fragment shader...
  // Then link program and check link status
}
```

### 2. Fix Texture Flow
```javascript
// In MultiPassRenderer.ts executePass():
private executePass(pass: ShaderPass, context: RenderContext): PassExecutionResult {
  // Ensure input texture is properly bound
  if (!pass.uniforms['Source']?.value) {
    console.error(`Pass ${pass.name} missing Source texture`);
    pass.uniforms['Source'].value = this.inputTexture || this.placeholderTexture;
  }

  // Validate shader program before use
  const material = pass.material as THREE.ShaderMaterial;
  if (!material.program) {
    console.error(`Pass ${pass.name} has no compiled program`);
    return null; // Skip this pass
  }

  // Continue with rendering...
}
```

### 3. Track Render Targets Properly
```javascript
// In MultiPassRenderer.ts renderPipeline():
renderPipeline(context: RenderContext): void {
  // Store the input texture
  this.inputTexture = context.inputTexture;

  // Initialize with a proper first render target
  let currentRenderTarget = new THREE.WebGLRenderTarget(800, 600);
  this.renderer.setRenderTarget(currentRenderTarget);
  this.renderer.clear();

  // Render input to first target
  const copyMaterial = new THREE.MeshBasicMaterial({ map: context.inputTexture });
  this.quad.material = copyMaterial;
  this.renderer.render(this.scene, this.camera);

  // Now currentRenderTarget.texture has the input
  let currentTexture = currentRenderTarget.texture;

  // Process through shader passes...
  for (const pass of this.preset.passes) {
    // Use currentTexture as input
    pass.uniforms['Source'].value = currentTexture;

    // Render to next target or screen
    const nextTarget = pass.renderTarget || null;
    this.renderer.setRenderTarget(nextTarget);

    // ... render pass ...

    if (nextTarget) {
      currentTexture = nextTarget.texture;
      this.lastRenderTarget = nextTarget; // Track it
    }
  }
}
```

### 4. Validate Shader Syntax
The key shader files that need validation:
- `/shaders/mega-bezel/shaders/guest/extras/hsm-drez-g-sharp_resampler.slang`
- `/shaders/mega-bezel/shaders/hyllian/crt-super-xbr/hsm-crt-super-xbr-pass1.slang`
- `/shaders/mega-bezel/shaders/base/cache-info-potato-params.slang`

Check for:
1. **Varying mismatches**: Ensure varyings declared in vertex shader match fragment shader
2. **Uniform type mismatches**: Ensure uniform types match between declaration and usage
3. **Texture sampling**: Ensure texture2D() calls use proper samplers
4. **Built-in variables**: Ensure gl_Position, gl_FragColor are properly set

### 5. Simplified Test Pipeline
Create a minimal test to isolate the issue:
```javascript
// Test with single passthrough shader first
const testShader = {
  vertex: `
    attribute vec2 position;
    varying vec2 vUv;
    void main() {
      vUv = position * 0.5 + 0.5;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `,
  fragment: `
    uniform sampler2D Source;
    varying vec2 vUv;
    void main() {
      gl_FragColor = texture2D(Source, vUv);
    }
  `
};
```

## Action Items

1. **Add WebGL compilation error logging** to see exact shader compilation errors
2. **Create fallback render path** that copies input to output when shader fails
3. **Validate uniform bindings** before each pass execution
4. **Track texture flow** with detailed logging at each step
5. **Test with simplified shaders** to isolate complex shader issues
6. **Fix varying/uniform mismatches** in converted GLSL code
7. **Ensure render targets are created** with proper dimensions
8. **Implement proper error recovery** so one failed pass doesn't break the pipeline

## Testing Approach

1. Start with BYPASS_MULTIPASS = true to verify input texture works
2. Test single pass with passthrough shader
3. Add passes one by one to find which breaks
4. Use WebGL debugging tools to inspect shader compilation
5. Log all uniform values and texture bindings
6. Verify render target creation and usage
7. Check that viewport/scissor settings are correct

The core issue is that the shader programs aren't compiling properly in WebGL, which breaks the entire render pipeline. Focus on getting clean shader compilation first, then fix the texture flow.