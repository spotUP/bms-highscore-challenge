# COMPREHENSIVE THREE.JS CONVERSION PROMPT FOR PONG 404

## MISSION OVERVIEW
Convert the existing Canvas 2D-based multiplayer Pong game to use **Three.js** for rendering while maintaining all gameplay features, multiplayer functionality, and visual effects. The conversion leverages Three.js's WebGL abstraction for improved performance, shader-based effects, and a foundation for advanced visual features like CRT simulation, bloom, and post-processing.

## 🎯 WHY THREE.JS?

### Three.js Advantages Over Raw WebGL
- **Abstracts WebGL Complexity**: No manual buffer/attribute management
- **ShaderMaterial**: Direct GLSL access for custom effects while Three.js handles uniforms
- **Built-in Post-Processing**: EffectComposer for multi-pass rendering pipeline
- **Automatic Render Targets**: No manual framebuffer/texture management
- **OrthographicCamera**: Perfect for 2D games with pixel-perfect rendering
- **Scene Graph**: Organized hierarchy for game objects
- **Extensive Community**: CRT shader examples, retro game references
- **Small Bundle Impact**: Tree-shakeable, only ~600KB minified (140KB gzipped)

### What We Keep Full Control Over
- **Custom Shaders**: Write raw GLSL for all visual effects
- **Performance**: Direct access to WebGL via renderer
- **Render Pipeline**: Custom post-processing passes
- **No Black Box**: Transparent abstraction over WebGL

---

## CURRENT ARCHITECTURE ANALYSIS

### Core Technologies Stack
- **Frontend Framework**: React 18 with TypeScript
- **Current Renderer**: HTML5 Canvas 2D Context (`CanvasRenderingContext2D`)
- **Networking**: WebSocket (custom multiplayer protocol)
- **Audio**: Tone.js for generative music, Web Audio API for sound effects
- **Speech**: SAM.js for robotic speech synthesis
- **State Management**: React useState/useRef hooks
- **Game Loop**: requestAnimationFrame-based loop at 60 FPS

### Current Rendering Architecture (Canvas 2D)
**File**: `src/pages/Pong404.tsx` (10,000+ lines)

**Key Rendering Components**:
1. **Main Canvas**: 800x800 pixels (dynamic scaling based on viewport)
2. **Render Function** (~lines 6816-9136): Single monolithic function handling all drawing
3. **Coordinate System**: Playfield is 800x800, centered in viewport
4. **Rendering Order**:
   - Clear canvas with black background
   - Apply dynamic scaling transform for responsive playfield
   - Draw ball (12x12 pixel square)
   - Draw ball trail (array of previous positions with alpha fade)
   - Draw paddles (4 paddles: left, right, top, bottom)
   - Draw paddle trails (velocity-based motion blur)
   - Draw pickups (4x4 pixel patterns with various effects)
   - Draw scores (text rendering with custom font)
   - Draw UI overlays (start screen, connection status, debug info)
   - Draw special effects (Great Wall borders, disharmonic glitch effects)

### Current Visual Effects (Canvas 2D)
1. **Trails**: Ball and paddle trails using alpha blending
2. **Glow**: Shadow blur effects on UI elements
3. **Flicker**: Precalculated flicker values for CRT-like effect
4. **Detroit Mode**: Rainbow scanlines synced to 130 BPM music
5. **Time Warp**: Speed modification affecting ball/paddle movement
6. **Disharmonic Mode**: RGB color shifting and glitch effects
7. **Pickups**: Various visual patterns (inverted colors, pulsing, etc.)

### Current Performance Characteristics
- **FPS**: Stable 60 FPS in Chrome/Safari on modern hardware
- **Draw Calls**: ~1 per frame (single canvas context)
- **CPU Usage**: Moderate (JavaScript-heavy rendering)
- **GPU Usage**: Minimal (2D canvas acceleration only)
- **Bottlenecks**: Text rendering, trail calculations, complex fills

---

## WHY CONVERT TO THREE.JS/WEBGL?

### Performance Benefits
1. **GPU Acceleration**: Offload rendering from CPU to GPU
2. **Batch Rendering**: Draw multiple objects in single draw call
3. **Shader Effects**: Real-time post-processing at 60 FPS
4. **Texture Caching**: Reuse pre-rendered sprites/patterns
5. **Instanced Rendering**: Efficient particle/trail systems

### Visual Enhancement Opportunities
1. **CRT Shader**: Authentic scanlines, curvature, chromatic aberration, phosphor glow
2. **Bloom/Glow**: HDR-style glow on paddles and ball
3. **Motion Blur**: Per-object motion vectors for realistic blur
4. **Distortion Effects**: Screen shake, warp, ripple effects
5. **Particle Systems**: Collision sparks, trail particles, explosions
6. **Bezel Reflections**: Real-time reflections on monitor frame (mega-bezel style)

