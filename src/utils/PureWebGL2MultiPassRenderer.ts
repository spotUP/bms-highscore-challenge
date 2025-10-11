/**
 * Pure WebGL2 Multi-Pass Shader Renderer
 *
 * NO THREE.JS - Direct WebGL2 implementation
 * Executes Slang shader pipelines with zero abstraction overhead
 */

import { PureWebGL2Renderer } from './PureWebGL2Renderer';
import { SlangShaderCompiler, CompiledShader } from '../shaders/SlangShaderCompiler';

export interface ShaderPassConfig {
  name: string;
  shaderPath: string;
  filter: 'linear' | 'nearest';
  scale?: number;
  scaleType?: 'source' | 'viewport' | 'absolute';
  alias?: string;
}

export interface PresetConfig {
  passes: ShaderPassConfig[];
  parameters?: Record<string, number>;
}

export class PureWebGL2MultiPassRenderer {
  private renderer: PureWebGL2Renderer;
  private passes: Map<string, CompiledShader> = new Map();
  private frameCount: number = 0;
  private width: number;
  private height: number;

  constructor(canvasOrContext: HTMLCanvasElement | WebGL2RenderingContext, width: number = 800, height: number = 600) {
    this.renderer = new PureWebGL2Renderer(canvasOrContext);
    this.width = width;
    this.height = height;

    console.log(`[PureWebGL2MultiPass] Initialized (${width}x${height})`);
  }

