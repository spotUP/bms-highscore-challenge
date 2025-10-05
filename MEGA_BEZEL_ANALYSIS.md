# Mega Bezel Shader - Phase 1 Analysis Report

**Date:** 2025-10-04
**Project:** Port Mega Bezel from RetroArch Slang to standalone Three.js/WebGL

---

## Executive Summary

The Mega Bezel shader is a **highly complex, multi-pass rendering system** designed for RetroArch that creates realistic CRT monitor effects with bezel frames and reflections. A full port to standalone Three.js/WebGL represents a substantial engineering effort.

### Key Findings

- **Complexity**: Production presets use **21+ shader passes**
- **Performance Tiers**: 5 preset levels from SMOOTH-ADV (highest quality) to POTATO (lowest)
- **Dependencies**: Requires textures, LUTs, and complex parameter management
- **Estimated Effort**: 2-4 weeks of development for basic implementation

---

## 1. Repository Structure Analysis

### Mega Bezel Repository
- **Main Repo**: https://github.com/HyperspaceMadness/Mega_Bezel
- **License**: Check repository for specific terms

### Directory Structure
```
Mega_Bezel/
├── Presets/
│   ├── Base_CRT_Presets/
│   ├── Base_CRT_Presets_DREZ/
│   ├── Community_CRT_Variations/
│   ├── Variations/
│   └── Experimental/
├── resource/              # Textures, LUTs, bezel images
├── shaders/               # .slang shader source files
└── tools/
    └── Mega_Preset_Assembler/
```

### Performance Tiers
1. **MBZ__0__SMOOTH-ADV** - Maximum visual quality, highest GPU load
2. **MBZ__1__ADV** - Advanced features, high performance requirements
3. **MBZ__3__STD** - Standard quality, balanced performance
4. **MBZ__4__STD-NO-REFLECT** - Standard without reflections
5. **MBZ__5__POTATO** - Minimal features, maximum compatibility

---

## 2. Slang Shader Format (.slangp Preset Structure)

### File Format

`.slangp` files are text-based configuration files that define multi-pass shader pipelines.

### Example: Simple Single-Pass Preset
```ini
shaders = 1

shader0 = shaders/crt-lottes.slang
filter_linear0 = false
scale_type0 = viewport
```

### Example: Complex 9-Pass Preset (ScaleFX + Anti-Aliasing)
```ini
shaders = 9

shader0 = ../../stock.slang
filter_linear0 = false
scale_type0 = source
scale0 = 1.0

shader1 = shaders/scalefx-pass0.slang
filter_linear1 = false
scale_type1 = source
scale1 = 1.0

# ... passes 2-4 (scalefx processing)

shader5 = shaders/scalefx-pass4.slang
filter_linear5 = false
scale_type5 = source
scale5 = 3.0  # Upscale to 3x

# ... passes 6-7 (reverse anti-aliasing)

shader8 = ../../interpolation/shaders/bicubic.slang
filter_linear8 = false
scale_type8 = viewport
```

### Per-Pass Parameters

Each pass (`shader#`) can have:
- **`filter_linear#`**: Hardware filtering (true/false)
- **`scale_type#`**: Scaling mode (source, viewport, absolute)
- **`scale#`** or **`scale_x#`/`scale_y#`**: Scale factor
- **`alias#`**: Name for referencing in other passes
- **`srgb_framebuffer#`**: Enable sRGB framebuffer
- **`float_framebuffer#`**: Use floating-point precision
- **`mipmap_input#`**: Enable mipmapping
- **`texture_wrap_mode#`**: Clamp or repeat

### Global Configuration

- **`textures`**: External texture (LUT) files
- **`parameters`**: User-adjustable values
- **`#reference`**: Import another preset as base

---

## 3. Mega Bezel Pipeline Analysis

### Example: Beetle PSX HW Preset (21 Passes)

**Pass Breakdown:**

