# Slang Shader System for Three.js

Port of RetroArch's Slang shader system to standalone Three.js/WebGL.

## Overview

This system allows loading and rendering RetroArch `.slangp` preset files in web browsers using Three.js, without requiring RetroArch itself.

## Components

### ✅ SlangPresetParser.ts (COMPLETE)

Parses `.slangp` preset files into structured TypeScript objects.

**Features:**
- Parse multi-pass shader configurations
- Extract texture (LUT) definitions
- Extract parameter overrides
- Handle `#reference` directives
- Serialize presets back to `.slangp` format
- Resolve relative file paths

**Usage:**
```typescript
import { SlangPresetParser } from './SlangPresetParser';

// Parse from string
const preset = SlangPresetParser.parse(slangpContent, basePath);

// Load from URL
const preset = await SlangPresetParser.loadFromURL('path/to/preset.slangp');

// Inspect passes
preset.passes.forEach((pass, i) => {
  console.log(`Pass ${i}: ${pass.shader} (scale: ${pass.scale})`);
});

// Inspect textures
preset.textures.forEach(tex => {
  console.log(`Texture: ${tex.name} → ${tex.path}`);
});
```

### ✅ SlangShaderCompiler.ts (COMPLETE)

Converts Slang GLSL shaders to WebGL-compatible GLSL.

**Features:**
- Parse `#pragma` directives (parameter, stage, name, format)
- Extract vertex and fragment shader stages
- Convert Slang uniforms to WebGL uniforms
- Handle texture bindings (layout → uniform)
- Extract shader parameters with metadata
- Support WebGL 1.0 and WebGL 2.0 output
- Convert Vulkan GLSL to WebGL GLSL
- Generate default vertex shader if missing

**Usage:**
```typescript
import { SlangShaderCompiler } from './SlangShaderCompiler';

// Compile shader for WebGL 2.0
const compiled = SlangShaderCompiler.compile(slangSource, true);

// Load and compile from URL
const compiled = await SlangShaderCompiler.loadFromURL('shader.slang');

// Access compiled output
console.log('Vertex:', compiled.vertex);
console.log('Fragment:', compiled.fragment);
console.log('Parameters:', compiled.parameters);

// Create Three.js material
const material = new THREE.ShaderMaterial({
  vertexShader: compiled.vertex,
  fragmentShader: compiled.fragment,
  uniforms: {
    Source: { value: inputTexture },
    // ... add parameter uniforms from compiled.parameters
  }
});
```

### ✅ MultiPassRenderer.ts (COMPLETE)

Manages the multi-pass rendering pipeline with Three.js.

