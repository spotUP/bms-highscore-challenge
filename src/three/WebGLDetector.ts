/**
 * WebGL Detector and Device Capabilities
 *
 * Phase 7: Polish and Fallback
 * Detects WebGL support, device capabilities, and accessibility preferences
 */

export interface DeviceCapabilities {
  supportsWebGL: boolean;
  supportsWebGL2: boolean;
  isMobile: boolean;
  prefersReducedMotion: boolean;
  pixelRatio: number;
  renderer?: string;
  vendor?: string;
}

export class WebGLDetector {
  /**
   * Check if WebGL is supported
   */
  public static isWebGLAvailable(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(
        canvas.getContext('webgl') ||
        canvas.getContext('experimental-webgl')
      );
    } catch (e) {
      return false;
    }
  }

  /**
   * Check if WebGL 2 is supported
   */
  public static isWebGL2Available(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!canvas.getContext('webgl2');
    } catch (e) {
      return false;
    }
  }

  /**
   * Detect if device is mobile
   */
  public static isMobile(): boolean {
    if (typeof window === 'undefined') return false;

    // Check user agent
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

    // Check screen size as backup
    const isMobileScreen = window.innerWidth < 768;

    return mobileRegex.test(userAgent) || isMobileScreen;
  }

  /**
   * Check if user prefers reduced motion
   */
  public static prefersReducedMotion(): boolean {
    if (typeof window === 'undefined') return false;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    return mediaQuery.matches;
  }

  /**
   * Get WebGL renderer info
   */
  public static getWebGLInfo(): { renderer: string; vendor: string } | null {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

      if (!gl) return null;

      const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      if (!debugInfo) {
        return {
          renderer: 'Unknown',
          vendor: 'Unknown'
        };
      }

      return {
        renderer: (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
        vendor: (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Get recommended pixel ratio based on device
   */
  public static getRecommendedPixelRatio(): number {
    if (typeof window === 'undefined') return 1;

    const isMobile = this.isMobile();
    const devicePixelRatio = window.devicePixelRatio || 1;

    // Cap pixel ratio on mobile for performance
    if (isMobile) {
      return Math.min(devicePixelRatio, 1.5);
    }

    // Use full pixel ratio on desktop
    return devicePixelRatio;
  }

  /**
   * Get comprehensive device capabilities
   */
  public static getDeviceCapabilities(): DeviceCapabilities {
    const webglInfo = this.getWebGLInfo();

    return {
      supportsWebGL: this.isWebGLAvailable(),
      supportsWebGL2: this.isWebGL2Available(),
      isMobile: this.isMobile(),
      prefersReducedMotion: this.prefersReducedMotion(),
      pixelRatio: this.getRecommendedPixelRatio(),
      renderer: webglInfo?.renderer,
      vendor: webglInfo?.vendor
    };
  }

  /**
   * Log device capabilities to console
   */
  public static logCapabilities(): void {
    const caps = this.getDeviceCapabilities();

    console.log('[WebGLDetector] ================');
    console.log('[WebGLDetector] WebGL Support:', caps.supportsWebGL ? '' : '');
    console.log('[WebGLDetector] WebGL 2 Support:', caps.supportsWebGL2 ? '' : '');
    console.log('[WebGLDetector] Mobile Device:', caps.isMobile ? 'Yes' : 'No');
    console.log('[WebGLDetector] Prefers Reduced Motion:', caps.prefersReducedMotion ? 'Yes' : 'No');
    console.log('[WebGLDetector] Pixel Ratio:', caps.pixelRatio);
    console.log('[WebGLDetector] Renderer:', caps.renderer || 'Unknown');
    console.log('[WebGLDetector] Vendor:', caps.vendor || 'Unknown');
    console.log('[WebGLDetector] ================');
  }

  /**
   * Get recommended post-processing settings based on device
   */
  public static getRecommendedSettings(): {
    enableBloom: boolean;
    enableCRT: boolean;
    crtIntensity: number;
    bloomStrength: number;
    maxTrailLength: number;
  } {
    const caps = this.getDeviceCapabilities();

    // Reduced motion: disable all effects
    if (caps.prefersReducedMotion) {
      return {
        enableBloom: false,
        enableCRT: false,
        crtIntensity: 0,
        bloomStrength: 0,
        maxTrailLength: 5
      };
    }

    // Mobile: lighter effects
    if (caps.isMobile) {
      return {
        enableBloom: false, // Disable bloom on mobile
        enableCRT: true,
        crtIntensity: 0.5, // 50% CRT intensity
        bloomStrength: 0.2,
        maxTrailLength: 15 // Shorter trails
      };
    }

    // Desktop: full effects
    return {
      enableBloom: true,
      enableCRT: true,
      crtIntensity: 1.0, // 100% CRT intensity
      bloomStrength: 0.3,
      maxTrailLength: 30
    };
  }
}
