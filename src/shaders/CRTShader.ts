import { Filter, GlProgram, GpuProgram } from 'pixi.js';

// Authentic CRT shader with scanlines, phosphor glow, and barrel distortion v2
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
uniform sampler2D uFrameTexture;  // Mega bezel frame texture
uniform sampler2D uTubeShadowTexture; // Tube shadow texture
uniform float uFrameOpacity;
uniform float uFrameHighlight;
uniform float uFrameShadowWidth;

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

// Corner masking function from mega bezel - creates smooth rounded corners
float getCornerMask(vec2 coord, float aspectRatio, float cornerRadius, float edgeSharpness) {
    // Convert to centered coordinates (-0.5 to 0.5)
    vec2 centered = coord - 0.5;

    // Scale by aspect ratio for proper corners
    vec2 newCoord = min(coord, vec2(1.0) - coord) * vec2(aspectRatio, 1.0);
    vec2 cornerDistance = vec2(max(cornerRadius / 1000.0, (1.0 - edgeSharpness) * 0.01));
    newCoord = cornerDistance - min(newCoord, cornerDistance);
    float distance = sqrt(dot(newCoord, newCoord));

    return clamp((cornerDistance.x - distance) * (edgeSharpness * 500.0 + 100.0), 0.0, 1.0);
}

// Get various mask regions for frame composition
float getTubeMask(vec2 coord) {
    // The playfield/tube area - where the game is rendered
    float cornerRadius = 0.03; // Adjust for desired corner roundness
    return getCornerMask(coord, 1.0, cornerRadius * 1000.0, 0.99);
}

float getBezelMask(vec2 coord) {
    // Bezel is slightly larger than tube (not used for frame, kept for reference)
    vec2 expandedCoord = (coord - 0.5) * 0.95 + 0.5;
    float cornerRadius = 0.035;
    return 1.0 - getCornerMask(expandedCoord, 1.0, cornerRadius * 1000.0, 0.95);
}

float getFrameMask(vec2 coord) {
    // Frame is the outer boundary - everything outside this is beyond the monitor
    // Make frame extend much further out (smaller scale = bigger frame)
    vec2 expandedCoord = (coord - 0.5) * 0.75 + 0.5; // 75% scale = 25% frame on each side
    float cornerRadius = 0.06;
    return 1.0 - getCornerMask(expandedCoord, 1.0, cornerRadius * 1000.0, 0.90);
}

