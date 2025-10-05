import * as THREE from 'three';

/**
 * Disharmonic Glitch Shader
 * Creates RGB separation and glitch effects (Disharmonic mode pickup)
 */
export const DisharmonicShader = {
  uniforms: {
    tDiffuse: { value: null },
    disharmonicValue: { value: 0.0 }, // 0-1 glitch intensity (from game state)
    time: { value: 0.0 }
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

      // Add horizontal glitch displacement
      float glitchLine = floor(uv.y * 100.0);
      float glitchTime = floor(time * 10.0);
      float glitchRandom = hash(vec2(glitchLine, glitchTime));

      // Only glitch certain lines randomly
      if (glitchRandom > 0.9) {
        float glitchOffset = (glitchRandom - 0.9) * 10.0 * disharmonicValue * 0.1;
        uv.x += glitchOffset;
      }

      // Sample RGB channels separately for chromatic aberration effect
      float r = texture2D(tDiffuse, uv + vec2(separation, 0.0)).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - vec2(separation, 0.0)).b;

      // Add some color inversion on glitched lines
      if (glitchRandom > 0.95) {
        r = 1.0 - r;
        g = 1.0 - g;
        b = 1.0 - b;
      }

      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `
};
