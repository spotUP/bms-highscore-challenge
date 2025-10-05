# Slang Shader System - End-to-End Demo

## 🎮 Live Demo

**URL:** http://localhost:8080/slang-demo

A fully working Pong game rendered through the complete Slang shader pipeline, demonstrating:
- ✅ Slang shader compilation (.slang → WebGL GLSL)
- ✅ Multi-pass rendering pipeline
- ✅ Runtime parameter control
- ✅ Real-time parameter adjustment
- ✅ Integration with Three.js game rendering

---

## 📁 Files Created

### Shader Files
- **`public/shaders/pong-crt.slang`** - Complete Slang shader with 5 parameters
  - Scanline intensity and count
  - Screen curvature
  - Brightness
  - Vignette intensity

- **`public/shaders/pong-crt.slangp`** - Preset configuration
  - Single-pass CRT effect
  - Parameter default values

### Demo Page
- **`src/pages/PongSlangDemo.tsx`** - Complete integration demo
  - Simple Pong game with Three.js
  - Slang shader pipeline integration
  - Real-time parameter control
  - Parameter display UI

---

## 🎮 Controls

| Key | Action |
|-----|--------|
| **1** | Decrease scanline intensity |
| **2** | Increase scanline intensity |
| **3** | Decrease curvature |
| **4** | Increase curvature |
| **0** | Reset all parameters to defaults |

---

## 🔧 How It Works

### 1. Game Rendering
```typescript
// Render Pong game to WebGL render target
renderer.setRenderTarget(gameRenderTarget);
renderer.render(gameScene, gameCamera);
```

### 2. Slang Shader Pipeline
```typescript
// Parse .slangp preset
const preset = SlangPresetParser.parse(presetContent);

// Create multi-pass renderer
const multipass = new MultiPassRenderer(renderer, preset, {
  width: 800,
  height: 800,
  webgl2: true
});

// Load and compile shaders
await multipass.loadShaders(async (path) => {
  const response = await fetch(path);
  return await response.text();
});

// Set game render target as input
multipass.setInputTexture(gameRenderTarget.texture);
```

### 3. Parameter Management
```typescript
// Create parameter manager
const paramManager = new ParameterManager();

// Link to renderer
paramManager.linkRenderer(multipass);

// Adjust parameters in real-time
paramManager.setValue('scanlineIntensity', 0.5);
```

### 4. Final Rendering
```typescript
// Render through Slang pipeline to screen
renderer.setRenderTarget(null);
multipass.render();
```

---

## 📊 Shader Parameters

| Parameter | Default | Min | Max | Step | Description |
|-----------|---------|-----|-----|------|-------------|
| `scanlineIntensity` | 0.25 | 0.0 | 1.0 | 0.05 | Darkness of scanlines |
| `scanlineCount` | 800.0 | 200.0 | 1200.0 | 50.0 | Number of scanlines |
| `curvature` | 0.05 | 0.0 | 0.2 | 0.01 | Screen curvature amount |
| `brightness` | 1.0 | 0.5 | 2.0 | 0.1 | Overall brightness |
| `vignetteIntensity` | 0.3 | 0.0 | 1.0 | 0.05 | Corner darkening |

---

## 🎨 Shader Features

### Scanlines
```glsl
float scanline = sin(curvedUV.y * params.scanlineCount * 3.14159 * 2.0) * 0.5 + 0.5;
scanline = mix(1.0, scanline, params.scanlineIntensity);
color *= scanline;
```

### Barrel Distortion (Curvature)
```glsl
vec2 centered = uv - 0.5;
float r2 = dot(centered, centered);
float distortion = 1.0 + params.curvature * r2;
vec2 curved = centered * distortion + 0.5;
```

### Vignette (Corner Darkening)
```glsl
vec2 toCenter = curvedUV - 0.5;
float dist = length(toCenter);
float vignette = smoothstep(0.8, 0.3, dist);
vignette = mix(1.0, vignette, params.vignetteIntensity);
color *= vignette;
```

---

## 🚀 Architecture Flow

```
┌─────────────────────┐
│   Pong Game Scene   │
│  (Three.js Objects) │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  WebGL Render Target│
│     (800x800)       │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  SlangPresetParser  │
│  (.slangp → JSON)   │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│ SlangShaderCompiler │
│ (.slang → WebGL)    │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│ MultiPassRenderer   │
│  (Execute Pipeline) │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  ParameterManager   │
│ (Runtime Control)   │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│   Screen Output     │
│  (Final Pixels)     │
└─────────────────────┘
```

---

## 💡 Key Takeaways

### What This Demonstrates

1. **Complete Pipeline Integration**
   - All 4 Slang shader system components working together
   - Real-world usage with actual game content

2. **Runtime Parameter Control**
   - Keyboard controls adjust shader parameters
   - Changes apply immediately
   - No recompilation needed

3. **Three.js Integration**
   - Uses game's WebGL render target as input
   - Clean separation between game and post-processing
   - Single render pipeline

4. **Production-Ready Pattern**
   - Easy to adapt for other shaders
   - Simple to add more complex presets
   - Scalable to multi-pass effects

---

## 🔄 Adding More Shaders

To use a different Slang shader:

1. **Add shader files** to `public/shaders/`
2. **Create .slangp preset** with configuration
3. **Update demo** to load new preset:
   ```typescript
   const presetPath = '/shaders/your-shader.slangp';
   ```
4. **Load and render** - no code changes needed!

---

## 🎯 Next Steps

Now that the basic integration works, you can:

1. **Load More Complex Shaders**
   - Try 2-pass or 3-pass effects (bloom, blur, etc.)
   - Test with real RetroArch shaders

2. **Add More Parameters**
   - Chromatic aberration
   - Phosphor glow
   - Color grading

3. **Integrate with Main Pong Game**
   - Add Slang shader option to Pong404
   - Make it toggleable (on/off)
   - Save user preferences

4. **Load Mega Bezel Presets**
   - Download POTATO preset from Mega Bezel repo
   - Test multi-pass rendering
   - Add bezel frame textures

---

## 🐛 Troubleshooting

### Shader Not Loading
- Check browser console for errors
- Verify shader files exist in `public/shaders/`
- Check file paths in .slangp preset

### Black Screen
- Verify WebGL 2.0 is available (check console)
- Check shader compilation errors
- Ensure render target is created correctly

### Parameters Not Working
- Check parameter names match shader pragmas
- Verify ParameterManager is linked to renderer
- Check console logs for parameter values

---

## 📚 Related Documentation

- [Slang Shader System README](./src/shaders/README.md)
- [Mega Bezel Analysis](./MEGA_BEZEL_ANALYSIS.md)
- [Component Documentation](./src/shaders/)

---

## ✅ Demo Status

**Status:** ✅ **COMPLETE AND WORKING**

All components integrated and functioning:
- ✅ Slang shader compiles to WebGL
- ✅ Multi-pass renderer executes pipeline
- ✅ Parameters adjust in real-time
- ✅ Game renders through shader
- ✅ Keyboard controls work
- ✅ UI displays current values

**Ready for:** Production use, more complex shaders, Mega Bezel integration