### Future-Proofing
1. **Shader Pipeline**: Easy to add new effects via GLSL + ShaderMaterial
2. **Post-Processing Stack**: EffectComposer with composable passes
3. **Render Targets**: Three.js WebGLRenderTarget abstraction
4. **Texture Atlases**: CanvasTexture for efficient sprite management
5. **Modern WebGL**: Three.js automatically uses WebGL2 when available

---

## THREE.JS FUNDAMENTALS FOR THIS PROJECT

### Core Three.js Concepts We'll Use

#### 1. **Scene + Camera + Renderer**
```typescript
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(0, 800, 0, 800, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
  canvas: canvasRef.current,
  antialias: false
});
```

#### 2. **OrthographicCamera for 2D**
- Maps 800x800 playfield to screen space
- No perspective distortion (perfect for 2D games)
- Pixel-perfect positioning

#### 3. **Mesh = Geometry + Material**
```typescript
// Ball as a plane mesh
const ballGeometry = new THREE.PlaneGeometry(12, 12);
const ballMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const ballMesh = new THREE.Mesh(ballGeometry, ballMaterial);
scene.add(ballMesh);
```

#### 4. **ShaderMaterial for Custom Effects**
```typescript
const customMaterial = new THREE.ShaderMaterial({
  vertexShader: `...`,
  fragmentShader: `...`,
  uniforms: {
    time: { value: 0.0 },
    color: { value: new THREE.Color(0xffffff) }
  }
});
```

#### 5. **EffectComposer for Post-Processing**
```typescript
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new ShaderPass(CRTShader)); // Custom CRT shader
```

#### 6. **CanvasTexture for Dynamic Sprites**
```typescript
// Generate pickup patterns as textures
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d')!;
// ... draw 4x4 pixel pattern
const texture = new THREE.CanvasTexture(canvas);
```

### Coordinate System Mapping
- **Three.js Default**: Center at (0, 0), Y-up
- **Our Game**: Top-left at (0, 0), Y-down, 800x800 playfield
- **Solution**: OrthographicCamera(0, 800, 800, 0) maps game coordinates directly

---

## CONVERSION STRATEGY: PHASED APPROACH

### PHASE 1: Three.js Foundation (Week 1)
**Goal**: Get basic rendering working with Three.js while maintaining Canvas 2D as fallback

#### Tasks:

**1. Install Three.js**
```bash
npm install three
npm install --save-dev @types/three
```

**2. Create Three.js Context Manager** (`src/three/ThreeContext.ts`)
```typescript
import * as THREE from 'three';

export class ThreeContext {
  public scene: THREE.Scene;
  public camera: THREE.OrthographicCamera;
  public renderer: THREE.WebGLRenderer;

  constructor(canvas: HTMLCanvasElement) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // Camera (orthographic for 2D, matching 800x800 playfield)
    // Left, Right, Top, Bottom, Near, Far
    this.camera = new THREE.OrthographicCamera(0, 800, 0, 800, 0.1, 1000);
    this.camera.position.z = 10;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // Pixel-perfect rendering
      alpha: false,
      powerPreference: 'high-performance'
    });

    this.renderer.setSize(800, 800);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    console.log('[Three.js] Initialized with WebGL',
      this.renderer.capabilities.isWebGL2 ? '2.0' : '1.0');
  }

  public resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    // Update camera if needed
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    this.renderer.dispose();
    // Clean up geometries, materials, textures
  }
}
```

**3. Create Game Object Manager** (`src/three/GameObjects.ts`)
```typescript
import * as THREE from 'three';

export class GameObjects {
  private scene: THREE.Scene;

  // Game entities
  public ball: THREE.Mesh;
  public paddles: {
    left: THREE.Mesh;
    right: THREE.Mesh;
    top: THREE.Mesh;
    bottom: THREE.Mesh;
  };
  public trails: THREE.Points; // For particle-based trails

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initBall();
    this.initPaddles();
  }

  private initBall(): void {
    const geometry = new THREE.PlaneGeometry(12, 12);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true
    });

    this.ball = new THREE.Mesh(geometry, material);
    this.scene.add(this.ball);
  }

  private initPaddles(): void {
    const createPaddle = (width: number, height: number, color: number) => {
      const geometry = new THREE.PlaneGeometry(width, height);
      const material = new THREE.MeshBasicMaterial({ color });
      const mesh = new THREE.Mesh(geometry, material);
      this.scene.add(mesh);
      return mesh;
    };

    this.paddles = {
      left: createPaddle(20, 100, 0xff0000),   // Red
      right: createPaddle(20, 100, 0x00ff00),  // Green
      top: createPaddle(100, 20, 0x0000ff),    // Blue
      bottom: createPaddle(100, 20, 0xffff00)  // Yellow
    };
  }

  public updateBall(x: number, y: number): void {
    // Three.js uses center-based positioning
    this.ball.position.set(x + 6, 800 - (y + 6), 0);
  }

  public updatePaddle(
    paddle: THREE.Mesh,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    paddle.position.set(x + width / 2, 800 - (y + height / 2), 0);
    paddle.scale.set(width / 20, height / 20, 1); // Assuming base size 20x20
  }

  public dispose(): void {
    // Dispose geometries and materials
    this.ball.geometry.dispose();
    (this.ball.material as THREE.Material).dispose();
    // ... dispose other objects
  }
}
```

