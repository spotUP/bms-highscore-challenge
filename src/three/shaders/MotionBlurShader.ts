import * as THREE from 'three';

/**
 * Motion Blur Shader
 *
 * Temporal accumulation motion blur using frame blending.
 * Integrates into PostProcessor as a shader pass.
 *
 * Algorithm:
 * - Stores previous frame in a texture
 * - Blends current frame with previous frame
 * - Creates smooth motion trails
 *
 * Performance:
 * - Single shader pass
 * - No velocity buffer needed
 * - Adjustable blend factor for trail length
 */

export const MotionBlurShader = {
  uniforms: {
    tDiffuse: { value: null },        // Current frame from previous pass
    tPrevious: { value: null },       // Previous accumulated frame
    blendFactor: { value: 0.7 },      // 0-1: higher = longer trails
    trailDimming: { value: 1.0 },     // 0-1: brightness of trails
    enabled: { value: true }          // Enable/disable blur
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
    uniform sampler2D tPrevious;
    uniform float blendFactor;
    uniform float trailDimming;
    uniform bool enabled;

    varying vec2 vUv;

    void main() {
      // Sample current frame
      vec4 currentColor = texture2D(tDiffuse, vUv);

      if (!enabled) {
        // Motion blur disabled - just pass through current frame
        gl_FragColor = currentColor;
        return;
      }

      // Sample previous accumulated frame
      vec4 previousColor = texture2D(tPrevious, vUv);

      // Dim the previous frame for trail fade effect
      vec4 dimmedPrevious = previousColor * trailDimming;

      // Blend current with dimmed previous
      // blendFactor controls how much of the previous frame to keep
      // 0.7 = 70% previous + 30% current (longer trails)
      // 0.3 = 30% previous + 70% current (shorter trails)
      vec4 blended = mix(currentColor, dimmedPrevious, blendFactor);

      // Ensure we don't exceed brightness (prevent trail accumulation)
      blended = clamp(blended, 0.0, 1.0);

      gl_FragColor = blended;
    }
  `
};

/**
 * Motion Blur Pass
 *
 * Custom ShaderPass that handles ping-pong render targets for accumulation.
 * This is needed because standard ShaderPass doesn't handle frame history.
 */
export class MotionBlurPass {
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private quad: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  // Ping-pong render targets for frame accumulation
  private renderTargetA: THREE.WebGLRenderTarget;
  private renderTargetB: THREE.WebGLRenderTarget;
  private currentTarget: 'A' | 'B' = 'A';

  public enabled: boolean = true;
  public needsSwap: boolean = true;

  constructor(width: number = 800, height: number = 800) {
    // Create shader material
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(MotionBlurShader.uniforms),
      vertexShader: MotionBlurShader.vertexShader,
      fragmentShader: MotionBlurShader.fragmentShader
    });

    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geometry, this.material);

    // Create scene and camera for rendering the quad
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Create ping-pong render targets
    const targetParams = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      stencilBuffer: false
    };

    this.renderTargetA = new THREE.WebGLRenderTarget(width, height, targetParams);
    this.renderTargetB = new THREE.WebGLRenderTarget(width, height, targetParams);

    // Initialize tPrevious to a black texture
    this.material.uniforms.tPrevious.value = this.renderTargetB.texture;
  }

  /**
   * Render the motion blur pass
   * @param renderer WebGL renderer
   * @param writeBuffer Output render target
   * @param readBuffer Input render target (current frame)
   */
  public render(
    renderer: THREE.WebGLRenderer,
    writeBuffer: THREE.WebGLRenderTarget,
    readBuffer: THREE.WebGLRenderTarget
  ): void {
    if (!this.enabled) {
      // Pass through without blur
      renderer.setRenderTarget(writeBuffer);
      this.material.uniforms.tDiffuse.value = readBuffer.texture;
      this.material.uniforms.enabled.value = false;
      renderer.render(this.scene, this.camera);
      return;
    }

    // Set current frame as input
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    this.material.uniforms.enabled.value = true;

    // Determine which targets to use
    const currentRT = this.currentTarget === 'A' ? this.renderTargetA : this.renderTargetB;
    const previousRT = this.currentTarget === 'A' ? this.renderTargetB : this.renderTargetA;

    // Set previous accumulated frame
    this.material.uniforms.tPrevious.value = previousRT.texture;

    // Render to current target (accumulates with previous)
    renderer.setRenderTarget(currentRT);
    renderer.render(this.scene, this.camera);

    // Copy to write buffer for next pass
    renderer.setRenderTarget(writeBuffer);
    renderer.render(this.scene, this.camera);

    // Swap targets for next frame
    this.currentTarget = this.currentTarget === 'A' ? 'B' : 'A';
  }

  /**
   * Set blur intensity (trail length)
   * @param factor 0-1 (0.7 = medium, 0.8 = long trails, 0.6 = short trails)
   */
  public setBlendFactor(factor: number): void {
    this.material.uniforms.blendFactor.value = Math.max(0, Math.min(1, factor));
  }

  /**
   * Get current blend factor
   */
  public getBlendFactor(): number {
    return this.material.uniforms.blendFactor.value;
  }

  /**
   * Set trail brightness/dimming
   * @param dimming 0-1 (1.0 = full brightness, 0.9 = subtle fade)
   */
  public setTrailDimming(dimming: number): void {
    this.material.uniforms.trailDimming.value = Math.max(0, Math.min(1, dimming));
  }

  /**
   * Get current trail dimming
   */
  public getTrailDimming(): number {
    return this.material.uniforms.trailDimming.value;
  }

  /**
   * Clear accumulated frames (reset blur)
   */
  public clearAccumulation(renderer: THREE.WebGLRenderer): void {
    renderer.setRenderTarget(this.renderTargetA);
    renderer.clear();
    renderer.setRenderTarget(this.renderTargetB);
    renderer.clear();
    renderer.setRenderTarget(null);
  }

  /**
   * Resize render targets
   */
  public setSize(width: number, height: number): void {
    this.renderTargetA.setSize(width, height);
    this.renderTargetB.setSize(width, height);
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.renderTargetA.dispose();
    this.renderTargetB.dispose();
    this.material.dispose();
    this.quad.geometry.dispose();
  }
}