| Pass | Shader | Purpose |
|------|--------|---------|
| 0 | HSM Stock + Mega Screen Scale | Input preprocessing + bezel setup |
| 1-2 | Stock | Pass-through stages |
| 3 | Guest LUT | Color look-up table mapping |
| 4 | Guest Color Profiles | Color space adjustment |
| 5 | Guest D65-D50 White Point | White balance correction |
| 6 | Guest Afterglow | Phosphor persistence effect |
| 7 | Stock | Pass-through |
| 8 | Linearize | Gamma correction |
| 9 | Horizontal Blur | First blur pass |
| 10 | Vertical Blur | Second blur pass (glow) |
| 11 | Linearize Scanlines | Scanline gamma prep |
| 12 | CRT Guest Dr. Venom Scaling | Core CRT simulation |
| 13 | Curvature Mapping | Screen curvature distortion |
| 14 | Linearize CRT Pass | Post-CRT gamma correction |
| 15 | Horizontal Blur Outside Screen | Bezel area blur (H) |
| 16 | Vertical Blur Outside Screen | Bezel area blur (V) |
| 17-18 | 9x9 Blur | Reflection blur processing |
| 19 | Mega Bezel Reflection | Final bezel + reflection composite |
| 20 | Final Output | Composite to screen |

### Key Rendering Stages

1. **Input Preprocessing** (Passes 0-2)
   - Screen area setup
   - Bezel margin calculation

2. **Color Correction** (Passes 3-6)
   - LUT-based color grading
   - White point adjustment
   - Phosphor afterglow

3. **Glow/Bloom Generation** (Passes 8-10)
   - Linearize for accurate blending
   - Separable gaussian blur

4. **CRT Simulation** (Passes 11-14)
   - Scanline rendering
   - Phosphor mask patterns
   - Screen curvature distortion

5. **Bezel Processing** (Passes 15-18)
   - Blur outside screen area
   - Reflection texture generation

6. **Final Composite** (Passes 19-20)
   - Combine CRT output + bezel + reflections
   - Output to display

### Required Assets

**Textures:**
- Bezel frame images (PNG/JPEG)
- Background images
- Tube glass overlay
- Reflection zone masks

**LUTs (Look-Up Tables):**
- Color grading 3D LUTs
- Typically 16x16x16 or 32x32x32 cubes

---

## 4. Slang Shader Language (.slang files)

### Language Specification

- **Base**: Vulkan GLSL
- **Version**: Uses `#version 450` or similar
- **Portability**: Designed to work across GL, Vulkan, D3D, Metal

### Pragma Directives

```glsl
#version 450

#pragma stage vertex
#pragma name VertexShaderName

#pragma stage fragment
#pragma name FragmentShaderName

#pragma format R16G16B16A16_SFLOAT

#pragma parameter PARAM_NAME "Display Name" DEFAULT MIN MAX STEP
#pragma parameter hardScan "Scanline Hardness" -8.0 -20.0 0.0 1.0
```

### Built-in Uniforms

**Standard Uniforms:**
```glsl
layout(std140, set = 0, binding = 0) uniform UBO
{
   mat4 MVP;            // Model-View-Projection matrix
   vec4 OutputSize;     // xy = size, zw = 1/size
   vec4 OriginalSize;   // Input texture size
   vec4 SourceSize;     // Previous pass size
   uint FrameCount;     // Frame counter
};
```

**Texture Bindings:**
```glsl
layout(set = 0, binding = 1) uniform sampler2D Source;      // Previous pass
layout(set = 0, binding = 2) uniform sampler2D Original;    // Original input
layout(set = 0, binding = 3) uniform sampler2D OriginalHistory1; // 1 frame ago
```

**Push Constants (Parameters):**
```glsl
layout(push_constant) uniform Push
{
   float PARAM_NAME;
   float hardScan;
   float maskDark;
   // ... user parameters
} params;
```

### Vertex Shader Example

```glsl
#pragma stage vertex
layout(location = 0) in vec4 Position;
layout(location = 1) in vec2 TexCoord;
layout(location = 0) out vec2 vTexCoord;

void main()
{
   gl_Position = MVP * Position;
   vTexCoord = TexCoord;
}
```

### Fragment Shader Example