**4. Integrate into Pong404.tsx**
```typescript
// In Pong404.tsx
import { ThreeContext } from '../three/ThreeContext';
import { GameObjects } from '../three/GameObjects';

const canvasRef = useRef<HTMLCanvasElement>(null);
const threeContextRef = useRef<ThreeContext | null>(null);
const gameObjectsRef = useRef<GameObjects | null>(null);

useEffect(() => {
  if (!canvasRef.current) return;

  try {
    // Initialize Three.js
    const threeContext = new ThreeContext(canvasRef.current);
    threeContextRef.current = threeContext;

    // Create game objects
    const gameObjects = new GameObjects(threeContext.scene);
    gameObjectsRef.current = gameObjects;

    console.log('[Three.js] Scene initialized');
  } catch (error) {
    console.error('[Three.js] Failed to initialize:', error);
    // Fall back to Canvas 2D
  }

  return () => {
    gameObjectsRef.current?.dispose();
    threeContextRef.current?.dispose();
  };
}, []);

// In game loop render function
const render = useCallback(() => {
  if (threeContextRef.current && gameObjectsRef.current) {
    // Update positions from game state
    gameObjectsRef.current.updateBall(gameState.ball.x, gameState.ball.y);
    gameObjectsRef.current.updatePaddle(
      gameObjectsRef.current.paddles.left,
      gameState.paddles.left.x,
      gameState.paddles.left.y,
      gameState.paddles.left.width,
      gameState.paddles.left.height
    );
    // ... update other paddles

    // Render
    threeContextRef.current.render();
  } else {
    // Canvas 2D fallback
    // ... existing rendering code
  }
}, [gameState]);
```

**Success Criteria**: Ball and paddles render correctly via Three.js with proper positioning

---

### PHASE 2: Trails and Custom Shaders (Week 2)
**Goal**: Implement trails using BufferGeometry and custom shaders

#### Tasks:

