import { Filter, GlProgram, GpuProgram } from 'pixi.js';

// Authentic CRT shader with scanlines, phosphor glow, and barrel distortion
const vertex = `
in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vScreenCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
    // Pass normalized screen coordinates (0-1) for perfectly symmetric distortion
    vScreenCoord = aPosition;
}
`;

const fragment = `
precision mediump float;

in vec2 vTextureCoord;
in vec2 vScreenCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uTime;
uniform float uCurvature;
uniform float uScanlineIntensity;
uniform float uVignetteIntensity;
uniform float uNoiseIntensity;
uniform float uBrightness;
uniform float uResolutionX;
uniform float uResolutionY;
uniform float uChromaticAberration;
uniform float uDisharmonic;
uniform vec2 uCenterOffset;
uniform float uBezelSize;
uniform float uReflectionOpacity;
uniform float uBorderNormalized;  // Inner edge of reflections (where border is, 12px)
uniform float uReflectionWidth;   // Outer edge of reflections (50px)

// CRT barrel distortion for square display
vec2 curveRemapUV(vec2 uv) {
    // Apply center offset to correct misalignment
    uv = uv + uCenterOffset;

    // Center coordinates (range -1 to 1)
    vec2 centered = uv * 2.0 - 1.0;

    // Apply classic barrel distortion with corner enhancement
    // This creates gentle outward curvature like a real CRT
    float curveAmount = 1.0 / uCurvature;
    float r2 = centered.x * centered.x + centered.y * centered.y;

    // Add corner-specific distortion using r^4 for more dramatic corners
    float cornerDistortion = r2 * r2 * 0.2; // Gentler corner enhancement
    centered = centered * (1.0 + curveAmount * r2 + curveAmount * cornerDistortion);

    // Return to 0-1 range
    return centered * 0.5 + 0.5;
}

// Scanline effect - uses screen position for even distribution
float scanline(vec2 uv) {
    // Use a fixed scanline count for consistent spacing regardless of stretching
    float scanlineCount = 600.0; // Number of scanlines
    return sin(uv.y * scanlineCount * 3.14159) * uScanlineIntensity + (1.0 - uScanlineIntensity);
}

// Vignette effect
float vignette(vec2 uv) {
    uv = (uv - 0.5) * 2.0;
    return 1.0 - dot(uv, uv) * uVignetteIntensity;
}

// Random noise for authentic CRT feel
float noise(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233)) + uTime) * 43758.5453);
}

// Get reflection from playfield edge
vec4 getBezelReflection(vec2 screenCoord, vec2 texCoordRatio) {
    // Calculate distance from each edge (normalized 0-1, where 0 = at edge, 1 = at opposite edge)
    float distFromTop = screenCoord.y;
    float distFromBottom = 1.0 - screenCoord.y;
    float distFromLeft = screenCoord.x;
    float distFromRight = 1.0 - screenCoord.x;

    // Determine which edge we're closest to
    float minDist = min(min(distFromTop, distFromBottom), min(distFromLeft, distFromRight));

    // Check if we're in the reflection zone (from screen edge outward to uReflectionWidth)
    // Reflections appear from screen edge (0px) outward to reflection width (50px)
    if (minDist >= uReflectionWidth) {
        // Too far from edges - outside reflection area
        return vec4(0.0);
    }

    // Sample coordinates for reflection (in screen space, will convert to texture space)
    vec2 sampleCoord;
    float fadeAmount = 1.0;

    // Reflection depth - how far into the playfield to sample (160px on 800px canvas)
    float reflectionDepth = 0.2; // 160/800 = 0.2

    // Playfield boundaries (where content starts/ends, accounting for border)
    float playfieldTop = uBorderNormalized;
    float playfieldBottom = 1.0 - uBorderNormalized;
    float playfieldLeft = uBorderNormalized;
    float playfieldRight = 1.0 - uBorderNormalized;

    // Calculate normalized depth within reflection zone
    // depth = 0 at screen edge (0), depth = 1 at reflection outer edge (uReflectionWidth)
    float depth = minDist / uReflectionWidth;

    // Calculate fade (1 = at playfield edge, 0 = at screen edge)
    fadeAmount = 1.0 - depth;

    // Determine which edge owns this pixel and calculate symmetric sample coordinate
    if (distFromTop == minDist) {
        // Top edge - sample from inside top playfield boundary, going inward
        sampleCoord = vec2(screenCoord.x, playfieldTop + depth * reflectionDepth);
    }
    else if (distFromBottom == minDist) {
        // Bottom edge - sample from inside bottom playfield boundary, going inward (symmetric to top)
        sampleCoord = vec2(screenCoord.x, playfieldBottom - depth * reflectionDepth);
    }
    else if (distFromLeft == minDist) {
        // Left edge - sample from inside left playfield boundary, going inward
        sampleCoord = vec2(playfieldLeft + depth * reflectionDepth, screenCoord.y);
    }
    else {
        // Right edge - sample from inside right playfield boundary, going inward (symmetric to left)
        sampleCoord = vec2(playfieldRight - depth * reflectionDepth, screenCoord.y);
    }

    // Convert sample coordinate from screen space to texture space
    vec2 texSampleCoord = texCoordRatio * sampleCoord;

    // Perspective distortion: reflections farther from edge should be dimmer and more blurred
    // Calculate depth into the bezel (0 = at playfield edge, 1 = at outer bezel edge)
    float bezelDepth = 1.0 - fadeAmount; // Inverted fadeAmount gives us depth

    // Increase blur based on depth (perspective: farther = more blurred)
    float baseBlur = 0.008; // Larger base blur
    float perspectiveBlur = baseBlur * (1.0 + bezelDepth * 2.0); // Up to 3x blur at outer edge

    // Sample with multi-level blur for soft reflections
    vec4 reflection = vec4(0.0);

    // Inner blur ring (sharp)
    reflection += texture(uTexture, texSampleCoord) * 0.25;
    reflection += texture(uTexture, texSampleCoord + vec2(perspectiveBlur * 0.5, 0.0)) * 0.125;
    reflection += texture(uTexture, texSampleCoord - vec2(perspectiveBlur * 0.5, 0.0)) * 0.125;
    reflection += texture(uTexture, texSampleCoord + vec2(0.0, perspectiveBlur * 0.5)) * 0.125;
    reflection += texture(uTexture, texSampleCoord - vec2(0.0, perspectiveBlur * 0.5)) * 0.125;

    // Outer blur ring (soft)
    reflection += texture(uTexture, texSampleCoord + vec2(perspectiveBlur, 0.0)) * 0.0625;
    reflection += texture(uTexture, texSampleCoord - vec2(perspectiveBlur, 0.0)) * 0.0625;
    reflection += texture(uTexture, texSampleCoord + vec2(0.0, perspectiveBlur)) * 0.0625;
    reflection += texture(uTexture, texSampleCoord - vec2(0.0, perspectiveBlur)) * 0.0625;

    // Apply fade based on distance from edge
    reflection.rgb *= fadeAmount * uReflectionOpacity;

    // Perspective dimming: reflections farther from playfield are dimmer (like real reflections receding)
    float perspectiveDim = 1.0 - (bezelDepth * 0.2); // Up to 20% dimmer at outer edge (reduced for brighter reflections)
    reflection.rgb *= perspectiveDim;

    // Additional corner darkening to hide visual artifacts
    if (minDist < uReflectionWidth) {
        // Darken corners slightly within reflection zone
        float cornerDarken = smoothstep(uBorderNormalized, uReflectionWidth, minDist);
        reflection.rgb *= mix(0.5, 1.0, cornerDarken); // Lighter corners (50% brightness) for brighter overall reflections
    }

    return reflection;
}

void main(void) {
    // Check if this is the reflection-only layer (uReflectionOpacity > 0 with minimal curvature)
    bool isReflectionLayer = (uReflectionOpacity > 0.0 && uCurvature < 1.0);

    if (isReflectionLayer) {
        // Reflection layer: render ONLY reflections in bezel areas, black everywhere else
        vec2 texCoordRatio = vTextureCoord / vScreenCoord;
        vec4 bezelReflection = getBezelReflection(vScreenCoord, texCoordRatio);

        if (bezelReflection.a > 0.0 || bezelReflection.r > 0.0 || bezelReflection.g > 0.0 || bezelReflection.b > 0.0) {
            // Show reflection
            finalColor = vec4(bezelReflection.rgb, 1.0);
        } else {
            // Black everywhere else
            finalColor = vec4(0.0, 0.0, 0.0, 1.0);
        }
        return;
    }

    // Playfield layer: render full game with CRT effects, no reflections

    // Apply barrel distortion using perfect screen coordinates for symmetry
    vec2 distortedScreenCoord = curveRemapUV(vScreenCoord);

    // Check if DISTORTED SCREEN COORD is outside bounds (symmetric check in screen space)
    // This is the key: check bounds in screen space BEFORE converting to texture space
    if (distortedScreenCoord.x < 0.0 || distortedScreenCoord.x > 1.0 ||
        distortedScreenCoord.y < 0.0 || distortedScreenCoord.y > 1.0) {
        // Outside curved bounds - transparent to show reflection layer
        finalColor = vec4(0.0, 0.0, 0.0, 0.0);
        return;
    }

    // Calculate the distorted texture coordinate
    // Convert distorted screen space (0-1) to texture space using the original ratio
    vec2 texCoordRatio = vTextureCoord / vScreenCoord;
    vec2 uv = distortedScreenCoord * texCoordRatio;

    // #2 - RGB misalignment in corners (convergence issues)
    vec2 cornerOffset = (uv - 0.5) * 2.0; // -1 to 1 from center
    float cornerDist = length(cornerOffset);
    vec2 rgbMisalign = cornerOffset * cornerDist * 0.003; // Strong misalignment

    // Chromatic aberration with corner misalignment
    vec2 baseOffset = vec2(uChromaticAberration, 0.0);
    vec4 originalColor = texture(uTexture, uv);

    // #6 - Enhanced color fringing at high contrast edges (discrete)
    float edgeDetect = length(texture(uTexture, uv + vec2(0.002, 0.0)).rgb - texture(uTexture, uv - vec2(0.002, 0.0)).rgb);
    float fringeBoost = edgeDetect * 0.5; // More discrete boost

    // Music-reactive RGB bleed - barely visible pulsing based on disharmonics
    float baseBleed = 0.0003; // Barely visible base separation
    float disharmonicBleed = uDisharmonic * 0.002; // Barely visible animation
    vec2 dynamicOffset = vec2(baseBleed + disharmonicBleed, 0.0); // Base + animated

    // Simple RGB separation - only affected by disharmonic
    float r = texture(uTexture, uv - dynamicOffset).r;
    float g = texture(uTexture, uv).g;
    float b = texture(uTexture, uv + dynamicOffset).b;
    vec4 aberratedColor = vec4(r, g, b, 1.0);

    // Always use the aberrated color so we can see the width change
    vec4 color = aberratedColor;

    // Phosphor bloom/glow effect - bright pixels bleed outward
    float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114)); // Luminance
    if (brightness > 0.4) { // Lower threshold to affect more pixels
        // Sample neighboring pixels for bloom with multiple radii
        vec4 bloom = vec4(0.0);
        float bloomRadius1 = 0.003;
        float bloomRadius2 = 0.006;

        // Inner bloom ring
        bloom += texture(uTexture, uv + vec2(bloomRadius1, 0.0));
        bloom += texture(uTexture, uv - vec2(bloomRadius1, 0.0));
        bloom += texture(uTexture, uv + vec2(0.0, bloomRadius1));
        bloom += texture(uTexture, uv - vec2(0.0, bloomRadius1));

        // Outer bloom ring
        bloom += texture(uTexture, uv + vec2(bloomRadius2, 0.0));
        bloom += texture(uTexture, uv - vec2(bloomRadius2, 0.0));
        bloom += texture(uTexture, uv + vec2(0.0, bloomRadius2));
        bloom += texture(uTexture, uv - vec2(0.0, bloomRadius2));

        // Diagonal samples for fuller bloom
        bloom += texture(uTexture, uv + vec2(bloomRadius1, bloomRadius1));
        bloom += texture(uTexture, uv - vec2(bloomRadius1, bloomRadius1));
        bloom += texture(uTexture, uv + vec2(bloomRadius1, -bloomRadius1));
        bloom += texture(uTexture, uv - vec2(bloomRadius1, -bloomRadius1));

        bloom /= 12.0;

        // Add bloom to bright areas - stronger effect
        float bloomStrength = (brightness - 0.4) * 1.2; // Increased strength
        color.rgb = mix(color.rgb, color.rgb + bloom.rgb * 0.5, bloomStrength);
    }

    // Apply scanlines
    // Use original texture coords for evenly spaced scanlines (not distorted uv)
    color.rgb *= scanline(vTextureCoord);

    // RGB shadow mask / aperture grille - simulate individual RGB phosphors (very subtle)
    vec2 maskCoord = vTextureCoord * vec2(uResolutionX, uResolutionY);
    float maskPattern = mod(floor(maskCoord.x), 3.0);

    // Create RGB triads (red, green, blue sub-pixels) - more discrete
    vec3 mask = vec3(1.0);
    if (maskPattern < 1.0) {
        mask = vec3(1.02, 0.98, 0.98); // Red sub-pixel (subtle)
    } else if (maskPattern < 2.0) {
        mask = vec3(0.98, 1.02, 0.98); // Green sub-pixel (subtle)
    } else {
        mask = vec3(0.98, 0.98, 1.02); // Blue sub-pixel (subtle)
    }
    color.rgb *= mask;

    // Apply vignette
    color.rgb *= vignette(uv);

    // Center brightness boost - CRTs are brighter in the center
    vec2 centerDist = (uv - 0.5) * 2.0; // -1 to 1 from center
    float distFromCenter = length(centerDist);
    float centerBrightness = 1.0 + (1.0 - distFromCenter) * 0.15; // 15% brighter in center
    color.rgb *= centerBrightness;

    // Add white noise for authentic CRT static
    // Combine temporal noise (flickering) with spatial noise (grain)
    float temporalNoise = noise(uv * uTime * 0.0001) * uNoiseIntensity * 0.5;
    float spatialNoise = noise(uv * 1000.0 + uTime * 0.01) * uNoiseIntensity * 0.5;
    float whiteNoise = temporalNoise + spatialNoise;
    color.rgb += vec3(whiteNoise);

    // #5 - Screen burn-in simulation - faint ghost of static UI elements
    // Simulate burn-in around the edges where score/UI might be
    float burnInTop = smoothstep(0.05, 0.15, uv.y) * 0.03; // Top of screen
    float burnInBottom = smoothstep(0.95, 0.85, uv.y) * 0.03; // Bottom of screen
    float burnIn = max(burnInTop, burnInBottom);
    color.rgb -= vec3(burnIn); // Darken areas with burn-in

    // Adjust brightness
    color.rgb *= uBrightness;

    // #9 - AC hum flicker - subtle 60Hz brightness pulsing
    float humFrequency = 60.0; // 60Hz
    float humFlicker = sin(uTime * humFrequency * 6.28318) * 0.015 + 1.0; // ±1.5% flicker
    color.rgb *= humFlicker;

    // Slight phosphor glow simulation (green tint)
    color.g += 0.02;

    finalColor = color;
}
`;

