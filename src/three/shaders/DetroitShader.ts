import * as THREE from 'three';

/**
 * Detroit Rainbow Shader
 * Creates rainbow scanlines synced to 130 BPM music (Detroit mode pickup)
 */
export const DetroitShader = {
  uniforms: {
    tDiffuse: { value: null },
    beatPhase: { value: 0.0 }, // 0-1 normalized to beat (updated from music)
    intensity: { value: 0.5 }, // How strong the rainbow effect is
    resolution: { value: new THREE.Vector2(800, 800) }
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
    uniform float beatPhase;
    uniform float intensity;
    uniform vec2 resolution;

    varying vec2 vUv;

    // HSL to RGB conversion
    vec3 hsl2rgb(vec3 c) {
      vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
      return c.z + c.y * (rgb - 0.5) * (1.0 - abs(2.0 * c.z - 1.0));
    }

    void main() {
      vec3 color = texture2D(tDiffuse, vUv).rgb;

      // Create rainbow based on Y position + beat phase
      float scanlineY = vUv.y * 10.0 + beatPhase * 5.0;
      float hue = fract(scanlineY);

      // Create rainbow color (full saturation, medium lightness)
      vec3 rainbow = hsl2rgb(vec3(hue, 0.8, 0.5));

      // Create scanline pattern
      float scanline = sin(vUv.y * resolution.y * 2.0) * 0.5 + 0.5;

      // Blend rainbow with original based on scanline and intensity
      color = mix(color, rainbow, scanline * intensity);

      gl_FragColor = vec4(color, 1.0);
    }
  `
};
