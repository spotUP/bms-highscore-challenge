import * as THREE from 'three';

export class MotionBlurRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;

  // Render targets for temporal accumulation (ping-pong)
  private currentFrame: THREE.WebGLRenderTarget;
  private accumBuffer1: THREE.WebGLRenderTarget;
  private accumBuffer2: THREE.WebGLRenderTarget;
  private readBuffer: THREE.WebGLRenderTarget;
  private writeBuffer: THREE.WebGLRenderTarget;

  // Post-process materials
  private blendMaterial: THREE.ShaderMaterial;
  private copyMaterial: THREE.ShaderMaterial;

  // Quad meshes and scenes
  private blendQuad: THREE.Mesh;
  private copyQuad: THREE.Mesh;
  private blendScene: THREE.Scene;
  private copyScene: THREE.Scene;
  private orthoCamera: THREE.OrthographicCamera;

  // Accumulation settings
  private blendFactor: number = 0.70; // How much trail to keep (0.70 = 70% previous trail, 30% current)
  private trailDimming: number = 1.0; // Full brightness trails that fade quickly

  // Debug settings
  private debugMode: 'off' | 'current' | 'previous' | 'blended' = 'off';
  private frameCount: number = 0;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number = 800,
    height: number = 800
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    // Create render targets for temporal accumulation
    this.currentFrame = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat
    });

    this.accumBuffer1 = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat
    });

    this.accumBuffer2 = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat
    });

    // Initialize ping-pong buffers
    this.readBuffer = this.accumBuffer1;
    this.writeBuffer = this.accumBuffer2;

    // Create temporal accumulation shader with clean fade
    this.blendMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uCurrentFrame: { value: this.currentFrame.texture },
        uPreviousFrame: { value: this.readBuffer.texture },
        uBlendFactor: { value: this.blendFactor },
        uTrailDimming: { value: this.trailDimming },
        uDebugColors: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uCurrentFrame;
        uniform sampler2D uPreviousFrame;
        uniform float uBlendFactor;
        uniform float uTrailDimming;
        uniform float uDebugColors;
        varying vec2 vUv;

        void main() {
          vec4 current = texture2D(uCurrentFrame, vUv);
          vec4 previous = texture2D(uPreviousFrame, vUv);

          // Apply dimming to previous frame to ensure trails fade
          vec4 dimmedPrevious = previous * uTrailDimming;

          // Blend: more previous = longer trails
          vec4 blended = mix(current, dimmedPrevious, uBlendFactor);

          gl_FragColor = blended;

          // Debug: Color code the blending
          if (uDebugColors > 0.5) {
            float currentIntensity = length(current.rgb);
            float previousIntensity = length(previous.rgb);

            if (currentIntensity > 0.1 && previousIntensity > 0.1) {
              gl_FragColor = vec4(1.0, 1.0, 0.0, 1.0); // Yellow = both
            } else if (currentIntensity > 0.1) {
              gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0); // Green = current only
            } else if (previousIntensity > 0.1) {
              gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // Red = previous only
            } else {
              gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); // Black = nothing
            }
          }
        }
      `,
      depthWrite: false,
      depthTest: false
    });

    // Create copy shader (simple pass-through)
    this.copyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        void main() {
          gl_FragColor = texture2D(tDiffuse, vUv);
        }
      `,
      depthWrite: false,
      depthTest: false
    });

    // Create blend quad for blending pass
    this.blendQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      this.blendMaterial
    );

    // Create copy quad for display pass
    this.copyQuad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      this.copyMaterial
    );

    this.blendScene = new THREE.Scene();
    this.blendScene.add(this.blendQuad);

    this.copyScene = new THREE.Scene();
    this.copyScene.add(this.copyQuad);

    this.orthoCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    console.log('[MotionBlur] Initialized with temporal accumulation');
  }

  public render(objectVelocities: Map<THREE.Mesh, THREE.Vector2>): void {
    try {
      this.frameCount++;

      // Debug logging every 60 frames
      if (this.frameCount % 60 === 0) {
        console.log('[MotionBlur] Frame:', this.frameCount, 'BlendFactor:', this.blendFactor, 'DebugMode:', this.debugMode);
      }

      // Pass 1: Render current frame to texture
      this.renderer.setRenderTarget(this.currentFrame);
      this.renderer.setClearColor(0x000000, 1);
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);

      // Debug mode: show different buffers
      if (this.debugMode !== 'off') {
        this.renderer.setRenderTarget(null);
        this.renderer.setClearColor(0x000000, 1);
        this.renderer.clear();

        this.copyMaterial.uniforms.tDiffuse.value =
          this.debugMode === 'current' ? this.currentFrame.texture :
          this.debugMode === 'previous' ? this.readBuffer.texture :
          this.writeBuffer.texture;

        this.renderer.render(this.copyScene, this.orthoCamera);

        if (this.frameCount % 60 === 0) {
          console.log('[MotionBlur] Debug showing:', this.debugMode);
        }
        return;
      }

      // Pass 2: Blend current frame with previous accumulated frame
      this.blendMaterial.uniforms.uCurrentFrame.value = this.currentFrame.texture;
      this.blendMaterial.uniforms.uPreviousFrame.value = this.readBuffer.texture;

      // Render blended result to writeBuffer
      this.renderer.setRenderTarget(this.writeBuffer);
      this.renderer.clear();
      this.renderer.render(this.blendScene, this.orthoCamera);

      // Pass 3: Copy writeBuffer to screen
      this.copyMaterial.uniforms.tDiffuse.value = this.writeBuffer.texture;

      this.renderer.setRenderTarget(null);
      this.renderer.setClearColor(0x000000, 1);
      this.renderer.clear();
      this.renderer.render(this.copyScene, this.orthoCamera);

      // Swap buffers for next frame
      const temp = this.readBuffer;
      this.readBuffer = this.writeBuffer;
      this.writeBuffer = temp;
    } catch (error) {
      console.error('[MotionBlur] Render error:', error);
      // Fallback to direct render
      this.renderer.setRenderTarget(null);
      this.renderer.setClearColor(0x000000, 1);
      this.renderer.clear();
      this.renderer.render(this.scene, this.camera);
    }
  }

  public setBlendFactor(factor: number): void {
    this.blendFactor = Math.max(0, Math.min(1, factor));
    this.blendMaterial.uniforms.uBlendFactor.value = this.blendFactor;
    console.log('[MotionBlur] Set blend factor to:', this.blendFactor, '(length) dimming:', this.trailDimming, '(subtlety)');
  }

  public setTrailDimming(dimming: number): void {
    this.trailDimming = Math.max(0, Math.min(1, dimming));
    this.blendMaterial.uniforms.uTrailDimming.value = this.trailDimming;
    console.log('[MotionBlur] Set trail dimming to:', this.trailDimming);
  }

  public setDebugMode(mode: 'off' | 'current' | 'previous' | 'blended'): void {
    this.debugMode = mode;
    console.log('[MotionBlur] Debug mode set to:', mode);
  }

  public setDebugColors(enabled: boolean): void {
    this.blendMaterial.uniforms.uDebugColors.value = enabled ? 1.0 : 0.0;
    console.log('[MotionBlur] Debug colors:', enabled ? 'ON (Green=current, Red=trail, Yellow=both)' : 'OFF');
  }

  public getBlendFactor(): number {
    return this.blendFactor;
  }

  public getTrailDimming(): number {
    return this.trailDimming;
  }

  public resize(width: number, height: number): void {
    this.currentFrame.setSize(width, height);
    this.accumBuffer1.setSize(width, height);
    this.accumBuffer2.setSize(width, height);
  }

  public dispose(): void {
    this.currentFrame.dispose();
    this.accumBuffer1.dispose();
    this.accumBuffer2.dispose();
    this.blendMaterial.dispose();
    this.copyMaterial.dispose();
    this.blendQuad.geometry.dispose();
    this.copyQuad.geometry.dispose();
  }
}