```glsl
#pragma stage fragment
layout(location = 0) in vec2 vTexCoord;
layout(location = 0) out vec4 FragColor;

void main()
{
   vec3 color = texture(Source, vTexCoord).rgb;

   // Apply CRT effect
   float scanline = sin(vTexCoord.y * SourceSize.y * 3.14159 * 2.0);
   color *= mix(1.0, scanline * 0.5 + 0.5, params.scanlineIntensity);

   FragColor = vec4(color, 1.0);
}
```

---

## 5. Slang → WebGL GLSL Translation Requirements

### Syntax Differences

| Slang Feature | WebGL Equivalent | Notes |
|---------------|------------------|-------|
| `layout(set=0, binding=1)` | `uniform sampler2D` | Manual binding in JS |
| `layout(push_constant)` | `uniform` block | Separate uniforms |
| `layout(std140)` UBO | `uniform` block | May need manual packing |
| `#pragma parameter` | Custom parser | Extract to JS object |
| `#pragma stage` | Separate files | Split vertex/fragment |
| `texture(sampler, uv)` | `texture2D(sampler, uv)` | WebGL 1.0 compatibility |
| `mix()` | `mix()` | Same |
| `fract()` | `fract()` | Same |

### Uniform Mapping

**Slang Built-in → WebGL Custom:**

```javascript
// Slang: MVP matrix
// WebGL:
uniform mat4 MVP;

// Slang: OutputSize (vec4)
// WebGL:
uniform vec2 OutputSize;
uniform vec2 OutputSizeInv; // 1.0 / OutputSize

// Slang: FrameCount
// WebGL:
uniform int FrameCount;

// Slang: push_constant params
// WebGL:
uniform float hardScan;
uniform float maskDark;
// ... individual parameters
```

### Texture Binding

```javascript
// Slang shader references:
// - Source (previous pass)
// - Original (input)
// - OriginalHistory# (frame history)
// - PassOutput# (specific pass)

// Three.js implementation:
const material = new THREE.ShaderMaterial({
  uniforms: {
    Source: { value: previousPassTexture },
    Original: { value: inputTexture },
    OriginalHistory1: { value: historyBuffer[1] },
    // ...
  }
});
```

---

## 6. Key Technical Challenges

### 6.1 Multi-Pass Rendering

**Challenge**: Managing 21+ render passes efficiently.

**Solution Approach**:
```javascript
class MultiPassRenderer {
  constructor(passes) {
    this.passes = passes.map(passConfig => ({
      material: createShaderMaterial(passConfig),
      renderTarget: new THREE.WebGLRenderTarget(...),
      scale: passConfig.scale,
      filterLinear: passConfig.filter_linear
    }));
  }

  render(renderer, inputTexture, outputTarget) {
    let currentInput = inputTexture;

    for (let i = 0; i < this.passes.length; i++) {
      const pass = this.passes[i];
      pass.material.uniforms.Source.value = currentInput;

      const target = (i === this.passes.length - 1)
        ? outputTarget
        : pass.renderTarget;

      renderer.setRenderTarget(target);
      renderer.render(this.fullscreenQuad.scene, this.camera);

      currentInput = target.texture;
    }
  }
}
```

### 6.2 Shader Compilation

**Challenge**: Converting Slang syntax to GLSL ES.

**Solution Approach**:
```javascript
class SlangShaderCompiler {
  compile(slangSource) {
    const pragmas = this.extractPragmas(slangSource);
    const vertexShader = this.extractStage(slangSource, 'vertex');
    const fragmentShader = this.extractStage(slangSource, 'fragment');

    return {
      vertex: this.convertToGLSL(vertexShader, 'vertex'),
      fragment: this.convertToGLSL(fragmentShader, 'fragment'),
      parameters: pragmas.parameters,
      format: pragmas.format
    };
  }

  convertToGLSL(source, stage) {
    return source
      .replace(/layout\(.*?\)\s+/g, '') // Remove layout qualifiers
      .replace(/texture\(/g, 'texture2D(') // WebGL 1.0 compatibility
      .replace(/#version 450/, '#version 300 es') // WebGL 2.0
      // ... more replacements
  }
}
```

### 6.3 Parameter Management

**Challenge**: 100+ user parameters in complex presets.

