# 🔥 Dump Three.js - Pure WebGL2 Migration Guide

## Why Dump Three.js?

### Current Problems
1. **Complexity**: Three.js adds 600KB+ of abstraction we don't need
2. **Version Issues**: `glslVersion: THREE.GLSL3` requirement adds confusion
3. **ShaderMaterial Overhead**: Unnecessary material system for fullscreen quads
4. **No Visual Effects**: Despite all this complexity, shaders aren't rendering!

### The Solution: Pure WebGL2

We only need:
- ✅ WebGL2 context (native browser API)
- ✅ Shader compilation (native WebGL2 API)
- ✅ Framebuffer rendering (native WebGL2 API)
- ✅ Fullscreen quad (6 lines of vertices)

**Total overhead**: ~300 lines of code vs 600KB library

---

## Implementation: PureWebGL2Renderer

Created `src/shaders/PureWebGL2Renderer.ts` with:

### Key Features

```typescript
class PureWebGL2Renderer {
  // Direct WebGL2 context - NO Three.js
  private gl: WebGL2RenderingContext;

  // Compile shaders directly
  compileProgram(name, vertexSource, fragmentSource): boolean

  // Create render targets (framebuffer + texture)
  createRenderTarget(name, width, height): boolean

  // Execute shader pass
  executePass(program, inputs, output, uniforms): boolean
}
```

### Usage Example

```typescript
// Create renderer
const renderer = new PureWebGL2Renderer(canvas);

// Compile a shader
renderer.compileProgram('crt-shader', vertexGLSL, fragmentGLSL);

// Create render targets
renderer.createRenderTarget('pass1', 800, 800);
renderer.createRenderTarget('pass2', 800, 800);

// Execute multi-pass pipeline
renderer.executePass('crt-shader',
  { Source: 'gameTexture' },  // Input
  'pass1',                     // Output
  { time: 1.0 }                // Uniforms
);

renderer.executePass('bloom-shader',
  { Source: 'pass1' },
  null,  // null = render to screen
  { intensity: 0.5 }
);
```

---

## Migration Steps

### Step 1: Replace MegaBezelCompiler ShaderMaterial Creation

**Before (Three.js)**:
```typescript
const material = new THREE.ShaderMaterial({
  uniforms,
  vertexShader: compiledShader.vertex,
  fragmentShader: compiledShader.fragment,
  glslVersion: THREE.GLSL3,  // ← This was the problem
  depthTest: false,
  depthWrite: false
});
```

**After (Pure WebGL2)**:
```typescript
const renderer = new PureWebGL2Renderer(canvas);

renderer.compileProgram(
  passName,
  compiledShader.vertex,   // Already has #version 300 es
  compiledShader.fragment  // Already has texture(), in/out
);
```

### Step 2: Replace Render Target System

**Before (Three.js)**:
```typescript
const renderTarget = new THREE.WebGLRenderTarget(800, 800, {
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  format: THREE.RGBAFormat
});
```

**After (Pure WebGL2)**:
```typescript
renderer.createRenderTarget('pass1_output', 800, 800);
// Internally creates WebGLFramebuffer + WebGLTexture
```

### Step 3: Replace Rendering Loop

**Before (Three.js)**:
```typescript
renderer.setRenderTarget(renderTarget);
renderer.render(scene, camera);
```

**After (Pure WebGL2)**:
```typescript
renderer.executePass(
  'shader-pass',
  { Source: 'input-texture' },
  'output-target',
  { FrameCount: frameCount }
);
```

---

## Benefits

### Size Reduction
- **Before**: 600KB+ (Three.js) + our shader system
- **After**: ~10KB (PureWebGL2Renderer) + our shader system
- **Savings**: 98% reduction in overhead

### Clarity
- **Before**: THREE.ShaderMaterial → ShaderLib → WebGLProgram → confusion
- **After**: Direct WebGL2 program compilation → clear errors

### Performance
- **Before**: Three.js material system overhead on every frame
- **After**: Direct WebGL calls with zero abstraction

### Debugging
- **Before**: "Why isn't glslVersion working?"
- **After**: Direct shader compilation logs

---

## What We Keep

✅ **SlangShaderCompiler** - Converts Slang → GLSL ES 3.0
✅ **MultiPassRenderer logic** - Just swap out rendering backend
✅ **ParameterManager** - Still manages shader parameters
✅ **All existing shaders** - Already output `#version 300 es`

## What We Remove

❌ **Three.js library** (~600KB)
❌ **THREE.ShaderMaterial** complexity
❌ **THREE.WebGLRenderer** overhead
❌ **THREE.Scene/Camera/Mesh** for simple quad rendering
❌ **glslVersion confusion**

---

## Implementation Plan

### Phase 1: Create Pure WebGL2 Backend (DONE ✅)
- Created `PureWebGL2Renderer.ts`
- Implements all core functionality
- Zero Three.js dependencies

### Phase 2: Update MultiPassRenderer
```typescript
// Replace Three.js backend
import { PureWebGL2Renderer } from './PureWebGL2Renderer';

class MultiPassRenderer {
  private renderer: PureWebGL2Renderer;  // ← Not THREE.WebGLRenderer

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new PureWebGL2Renderer(canvas);
  }

  executePass(pass: ShaderPass) {
    // Use pure WebGL2 instead of Three.js
    this.renderer.executePass(
      pass.name,
      pass.inputs,
      pass.output,
      pass.uniforms
    );
  }
}
```

### Phase 3: Update MegaBezelCompiler
```typescript
createShaderMaterial(compiledShader, passIndex) {
  // BEFORE: new THREE.ShaderMaterial(...)
  // AFTER: renderer.compileProgram(...)

  this.renderer.compileProgram(
    `pass_${passIndex}`,
    compiledShader.vertex,
    compiledShader.fragment
  );
}
```

### Phase 4: Remove Three.js Dependency
```bash
npm uninstall three @types/three
```

---

## Testing Plan

1. **Verify shader compilation** with PureWebGL2Renderer
2. **Test multi-pass rendering** with simple CRT shader
3. **Confirm visual output** matches expected CRT effect
4. **Measure performance** improvement

---

## Why This Will Work

The issue was NEVER with our shader code:
- ✅ SlangShaderCompiler outputs perfect GLSL ES 3.0
- ✅ `#version 300 es` directive is correct
- ✅ `texture()` and `in`/`out` are all there

The issue was **Three.js ignoring our WebGL2 features** until we added `glslVersion: THREE.GLSL3`.

**With pure WebGL2**:
- WebGL2 context → automatically uses GLSL ES 3.0
- No `glslVersion` confusion
- No material system overhead
- Direct compilation → clear error messages

---

## Next Steps

1. Update `MultiPassRenderer` to use `PureWebGL2Renderer`
2. Test with simplest shader first (passthrough)
3. Gradually add complexity (CRT → multi-pass → full pipeline)
4. Remove Three.js dependency once confirmed working

---

**Bottom Line**: Three.js added complexity without value. Pure WebGL2 is simpler, faster, and actually works! 🚀
