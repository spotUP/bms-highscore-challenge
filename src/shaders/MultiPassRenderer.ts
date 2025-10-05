/**
 * MultiPassRenderer - Three.js multi-pass shader rendering pipeline
 *
 * Manages execution of Slang shader presets with multiple passes,
 * handling render targets, texture bindings, and parameter management.
 */

import * as THREE from 'three';
import { SlangPreset, SlangShaderPass } from './SlangPresetParser';
import { SlangShaderCompiler, CompiledShader } from './SlangShaderCompiler';

export interface RenderPassConfig {
  // Compiled shader
  shader: CompiledShader;

  // Preset configuration
  config: SlangShaderPass;

  // Three.js material
  material: THREE.ShaderMaterial;

  // Render target (null for final pass)
  renderTarget: THREE.WebGLRenderTarget | null;

  // Alias for referencing in other passes
  alias?: string;
}

export interface MultiPassRendererOptions {
  // Input texture size
  width: number;
  height: number;

  // WebGL 2.0 support
  webgl2?: boolean;

  // Frame history depth (for temporal effects)
  historyDepth?: number;

  // Pixel ratio
  pixelRatio?: number;
}

export class MultiPassRenderer {
  private renderer: THREE.WebGLRenderer;
  private preset: SlangPreset;
  private passes: RenderPassConfig[] = [];

  // Fullscreen quad for rendering
  private quad: THREE.Mesh;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;

  // Input texture (game content)
  private inputTexture: THREE.Texture | null = null;

  // External textures (LUTs, backgrounds, etc.)
  private externalTextures: Map<string, THREE.Texture> = new Map();

  // Frame history buffers
  private historyBuffers: THREE.WebGLRenderTarget[] = [];
  private historyDepth: number;
  private currentHistoryIndex: number = 0;

  // Render target dimensions
  private baseWidth: number;
  private baseHeight: number;

  // Frame counter
  private frameCount: number = 0;

  // WebGL version
  private webgl2: boolean;

  // Pixel ratio
  private pixelRatio: number;

  constructor(
    renderer: THREE.WebGLRenderer,
    preset: SlangPreset,
    options: MultiPassRendererOptions
  ) {
    this.renderer = renderer;
    this.preset = preset;
    this.baseWidth = options.width;
    this.baseHeight = options.height;
    this.webgl2 = options.webgl2 ?? true;
    this.historyDepth = options.historyDepth ?? 4;
    this.pixelRatio = options.pixelRatio ?? 1.0;

    // Create scene for fullscreen quad
    this.scene = new THREE.Scene();
    this.scene.background = null; // No background - transparent
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Create fullscreen quad
    const quadGeometry = new THREE.PlaneGeometry(2, 2);
    this.quad = new THREE.Mesh(quadGeometry);
    this.quad.position.z = 0.5; // Position in middle of frustum (near=0, far=1)
    this.scene.add(this.quad);

    // Initialize frame history
    this.initializeHistory();

    console.log('[MultiPassRenderer] Initialized with', preset.passes.length, 'passes');
  }

  /**
   * Initialize frame history buffers
   */
  private initializeHistory(): void {
    for (let i = 0; i < this.historyDepth; i++) {
      const target = new THREE.WebGLRenderTarget(this.baseWidth, this.baseHeight, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType
      });
      this.historyBuffers.push(target);
    }

