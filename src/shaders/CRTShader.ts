import { Filter, GlProgram, GpuProgram } from 'pixi.js';

// Authentic CRT shader with scanlines, phosphor glow, and barrel distortion
const vertex = `
in vec2 aPosition;
out vec2 vTextureCoord;

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
}
`;

const fragment = `
precision mediump float;

in vec2 vTextureCoord;
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

// CRT barrel distortion with 4:3 aspect ratio correction
vec2 curveRemapUV(vec2 uv) {
    // Center coordinates (range -1 to 1)
    vec2 centered = uv * 2.0 - 1.0;

    // Correct for 4:3 display aspect ratio (being stretched from square 800x800)
    // Since we're stretching horizontally, compress X coordinate before distortion
    centered.x *= 0.75; // 3/4 = 0.75

    // Apply classic barrel distortion
    // This creates gentle outward curvature like a real CRT
    float curveAmount = 1.0 / uCurvature;
    float r2 = centered.x * centered.x + centered.y * centered.y;
    centered = centered * (1.0 + curveAmount * r2);

    // Restore aspect ratio after distortion
    centered.x /= 0.75;

    // Return to 0-1 range
    return centered * 0.5 + 0.5;
}

// Scanline effect
float scanline(vec2 uv) {
    return sin(uv.y * uResolutionY * 2.0) * uScanlineIntensity + (1.0 - uScanlineIntensity);
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

void main(void) {
    // Apply barrel distortion
    vec2 uv = curveRemapUV(vTextureCoord);

    // Check if we're outside the curved screen
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        finalColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }

    // Sample the texture
    vec4 color = texture(uTexture, uv);

    // Apply scanlines
    color.rgb *= scanline(uv);

    // Apply vignette
    color.rgb *= vignette(uv);

    // Add slight noise for authenticity
    float n = noise(uv * uTime * 0.0001) * uNoiseIntensity;
    color.rgb += vec3(n);

    // Adjust brightness
    color.rgb *= uBrightness;

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
          uCurvature: { value: options.curvature || 6.0, type: 'f32' },
          uScanlineIntensity: { value: options.scanlineIntensity || 0.15, type: 'f32' },
          uVignetteIntensity: { value: options.vignetteIntensity || 0.3, type: 'f32' },
          uNoiseIntensity: { value: options.noiseIntensity || 0.03, type: 'f32' },
          uBrightness: { value: options.brightness || 1.1, type: 'f32' },
          uResolutionX: { value: 800, type: 'f32' },
          uResolutionY: { value: 800, type: 'f32' },
        },
      },
    });
  }

}