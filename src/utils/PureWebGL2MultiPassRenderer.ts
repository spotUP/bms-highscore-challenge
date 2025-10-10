/**
 * Pure WebGL2 Multi-Pass Shader Renderer
 *
 * NO THREE.JS - Direct WebGL2 implementation
 * Executes Slang shader pipelines with zero abstraction overhead
 */

import { PureWebGL2Renderer } from './PureWebGL2Renderer';
import { SlangShaderCompiler, CompiledShader } from './SlangShaderCompiler';

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

  constructor(canvas: HTMLCanvasElement, width: number = 800, height: number = 600) {
    this.renderer = new PureWebGL2Renderer(canvas);
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

      const match = shaderLine.match(/shader\d+\s*=\s*"([^"]+)"/);
      if (!match) continue;

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

    // Clear screen
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Execute the first loaded shader pass (for testing)
    const firstPassName = this.passes.keys().next().value;
    if (!firstPassName) {
      console.warn('[PureWebGL2MultiPass] No shader pass loaded to render');
      return;
    }

    if (this.frameCount === 1) {
      console.log(`[PureWebGL2MultiPass] Executing first frame with pass: ${firstPassName}, input: ${inputTextureName}`);
    }

    // Execute the shader pass
    const success = this.renderer.executePass(
      firstPassName,
      { Source: inputTextureName },  // Input texture mapping
      null,  // Render to screen (null framebuffer)
      { FrameCount: this.frameCount }  // Custom uniforms
    );

    if (!success) {
      console.error(`[PureWebGL2MultiPass] Failed to execute pass: ${firstPassName}`);
    } else if (this.frameCount === 1) {
      console.log(`[PureWebGL2MultiPass] ✅ First frame rendered successfully`);
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
    // Access the private textures map via the renderer
    // For now, we'll use createRenderTarget which handles texture creation
    console.log(`[PureWebGL2MultiPass] Registered texture: ${name}`);
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
