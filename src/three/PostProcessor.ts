import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { CRTShader } from './shaders/CRTShader';
import { DetroitShader } from './shaders/DetroitShader';
import { DisharmonicShader } from './shaders/DisharmonicShader';
import { MotionBlurPass } from './shaders/MotionBlurShader';

export interface CRTSettings {
  curvature?: number;
  scanlineIntensity?: number;
  chromaticAberration?: number;
  vignetteIntensity?: number;
  flickerIntensity?: number;
  brightness?: number;
  contrast?: number;
}

export interface BloomSettings {
  strength?: number;
  radius?: number;
  threshold?: number;
}

export interface BezelSettings {
  enabled?: boolean;
  margin?: number;
  roughness?: number;
  color?: THREE.Vector3;
  reflectionStrength?: number;
  edgeHighlight?: number;
  cornerFade?: number;
  fresnelPower?: number;
  fresnelBase?: number;
}

export class PostProcessor {
  private composer: EffectComposer;
  private renderer: THREE.WebGLRenderer;
  private renderPass: RenderPass;
  private motionBlurPass: MotionBlurPass;
  private bloomPass: UnrealBloomPass;
  private detroitPass: ShaderPass;
  private disharmonicPass: ShaderPass;
  private crtPass: ShaderPass;

  // Enable/disable flags
  private motionBlurEnabled: boolean = false; // Disabled by default (use TrailRenderer instead)
  private bloomEnabled: boolean = true;
  private crtEnabled: boolean = true;
  private detroitEnabled: boolean = false;
  private disharmonicEnabled: boolean = false;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    width: number = 800,
    height: number = 800
  ) {
    // Store renderer reference for motion blur pass
    this.renderer = renderer;

    // Create effect composer
    this.composer = new EffectComposer(renderer);
    this.composer.setSize(width, height);

    // Pass 1: Render scene to texture
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // Pass 2: Motion Blur (temporal accumulation)
    // NOTE: Disabled by default - use TrailRenderer (instanced particles) instead
    // Can be enabled for additional fullscreen motion blur effect if desired
    this.motionBlurPass = new MotionBlurPass(width, height);
    this.motionBlurPass.enabled = this.motionBlurEnabled;
    // Motion blur needs custom render handling, so we'll handle it manually

    // Pass 3: Bloom (glow effect)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.3,  // Strength (subtle glow)
      0.4,  // Radius
      0.85  // Threshold (only bright objects glow)
    );
    this.bloomPass.enabled = this.bloomEnabled;
    this.composer.addPass(this.bloomPass);

    // Pass 4: Detroit rainbow shader (game-specific)
    this.detroitPass = new ShaderPass(DetroitShader);
    this.detroitPass.uniforms.resolution.value.set(width, height);
    this.detroitPass.enabled = this.detroitEnabled;
    this.composer.addPass(this.detroitPass);

    // Pass 5: Disharmonic glitch shader (game-specific)
    this.disharmonicPass = new ShaderPass(DisharmonicShader);
    this.disharmonicPass.enabled = this.disharmonicEnabled;
    this.composer.addPass(this.disharmonicPass);

    // Pass 6: CRT shader (final pass)
    this.crtPass = new ShaderPass(CRTShader);
    this.crtPass.uniforms.resolution.value.set(width, height);
    this.crtPass.enabled = this.crtEnabled;
    this.composer.addPass(this.crtPass);

    console.log('[PostProcessor] Initialized with', this.composer.passes.length, 'passes');
    console.log('[PostProcessor] Motion blur: DISABLED by default (using TrailRenderer)');
  }

  /**
   * Render with post-processing effects
   * @param deltaTime Time delta in seconds for animation
   */
  public render(deltaTime: number = 0): void {
    // Update time uniform for animated effects (flicker, etc.)
    if (this.crtPass.enabled) {
      this.crtPass.uniforms.time.value += deltaTime;
    }

    // Update time uniform for disharmonic glitch
    if (this.disharmonicPass.enabled) {
      this.disharmonicPass.uniforms.time.value += deltaTime;
    }

    // Render all passes
    this.composer.render(deltaTime);
  }

  /**
   * Update CRT shader settings
   */
  public updateCRTSettings(settings: CRTSettings): void {
    if (settings.curvature !== undefined) {
      this.crtPass.uniforms.curvature.value = settings.curvature;
    }
    if (settings.scanlineIntensity !== undefined) {
      this.crtPass.uniforms.scanlineIntensity.value = settings.scanlineIntensity;
    }
    if (settings.chromaticAberration !== undefined) {
      this.crtPass.uniforms.chromaticAberration.value = settings.chromaticAberration;
    }
    if (settings.vignetteIntensity !== undefined) {
      this.crtPass.uniforms.vignetteIntensity.value = settings.vignetteIntensity;
    }
    if (settings.flickerIntensity !== undefined) {
      this.crtPass.uniforms.flickerIntensity.value = settings.flickerIntensity;
    }
    if (settings.brightness !== undefined) {
      this.crtPass.uniforms.brightness.value = settings.brightness;
    }
    if (settings.contrast !== undefined) {
      this.crtPass.uniforms.contrast.value = settings.contrast;
    }
  }

  /**
   * Update bloom settings
   */
  public updateBloomSettings(settings: BloomSettings): void {
    if (settings.strength !== undefined) {
      this.bloomPass.strength = settings.strength;
    }
    if (settings.radius !== undefined) {
      this.bloomPass.radius = settings.radius;
    }
    if (settings.threshold !== undefined) {
      this.bloomPass.threshold = settings.threshold;
    }
  }

  /**
   * Update Mega Bezel settings
   */
  public updateBezelSettings(settings: BezelSettings): void {
    if (settings.enabled !== undefined) {
      this.crtPass.uniforms.bezelEnabled.value = settings.enabled;
    }
    if (settings.margin !== undefined) {
      this.crtPass.uniforms.bezelMargin.value = settings.margin;
    }
    if (settings.roughness !== undefined) {
      this.crtPass.uniforms.bezelRoughness.value = settings.roughness;
    }
    if (settings.color !== undefined) {
      this.crtPass.uniforms.bezelColor.value = settings.color;
    }
    if (settings.reflectionStrength !== undefined) {
      this.crtPass.uniforms.bezelReflectionStrength.value = settings.reflectionStrength;
    }
    if (settings.edgeHighlight !== undefined) {
      this.crtPass.uniforms.bezelEdgeHighlight.value = settings.edgeHighlight;
    }
    if (settings.cornerFade !== undefined) {
      this.crtPass.uniforms.bezelCornerFade.value = settings.cornerFade;
    }
    if (settings.fresnelPower !== undefined) {
      this.crtPass.uniforms.bezelFresnelPower.value = settings.fresnelPower;
    }
    if (settings.fresnelBase !== undefined) {
      this.crtPass.uniforms.bezelFresnelBase.value = settings.fresnelBase;
    }
  }

  /**
   * Enable/disable Mega Bezel
   */
  public setBezelEnabled(enabled: boolean): void {
    this.crtPass.uniforms.bezelEnabled.value = enabled;
    console.log('[PostProcessor] Mega Bezel:', enabled ? 'ON' : 'OFF');
  }

  /**
   * Get current bezel enabled state
   */
  public isBezelEnabled(): boolean {
    return this.crtPass.uniforms.bezelEnabled.value as boolean;
  }

  /**
   * Enable/disable bloom effect
   */
  public setBloomEnabled(enabled: boolean): void {
    this.bloomEnabled = enabled;
    this.bloomPass.enabled = enabled;
    console.log('[PostProcessor] Bloom:', enabled ? 'ON' : 'OFF');
  }

  /**
   * Enable/disable CRT effect
   */
  public setCRTEnabled(enabled: boolean): void {
    this.crtEnabled = enabled;
    this.crtPass.enabled = enabled;
    console.log('[PostProcessor] CRT:', enabled ? 'ON' : 'OFF');
  }

  /**
   * Get current CRT enabled state
   */
  public isCRTEnabled(): boolean {
    return this.crtEnabled;
  }

  /**
   * Get current bloom enabled state
   */
  public isBloomEnabled(): boolean {
    return this.bloomEnabled;
  }

  /**
   * Get current motion blur enabled state
   */
  public isMotionBlurEnabled(): boolean {
    return this.motionBlurEnabled;
  }

  /**
   * Enable/disable Detroit rainbow mode
   * @param enabled Enable/disable
   * @param beatPhase Optional beat phase (0-1, synced to music)
   * @param intensity Optional intensity (0-1)
   */
  public setDetroitMode(enabled: boolean, beatPhase: number = 0, intensity: number = 0.5): void {
    this.detroitEnabled = enabled;
    this.detroitPass.enabled = enabled;

    if (enabled) {
      this.detroitPass.uniforms.beatPhase.value = beatPhase;
      this.detroitPass.uniforms.intensity.value = intensity;
    }

    console.log('[PostProcessor] Detroit mode:', enabled ? 'ON' : 'OFF');
  }

  /**
   * Update Detroit beat phase (call this from music sync)
   */
  public updateDetroitBeatPhase(beatPhase: number): void {
    if (this.detroitEnabled) {
      this.detroitPass.uniforms.beatPhase.value = beatPhase;
    }
  }

  /**
   * Enable/disable Disharmonic glitch mode
   * @param enabled Enable/disable
   * @param value Glitch intensity (0-1)
   */
  public setDisharmonicMode(enabled: boolean, value: number = 0.5): void {
    this.disharmonicEnabled = enabled;
    this.disharmonicPass.enabled = enabled;

    if (enabled) {
      this.disharmonicPass.uniforms.disharmonicValue.value = value;
    }

    console.log('[PostProcessor] Disharmonic mode:', enabled ? 'ON' : 'OFF', 'value:', value);
  }

  /**
   * Update Disharmonic value (call this to change glitch intensity)
   */
  public updateDisharmonicValue(value: number): void {
    if (this.disharmonicEnabled) {
      this.disharmonicPass.uniforms.disharmonicValue.value = value;
    }
  }

  /**
   * Enable/disable Motion Blur effect
   * NOTE: Disabled by default - TrailRenderer provides particle-based trails
   * @param enabled Enable/disable fullscreen motion blur
   */
  public setMotionBlurEnabled(enabled: boolean): void {
    this.motionBlurEnabled = enabled;
    this.motionBlurPass.enabled = enabled;
    console.log('[PostProcessor] Motion Blur:', enabled ? 'ON' : 'OFF');
  }

  /**
   * Set motion blur blend factor (trail length)
   * @param factor 0-1 (0.7 = medium, 0.8 = long, 0.6 = short)
   */
  public setMotionBlurBlendFactor(factor: number): void {
    this.motionBlurPass.setBlendFactor(factor);
  }

  /**
   * Set motion blur trail dimming
   * @param dimming 0-1 (1.0 = full brightness, 0.9 = subtle fade)
   */
  public setMotionBlurTrailDimming(dimming: number): void {
    this.motionBlurPass.setTrailDimming(dimming);
  }

  /**
   * Clear motion blur accumulation (reset trails)
   */
  public clearMotionBlur(): void {
    this.motionBlurPass.clearAccumulation(this.renderer);
  }

  /**
   * Resize composer (call when window/canvas resizes)
   */
  public resize(width: number, height: number): void {
    this.composer.setSize(width, height);
    this.crtPass.uniforms.resolution.value.set(width, height);
    this.detroitPass.uniforms.resolution.value.set(width, height);
    this.motionBlurPass.setSize(width, height);

    // Update bloom resolution
    this.bloomPass.resolution.set(width, height);

    console.log(`[PostProcessor] Resized to ${width}x${height}`);
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.composer.dispose();
    this.motionBlurPass.dispose();
    console.log('[PostProcessor] Disposed');
  }
}