**1. Create Trail System** (`src/three/TrailRenderer.ts`)
```typescript
import * as THREE from 'three';

export class TrailRenderer {
  private scene: THREE.Scene;
  private trailMesh: THREE.Points;
  private positions: Float32Array;
  private alphas: Float32Array;
  private maxTrailLength: number = 50;
  private currentIndex: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initTrail();
  }

  private initTrail(): void {
    const geometry = new THREE.BufferGeometry();

    // Allocate buffers
    this.positions = new Float32Array(this.maxTrailLength * 3);
    this.alphas = new Float32Array(this.maxTrailLength);

    geometry.setAttribute('position',
      new THREE.BufferAttribute(this.positions, 3));
    geometry.setAttribute('alpha',
      new THREE.BufferAttribute(this.alphas, 1));

    // Custom shader material
    const material = new THREE.ShaderMaterial({
      vertexShader: `
        attribute float alpha;
        varying float vAlpha;

        void main() {
          vAlpha = alpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = 12.0; // Ball size
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying float vAlpha;

        void main() {
          gl_FragColor = vec4(color, vAlpha);
        }
      `,
      uniforms: {
        color: { value: new THREE.Color(0xffffff) }
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false
    });

    this.trailMesh = new THREE.Points(geometry, material);
    this.scene.add(this.trailMesh);
  }

  public addPosition(x: number, y: number): void {
    const i = this.currentIndex * 3;
    this.positions[i] = x;
    this.positions[i + 1] = y;
    this.positions[i + 2] = 0;

    // Fade out calculation (1.0 at newest, 0.0 at oldest)
    for (let j = 0; j < this.maxTrailLength; j++) {
      const age = (this.currentIndex - j + this.maxTrailLength) % this.maxTrailLength;
      this.alphas[j] = Math.max(0, 1.0 - age / this.maxTrailLength);
    }

    this.currentIndex = (this.currentIndex + 1) % this.maxTrailLength;

    // Mark for update
    const geometry = this.trailMesh.geometry as THREE.BufferGeometry;
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.alpha.needsUpdate = true;
  }

  public dispose(): void {
    this.trailMesh.geometry.dispose();
    (this.trailMesh.material as THREE.Material).dispose();
  }
}
```

**2. Create Pickup Texture Atlas** (`src/three/PickupAtlas.ts`)
```typescript
import * as THREE from 'three';

export class PickupAtlas {
  private texture: THREE.CanvasTexture;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256; // 16 pickups x 16 pixels each
    this.canvas.height = 16;
    this.ctx = this.canvas.getContext('2d')!;

    this.generateAtlas();

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter; // Pixel-perfect
    this.texture.minFilter = THREE.NearestFilter;
  }

  private generateAtlas(): void {
    // Example: Draw first pickup pattern at x=0
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, 4, 4); // 4x4 pixel pattern

    // Draw more pickups at x=16, x=32, etc.
    // ... (use existing PRECALC_PICKUP_PATTERNS logic)
  }

  public getTexture(): THREE.CanvasTexture {
    return this.texture;
  }

  public getUVOffset(pickupIndex: number): number {
    return (pickupIndex * 16) / 256; // UV offset for this pickup
  }

  public dispose(): void {
    this.texture.dispose();
  }
}
```

**Success Criteria**: Trails render with proper alpha fading, pickups use texture atlas

---

### PHASE 3: Text Rendering with Sprites (Week 3)
**Goal**: Render text using Three.js Sprites and SDF fonts

#### Tasks:

**1. Create Text Renderer** (`src/three/TextRenderer.ts`)
```typescript
import * as THREE from 'three';

export class TextRenderer {
  private scene: THREE.Scene;
  private fontTexture: THREE.Texture;
  private textSprites: Map<string, THREE.Sprite> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.generateFontTexture();
  }

  private generateFontTexture(): void {
    // Option 1: Load SDF font texture
    // Option 2: Generate bitmap font from canvas
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    ctx.font = '48px "Press Start 2P"';
    ctx.fillStyle = 'white';
    ctx.textBaseline = 'top';

    // Draw ASCII characters to canvas
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ ';
    let x = 0, y = 0;

    for (const char of chars) {
      ctx.fillText(char, x, y);
      x += 32;
      if (x >= 512) { x = 0; y += 48; }
    }

    this.fontTexture = new THREE.CanvasTexture(canvas);
    this.fontTexture.magFilter = THREE.NearestFilter;
    this.fontTexture.minFilter = THREE.NearestFilter;
  }

  public createText(
    id: string,
    text: string,
    x: number,
    y: number,
    color: THREE.Color
  ): void {
    // Create sprite for text
    const spriteMaterial = new THREE.SpriteMaterial({
      map: this.fontTexture,
      color,
      transparent: true
    });

    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(x, 800 - y, 1); // Higher Z for UI
    sprite.scale.set(text.length * 16, 16, 1);

    this.scene.add(sprite);
    this.textSprites.set(id, sprite);
  }

  public updateText(id: string, x: number, y: number): void {
    const sprite = this.textSprites.get(id);
    if (sprite) {
      sprite.position.set(x, 800 - y, 1);
    }
  }

  public dispose(): void {
    this.fontTexture.dispose();
    this.textSprites.forEach(sprite => {
      sprite.material.dispose();
    });
  }
}
```

**Success Criteria**: Score text renders correctly with proper positioning

---

### PHASE 4: Post-Processing Pipeline (Week 4)
**Goal**: Implement CRT shader and post-processing effects

#### Tasks:

**1. Install Post-Processing Dependencies**
```bash
# Already included in three/examples
```

**2. Create CRT Shader** (`src/three/shaders/CRTShader.ts`)
```typescript
import * as THREE from 'three';

export const CRTShader = {
  uniforms: {
    tDiffuse: { value: null }, // Input texture from EffectComposer
    resolution: { value: new THREE.Vector2(800, 800) },
    time: { value: 0.0 },
    curvature: { value: 6.0 },
    scanlineIntensity: { value: 0.3 },
    chromaticAberration: { value: 0.002 },
    vignetteIntensity: { value: 0.3 },
    bezelSize: { value: 0.0 } // 0.0 = no bezel, 0.1 = 10% bezel
  },

  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float time;
    uniform float curvature;
    uniform float scanlineIntensity;
    uniform float chromaticAberration;
    uniform float vignetteIntensity;
    uniform float bezelSize;

    varying vec2 vUv;

    // Barrel distortion for CRT curvature
    vec2 barrelDistortion(vec2 uv, float strength) {
      vec2 cc = uv - 0.5;
      float dist = dot(cc, cc) * strength;
      return uv + cc * (1.0 + dist) * dist;
    }

    void main() {
      vec2 uv = vUv;

      // Apply curvature
      uv = barrelDistortion(uv, curvature);

      // Check bounds after distortion
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      // Chromatic aberration
      float r = texture2D(tDiffuse, uv + vec2(chromaticAberration, 0.0)).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - vec2(chromaticAberration, 0.0)).b;
      vec3 color = vec3(r, g, b);

      // Scanlines
      float scanline = sin(uv.y * resolution.y * 3.14159 * 2.0) * 0.5 + 0.5;
      color *= mix(1.0, scanline, scanlineIntensity);

      // Vignette
      vec2 toCenter = uv - 0.5;
      float vignette = 1.0 - dot(toCenter, toCenter) * vignetteIntensity;
      color *= vignette;

      // Subtle flicker
      float flicker = 0.98 + 0.02 * sin(time * 60.0);
      color *= flicker;

      gl_FragColor = vec4(color, 1.0);
    }
  `
};
```

**3. Create Post-Processor** (`src/three/PostProcessor.ts`)
```typescript
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { CRTShader } from './shaders/CRTShader';

