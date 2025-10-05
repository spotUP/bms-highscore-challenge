import * as THREE from 'three';
import { PostProcessor } from './PostProcessor';
import { PerformanceMonitor } from './PerformanceMonitor';
import { WebGLDetector } from './WebGLDetector';

export class ThreeContext {
  public scene: THREE.Scene;
  public camera: THREE.OrthographicCamera;
  public renderer: THREE.WebGLRenderer;
  public postProcessor: PostProcessor;
  public performanceMonitor: PerformanceMonitor;

  private clock: THREE.Clock;

  constructor(canvas: HTMLCanvasElement) {
    // Detect device capabilities and log them
    const deviceCaps = WebGLDetector.getDeviceCapabilities();
    WebGLDetector.logCapabilities();

    // Get recommended settings based on device
    const recommendedSettings = WebGLDetector.getRecommendedSettings();

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    // Camera (orthographic for 2D, matching 800x800 playfield)
    // Left, Right, Top, Bottom, Near, Far
    // Note: top=800, bottom=0 to match Canvas 2D coordinates (Y increases downward)
    this.camera = new THREE.OrthographicCamera(0, 800, 800, 0, 0.1, 1000);
    this.camera.position.z = 10;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // Pixel-perfect rendering
      alpha: false,
      powerPreference: 'high-performance'
    });

    this.renderer.setSize(800, 800);
    // Use recommended pixel ratio (capped on mobile for performance)
    this.renderer.setPixelRatio(deviceCaps.pixelRatio);

    // Clock for delta time
    this.clock = new THREE.Clock();

    // Post-processor with CRT and bloom effects
    this.postProcessor = new PostProcessor(
      this.renderer,
      this.scene,
      this.camera,
      800,
      800
    );

    // Apply device-specific optimizations
    console.log('[Three.js] Applying device-specific optimizations...');

    // Bloom optimization
    this.postProcessor.setBloomEnabled(recommendedSettings.enableBloom);
    if (recommendedSettings.bloomStrength < 0.3) {
      this.postProcessor.updateBloomSettings({
        strength: recommendedSettings.bloomStrength
      });
    }

    // CRT optimization
    this.postProcessor.setCRTEnabled(recommendedSettings.enableCRT);
    if (recommendedSettings.crtIntensity < 1.0) {
      // Reduce CRT effects for mobile/reduced motion
      this.postProcessor.updateCRTSettings({
        scanlineIntensity: 0.1 * recommendedSettings.crtIntensity,
        chromaticAberration: 0.0015 * recommendedSettings.crtIntensity,
        flickerIntensity: 0.01 * recommendedSettings.crtIntensity
      });
    }

    // Performance monitor for optimization profiling
    this.performanceMonitor = new PerformanceMonitor(this.renderer);

    console.log('[Three.js] Initialized with WebGL',
      this.renderer.capabilities.isWebGL2 ? '2.0' : '1.0');
    console.log('[Three.js] Pixel Ratio:', deviceCaps.pixelRatio);
    console.log('[Three.js] Bloom:', recommendedSettings.enableBloom ? 'ON' : 'OFF');
    console.log('[Three.js] CRT Intensity:', Math.round(recommendedSettings.crtIntensity * 100) + '%');
  }

  public resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.postProcessor.resize(width, height);
    // Update camera if needed for responsive sizing
  }

  public render(): void {
    // Get delta time for animations
    const deltaTime = this.clock.getDelta();

    // Render with post-processing effects
    this.postProcessor.render(deltaTime);

    // Update performance metrics
    this.performanceMonitor.update();
  }

  public dispose(): void {
    this.postProcessor.dispose();
    this.renderer.dispose();
    // Clean up geometries, materials, textures
  }
}