**Solution Approach**:
```javascript
class ShaderParameterManager {
  constructor(presetData) {
    this.parameters = this.parseParameters(presetData);
  }

  parseParameters(slangpContent) {
    // Parse #pragma parameter lines
    const params = {};
    const regex = /#pragma parameter (\w+) "(.*?)" ([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+)/g;

    let match;
    while (match = regex.exec(slangpContent)) {
      params[match[1]] = {
        displayName: match[2],
        default: parseFloat(match[3]),
        min: parseFloat(match[4]),
        max: parseFloat(match[5]),
        step: parseFloat(match[6]),
        value: parseFloat(match[3]) // Initialize to default
      };
    }

    return params;
  }

  updateUniforms(material) {
    for (const [name, param] of Object.entries(this.parameters)) {
      if (material.uniforms[name]) {
        material.uniforms[name].value = param.value;
      }
    }
  }
}
```

### 6.4 Frame History

**Challenge**: Accessing previous frame textures.

**Solution Approach**:
```javascript
class FrameHistoryBuffer {
  constructor(width, height, depth = 4) {
    this.buffers = Array(depth).fill(null).map(() =>
      new THREE.WebGLRenderTarget(width, height)
    );
    this.currentIndex = 0;
  }

  update(renderer, currentFrame) {
    this.currentIndex = (this.currentIndex + 1) % this.buffers.length;

    // Copy current frame to history buffer
    renderer.setRenderTarget(this.buffers[this.currentIndex]);
    // ... render currentFrame
  }

  getHistory(frameOffset) {
    // frameOffset = 1 means "1 frame ago"
    const index = (this.currentIndex - frameOffset + this.buffers.length)
                  % this.buffers.length;
    return this.buffers[index].texture;
  }
}
```

### 6.5 Texture/LUT Loading

**Challenge**: Loading and managing external textures.

**Solution Approach**:
```javascript
class TextureLoader {
  async loadPresetTextures(presetData) {
    const texturePromises = presetData.textures.map(async (texDef) => {
      const loader = new THREE.TextureLoader();
      const texture = await loader.loadAsync(texDef.path);

      texture.wrapS = texDef.wrap === 'repeat'
        ? THREE.RepeatWrapping
        : THREE.ClampToEdgeWrapping;
      texture.wrapT = texDef.wrap === 'repeat'
        ? THREE.RepeatWrapping
        : THREE.ClampToEdgeWrapping;
      texture.minFilter = texDef.linear
        ? THREE.LinearFilter
        : THREE.NearestFilter;

      return { name: texDef.name, texture };
    });

    return Object.fromEntries(
      (await Promise.all(texturePromises))
        .map(({ name, texture }) => [name, texture])
    );
  }
}
```

---

## 7. Recommended Implementation Phases

### Phase 1: Foundation (Week 1)
- ✅ Analysis (COMPLETE - this document)
- Build `.slangp` preset parser
- Build basic Slang-to-GLSL compiler
- Create multi-pass render pipeline architecture

### Phase 2: Core Features (Week 1-2)
- Implement parameter management system
- Implement texture/LUT loading
- Port basic CRT shaders (scanlines, curvature)
- Build frame history buffer system

### Phase 3: Advanced Features (Week 2-3)
- Port color correction shaders
- Port blur/glow shaders
- Implement bezel rendering
- Implement reflection system

### Phase 4: Integration & Optimization (Week 3-4)
- Performance profiling and optimization
- Browser compatibility testing
- API design and documentation
- Example presets and demos

---

## 8. Recommended Starting Point

### Minimal Viable Implementation

Start with a **simplified 5-pass pipeline** based on the POTATO preset:

1. **Pass 0**: Input scaling
2. **Pass 1**: Basic CRT effect (scanlines + curvature)
3. **Pass 2**: Bezel area detection
4. **Pass 3**: Reflection generation
5. **Pass 4**: Final composite

This provides:
- Core CRT visual effect
- Bezel border
- Basic reflections
- ~70% of visual quality with ~20% of complexity

### Technology Stack

