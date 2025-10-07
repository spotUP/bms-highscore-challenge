/**
 * Specular Reflections Renderer for Mega Bezel
 *
 * Handles advanced lighting effects with specular highlights and reflections:
 * - Specular reflection calculations
 * - Surface material properties (roughness, metallic)
 * - Normal mapping for surface detail
 * - Fresnel effects for realistic reflections
 * - Environment mapping for complex reflections
 */

import * as THREE from 'three';
import { ParameterManager } from './ParameterManager';
import { MegaBezelCoordinateSystem } from './CoordinateSystem';

export interface MaterialProperties {
  roughness: number;
  metallic: number;
  specularPower: number;
  fresnelStrength: number;
  reflectionStrength: number;
}

export interface ReflectionParameters {
  materialProps: MaterialProperties;
  lightDirection: [number, number, number];
  viewPosition: [number, number, number];
  environmentMap?: THREE.Texture;
  normalMap?: THREE.Texture;
}

export class SpecularReflectionsRenderer {
  private renderer: THREE.WebGLRenderer;
  private parameterManager: ParameterManager;
  private coordinateSystem: MegaBezelCoordinateSystem;

  // Reflection render targets
  private reflectionRenderTarget: THREE.WebGLRenderTarget;
  private specularRenderTarget: THREE.WebGLRenderTarget;

  // Reflection materials
  private specularMaterial: THREE.ShaderMaterial;
  private reflectionMaterial: THREE.ShaderMaterial;
  private fresnelMaterial: THREE.ShaderMaterial;

  // Rendering resources
  private quad: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  // Material and reflection parameters
  private materialProps: MaterialProperties;
  private reflectionParams: ReflectionParameters;

  constructor(
    renderer: THREE.WebGLRenderer,
    parameterManager: ParameterManager,
    coordinateSystem: MegaBezelCoordinateSystem
  ) {
    this.renderer = renderer;
    this.parameterManager = parameterManager;
    this.coordinateSystem = coordinateSystem;

    this.initializeMaterialProperties();
    this.initializeReflectionParameters();
    this.initializeRenderTargets();
    this.initializeMaterials();
    this.initializeRenderingResources();
  }

  /**
   * Initialize default material properties
   */
  private initializeMaterialProperties(): void {
    this.materialProps = {
      roughness: 0.3,
      metallic: 0.1,
      specularPower: 64.0,
      fresnelStrength: 0.5,
      reflectionStrength: 0.3
    };
  }

  /**
   * Initialize reflection parameters
   */
  private initializeReflectionParameters(): void {
    this.reflectionParams = {
      materialProps: this.materialProps,
      lightDirection: [0.5, 0.5, 1.0], // Directional light from top-right
      viewPosition: [0.0, 0.0, 1.0]   // Camera position
    };
  }