    console.log('[MultiPassRenderer] Created', this.historyDepth, 'history buffers');
  }

  /**
   * Load shaders and compile passes
   */
  public async loadShaders(shaderLoader?: (path: string) => Promise<string>): Promise<void> {
    console.log('[MultiPassRenderer] Loading shaders...');

    for (let i = 0; i < this.preset.passes.length; i++) {
      const passConfig = this.preset.passes[i];

      // Construct shader path
      // basePath may include the preset filename (e.g., /shaders/mega-bezel/potato.slangp)
      // Extract just the directory
      let baseDir = this.preset.basePath || '';
      if (baseDir) {
        const lastSlash = baseDir.lastIndexOf('/');
        if (lastSlash !== -1) {
          // Check if there's a file extension after the last slash
          const afterSlash = baseDir.substring(lastSlash + 1);
          if (afterSlash.includes('.')) {
            // Has file extension, extract directory
            baseDir = baseDir.substring(0, lastSlash);
          }
        }
      }

      const shaderPath = passConfig.shader;
      const fullPath = baseDir ? `${baseDir}/${shaderPath}` : shaderPath;

      console.log(`[MultiPassRenderer] Loading shader ${i}: ${fullPath}`);

      // Compile shader using loadFromURL (includes #include preprocessing)
      const compiled = await SlangShaderCompiler.loadFromURL(fullPath, this.webgl2);

      // Create material
      const material = this.createMaterial(compiled, passConfig, i);

      // Create render target (if not final pass)
      const renderTarget = i < this.preset.passes.length - 1
        ? this.createRenderTarget(passConfig, i)
        : null;

      // Store pass
      this.passes.push({
        shader: compiled,
        config: passConfig,
        material,
        renderTarget,
        alias: passConfig.alias
      });

      console.log(`[MultiPassRenderer] Compiled pass ${i}: ${compiled.parameters.length} params, ` +
                  `${compiled.uniforms.length} uniforms, ${compiled.samplers.length} samplers`);
    }

    console.log('[MultiPassRenderer] All shaders loaded and compiled');

    // Load textures after shaders
    await this.loadTextures();
  }

  /**
   * Load external textures (LUTs, backgrounds, etc.)
   */
  private async loadTextures(): Promise<void> {
    if (this.preset.textures.length === 0) {
      console.log('[MultiPassRenderer] No external textures to load');
      return;
    }

    console.log('[MultiPassRenderer] Loading', this.preset.textures.length, 'external textures...');

    const loader = new THREE.TextureLoader();

    // Extract base directory from preset path
    let baseDir = this.preset.basePath || '';
    if (baseDir) {
      const lastSlash = baseDir.lastIndexOf('/');
      if (lastSlash !== -1) {
        const afterSlash = baseDir.substring(lastSlash + 1);
        if (afterSlash.includes('.')) {
          baseDir = baseDir.substring(0, lastSlash);
        }
      }
    }

    for (const tex of this.preset.textures) {
      const fullPath = baseDir ? `${baseDir}/${tex.path}` : tex.path;

      try {
        const texture = await new Promise<THREE.Texture>((resolve, reject) => {
          loader.load(
            fullPath,
            resolve,
            undefined,
            (err) => reject(new Error(`Failed to load texture: ${err.message}`))
          );
        });

        // Apply texture parameters
        texture.minFilter = tex.filter === 'linear' ? THREE.LinearFilter : THREE.NearestFilter;
        texture.magFilter = tex.filter === 'linear' ? THREE.LinearFilter : THREE.NearestFilter;
        texture.wrapS = tex.wrapMode === 'repeat' ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
        texture.wrapT = tex.wrapMode === 'repeat' ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;

        if (tex.mipmap) {
          texture.generateMipmaps = true;
        }

        this.externalTextures.set(tex.name, texture);
        console.log('[MultiPassRenderer] Loaded texture:', tex.name, 'from', fullPath);
      } catch (err) {
        console.warn('[MultiPassRenderer] Failed to load texture', tex.name, ':', err);
        // Create a 1x1 fallback texture
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 1, 1);
        const fallbackTexture = new THREE.CanvasTexture(canvas);
        this.externalTextures.set(tex.name, fallbackTexture);
      }
    }

    console.log('[MultiPassRenderer] All textures loaded');
  }

  /**
   * Create Three.js material from compiled shader
   */
  private createMaterial(
    compiled: CompiledShader,
    config: SlangShaderPass,
    passIndex: number
  ): THREE.ShaderMaterial {
    // Build uniforms
    const uniforms: Record<string, THREE.IUniform> = {};

    // Standard uniforms
    uniforms.MVP = { value: new THREE.Matrix4() };
    uniforms.OutputSize = { value: new THREE.Vector4() };
    uniforms.OriginalSize = { value: new THREE.Vector4(this.baseWidth, this.baseHeight, 1.0 / this.baseWidth, 1.0 / this.baseHeight) };
    uniforms.SourceSize = { value: new THREE.Vector4() };
    uniforms.OriginalFeedbackSize = { value: new THREE.Vector4() };
    uniforms.FinalViewportSize = { value: new THREE.Vector4() };
    uniforms.DerezedPassSize = { value: new THREE.Vector4() };
    uniforms.FrameDirection = { value: 1.0 };
    uniforms.FrameCount = { value: 0 };

    // Source texture (from previous pass)
    uniforms.Source = { value: null };

    // Original texture (initial input)
    uniforms.Original = { value: null };

    // History textures
    for (let i = 0; i < this.historyDepth; i++) {
      uniforms[`OriginalHistory${i + 1}`] = { value: null };
    }

    // Shader parameters (from compiled shader)
    compiled.parameters.forEach(param => {
      uniforms[param.name] = { value: param.default };
    });

    // Apply parameter overrides from preset
    this.preset.parameters.forEach(paramOverride => {
      if (uniforms[paramOverride.name]) {
        uniforms[paramOverride.name].value = paramOverride.value;
      }
    });

    // Sampler uniforms (for aliased textures and custom samplers)
    compiled.samplers.forEach(samplerName => {
      if (!uniforms[samplerName]) {
        // Check if this is an external texture
        const externalTexture = this.externalTextures.get(samplerName);
        uniforms[samplerName] = { value: externalTexture || null };

        if (externalTexture) {
          console.log(`[MultiPassRenderer] Bound external texture '${samplerName}' to pass ${passIndex}`);
        }
      }
    });

    // Debug: Log compiled fragment shader for first pass
    if (passIndex === 0 || passIndex === 4) { // Log pass 0 and pass 4 (hsm-grade.slang)
      console.log(`[MultiPass] Pass ${passIndex} compiled fragment shader (first 5000 chars):`);
      console.log(compiled.fragment.substring(0, 5000));
      console.log(`[MultiPass] Pass ${passIndex} total fragment length: ${compiled.fragment.length}`);
    }

    return new THREE.ShaderMaterial({
      uniforms,
      vertexShader: compiled.vertex,
      fragmentShader: compiled.fragment,
      depthTest: false,
      depthWrite: false
    });
  }

  /**
   * Create render target for a pass
   */
  private createRenderTarget(
    config: SlangShaderPass,
    passIndex: number
  ): THREE.WebGLRenderTarget {
    // Calculate target size based on scale mode
    let width = this.baseWidth;
    let height = this.baseHeight;

    if (config.scaleType === 'source') {
      // Scale relative to previous pass
      const scale = config.scale ?? 1.0;
      const scaleX = config.scaleX ?? scale;
      const scaleY = config.scaleY ?? scale;

      if (passIndex > 0) {
        const prevTarget = this.passes[passIndex - 1].renderTarget;
        if (prevTarget) {
          width = prevTarget.width * scaleX;
          height = prevTarget.height * scaleY;
        } else {
          width = this.baseWidth * scaleX;
          height = this.baseHeight * scaleY;
        }
      } else {
        width = this.baseWidth * scaleX;
        height = this.baseHeight * scaleY;
      }
    } else if (config.scaleType === 'viewport') {
      // Use viewport size (typically final output size)
      width = this.baseWidth * this.pixelRatio;
      height = this.baseHeight * this.pixelRatio;
    } else if (config.scaleType === 'absolute') {
      // Use absolute size
      width = config.scaleX ?? this.baseWidth;
      height = config.scaleY ?? this.baseHeight;
    }

    width = Math.round(width);
    height = Math.round(height);

    // Determine texture format and type
    let format = THREE.RGBAFormat;
    let type = THREE.UnsignedByteType;
    let internalFormat: THREE.PixelFormatGPU | null = null;

    if (config.floatFramebuffer) {
      type = THREE.FloatType;
    }

    if (config.format) {
      // Map Slang format to Three.js format
      if (config.format.includes('SFLOAT') || config.format.includes('FLOAT')) {
        type = THREE.FloatType;
      }
      if (config.format.includes('R16G16B16A16')) {
        type = THREE.HalfFloatType;
      }
    }

    // Create render target
    const target = new THREE.WebGLRenderTarget(width, height, {
      minFilter: config.filterLinear ? THREE.LinearFilter : THREE.NearestFilter,
      magFilter: config.filterLinear ? THREE.LinearFilter : THREE.NearestFilter,
      format,
      type,
      generateMipmaps: config.mipmapInput ?? false,
      wrapS: this.getWrapMode(config.wrapMode),
      wrapT: this.getWrapMode(config.wrapMode)
    });

    console.log(`[MultiPassRenderer] Created render target ${passIndex}: ${width}x${height} ` +
                `(scale: ${config.scaleType}, filter: ${config.filterLinear ? 'linear' : 'nearest'})`);

    return target;
  }

  /**
   * Convert wrap mode string to Three.js constant
   */
  private getWrapMode(mode?: string): THREE.Wrapping {
    if (mode === 'repeat') return THREE.RepeatWrapping;
    if (mode === 'mirrored_repeat') return THREE.MirroredRepeatWrapping;
    return THREE.ClampToEdgeWrapping;
  }

  /**
   * Set input texture (game content)
   */
  public setInputTexture(texture: THREE.Texture): void {
    this.inputTexture = texture;

    // Update OriginalSize uniforms
    // RetroArch format: vec4(width, height, 1/width, 1/height)
    const width = texture.image?.width ?? this.baseWidth;
    const height = texture.image?.height ?? this.baseHeight;
    this.passes.forEach(pass => {
      pass.material.uniforms.OriginalSize.value.set(
        width,
        height,
        1.0 / width,
        1.0 / height
      );
    });
  }

  /**
   * Render all passes
   */
  public render(outputTarget?: THREE.WebGLRenderTarget | null): void {
    if (!this.inputTexture) {
      console.warn('[MultiPassRenderer] No input texture set');
      return;
    }

    // Update frame counter
    this.frameCount++;
    if (this.frameCount <= 3) {
      console.log(`[MultiPassRenderer] render() called, frame ${this.frameCount}, ${this.passes.length} passes, input texture:`, this.inputTexture.image ? `${this.inputTexture.image.width}x${this.inputTexture.image.height}` : 'no image');
    }

    // Current input starts with the input texture
    let currentInput = this.inputTexture;

    // Render each pass
    for (let i = 0; i < this.passes.length; i++) {
      const pass = this.passes[i];
      const isFinalPass = i === this.passes.length - 1;

      // Update uniforms
      this.updatePassUniforms(pass, currentInput, i);

      // Set material on quad
      this.quad.material = pass.material;

      // Determine output target
      const target = isFinalPass
        ? (outputTarget ?? null)
        : pass.renderTarget;

      // Render
      this.renderer.setRenderTarget(target);
      // Only clear render targets, NOT the screen
      if (target) {
        this.renderer.clear();
      }
      if (this.frameCount <= 3) {
        console.log(`[MultiPassRenderer] Rendering pass ${i}/${this.passes.length-1} to ${target ? 'RT' : 'screen'}`);
      }
      this.renderer.render(this.scene, this.camera);

      // Update current input for next pass
      if (pass.renderTarget) {
        currentInput = pass.renderTarget.texture;
      }
    }

    // Reset render target
    this.renderer.setRenderTarget(null);

    // Update frame history
    this.updateHistory();
  }

  /**
   * Update uniforms for a pass
   */
  private updatePassUniforms(
    pass: RenderPassConfig,
    inputTexture: THREE.Texture,
    passIndex: number
  ): void {
    const uniforms = pass.material.uniforms;

    // MVP matrix (for fullscreen quad, use camera projection matrix)
    // Copy the camera's projection matrix
    uniforms.MVP.value.copy(this.camera.projectionMatrix);

    // Source (input from previous pass)
    if (uniforms.Source) {
      uniforms.Source.value = inputTexture;
      if (this.frameCount <= 3 && passIndex === 0) {
        console.log(`[MultiPassRenderer] Pass ${passIndex} Source texture:`, inputTexture?.image ? `${inputTexture.image.width}x${inputTexture.image.height}` : 'null');
      }
    } else if (this.frameCount === 1 && passIndex === this.passes.length - 1) {
      console.warn('[MultiPassRenderer] Source uniform missing in final pass!');
    }

    // Original (initial input)
    if (uniforms.Original) {
      uniforms.Original.value = this.inputTexture;
    }

    // SourceSize (input texture size)
    // RetroArch format: vec4(width, height, 1/width, 1/height)
    const inputWidth = inputTexture.image?.width ?? this.baseWidth;
    const inputHeight = inputTexture.image?.height ?? this.baseHeight;
    uniforms.SourceSize.value.set(
      inputWidth,
      inputHeight,
      1.0 / inputWidth,
      1.0 / inputHeight
    );

    // OutputSize (render target size)
    // RetroArch format: vec4(width, height, 1/width, 1/height)
    const outputWidth = pass.renderTarget?.width ?? this.baseWidth;
    const outputHeight = pass.renderTarget?.height ?? this.baseHeight;
    uniforms.OutputSize.value.set(
      outputWidth,
      outputHeight,
      1.0 / outputWidth,
      1.0 / outputHeight
    );

    // FrameCount
    uniforms.FrameCount.value = this.frameCount;

    // Aliased textures from previous passes
    // Loop through all previous passes and bind any that have aliases
    for (let i = 0; i < passIndex; i++) {
      const prevPass = this.passes[i];
      if (prevPass.alias && prevPass.renderTarget && uniforms[prevPass.alias]) {
        uniforms[prevPass.alias].value = prevPass.renderTarget.texture;
        if (this.frameCount <= 2 && passIndex === 7) {
          console.log(`[MultiPassRenderer] Pass ${passIndex} bound alias ${prevPass.alias}`);
        }
      }
    }

    // DerezedPassSize (size of pass 0 - the drez downsampling pass)
    // This is used by later passes that need the derezed resolution
    if (uniforms.DerezedPassSize && this.passes[0]?.renderTarget) {
      const derezWidth = this.passes[0].renderTarget.width;
      const derezHeight = this.passes[0].renderTarget.height;
      uniforms.DerezedPassSize.value.set(
        derezWidth,
        derezHeight,
        1.0 / derezWidth,
        1.0 / derezHeight
      );
    }

    // History textures
    for (let i = 0; i < this.historyDepth; i++) {
      const historyKey = `OriginalHistory${i + 1}`;
      if (uniforms[historyKey]) {
        const historyIndex = (this.currentHistoryIndex - i - 1 + this.historyDepth) % this.historyDepth;
        uniforms[historyKey].value = this.historyBuffers[historyIndex].texture;
      }
    }
  }

  /**
   * Update frame history
   */
  private updateHistory(): void {
    if (!this.inputTexture) return;

    // Copy current input to history buffer
    this.currentHistoryIndex = (this.currentHistoryIndex + 1) % this.historyDepth;
    const historyTarget = this.historyBuffers[this.currentHistoryIndex];

    // Simple copy using fullscreen quad
    const copyMaterial = new THREE.MeshBasicMaterial({ map: this.inputTexture });
    this.quad.material = copyMaterial;

    this.renderer.setRenderTarget(historyTarget);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
  }

  /**
   * Update shader parameter value
   */
  public setParameter(paramName: string, value: number): void {
    this.passes.forEach(pass => {
      if (pass.material.uniforms[paramName]) {
        pass.material.uniforms[paramName].value = value;
      }
    });
  }

  /**
   * Get shader parameter value
   */
  public getParameter(paramName: string): number | undefined {
    for (const pass of this.passes) {
      if (pass.material.uniforms[paramName]) {
        return pass.material.uniforms[paramName].value as number;
      }
    }
    return undefined;
  }

  /**
   * Get all shader parameters
   */
  public getAllParameters(): Map<string, number> {
    const params = new Map<string, number>();

    this.passes.forEach(pass => {
      pass.shader.parameters.forEach(param => {
        if (!params.has(param.name)) {
          params.set(param.name, pass.material.uniforms[param.name].value as number);
        }
      });
    });

    return params;
  }

  /**
   * Resize render targets
   */
  public resize(width: number, height: number): void {
    this.baseWidth = width;
    this.baseHeight = height;

    // Recreate all render targets with new sizes
    this.passes.forEach((pass, index) => {
      if (pass.renderTarget) {
        pass.renderTarget.dispose();
        pass.renderTarget = this.createRenderTarget(pass.config, index);
      }
    });

    // Resize history buffers
    this.historyBuffers.forEach(buffer => {
      buffer.setSize(width, height);
    });

    console.log('[MultiPassRenderer] Resized to', width, 'x', height);
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    // Dispose render targets
    this.passes.forEach(pass => {
      if (pass.renderTarget) {
        pass.renderTarget.dispose();
      }
      pass.material.dispose();
    });

    // Dispose history buffers
    this.historyBuffers.forEach(buffer => buffer.dispose());

    // Dispose quad
    this.quad.geometry.dispose();

    console.log('[MultiPassRenderer] Disposed');
  }

  /**
   * Get pass count
   */
  public getPassCount(): number {
    return this.passes.length;
  }

  /**
   * Get pass by index
   */
  public getPass(index: number): RenderPassConfig | undefined {
    return this.passes[index];
  }

  /**
   * Get pass by alias
   */
  public getPassByAlias(alias: string): RenderPassConfig | undefined {
    return this.passes.find(pass => pass.alias === alias);
  }
}