export class PostProcessor {
  private composer: EffectComposer;
  private crtPass: ShaderPass;
  private bloomPass: UnrealBloomPass;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera
  ) {
    this.composer = new EffectComposer(renderer);

    // Pass 1: Render scene
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // Pass 2: Bloom (glow effect)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(800, 800),
      0.5,  // Strength
      0.4,  // Radius
      0.85  // Threshold
    );
    this.composer.addPass(this.bloomPass);

    // Pass 3: CRT shader
    this.crtPass = new ShaderPass(CRTShader);
    this.composer.addPass(this.crtPass);
  }

  public render(deltaTime: number): void {
    // Update time uniform
    this.crtPass.uniforms.time.value += deltaTime;
    this.composer.render();
  }

  public updateCRTSettings(settings: {
    curvature?: number;
    scanlineIntensity?: number;
    chromaticAberration?: number;
  }): void {
    if (settings.curvature !== undefined) {
      this.crtPass.uniforms.curvature.value = settings.curvature;
    }
    if (settings.scanlineIntensity !== undefined) {
      this.crtPass.uniforms.scanlineIntensity.value = settings.scanlineIntensity;
    }
    if (settings.chromaticAberration !== undefined) {
      this.crtPass.uniforms.chromaticAberration.value = settings.chromaticAberration;
    }
  }

  public setBloomEnabled(enabled: boolean): void {
    this.bloomPass.enabled = enabled;
  }

  public setCRTEnabled(enabled: boolean): void {
    this.crtPass.enabled = enabled;
  }

  public resize(width: number, height: number): void {
    this.composer.setSize(width, height);
  }

  public dispose(): void {
    this.composer.dispose();
  }
}
```

**4. Integrate Post-Processor**
```typescript
// In ThreeContext.ts
import { PostProcessor } from './PostProcessor';

export class ThreeContext {
  // ... existing code
  public postProcessor: PostProcessor;

  constructor(canvas: HTMLCanvasElement) {
    // ... existing setup

    this.postProcessor = new PostProcessor(this.renderer, this.scene, this.camera);
  }

  public render(deltaTime: number): void {
    // Use composer instead of renderer directly
    this.postProcessor.render(deltaTime);
  }
}
```

**Success Criteria**: CRT effect runs at 60 FPS with scanlines, curvature, and chromatic aberration

---

### PHASE 5: Advanced Game-Specific Effects (Week 5)
**Goal**: Implement Detroit mode, disharmonic mode, time warp shaders

#### Tasks:

**1. Create Detroit Rainbow Shader** (`src/three/shaders/DetroitShader.ts`)
```typescript
export const DetroitShader = {
  uniforms: {
    tDiffuse: { value: null },
    beatPhase: { value: 0.0 }, // 0-1 normalized to beat
    bpm: { value: 130.0 },
    resolution: { value: new THREE.Vector2(800, 800) }
  },

  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float beatPhase;
    uniform vec2 resolution;

    varying vec2 vUv;

    // HSL to RGB conversion
    vec3 hsl2rgb(vec3 c) {
      vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0);
      return c.z + c.y * (rgb-0.5)*(1.0-abs(2.0*c.z-1.0));
    }

    void main() {
      vec3 color = texture2D(tDiffuse, vUv).rgb;

      // Create rainbow scanlines based on Y position and beat
      float scanlineY = vUv.y + beatPhase;
      float hue = mod(scanlineY * 10.0, 1.0);
      vec3 rainbow = hsl2rgb(vec3(hue, 0.8, 0.5));

      // Blend with original based on scanline intensity
      float scanline = sin(vUv.y * resolution.y * 2.0) * 0.5 + 0.5;
      color = mix(color, rainbow, scanline * 0.3);

      gl_FragColor = vec4(color, 1.0);
    }
  `
};
```