  /**
   * Load a single shader pass
   */
  async loadShaderPass(name: string, shaderPath: string): Promise<boolean> {
    try {
      console.log(`[PureWebGL2MultiPass] Loading shader: ${name} from ${shaderPath}`);

      // Use loadFromURL which processes #include directives AND compiles
      // This is CRITICAL - it processes globals.inc which contains the UBO!
      const compiled = await SlangShaderCompiler.loadFromURL(shaderPath, true); // webgl2 = true

      console.log(`[PureWebGL2MultiPass] Compiled ${name}:`, {
        vertexLength: compiled.vertex.length,
        fragmentLength: compiled.fragment.length,
        parameters: compiled.parameters.length
      });

      // Store compiled shader
      this.passes.set(name, compiled);

      // Compile WebGL program
      const success = this.renderer.compileProgram(
        name,
        compiled.vertex,
        compiled.fragment
      );

      if (!success) {
        console.error(`[PureWebGL2MultiPass] Failed to compile WebGL program for ${name}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`[PureWebGL2MultiPass] Error loading shader pass ${name}:`, error);
      return false;
    }
  }

  /**
   * Load a preset (multiple passes)
   */
  async loadPreset(presetPath: string): Promise<boolean> {
    try {
      console.log(`[PureWebGL2MultiPass] Loading preset: ${presetPath}`);

      // Fetch preset file (.slangp)
      const response = await fetch(presetPath);
      if (!response.ok) {
        throw new Error(`Failed to fetch preset: ${response.statusText}`);
      }

      const presetContent = await response.text();

      // Parse preset (simple .slangp parser)
      const config = this.parseSlangPreset(presetContent, presetPath);

      console.log(`[PureWebGL2MultiPass] Preset has ${config.passes.length} passes`);

      // Load each shader pass
      for (const pass of config.passes) {
        const basePath = presetPath.substring(0, presetPath.lastIndexOf('/'));
        const fullPath = `${basePath}/${pass.shaderPath}`;

        const success = await this.loadShaderPass(pass.name, fullPath);
        if (!success) {
          console.error(`[PureWebGL2MultiPass] Failed to load pass: ${pass.name}`);
          return false;
        }
      }

      // Create render targets for passes
      for (let i = 0; i < config.passes.length - 1; i++) {
        const passName = config.passes[i].name;
        this.renderer.createRenderTarget(`${passName}_output`, this.width, this.height);
      }

      console.log(`✅ [PureWebGL2MultiPass] Preset loaded successfully`);
      return true;
    } catch (error) {
      console.error(`[PureWebGL2MultiPass] Error loading preset:`, error);
      return false;
    }
  }

  /**
   * Parse .slangp preset file
   */
  private parseSlangPreset(content: string, basePath: string): PresetConfig {
    const lines = content.split('\n');
    const passes: ShaderPassConfig[] = [];
    let shaderCount = 0;

    // Extract directory from preset path
    const presetDir = basePath.substring(0, basePath.lastIndexOf('/'));

    // Find number of shaders
    for (const line of lines) {
      if (line.startsWith('shaders')) {
        const match = line.match(/shaders\s*=\s*"?(\d+)"?/);
        if (match) {
          shaderCount = parseInt(match[1]);
        }
      }
    }

    // Parse each shader
    for (let i = 0; i < shaderCount; i++) {
      const shaderLine = lines.find(l => l.startsWith(`shader${i}`));
      if (!shaderLine) continue;

      // Match both quoted and unquoted paths: shader0 = "path" OR shader0 = path
      const match = shaderLine.match(/shader\d+\s*=\s*"?([^"\s]+)"?/);
      if (!match) continue;

      // Keep path as-is - will be resolved relative to preset in loadPreset()
      passes.push({
        name: `pass_${i}`,
        shaderPath: match[1],
        filter: 'linear'
      });
    }

    return { passes };
  }

  /**
   * Render a frame through the shader pipeline
   */
  render(inputTextureName: string): void {
    const gl = this.renderer.getContext();
    this.frameCount++;

    // CRITICAL: Clear the screen before rendering to prevent double images
    // Make sure we're rendering to the screen (not a framebuffer)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Execute ALL shader passes in order
    const passNames = Array.from(this.passes.keys());
    if (passNames.length === 0) {
      console.warn('[PureWebGL2MultiPass] No shader passes loaded to render');
      return;
    }

    if (this.frameCount === 1 || this.frameCount % 60 === 0) {
      console.log(`[PureWebGL2MultiPass] Frame ${this.frameCount}: Executing ${passNames.length} passes`);
    }

    // Execute each pass in sequence
    let currentInput = inputTextureName;

    for (let i = 0; i < passNames.length; i++) {
      const passName = passNames[i];
      const isLastPass = (i === passNames.length - 1);

      if (this.frameCount === 1) {
        console.log(`[PureWebGL2MultiPass] Executing pass ${i}: ${passName}, input: ${currentInput}, output: ${isLastPass ? 'screen' : passName + '_output'}`);
      }

      // For intermediate passes, render to a texture
      // For the last pass, render to screen (null)
      const outputTarget = isLastPass ? null : `${passName}_output`;

      // Different passes need different textures
      let inputTextures: Record<string, string> = { Source: currentInput };

      // Special texture mappings for Mega Bezel passes
      // Pass 1 might need DerezedPass from pass 0
      if (passName === 'pass_1' && i > 0) {
        inputTextures.DerezedPass = 'pass_0_output';
      }

      // Pass 2 - CRT shader needs game + cache-info
      if (passName === 'pass_2' && i === 2) {
        inputTextures.Source = 'pass_0_output'; // Game image from derez
        inputTextures.InfoCachePass = 'pass_1_output'; // Coordinate data from cache-info
        inputTextures.DerezedPass = 'pass_0_output';
      }

      // Pass 3 (bezel in 4-pass preset) needs game image + cache-info
      if (passName === 'pass_3' && i === 3) {
        inputTextures.Source = 'pass_2_output'; // Game image from pass 2 (stock)
        inputTextures.InfoCachePass = 'pass_1_output'; // Coordinate data from pass 1 (cache-info)
        inputTextures.DerezedPass = 'pass_0_output'; // Derezed image from pass 0
      }

      const success = this.renderer.executePass(
        passName,
        inputTextures,
        outputTarget,  // Output target
        { FrameCount: this.frameCount }  // Custom uniforms
      );

      if (!success) {
        console.error(`[PureWebGL2MultiPass] Failed to execute pass ${i}: ${passName}`);
        return;
      }

      // Next pass uses this pass's output as input
      if (!isLastPass) {
        currentInput = `${passName}_output`;
      }
    }

    if (this.frameCount === 1) {
      console.log(`[PureWebGL2MultiPass] ✅ All ${passNames.length} passes executed successfully`);
    }
  }

  /**
   * Get the WebGL2 context
   */
  getContext(): WebGL2RenderingContext {
    return this.renderer.getContext();
  }

  /**
   * Create a texture from image data
   * Registers it directly with the renderer
   */
  createTexture(name: string, width: number, height: number, data?: Uint8Array): boolean {
    return this.renderer.createRenderTarget(name, width, height);
  }

  /**
   * Register an existing WebGL texture
   */
  registerTexture(name: string, texture: WebGLTexture): void {
    // Only log on first registration to reduce console spam
    if (this.frameCount === 1) {
      console.log(`[PureWebGL2MultiPass] Registered texture: ${name}`);
    }
    // Actually register the texture with the renderer!
    this.renderer.registerTexture(name, texture);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.renderer.dispose();
    this.passes.clear();
    console.log('[PureWebGL2MultiPass] Disposed');
  }
}