  /**
   * Initialize render targets for reflection effects
   */
  private initializeRenderTargets(): void {
    const size = this.renderer.getSize(new THREE.Vector2());

    // Reflection render target for environment reflections
    this.reflectionRenderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType
    });

    // Specular render target for specular highlights
    this.specularRenderTarget = new THREE.WebGLRenderTarget(size.x, size.y, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType
    });
  }

  /**
   * Initialize shader materials for reflection effects
   */
  private initializeMaterials(): void {
    // Specular highlight material
    this.specularMaterial = new THREE.ShaderMaterial({
      uniforms: {
        normalMap: { value: null },
        lightDirection: { value: new THREE.Vector3() },
        viewPosition: { value: new THREE.Vector3() },
        specularPower: { value: this.materialProps.specularPower },
        specularStrength: { value: 1.0 },
        roughness: { value: this.materialProps.roughness }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vLightDir;

        void main() {
          vUv = uv;

          // Transform normal to world space
          vNormal = normalize(normalMatrix * normal);

          // View direction
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPosition.xyz);

          // Light direction (assume directional light)
          vLightDir = normalize(vec3(0.5, 0.5, 1.0));

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D normalMap;
        uniform vec3 lightDirection;
        uniform vec3 viewPosition;
        uniform float specularPower;
        uniform float specularStrength;
        uniform float roughness;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vLightDir;

        void main() {
          // Sample normal map if available
          vec3 normal = vNormal;
          if (normalMap != null) {
            vec3 normalSample = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
            normal = normalize(normalSample);
          }

          // Calculate reflection vector
          vec3 reflectDir = reflect(-vLightDir, normal);

          // Calculate specular term using Blinn-Phong
          vec3 halfwayDir = normalize(vLightDir + vViewDir);
          float specAngle = max(dot(normal, halfwayDir), 0.0);

          // Apply roughness (higher roughness = more spread out specular)
          float roughnessFactor = 1.0 - roughness;
          float specular = pow(specAngle, specularPower * roughnessFactor) * specularStrength;

          // Fresnel effect (more reflection at grazing angles)
          float fresnel = 1.0 - max(dot(vViewDir, normal), 0.0);
          specular *= (0.5 + 0.5 * fresnel);

          gl_FragColor = vec4(vec3(specular), 1.0);
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });

    // Environment reflection material
    this.reflectionMaterial = new THREE.ShaderMaterial({
      uniforms: {
        environmentMap: { value: null },
        normalMap: { value: null },
        reflectionStrength: { value: this.materialProps.reflectionStrength },
        metallic: { value: this.materialProps.metallic },
        viewPosition: { value: new THREE.Vector3() }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vWorldPos;

        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPosition.xyz);
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D environmentMap;
        uniform sampler2D normalMap;
        uniform float reflectionStrength;
        uniform float metallic;
        uniform vec3 viewPosition;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vWorldPos;

        void main() {
          // Sample normal map if available
          vec3 normal = vNormal;
          if (normalMap != null) {
            vec3 normalSample = texture2D(normalMap, vUv).xyz * 2.0 - 1.0;
            normal = normalize(normalSample);
          }

          // Calculate reflection vector
          vec3 reflectDir = reflect(-vViewDir, normal);

          // Convert reflection vector to UV coordinates for environment map
          // Simple spherical mapping (can be improved with cube maps)
          vec2 envUV = vec2(
            atan(reflectDir.z, reflectDir.x) / (2.0 * 3.14159) + 0.5,
            acos(reflectDir.y) / 3.14159
          );

          // Sample environment reflection
          vec3 reflectionColor = vec3(0.0);
          if (environmentMap != null) {
            reflectionColor = texture2D(environmentMap, envUV).rgb;
          } else {
            // Default reflection color (subtle blue tint)
            reflectionColor = vec3(0.7, 0.8, 1.0) * 0.3;
          }

          // Apply metallic and reflection strength
          float metalFactor = metallic;
          vec3 finalReflection = reflectionColor * reflectionStrength * (0.5 + 0.5 * metalFactor);

          // Fresnel effect for more realistic reflections
          float fresnel = 1.0 - max(dot(vViewDir, normal), 0.0);
          finalReflection *= (0.3 + 0.7 * fresnel);

          gl_FragColor = vec4(finalReflection, 1.0);
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });

    // Fresnel effect material for enhanced realism
    this.fresnelMaterial = new THREE.ShaderMaterial({
      uniforms: {
        fresnelStrength: { value: this.materialProps.fresnelStrength },
        fresnelPower: { value: 2.0 },
        baseColor: { value: new THREE.Color(0x000000) },
        fresnelColor: { value: new THREE.Color(0xffffff) }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPosition.xyz);

          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform float fresnelStrength;
        uniform float fresnelPower;
        uniform vec3 baseColor;
        uniform vec3 fresnelColor;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
          // Calculate Fresnel term
          float fresnel = 1.0 - max(dot(vViewDir, vNormal), 0.0);
          fresnel = pow(fresnel, fresnelPower);

          // Mix base color with fresnel color
          vec3 finalColor = mix(baseColor, fresnelColor, fresnel * fresnelStrength);

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
  }

  /**
   * Initialize rendering resources
   */
  private initializeRenderingResources(): void {
    // Create fullscreen quad
    const geometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(geometry);

    // Create scene and camera
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.camera.position.z = 0.5;
  }

  /**
   * Update material and reflection parameters from Mega Bezel parameters
   */
  private updateReflectionParameters(): void {
    // Update from parameter manager
    this.materialProps.roughness = this.parameterManager.getValue('HSM_BEZEL_REFLECTION_ROUGHNESS') || 0.3;
    this.materialProps.metallic = this.parameterManager.getValue('HSM_BEZEL_REFLECTION_METALLIC') || 0.1;
    this.materialProps.specularPower = this.parameterManager.getValue('HSM_BEZEL_REFLECTION_SPECULAR_POWER') || 64.0;
    this.materialProps.fresnelStrength = this.parameterManager.getValue('HSM_BEZEL_REFLECTION_FRESNEL') || 0.5;
    this.materialProps.reflectionStrength = this.parameterManager.getValue('HSM_BEZEL_REFLECTION_STRENGTH') || 0.3;

    // Update shader uniforms
    this.specularMaterial.uniforms.specularPower.value = this.materialProps.specularPower;
    this.specularMaterial.uniforms.roughness.value = this.materialProps.roughness;

    this.reflectionMaterial.uniforms.reflectionStrength.value = this.materialProps.reflectionStrength;
    this.reflectionMaterial.uniforms.metallic.value = this.materialProps.metallic;

    this.fresnelMaterial.uniforms.fresnelStrength.value = this.materialProps.fresnelStrength;
  }

  /**
   * Render specular reflections
   */
  renderSpecular(): THREE.WebGLRenderTarget {
    this.updateReflectionParameters();

    // Set material and render specular highlights
    this.quad.material = this.specularMaterial;

    // Update light and view directions
    this.specularMaterial.uniforms.lightDirection.value.set(
      this.reflectionParams.lightDirection[0],
      this.reflectionParams.lightDirection[1],
      this.reflectionParams.lightDirection[2]
    );
    this.specularMaterial.uniforms.viewPosition.value.set(
      this.reflectionParams.viewPosition[0],
      this.reflectionParams.viewPosition[1],
      this.reflectionParams.viewPosition[2]
    );

    // Set normal map if available
    if (this.reflectionParams.normalMap) {
      this.specularMaterial.uniforms.normalMap.value = this.reflectionParams.normalMap;
    }

    // Render to specular target
    this.renderer.setRenderTarget(this.specularRenderTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    return this.specularRenderTarget;
  }

  /**
   * Render environment reflections
   */
  renderReflections(): THREE.WebGLRenderTarget {
    this.updateReflectionParameters();

    // Set material and render environment reflections
    this.quad.material = this.reflectionMaterial;

    // Update view position
    this.reflectionMaterial.uniforms.viewPosition.value.set(
      this.reflectionParams.viewPosition[0],
      this.reflectionParams.viewPosition[1],
      this.reflectionParams.viewPosition[2]
    );

    // Set environment and normal maps if available
    if (this.reflectionParams.environmentMap) {
      this.reflectionMaterial.uniforms.environmentMap.value = this.reflectionParams.environmentMap;
    }
    if (this.reflectionParams.normalMap) {
      this.reflectionMaterial.uniforms.normalMap.value = this.reflectionParams.normalMap;
    }

    // Render to reflection target
    this.renderer.setRenderTarget(this.reflectionRenderTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    return this.reflectionRenderTarget;
  }

  /**
   * Render Fresnel effects
   */
  renderFresnel(): THREE.WebGLRenderTarget {
    this.updateReflectionParameters();

    // Set material and render Fresnel effects
    this.quad.material = this.fresnelMaterial;

    // Render to reflection target (reuse for Fresnel)
    this.renderer.setRenderTarget(this.reflectionRenderTarget);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    return this.reflectionRenderTarget;
  }

  /**
   * Render all reflection effects combined
   */
  renderAllReflections(): {
    specular: THREE.WebGLRenderTarget;
    reflections: THREE.WebGLRenderTarget;
    fresnel: THREE.WebGLRenderTarget;
  } {
    const specular = this.renderSpecular();
    const reflections = this.renderReflections();
    const fresnel = this.renderFresnel();

    return { specular, reflections, fresnel };
  }

  /**
   * Get specular texture
   */
  getSpecularTexture(): THREE.Texture {
    return this.specularRenderTarget.texture;
  }

  /**
   * Get reflection texture
   */
  getReflectionTexture(): THREE.Texture {
    return this.reflectionRenderTarget.texture;
  }

  /**
   * Set environment map for reflections
   */
  setEnvironmentMap(texture: THREE.Texture): void {
    this.reflectionParams.environmentMap = texture;
  }

  /**
   * Set normal map for surface detail
   */
  setNormalMap(texture: THREE.Texture): void {
    this.reflectionParams.normalMap = texture;
  }

  /**
   * Set light direction
   */
  setLightDirection(direction: [number, number, number]): void {
    this.reflectionParams.lightDirection = direction;
  }

  /**
   * Set view position
   */
  setViewPosition(position: [number, number, number]): void {
    this.reflectionParams.viewPosition = position;
  }

  /**
   * Update material properties
   */
  setMaterialProperties(props: Partial<MaterialProperties>): void {
    Object.assign(this.materialProps, props);
    this.reflectionParams.materialProps = this.materialProps;
  }

  /**
   * Resize render targets
   */
  resize(width: number, height: number): void {
    this.reflectionRenderTarget.setSize(width, height);
    this.specularRenderTarget.setSize(width, height);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.reflectionRenderTarget.dispose();
    this.specularRenderTarget.dispose();
    this.specularMaterial.dispose();
    this.reflectionMaterial.dispose();
    this.fresnelMaterial.dispose();
    this.quad.geometry.dispose();
  }

  /**
   * Get current material properties
   */
  getMaterialProperties(): MaterialProperties {
    return { ...this.materialProps };
  }

  /**
   * Get current reflection parameters
   */
  getReflectionParameters(): ReflectionParameters {
    return { ...this.reflectionParams };
  }
}