// Get reflection from playfield edge
// curvedCoord: the coordinate AFTER curvature has been applied (this is where we are on the curved surface)
// flatCoord: the original flat coordinate (this is where we sample the texture from)
vec4 getBezelReflection(vec2 curvedCoord, vec2 flatCoord, vec2 texCoordRatio) {
    // Early exit if reflections are disabled
    if (uReflectionOpacity <= 0.0) {
        return vec4(0.0);
    }

    // Calculate distance from each edge using CURVED coordinates
    // This makes the reflection zones follow the curved surface
    float distFromTop = curvedCoord.y;
    float distFromBottom = 1.0 - curvedCoord.y;
    float distFromLeft = curvedCoord.x;
    float distFromRight = 1.0 - curvedCoord.x;

    // Determine which edge we're closest to on the CURVED surface
    float minDist = min(min(distFromTop, distFromBottom), min(distFromLeft, distFromRight));

    // Check if we're in the reflection zone (from screen edge outward to uReflectionWidth)
    // Reflections appear from screen edge (0px) outward to reflection width (50px)
    if (minDist >= uReflectionWidth) {
        // Too far from edges - outside reflection area
        return vec4(0.0);
    }

    // Hide reflections in corner areas - they cause pink artifacts
    // Only hide if we're near both horizontal AND vertical edges (actual corners)
    float distFromHorizontalEdge = min(distFromTop, distFromBottom);
    float distFromVerticalEdge = min(distFromLeft, distFromRight);

    // If close to both edges simultaneously, we're in a corner - hide reflection
    if (distFromHorizontalEdge < uReflectionWidth && distFromVerticalEdge < uReflectionWidth) {
        // Fade out reflections in corners
        float cornerFade = max(distFromHorizontalEdge, distFromVerticalEdge) / uReflectionWidth;
        if (cornerFade < 0.5) {
            return vec4(0.0);
        }
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

    // Sample from the FLAT (pre-curve) texture, but use CURVED coordinates to determine position
    // This creates the illusion of reflections on curved glass
    // We need to sample the BORDER which exists between screen edge and playfieldTop/Bottom/Left/Right
    // The border region: from 0.0 to uBorderNormalized on each side
    // We want to sample: border region + some playfield content

    // Hardcoded sampling parameters found through interactive tuning
    // These values capture the yellow border in reflections
    float sampleStart;
    float totalDepth;

    if (distFromTop == minDist) {
        sampleStart = 0.08;
        totalDepth = 0.09;
        // Top edge - sample from screen edge (0.0), going into playfield
        sampleCoord = vec2(flatCoord.x, sampleStart + depth * totalDepth);
    }
    else if (distFromBottom == minDist) {
        sampleStart = 0.08;
        totalDepth = 0.09;
        // Bottom edge - sample from screen edge, going into playfield
        sampleCoord = vec2(flatCoord.x, 1.0 - (sampleStart + depth * totalDepth));
    }
    else if (distFromLeft == minDist) {
        sampleStart = 0.10;
        totalDepth = 0.11;
        // Left edge - sample from screen edge, going into playfield
        sampleCoord = vec2(sampleStart + depth * totalDepth, flatCoord.y);
    }
    else {
        sampleStart = 0.09;
        totalDepth = 0.10;
        // Right edge - sample from screen edge, going into playfield
        sampleCoord = vec2(1.0 - (sampleStart + depth * totalDepth), flatCoord.y);
    }

    // Convert sample coordinate from screen space to texture space
    vec2 texSampleCoord = texCoordRatio * sampleCoord;

    // Flip reflections within their own regions (mirror effect like real glass)
    // Flip the entire sampling range from 0.0 to totalDepth
    if (distFromTop == minDist) {
        // Top reflection: flip upside down from 0.0 to totalDepth
        float topBound = 0.0;
        float sampleBound = texCoordRatio.y * totalDepth;
        float localY = texSampleCoord.y - topBound;
        float regionHeight = sampleBound - topBound;
        texSampleCoord.y = topBound + (regionHeight - localY);
    }
    else if (distFromBottom == minDist) {
        // Bottom reflection: flip upside down from (1.0 - totalDepth) to 1.0
        float bottomBound = texCoordRatio.y;
        float sampleBound = texCoordRatio.y * (1.0 - totalDepth);
        float localY = texSampleCoord.y - sampleBound;
        float regionHeight = bottomBound - sampleBound;
        texSampleCoord.y = sampleBound + (regionHeight - localY);
    }
    else if (distFromLeft == minDist) {
        // Left reflection: flip horizontally from 0.0 to totalDepth
        float leftBound = 0.0;
        float sampleBound = texCoordRatio.x * totalDepth;
        float localX = texSampleCoord.x - leftBound;
        float regionWidth = sampleBound - leftBound;
        texSampleCoord.x = leftBound + (regionWidth - localX);
    }
    else if (distFromRight == minDist) {
        // Right reflection: flip horizontally from (1.0 - totalDepth) to 1.0
        float rightBound = texCoordRatio.x;
        float sampleBound = texCoordRatio.x * (1.0 - totalDepth);
        float localX = texSampleCoord.x - sampleBound;
        float regionWidth = rightBound - sampleBound;
        texSampleCoord.x = sampleBound + (regionWidth - localX);
    }

    // No blur - sharp reflections
    vec4 reflection = texture(uTexture, texSampleCoord);

    // Apply fade based on distance from edge and reflection opacity
    reflection.rgb *= fadeAmount * uReflectionOpacity;

    // Luminance filtering - only show brighter content
    float luminance = dot(reflection.rgb, vec3(0.299, 0.587, 0.114));
    float luminanceFilter = smoothstep(0.1, 0.5, luminance);
    reflection.rgb *= luminanceFilter * 0.8;

    return reflection;
}

// Render beveled bezel background
vec3 renderBeveledBezel(vec2 coord) {
    // Calculate distance from edges
    float distFromTop = coord.y;
    float distFromBottom = 1.0 - coord.y;
    float distFromLeft = coord.x;
    float distFromRight = 1.0 - coord.x;

    float minDistFromEdge = min(min(distFromTop, distFromBottom), min(distFromLeft, distFromRight));

    // Base grey color - darker than frame
    vec3 bezelColor = vec3(0.15, 0.15, 0.15);

    // Bevel effect - lighter at outer edge, darker towards playfield
    float bevelDepth = smoothstep(0.0, uReflectionWidth, minDistFromEdge);

    // Outer highlight (dark grey)
    vec3 highlightColor = vec3(0.25, 0.25, 0.25);
    // Inner shadow (almost black)
    vec3 shadowColor = vec3(0.08, 0.08, 0.08);

    // Mix based on bevel depth
    bezelColor = mix(highlightColor, shadowColor, bevelDepth);

    return bezelColor;
}

// Render the monitor frame with mega bezel technique
vec4 renderFrame(vec2 coord) {
    // Mega Bezel Frame - Proper Implementation
    // Based on libretro/slang-shaders analysis

    float aspectRatio = 1.0; // Assume square for now
    float tubeAspect = 1.0;

    // Step 1: Calculate BEZEL_OUTSIDE_CURVED_COORD (simplified - no curvature)
    vec2 bezelOutsideCoord = coord;

    // Step 2: Calculate FRAME_OUTSIDE_CURVED_COORD (mega bezel technique)
    float frmThickness = 1.0; // HSM_FRM_THICKNESS normalized (100/100 = 1.0)
    vec2 frameOutsideCoord = (bezelOutsideCoord - 0.5) / (frmThickness + 1.0) + 0.5;

    // Step 3: Calculate Masks for outer frame border
    // OUTSIDE_BEZEL_MASK - starts from very outer edge (0.0)
    float outsideBezelMask = 1.0 - getCornerMask(bezelOutsideCoord, tubeAspect, 3.0, 0.98);

    // OUTSIDE_FRAME_MASK - creates inner boundary of frame (starts after bezel+reflections)
    // Frame width should be visible around the bezel area
    vec2 frameCoordCtr = frameOutsideCoord - 0.5;
    float frameInnerBoundary = 0.88; // Smaller = thicker frame
    float outsideFrameMask = 1.0 - getCornerMask(frameCoordCtr + 0.5, tubeAspect, 8.0, frameInnerBoundary);

    // FRAME_MASK = OUTSIDE_BEZEL_MASK * (1 - OUTSIDE_FRAME_MASK)
    float frameMask = outsideBezelMask * (1.0 - outsideFrameMask);

    if (frameMask < 0.01) {
        return vec4(0.0); // Not in frame
    }

    // Step 4: Beveled Frame with highlights and shadows
    vec3 frameBaseColor = vec3(0.25, 0.25, 0.25); // Medium grey

    // Calculate distance from outer edge for bevel effect
    float distFromOuterEdge = min(min(coord.x, 1.0 - coord.x), min(coord.y, 1.0 - coord.y));
    float distFromInnerEdge = min(0.50 - abs(frameCoordCtr.x), 0.50 - abs(frameCoordCtr.y));

    // Outer bevel - lighter highlight at very outer edge
    float outerBevel = smoothstep(0.0, 0.02, distFromOuterEdge);
    vec3 outerHighlight = vec3(0.45, 0.45, 0.45);

    // Inner bevel - darker shadow at inner edge
    float innerBevel = smoothstep(0.0, 0.02, distFromInnerEdge);
    vec3 innerShadow = vec3(0.15, 0.15, 0.15);

    // Combine bevels
    vec3 frameColor = mix(outerHighlight, frameBaseColor, outerBevel);
    frameColor = mix(innerShadow, frameColor, innerBevel);

    // Add subtle noise for texture
    float noiseMask = noise(coord * 200.0);
    frameColor = mix(frameColor, frameColor * 1.1 * noiseMask, 0.15);

    // Step 6: Skip texture for now - it contains unwanted reflections
    // TODO: Use only the grayscale lighting data from texture, not colors
    // vec4 frameTextureSample = texture(uFrameTexture, frameOutsideCoord);
    // vec3 frameTextureColor = frameTextureSample.rgb;
    // frameColor = mix(frameColor, frameTextureColor, 0.5);

    return vec4(frameColor, 1.0);
}

void main(void) {
    // Check if this is the reflection-only layer (uReflectionOpacity > 0 with minimal curvature)
    bool isReflectionLayer = (uReflectionOpacity > 0.0 && uCurvature < 1.0);

    if (isReflectionLayer) {
        // Reflection layer: render ONLY reflections in bezel areas, black everywhere else
        vec2 texCoordRatio = vTextureCoord / vScreenCoord;
        vec4 bezelReflection = getBezelReflection(vScreenCoord, vScreenCoord, texCoordRatio);

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

    // FIRST: Check if we should render the frame (independent of curvature)
    // Frame should render in the bezel area around the playfield
    if (uFrameOpacity > 0.0) {
        vec4 frame = renderFrame(vScreenCoord);
        if (frame.a > 0.01) {
            // We're in the frame region - render the frame
            finalColor = vec4(frame.rgb, 1.0);
            return;
        }
    }

    // Check if DISTORTED SCREEN COORD is outside bounds (symmetric check in screen space)
    // This is the key: check bounds in screen space BEFORE converting to texture space
    if (distortedScreenCoord.x < 0.0 || distortedScreenCoord.x > 1.0 ||
        distortedScreenCoord.y < 0.0 || distortedScreenCoord.y > 1.0) {
        // Outside curved bounds - this is the bezel area (but not frame)

        // Start with beveled bezel background
        vec3 bezelBackground = renderBeveledBezel(vScreenCoord);

        // Render reflections on top of bezel (if enabled)
        if (uReflectionOpacity > 0.0) {
            vec2 texCoordRatio = vTextureCoord / vScreenCoord;
            vec4 bezelReflection = getBezelReflection(distortedScreenCoord, vScreenCoord, texCoordRatio);

            if (bezelReflection.a > 0.0 || bezelReflection.r > 0.0 || bezelReflection.g > 0.0 || bezelReflection.b > 0.0) {
                // Blend reflection over beveled bezel background
                finalColor = vec4(bezelBackground + bezelReflection.rgb, 1.0);
                return;
            }
        }

        // No reflections - show just beveled bezel
        finalColor = vec4(bezelBackground, 1.0);
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
  frameTexture?: any; // PixiJS Texture
  tubeShadowTexture?: any; // PixiJS Texture
  frameOpacity?: number;
  frameHighlight?: number;
  frameShadowWidth?: number;
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
      name: 'crt-filter-v3',
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
          uReflectionOpacity: { value: options.reflectionOpacity !== undefined ? options.reflectionOpacity : 1.5, type: 'f32' },
          uBorderNormalized: { value: options.borderNormalized || 0.015, type: 'f32' }, // Default 12px on 800px canvas (inner edge of reflections)
          uReflectionWidth: { value: options.reflectionWidth || 0.0625, type: 'f32' }, // Default 50px on 800px canvas (outer edge of reflections)
          uFrameOpacity: { value: options.frameOpacity !== undefined ? options.frameOpacity : 0.0, type: 'f32' }, // Off by default
          uFrameHighlight: { value: options.frameHighlight || 1.0, type: 'f32' },
          uFrameShadowWidth: { value: options.frameShadowWidth || 0.02, type: 'f32' },
        },
        // Only add textures if they exist
        ...(options.frameTexture ? { uFrameTexture: options.frameTexture } : {}),
        ...(options.tubeShadowTexture ? { uTubeShadowTexture: options.tubeShadowTexture } : {}),
      },
    });
  }

}