**2. Create Disharmonic Glitch Shader** (`src/three/shaders/DisharmonicShader.ts`)
```typescript
export const DisharmonicShader = {
  uniforms: {
    tDiffuse: { value: null },
    disharmonicValue: { value: 0.0 }, // 0-1 glitch intensity
    time: { value: 0.0 }
  },

  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float disharmonicValue;
    uniform float time;

    varying vec2 vUv;

    // Simple hash for pseudo-random
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;

      // RGB channel separation based on disharmonic value
      float separation = disharmonicValue * 0.02;

      // Add glitch displacement
      float glitchLine = floor(uv.y * 100.0);
      float glitchOffset = hash(vec2(glitchLine, floor(time * 10.0))) * disharmonicValue * 0.1;

      uv.x += glitchOffset;

      // Sample RGB channels separately
      float r = texture2D(tDiffuse, uv + vec2(separation, 0.0)).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - vec2(separation, 0.0)).b;

      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `
};
```

**3. Add Conditional Shader Passes**
```typescript
// In PostProcessor.ts
public setDetroitMode(enabled: boolean, beatPhase: number): void {
  if (enabled) {
    this.detroitPass.enabled = true;
    this.detroitPass.uniforms.beatPhase.value = beatPhase;
  } else {
    this.detroitPass.enabled = false;
  }
}

public setDisharmonicMode(enabled: boolean, value: number): void {
  if (enabled) {
    this.disharmonicPass.enabled = true;
    this.disharmonicPass.uniforms.disharmonicValue.value = value;
  } else {
    this.disharmonicPass.enabled = false;
  }
}
```

**Success Criteria**: Detroit rainbow scanlines sync to music, disharmonic glitch activates correctly

---

### PHASE 6: Optimization and Batching (Week 6)
**Goal**: Minimize draw calls and maximize performance

#### Tasks:

**1. Implement Instanced Rendering for Trails**
```typescript
import { InstancedMesh } from 'three';

// Instead of Points, use InstancedMesh for better performance
const geometry = new THREE.PlaneGeometry(12, 12);
const material = new THREE.ShaderMaterial({ /* ... */ });
const instancedMesh = new THREE.InstancedMesh(geometry, material, maxTrailLength);

// Update instances
const matrix = new THREE.Matrix4();
for (let i = 0; i < trailPositions.length; i++) {
  matrix.setPosition(trailPositions[i].x, trailPositions[i].y, 0);
  instancedMesh.setMatrixAt(i, matrix);
}
instancedMesh.instanceMatrix.needsUpdate = true;
```

**2. Use Object Pooling**
```typescript
// Reuse geometries and materials
export class GeometryPool {
  private static quadGeometry: THREE.PlaneGeometry | null = null;

  public static getQuadGeometry(): THREE.PlaneGeometry {
    if (!this.quadGeometry) {
      this.quadGeometry = new THREE.PlaneGeometry(1, 1);
    }
    return this.quadGeometry;
  }
}
```

**3. Profile and Optimize**
- Check draw calls: `renderer.info.render.calls` (target: <10)
- Check triangles: `renderer.info.render.triangles`
- Use Chrome DevTools Performance tab
- Disable unused post-processing passes

**Success Criteria**: <10 draw calls per frame, 60 FPS maintained

---

### PHASE 7: Polish and Fallback (Week 7)
**Goal**: Cross-browser testing, mobile optimization, accessibility

#### Tasks:

**1. Canvas 2D Fallback Detection**
```typescript
const supportsWebGL = () => {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    );
  } catch (e) {
    return false;
  }
};

useEffect(() => {
  if (supportsWebGL()) {
    // Initialize Three.js
  } else {
    // Use Canvas 2D
    console.warn('[Renderer] WebGL not supported, using Canvas 2D fallback');
  }
}, []);
```

**2. Mobile Optimization**
```typescript
const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