**Features:**
- Create render target chain for multiple passes
- Execute shader passes in sequence with proper texture bindings
- Handle different scale modes (source, viewport, absolute)
- Manage frame history buffers for temporal effects
- Support different framebuffer formats (float, sRGB)
- Runtime parameter adjustment
- Pass aliasing and lookup
- Automatic uniform binding (Source, Original, OriginalHistory#, etc.)
- Responsive resizing

**Usage:**
```typescript
import { MultiPassRenderer } from './MultiPassRenderer';
import { SlangPresetParser } from './SlangPresetParser';

// Parse preset
const preset = SlangPresetParser.parse(presetContent);

// Create renderer
const multipass = new MultiPassRenderer(renderer, preset, {
  width: 800,
  height: 800,
  webgl2: true,
  historyDepth: 4
});

// Load shaders
await multipass.loadShaders(async (path) => {
  const response = await fetch(path);
  return await response.text();
});

// Set input texture
multipass.setInputTexture(gameTexture);

// Render loop
function animate() {
  multipass.render(); // Outputs to screen
  requestAnimationFrame(animate);
}

// Adjust parameters
multipass.setParameter('scanlineIntensity', 0.5);

// Get parameter
const value = multipass.getParameter('bloomAmount');

// Resize
multipass.resize(1920, 1080);

// Cleanup
multipass.dispose();
```

### ✅ ParameterManager.ts (COMPLETE)

Runtime shader parameter control and UI integration helper.

**Features:**
- Parameter metadata management (min, max, step, default, display name)
- Value validation and clamping
- Change callbacks for UI updates
- Parameter presets (save/load with JSON export/import)
- Parameter interpolation/animation with easing functions
- Parameter grouping for UI organization
- Parameter visibility control
- Integration with MultiPassRenderer
- UI control object generation

**Usage:**
```typescript
import { ParameterManager, Easing } from './ParameterManager';

// Create from shader parameters
const manager = new ParameterManager(shaderParameters);

// Link to renderer
manager.linkRenderer(multipassRenderer);

// Set/get values
manager.setValue('scanlineIntensity', 0.5);
const value = manager.getValue('bloomAmount');

// Change callbacks
manager.onChange('brightness', (event) => {
  console.log(`Changed from ${event.previousValue} to ${event.value}`);
  updateUISlider(event.value);
});

// Presets
const preset = manager.savePreset('My Settings');
await manager.loadPreset(preset, true); // Animated

// Animation
await manager.interpolate('brightness', 2.0, 1000, Easing.easeInOutQuad);

// Grouping
manager.setGroup('brightness', 'Color');
manager.setGroup('contrast', 'Color');
const colorParams = manager.getParametersByGroup('Color');

// UI integration
const control = manager.createControl('brightness');
// → { label, value, min, max, step, onChange, reset }

// Export/import
const json = manager.exportJSON();
localStorage.setItem('params', json);
manager.importJSON(localStorage.getItem('params'));
```

## Example Presets

### Simple Single-Pass CRT
```
shaders = 1

shader0 = shaders/crt-lottes.slang
filter_linear0 = false
scale_type0 = viewport
```

### Multi-Pass with Bloom and Bezel
```
shaders = 5

# Pass 0: Linearize
shader0 = shaders/linearize.slang
scale_type0 = source
scale0 = 1.0

# Pass 1: Horizontal blur
shader1 = shaders/blur-h.slang
float_framebuffer1 = true

# Pass 2: Vertical blur
shader2 = shaders/blur-v.slang
alias2 = "BloomPass"

# Pass 3: CRT effect
shader3 = shaders/crt-guest.slang

# Pass 4: Bezel composite
shader4 = shaders/bezel.slang
scale_type4 = viewport

textures = "BezelImage"
BezelImage = textures/bezel.png
```

## Preset File Format

### Global Settings

| Key | Description | Example |
|-----|-------------|---------|
| `shaders` | Number of shader passes | `shaders = 3` |
| `#reference` | Import base preset | `#reference "base.slangp"` |

### Per-Pass Settings

| Key | Description | Values |
|-----|-------------|--------|
| `shader#` | Shader file path | `shader0 = "shaders/blur.slang"` |
| `filter_linear#` | Texture filtering | `true` / `false` |
| `scale_type#` | Scaling mode | `source` / `viewport` / `absolute` |
| `scale#` | Scale factor | `1.0`, `2.0`, etc. |
| `scale_x#` / `scale_y#` | Separate X/Y scale | `scale_x0 = 2.0` |
| `alias#` | Pass name | `alias0 = "SCALED"` |
| `srgb_framebuffer#` | sRGB framebuffer | `true` / `false` |
| `float_framebuffer#` | Float precision | `true` / `false` |
| `format#` | Texture format | `R16G16B16A16_SFLOAT` |
| `mipmap_input#` | Enable mipmapping | `true` / `false` |
| `wrap_mode#` | Texture wrap mode | `clamp_to_edge` / `repeat` |

### Texture Definitions

```
textures = "LUT;Bezel"

LUT = textures/color-lut.png
LUT_linear = true
LUT_wrap_mode = clamp_to_edge
LUT_mipmap = false

Bezel = textures/bezel-frame.png
Bezel_linear = true
```

### Parameter Overrides

```
parameters = "scanlineIntensity;bloom"

scanlineIntensity = 0.25
bloom = 0.15
```

## Slang Shader File Format (.slang)

### Pragma Directives

```glsl
#version 450

// Shader stage
#pragma stage vertex
#pragma stage fragment

// Framebuffer format
#pragma format R16G16B16A16_SFLOAT

// User parameters
#pragma parameter PARAM_NAME "Display Name" DEFAULT MIN MAX STEP
#pragma parameter scanlineIntensity "Scanline Intensity" 0.15 0.0 1.0 0.05
```

### Built-in Uniforms

```glsl
layout(std140, set = 0, binding = 0) uniform UBO
{
   mat4 MVP;              // Model-View-Projection matrix
   vec4 OutputSize;       // xy = size, zw = 1/size
   vec4 OriginalSize;     // Original input size
   vec4 SourceSize;       // Previous pass size
   uint FrameCount;       // Frame counter
};
```

### Texture Bindings

```glsl
layout(set = 0, binding = 1) uniform sampler2D Source;          // Previous pass
layout(set = 0, binding = 2) uniform sampler2D Original;        // Original input
layout(set = 0, binding = 3) uniform sampler2D OriginalHistory1; // 1 frame ago
```

### Parameters

```glsl
layout(push_constant) uniform Push
{
   float scanlineIntensity;
   float bloom;
   // ...
} params;
```

## Translation to WebGL

### Uniform Mapping

| Slang | WebGL |
|-------|-------|
| `layout(set=0, binding=1)` | `uniform sampler2D` (manual binding) |
| `layout(push_constant)` | Individual `uniform` declarations |
| `layout(std140)` UBO | Separate uniforms or packed struct |
| `texture(sampler, uv)` | `texture2D(sampler, uv)` (WebGL 1.0) |
| `in` / `out` (WebGL 2.0) | `varying` (WebGL 1.0) |
| `#version 450` | `#version 300 es` (WebGL 2.0) or removed (WebGL 1.0) |

### Automatic Conversions by SlangShaderCompiler

The compiler automatically handles these conversions:

1. **Layout Qualifiers → Uniforms**
   ```glsl
   // Slang
   layout(set = 0, binding = 1) uniform sampler2D Source;

   // WebGL
   uniform sampler2D Source;
   ```

2. **UBO → Individual Uniforms**
   ```glsl
   // Slang
   layout(set = 0, binding = 0) uniform UBO {
      mat4 MVP;
      vec4 OutputSize;
   };

   // WebGL
   uniform mat4 MVP;
   uniform vec2 OutputSize;
   ```

3. **Push Constants → Uniforms**
   ```glsl
   // Slang
   layout(push_constant) uniform Push {
      float intensity;
   } params;
   // Usage: params.intensity

   // WebGL
   uniform float intensity;
   // Usage: intensity
   ```

4. **Texture Functions**
   ```glsl
   // Slang (WebGL 2.0)
   texture(Source, uv)

   // WebGL 1.0
   texture2D(Source, uv)
   ```

5. **Shader Stage Keywords**
   ```glsl
   // Slang/WebGL 2.0
   in vec2 vTexCoord;  // Fragment input
   out vec4 FragColor; // Fragment output

   // WebGL 1.0
   varying vec2 vTexCoord;
   // gl_FragColor (built-in)
   ```

### Complete Example Conversion

**Slang:**
```glsl
#version 450

#pragma parameter intensity "Effect Intensity" 0.5 0.0 1.0 0.1

#pragma stage fragment
layout(location = 0) in vec2 vTexCoord;
layout(location = 0) out vec4 FragColor;

layout(set = 0, binding = 0) uniform UBO {
   mat4 MVP;
   vec4 OutputSize;
};

layout(set = 0, binding = 1) uniform sampler2D Source;

layout(push_constant) uniform Push {
   float intensity;
} params;

void main() {
   vec3 color = texture(Source, vTexCoord).rgb;
   color *= params.intensity;
   FragColor = vec4(color, 1.0);
}
```

**Compiled WebGL 2.0:**
```glsl
#version 300 es
precision highp float;
precision highp int;

uniform mat4 MVP;
uniform vec2 OutputSize;
uniform sampler2D Source;
uniform float intensity;

in vec2 vTexCoord;
out vec4 FragColor;

void main() {
   vec3 color = texture(Source, vTexCoord).rgb;
   color *= intensity;
   FragColor = vec4(color, 1.0);
}
```

**Compiled WebGL 1.0:**
```glsl
precision mediump float;

uniform mat4 MVP;
uniform vec2 OutputSize;
uniform sampler2D Source;
uniform float intensity;

varying vec2 vTexCoord;

void main() {
   vec3 color = texture2D(Source, vTexCoord).rgb;
   color *= intensity;
   gl_FragColor = vec4(color, 1.0);
}
```

## Testing

Run tests with:
```bash
npm test -- SlangPresetParser
```

See `__tests__/SlangPresetParser.test.ts` for examples.

## Examples

See `examples/` directory for:
- `simple-crt.slangp` - Basic single-pass CRT
- `multi-pass-crt.slangp` - Complex multi-pass with bloom and bezel
- `parser-usage-example.ts` - Code examples for using the parser

## Implementation Status

| Component | Status | Description |
|-----------|--------|-------------|
| SlangPresetParser | ✅ Complete | Parse .slangp files |
| SlangShaderCompiler | ✅ Complete | Convert Slang → WebGL GLSL |
| MultiPassRenderer | ✅ Complete | Three.js multi-pass pipeline |
| ParameterManager | ✅ Complete | Runtime parameter control & UI |

**Progress: 4/4 components complete (100%)** 🎉

## Next Steps

1. ✅ ~~SlangPresetParser~~ - COMPLETE
2. ✅ ~~SlangShaderCompiler~~ - COMPLETE
3. ✅ ~~MultiPassRenderer~~ - COMPLETE
4. ✅ ~~ParameterManager~~ - COMPLETE
5. **Integration Testing** - Test complete pipeline with real shaders
6. **End-to-End Example** - Create working demo with game integration
7. **Mega Bezel Port** - Load and render Mega Bezel presets (POTATO → ADV)
8. **Optimization** - Performance profiling and improvements
9. **Documentation** - API docs and usage guides

## Resources

- [Slang Shaders Repository](https://github.com/libretro/slang-shaders)
- [Mega Bezel Repository](https://github.com/HyperspaceMadness/Mega_Bezel)
- [Libretro Slang Docs](https://docs.libretro.com/development/shader/slang-shaders/)
- [Analysis Document](../../MEGA_BEZEL_ANALYSIS.md)

## License

This implementation is designed to work with shaders from the libretro/slang-shaders repository, which is licensed under various open-source licenses. Check individual shader files for their specific licenses.