export interface CRTShaderOptions {
  time?: number;
  curvature?: number;
  scanlineIntensity?: number;
  vignetteIntensity?: number;
  noiseIntensity?: number;
  brightness?: number;
  chromaticAberration?: number;
  disharmonic?: number;
  bezelSize?: number;
  reflectionOpacity?: number;
  borderNormalized?: number;
  reflectionWidth?: number;
}

export class CRTFilter extends Filter {
  constructor(options: CRTShaderOptions = {}) {
    const gpuProgram = GpuProgram.from({
      vertex: {
        source: vertex,
        entryPoint: 'main',
      },
      fragment: {
        source: fragment,
        entryPoint: 'main',
      },
    });

    const glProgram = GlProgram.from({
      vertex,
      fragment,
      name: 'crt-filter',
    });

    // Pass uniforms through resources with explicit type definitions for PixiJS v8
    // Note: Using separate float values instead of vec2 to avoid PixiJS v8 bug #11359
    super({
      gpuProgram,
      glProgram,
      resources: {
        crtUniforms: {
          uTime: { value: options.time || 0, type: 'f32' },
          uCurvature: { value: options.curvature || 4.5, type: 'f32' }, // Lower = more curve
          uScanlineIntensity: { value: options.scanlineIntensity || 0.15, type: 'f32' },
          uVignetteIntensity: { value: options.vignetteIntensity || 0.3, type: 'f32' },
          uNoiseIntensity: { value: options.noiseIntensity || 0.03, type: 'f32' },
          uBrightness: { value: options.brightness || 1.1, type: 'f32' },
          uResolutionX: { value: 800, type: 'f32' },
          uResolutionY: { value: 800, type: 'f32' },
          uChromaticAberration: { value: options.chromaticAberration || 0.001, type: 'f32' },
          uDisharmonic: { value: options.disharmonic || 0.0, type: 'f32' },
          uCenterOffset: { value: [0.0, 0.0], type: 'vec2<f32>' }, // Perfect center
          uBezelSize: { value: options.bezelSize || 0.03125, type: 'f32' }, // Default 25px on 800px canvas
          uReflectionOpacity: { value: options.reflectionOpacity || 1.5, type: 'f32' },
          uBorderNormalized: { value: options.borderNormalized || 0.015, type: 'f32' }, // Default 12px on 800px canvas (inner edge of reflections)
          uReflectionWidth: { value: options.reflectionWidth || 0.0625, type: 'f32' }, // Default 50px on 800px canvas (outer edge of reflections)
        },
      },
    });
  }

}