if (isMobile) {
  // Reduce post-processing
  postProcessor.setBloomEnabled(false);
  postProcessor.updateCRTSettings({
    scanlineIntensity: 0.1, // Lighter effects
    curvature: 3.0
  });

  // Lower resolution
  renderer.setPixelRatio(1); // Instead of window.devicePixelRatio
}
```

**3. Respect Reduced Motion**
```typescript
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (prefersReducedMotion) {
  postProcessor.setCRTEnabled(false); // Disable flickering/scanlines
  // Disable particle effects, trails
}
```

**Success Criteria**: Works on Chrome, Firefox, Safari, Edge; Graceful degradation on mobile

---

## INTEGRATION WITH EXISTING CODEBASE

### Minimal Changes to Game Logic
**CRITICAL**: Keep all game logic, physics, collision detection, and networking unchanged. Only replace rendering.

### Full React Integration Example

```typescript
// src/pages/Pong404.tsx
import { useEffect, useRef, useCallback } from 'react';
import { ThreeContext } from '../three/ThreeContext';
import { GameObjects } from '../three/GameObjects';

export const Pong404: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const threeContextRef = useRef<ThreeContext | null>(null);
  const gameObjectsRef = useRef<GameObjects | null>(null);
  const useWebGL = useRef(true);

  // Initialize Three.js
  useEffect(() => {
    if (!canvasRef.current) return;

    try {
      const threeContext = new ThreeContext(canvasRef.current);
      threeContextRef.current = threeContext;

      const gameObjects = new GameObjects(threeContext.scene);
      gameObjectsRef.current = gameObjects;

      console.log('[Three.js] Initialized successfully');
    } catch (error) {
      console.error('[Three.js] Initialization failed:', error);
      useWebGL.current = false;
    }

    return () => {
      gameObjectsRef.current?.dispose();
      threeContextRef.current?.dispose();
    };
  }, []);

  // Game loop
  const render = useCallback(() => {
    if (useWebGL.current && threeContextRef.current && gameObjectsRef.current) {
      // Update Three.js objects from game state
      gameObjectsRef.current.updateBall(gameState.ball.x, gameState.ball.y);
      gameObjectsRef.current.updatePaddle(/* ... */);

      // Render
      const deltaTime = clock.getDelta();
      threeContextRef.current.render(deltaTime);
    } else {
      // Canvas 2D fallback
      renderCanvas2D();
    }
  }, [gameState]);

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={800}
      style={{ width: '100%', height: '100%' }}
    />
  );
};
```

---

## PERFORMANCE TARGETS

### Metrics to Monitor
1. **FPS**: Maintain 60 FPS (16.67ms per frame)
2. **GPU Frame Time**: <8ms for rendering
3. **Draw Calls**: <10 per frame (check `renderer.info.render.calls`)
4. **Triangles**: <5000 per frame (check `renderer.info.render.triangles`)
5. **Texture Memory**: <50MB for all assets
6. **Bundle Size**: Three.js adds ~140KB gzipped

### Three.js-Specific Optimizations
- [x] Use `BufferGeometry` instead of `Geometry` (deprecated)
- [x] Reuse geometries/materials via object pooling
- [x] Use `InstancedMesh` for repeated objects (trail particles)
- [x] Disable `renderer.shadowMap` (not needed for 2D)
- [x] Use `NearestFilter` for pixel-perfect textures
- [x] Set `renderer.setPixelRatio(1)` on mobile
- [x] Disable unused post-processing passes
- [x] Use `ShaderMaterial` instead of `MeshBasicMaterial` for custom effects

---

## THREE.JS PITFALLS AND SOLUTIONS

### Pitfall 1: Memory Leaks
**Problem**: Geometries, materials, textures not disposed
**Solution**: Always call `.dispose()` in cleanup
```typescript
useEffect(() => {
  return () => {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  };
}, []);
```

### Pitfall 2: Coordinate System Mismatch
**Problem**: Three.js Y-up vs. Canvas 2D Y-down
**Solution**: Use `800 - y` when setting positions, or configure camera differently

### Pitfall 3: Texture Filtering
**Problem**: Blurry pixel art
**Solution**: Use `THREE.NearestFilter` for both mag and min filters

### Pitfall 4: Post-Processing Performance
**Problem**: EffectComposer slow on mobile
**Solution**: Disable heavy passes (bloom, complex shaders) on low-end devices

### Pitfall 5: Shader Compilation Stutter
**Problem**: First frame with new shader causes lag
**Solution**: Pre-compile shaders during initialization
```typescript
renderer.compile(scene, camera);
```

---

## RESOURCES AND REFERENCES

### Three.js Resources
- [Three.js Documentation](https://threejs.org/docs/) - Official API reference
- [Three.js Examples](https://threejs.org/examples/) - Post-processing examples
- [Three.js Fundamentals](https://threejs.org/manual/) - Comprehensive guide
- [Discover Three.js](https://discoverthreejs.com/) - Book/tutorial

### Shader Resources
- [The Book of Shaders](https://thebookofshaders.com/) - GLSL fundamentals
- [Shadertoy](https://www.shadertoy.com/) - CRT shader examples
- [Three.js Shader Examples](https://threejs.org/examples/?q=shader) - ShaderMaterial demos

### CRT/Retro Shaders
- [CRT Shader Collection](https://github.com/libretro/glsl-shaders) - RetroArch shaders
- [Mega Bezel Shader](https://forums.libretro.com/t/hsm-mega-bezel-reflection-shader-feedback-and-updates/)
- [Three.js CRT Example](https://threejs.org/examples/#webgl_postprocessing_glitch)

### Performance
- [Three.js Performance Tips](https://discoverthreejs.com/tips-and-tricks/)
- [Chrome DevTools 3D View](https://developer.chrome.com/docs/devtools/3d-view/)
- [Stats.js](https://github.com/mrdoob/stats.js/) - FPS/MS/MB monitor

---

## MIGRATION CHECKLIST

### Pre-Conversion
- [x] Install Three.js (`npm install three @types/three`)
- [ ] Review Canvas 2D rendering code
- [ ] Create Three.js context wrapper
- [ ] Set up OrthographicCamera for 2D
- [ ] Test basic scene rendering

### Core Rendering
- [ ] Convert ball to THREE.Mesh
- [ ] Convert paddles to THREE.Mesh
- [ ] Implement trail system with BufferGeometry
- [ ] Create pickup texture atlas
- [ ] Convert borders/UI to meshes

### Text Rendering
- [ ] Generate font texture atlas
- [ ] Implement text via THREE.Sprite or shader
- [ ] Convert score displays
- [ ] Convert start screen text
- [ ] Convert connection status

### Post-Processing
- [ ] Set up EffectComposer
- [ ] Implement CRT shader pass
- [ ] Add bloom/glow pass
- [ ] Create Detroit mode shader
- [ ] Create disharmonic glitch shader
- [ ] Add time warp radial blur

### Optimization
- [ ] Profile draw calls (<10)
- [ ] Implement geometry/material pooling
- [ ] Use InstancedMesh for particles
- [ ] Test on mid-range hardware
- [ ] Optimize for mobile

### Polish
- [ ] Handle context loss
- [ ] Implement Canvas 2D fallback
- [ ] Add error handling
- [ ] Respect prefers-reduced-motion
- [ ] Cross-browser testing

### Deployment
- [ ] A/B test Three.js vs Canvas 2D
- [ ] Monitor bundle size impact
- [ ] Measure FPS metrics
- [ ] Gather user feedback
- [ ] Gradual rollout

---

## FINAL NOTES

### Why Three.js Is Perfect for This Project
- **2D-Friendly**: OrthographicCamera makes 2D games trivial
- **Shader Control**: ShaderMaterial gives raw GLSL access
- **Post-Processing**: EffectComposer eliminates manual framebuffer management
- **Community**: Extensive retro/CRT shader examples
- **Performance**: Mature, optimized WebGL abstraction
- **Bundle Size**: ~140KB gzipped is acceptable for this use case

### Success Criteria
1. **Functionality**: All existing features work identically
2. **Performance**: 60 FPS on mid-range hardware
3. **Visual Quality**: CRT shader matches/exceeds expectations
4. **Compatibility**: Works on 95%+ of target browsers
5. **Maintainability**: Cleaner code than raw WebGL approach

### Timeline Estimate
- **Phase 1**: 1 week (Three.js foundation)
- **Phase 2**: 1 week (trails + custom shaders)
- **Phase 3**: 1 week (text rendering)
- **Phase 4**: 1 week (post-processing)
- **Phase 5**: 1 week (game-specific effects)
- **Phase 6**: 1 week (optimization)
- **Phase 7**: 1 week (polish + testing)
- **Total**: ~7 weeks for complete conversion

### Risk Mitigation
- Maintain Canvas 2D fallback throughout
- Test on target devices early and often
- Profile performance at each phase
- Have rollback plan ready
- Monitor crash reports in production

---

## CONVERSION START COMMAND

**Ready to begin?** Execute this sequence:

1. **Install Three.js**: `npm install three @types/three`
2. **Create `src/three/` directory**
3. **Implement `ThreeContext.ts`** (scene, camera, renderer)
4. **Implement `GameObjects.ts`** (ball, paddles as meshes)
5. **Integrate into `Pong404.tsx`** (useEffect + refs)
6. **Test**: Ball and paddles render via Three.js
7. **Iterate**: Add trails, text, post-processing incrementally

**The GPU awaits. Time to make retro Pong beautiful.** 🎮✨