```javascript
// Core dependencies
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';

// Custom modules to build
import { SlangPresetParser } from './SlangPresetParser';
import { SlangShaderCompiler } from './SlangShaderCompiler';
import { MultiPassRenderer } from './MultiPassRenderer';
import { ParameterManager } from './ParameterManager';
```

---

## 9. Performance Considerations

### GPU Requirements

| Preset Tier | Shader Passes | Estimated GPU Load |
|-------------|---------------|---------------------|
| SMOOTH-ADV | 21+ | High-end desktop GPU |
| ADV | 18-20 | Mid-range desktop GPU |
| STD | 12-15 | Integrated graphics |
| STD-NO-REFLECT | 8-10 | Entry-level GPU |
| POTATO | 5-7 | Mobile/low-end |

### Optimization Strategies

1. **Render Target Resolution**
   - Use lower resolution for blur passes
   - Scale up only for final composite

2. **Texture Format**
   - Use 8-bit RGBA for most passes
   - 16-bit float only where needed (bloom)

3. **Shader Complexity**
   - Provide quality settings (low/medium/high)
   - Disable expensive features on mobile

4. **Frame Rate Targeting**
   - 60 FPS on desktop
   - 30 FPS fallback for complex presets on mobile

---

## 10. Browser Compatibility

### WebGL Requirements

- **Minimum**: WebGL 1.0
- **Recommended**: WebGL 2.0 (for textureLod, integer uniforms)

### Feature Detection

```javascript
function detectWebGLCapabilities() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');

  return {
    webgl2: !!canvas.getContext('webgl2'),
    floatTextures: gl.getExtension('OES_texture_float'),
    halfFloatTextures: gl.getExtension('OES_texture_half_float'),
    derivatives: gl.getExtension('OES_standard_derivatives'),
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxTextureUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)
  };
}
```

---

## 11. Next Steps

### Immediate Actions (Phase 1)

1. **Create Slang Preset Parser** (`/src/shaders/SlangPresetParser.ts`)
   - Parse `.slangp` files
   - Extract shader pass configuration
   - Extract parameters and textures

2. **Create Slang Shader Compiler** (`/src/shaders/SlangShaderCompiler.ts`)
   - Convert Slang GLSL to WebGL GLSL
   - Handle pragma directives
   - Generate uniform mappings

3. **Build Multi-Pass Infrastructure** (`/src/shaders/MultiPassRenderer.ts`)
   - Render target management
   - Pass execution pipeline
   - Texture binding logic

4. **Test with Simple Preset**
   - Start with `crt-lottes.slangp` (1 pass)
   - Verify shader compilation
   - Verify parameter extraction
   - Verify rendering output

### Success Criteria

✅ Can parse and load a `.slangp` preset file
✅ Can compile a `.slang` shader to WebGL GLSL
✅ Can render a single-pass CRT effect
✅ Can adjust shader parameters at runtime
✅ Renders at 60 FPS on target hardware

---

## 12. Resources

### Documentation
- [Slang Shaders Repo](https://github.com/libretro/slang-shaders)
- [Libretro Docs - Slang Shaders](https://docs.libretro.com/development/shader/slang-shaders/)
- [Three.js Post-Processing](https://threejs.org/docs/#manual/en/introduction/How-to-use-post-processing)

### Reference Implementations
- [RetroArch Web Player](https://github.com/libretro/RetroArch) (Check web implementation)
- [Existing WebGL CRT Shaders](https://github.com/search?q=crt+shader+webgl)

### Tools
- [Shader Toy](https://www.shadertoy.com/) - Test GLSL fragments
- [GLSL Sandbox](http://glslsandbox.com/) - Share shader experiments

---

## Conclusion

The Mega Bezel shader represents a **sophisticated multi-pass rendering system** that will require substantial effort to port. The recommended approach is to:

1. Build core infrastructure incrementally
2. Start with simplified presets
3. Validate each component before moving forward
4. Focus on the POTATO preset as MVP (5-7 passes)
5. Gradually add complexity (STD → ADV → SMOOTH-ADV)

**Estimated Timeline**: 2-4 weeks for basic implementation with POTATO-level quality.

---

**Analysis Complete** ✅
