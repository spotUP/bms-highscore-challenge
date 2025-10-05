import * as THREE from 'three';

/**
 * CRT Shader with Mega Bezel Reflection
 * Features:
 * - Barrel distortion (screen curvature)
 * - Scanlines
 * - Chromatic aberration (RGB separation)
 * - Vignette
 * - Phosphor glow/bloom
 * - Flicker
 * - Mega Bezel plastic frame with reflections
 * - Fresnel effect for realistic material
 * - Edge highlights and corner attenuation
 */
export const CRTShader = {
  uniforms: {
    tDiffuse: { value: null }, // Input texture from previous pass
    resolution: { value: new THREE.Vector2(800, 800) },
    time: { value: 0.0 },

    // CRT curvature
    curvature: { value: 4.0 }, // Barrel distortion strength (0 = flat, 10 = very curved)

    // Scanlines
    scanlineIntensity: { value: 0.15 }, // 0-1, how dark the scanlines are
    scanlineCount: { value: 800.0 }, // Number of scanlines (match resolution)

    // Chromatic aberration
    chromaticAberration: { value: 0.0015 }, // RGB separation amount

    // Vignette
    vignetteIntensity: { value: 0.3 }, // 0-1, corner darkening
    vignetteRadius: { value: 0.8 }, // 0-1, how far from center vignette starts

    // Flicker
    flickerIntensity: { value: 0.02 }, // 0-1, subtle brightness variation

    // Brightness/contrast
    brightness: { value: 1.0 },
    contrast: { value: 1.0 },

    // Mega Bezel - Frame/Bezel
    bezelEnabled: { value: true }, // Enable/disable bezel rendering
    bezelMargin: { value: 0.20 }, // Size of bezel border (0-0.3) - INCREASED for visibility
    bezelRoughness: { value: 0.3 }, // Material roughness (0 = mirror, 1 = matte) - more reflective
    bezelColor: { value: new THREE.Vector3(0.2, 0.2, 0.22) }, // Base plastic color (lighter gray)

    // Mega Bezel - Reflections
    bezelReflectionStrength: { value: 0.8 }, // How much screen reflects in bezel (0-1) - INCREASED
    bezelEdgeHighlight: { value: 2.5 }, // Edge brightness boost (0-3) - INCREASED
    bezelCornerFade: { value: 0.10 }, // Corner shadow size (0-0.3)

    // Mega Bezel - Fresnel
    bezelFresnelPower: { value: 5.0 }, // Fresnel falloff (1-10)
    bezelFresnelBase: { value: 0.04 }, // Base reflectance for plastic (0.04 typical)
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

    // CRT uniforms
    uniform float curvature;
    uniform float scanlineIntensity;
    uniform float scanlineCount;
    uniform float chromaticAberration;
    uniform float vignetteIntensity;
    uniform float vignetteRadius;
    uniform float flickerIntensity;
    uniform float brightness;
    uniform float contrast;

    // Mega Bezel uniforms
    uniform bool bezelEnabled;
    uniform float bezelMargin;
    uniform float bezelRoughness;
    uniform vec3 bezelColor;
    uniform float bezelReflectionStrength;
    uniform float bezelEdgeHighlight;
    uniform float bezelCornerFade;
    uniform float bezelFresnelPower;
    uniform float bezelFresnelBase;

    varying vec2 vUv;

    // ========================================
    // Signed Distance Field Functions
    // ========================================

    // Signed distance to box (negative inside, positive outside)
    float sdBox(vec2 p, vec2 b) {
      vec2 d = abs(p) - b;
      return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
    }

    // ========================================
    // Fresnel Effect (Schlick approximation)
    // ========================================

    float fresnelSchlick(float cosTheta, float F0, float power) {
      return F0 + (1.0 - F0) * pow(1.0 - cosTheta, power);
    }

    // ========================================
    // Barrel Distortion for CRT Curvature
    // ========================================

    vec2 curveUV(vec2 uv) {
      if (curvature <= 0.0) return uv;

      // Center coordinates
      vec2 centered = uv - 0.5;

      // Apply barrel distortion
      float r2 = dot(centered, centered);
      float distortion = 1.0 + curvature * r2;

      vec2 curved = centered * distortion + 0.5;

      return curved;
    }

    // ========================================
    // Reflection UV Calculation
    // ========================================

    vec2 calculateReflectionUV(vec2 bezelUV, vec2 screenCenter) {
      // Calculate vector from current point to screen center
      vec2 toCenter = screenCenter - bezelUV;

      // Create reflection by bouncing toward center
      // Strength of 0.3 creates subtle reflection that follows screen content
      vec2 reflectUV = bezelUV + toCenter * 0.3;

      // Clamp to valid texture coordinates
      return clamp(reflectUV, vec2(0.0), vec2(1.0));
    }

    // ========================================
    // Random Noise for Flicker
    // ========================================

    float random(float seed) {
      return fract(sin(seed) * 43758.5453);
    }

    // ========================================
    // CRT Screen Rendering
    // ========================================

    vec3 renderScreen(vec2 curvedUV) {
      // Chromatic aberration - sample RGB channels separately
      float r = texture2D(tDiffuse, curvedUV + vec2(chromaticAberration, 0.0)).r;
      float g = texture2D(tDiffuse, curvedUV).g;
      float b = texture2D(tDiffuse, curvedUV - vec2(chromaticAberration, 0.0)).b;
      vec3 color = vec3(r, g, b);

      // Scanlines - horizontal dark lines
      float scanline = sin(curvedUV.y * scanlineCount * 3.14159 * 2.0) * 0.5 + 0.5;
      scanline = mix(1.0, scanline, scanlineIntensity);
      color *= scanline;

      // Vignette - darken corners
      vec2 toCenter = curvedUV - 0.5;
      float dist = length(toCenter);
      float vignette = smoothstep(vignetteRadius, vignetteRadius - 0.5, dist);
      vignette = mix(1.0, vignette, vignetteIntensity);
      color *= vignette;

      // Subtle flicker (like old CRT power fluctuation)
      float flicker = 1.0 - flickerIntensity + flickerIntensity * (0.95 + 0.05 * sin(time * 60.0 + random(floor(time * 60.0))));
      color *= flicker;

      // Brightness and contrast adjustments
      color = (color - 0.5) * contrast + 0.5; // Contrast
      color *= brightness; // Brightness

      return color;
    }

    // ========================================
    // Bezel Rendering with Reflections
    // ========================================

    vec3 renderBezel(vec2 bezelUV, float distToScreen) {
      vec2 screenCenter = vec2(0.5);

      // Calculate reflection UV
      vec2 reflectUV = calculateReflectionUV(bezelUV, screenCenter);

      // Sample reflection - use simple texture2D for compatibility
      vec3 reflection = texture2D(tDiffuse, reflectUV).rgb;

      // Calculate Fresnel effect
      // Approximate view direction from UV position
      vec3 viewDir = normalize(vec3(bezelUV - 0.5, 1.0));
      vec3 normal = vec3(0.0, 0.0, 1.0); // Facing viewer
      float cosTheta = max(dot(viewDir, normal), 0.0);
      float fresnel = fresnelSchlick(cosTheta, bezelFresnelBase, bezelFresnelPower);

      // Edge highlight - brighten near screen edge
      float edgeWidth = bezelMargin;
      float edgeFade = smoothstep(edgeWidth, edgeWidth * 0.3, distToScreen);
      float edgeBoost = 1.0 + bezelEdgeHighlight * (1.0 - edgeFade);

      // Corner attenuation - darken corners
      vec2 corner = max(abs(bezelUV - 0.5) - vec2(0.5 - bezelCornerFade), 0.0);
      float cornerFade = 1.0 - smoothstep(0.0, bezelCornerFade, length(corner));

      // Combine: base color + reflection modulated by fresnel and edge effects
      vec3 bezelReflection = reflection * bezelReflectionStrength * edgeBoost * cornerFade;

      // Mix base color with reflection based on fresnel
      vec3 finalBezel = bezelColor + bezelReflection * fresnel;

      return finalBezel;
    }

    // ========================================
    // Main Rendering
    // ========================================

    void main() {
      vec2 uv = vUv;

      if (!bezelEnabled) {
        // Bezel disabled - render screen only with CRT effects
        vec2 curvedUV = curveUV(uv);

        // Check if outside curved screen bounds
        if (curvedUV.x < 0.0 || curvedUV.x > 1.0 || curvedUV.y < 0.0 || curvedUV.y > 1.0) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
          return;
        }

        vec3 color = renderScreen(curvedUV);
        color = clamp(color, 0.0, 1.0);
        gl_FragColor = vec4(color, 1.0);
        return;
      }

      // Bezel enabled - expand UV to bezel space
      vec2 bezelUV = (uv - 0.5) * (1.0 + bezelMargin * 2.0) + 0.5;

      // Calculate signed distance to screen edge
      float distToScreen = sdBox(bezelUV - 0.5, vec2(0.5));

      if (distToScreen > 0.0) {
        // Bezel region - render reflection
        vec3 bezelColor = renderBezel(bezelUV, distToScreen);
        gl_FragColor = vec4(bezelColor, 1.0);
      } else {
        // Screen region - use bezelUV (already in 0-1 range for screen area)
        vec2 screenUV = bezelUV; // bezelUV is in 0-1 when inside screen box
        vec2 curvedUV = curveUV(screenUV);

        // Check if outside curved screen bounds
        if (curvedUV.x < 0.0 || curvedUV.x > 1.0 || curvedUV.y < 0.0 || curvedUV.y > 1.0) {
          // Transition to bezel at screen edge
          vec3 bezelColor = renderBezel(bezelUV, distToScreen);
          gl_FragColor = vec4(bezelColor, 1.0);
          return;
        }

        vec3 screenColor = renderScreen(curvedUV);

        // Smooth transition at screen/bezel edge
        float edgeBlend = smoothstep(-2.0/resolution.x, 2.0/resolution.x, distToScreen);
        vec3 bezelEdgeColor = renderBezel(bezelUV, distToScreen);
        vec3 finalColor = mix(screenColor, bezelEdgeColor, edgeBlend);

        finalColor = clamp(finalColor, 0.0, 1.0);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    }
  `
};
