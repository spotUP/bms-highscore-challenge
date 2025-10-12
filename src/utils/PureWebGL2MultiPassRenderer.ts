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
  private presetParameters: Record<string, number> = {}; // Store parameters from preset
  private passAliases: Map<string, string> = new Map(); // Maps alias name to pass output texture name (e.g., "LinearizePass" -> "pass_11_output")
  private passConfigs: ShaderPassConfig[] = []; // Store pass configurations for alias lookup

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
      // IMPORTANT: Pass preset parameters to compiler for compile-time injection
      const compiled = await SlangShaderCompiler.loadFromURL(
        shaderPath,
        true, // webgl2 = true
        this.presetParameters // Pass parameters for compile-time injection
      );

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

      // Store parameters for use during rendering
      this.presetParameters = config.parameters || {};

      // Store pass configurations for alias lookup
      this.passConfigs = config.passes;

      console.log(`[PureWebGL2MultiPass] Preset has ${config.passes.length} passes and ${Object.keys(this.presetParameters).length} parameters`);

      // Build alias map: alias name → pass output texture name
      for (let i = 0; i < config.passes.length; i++) {
        const pass = config.passes[i];
        if (pass.alias) {
          // Map alias to the pass's output texture (e.g., "LinearizePass" → "pass_11_output")
          this.passAliases.set(pass.alias, `${pass.name}_output`);
          console.log(`[PureWebGL2MultiPass] Registered alias: ${pass.alias} → ${pass.name}_output`);
        }
      }

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
    const parameters: Record<string, number> = {};
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

    // Parse each shader and its alias
    for (let i = 0; i < shaderCount; i++) {
      const shaderLine = lines.find(l => l.startsWith(`shader${i}`));
      if (!shaderLine) continue;

      // Match both quoted and unquoted paths: shader0 = "path" OR shader0 = path
      const match = shaderLine.match(/shader\d+\s*=\s*"?([^"\s]+)"?/);
      if (!match) continue;

      // Look for alias directive: alias0 = "AliasName" or alias0 = AliasName
      const aliasLine = lines.find(l => l.startsWith(`alias${i}`));
      let alias: string | undefined;
      if (aliasLine) {
        const aliasMatch = aliasLine.match(/alias\d+\s*=\s*"?([^"\s]+)"?/);
        if (aliasMatch) {
          alias = aliasMatch[1];
        }
      }

      // Keep path as-is - will be resolved relative to preset in loadPreset()
      passes.push({
        name: `pass_${i}`,
        shaderPath: match[1],
        filter: 'linear',
        alias: alias
      });
    }

    // Parse parameters - any line with "PARAM_NAME = value" pattern
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

      // Skip shader/texture/filter/scale/alias definitions
      if (trimmed.startsWith('shader') || trimmed.startsWith('texture') ||
          trimmed.startsWith('filter') || trimmed.startsWith('scale') ||
          trimmed.startsWith('alias') || trimmed.startsWith('Sampler')) continue;

      // Match parameter lines: PARAM_NAME = value
      const paramMatch = trimmed.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*([0-9]+\.?[0-9]*)/);
      if (paramMatch) {
        parameters[paramMatch[1]] = parseFloat(paramMatch[2]);
      }
    }

    console.log(`[PresetParser] Extracted ${Object.keys(parameters).length} parameters from preset`);
    if (Object.keys(parameters).length > 0) {
      console.log('[PresetParser] Parameters:', parameters);
    }

    return { passes, parameters };
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

      // Start with Source (previous pass output or initial input)
      let inputTextures: Record<string, string> = { Source: currentInput };

      // AUTOMATICALLY ADD ALL ALIASED TEXTURES
      // This allows any pass to reference any previous pass by its alias
      // Example: Gaussian blur can reference "LinearizePass" even if it's not the previous pass
      for (const [aliasName, textureName] of this.passAliases.entries()) {
        // Only add if the aliased pass has already executed (i.e., its index is less than current)
        const aliasPassIndex = this.passConfigs.findIndex(p => `${p.name}_output` === textureName);
        if (aliasPassIndex >= 0 && aliasPassIndex < i) {
          inputTextures[aliasName] = textureName;
          if (this.frameCount === 1) {
            console.log(`[PureWebGL2MultiPass] Pass ${i} (${passName}) can access aliased texture: ${aliasName} → ${textureName}`);
          }
        }
      }

      // Legacy hardcoded texture mappings (kept for compatibility, but aliases handle most of this now)
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

      // Prefix preset parameters with PARAM_ to match shader uniform names
      const paramUniforms: Record<string, number> = {};
      for (const [key, value] of Object.entries(this.presetParameters)) {
        paramUniforms[`PARAM_${key}`] = value;
      }

      const success = this.renderer.executePass(
        passName,
        inputTextures,
        outputTarget,  // Output target
        { ...paramUniforms, FrameCount: this.frameCount }  // Preset parameters with PARAM_ prefix + frame uniforms
      );

      if (!success) {
        console.error(`[PureWebGL2MultiPass] Failed to execute pass ${i}: ${passName}`);
        return;
      }

      // DEBUG: Check output of this pass (every 60 frames)
      if (this.frameCount % 60 === 0) {
        const gl = this.renderer.getContext();
        const checkOutput = () => {
          // Bind the output target to read from it
          if (!isLastPass) {
            const fb = this.renderer['framebuffers'].get(outputTarget!);
            if (fb) {
              gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            }
          } else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          }

          const pixels = new Uint8Array(100 * 100 * 4);
          gl.readPixels(Math.floor(gl.canvas.width / 2) - 50, Math.floor(gl.canvas.height / 2) - 50, 100, 100, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

          let sumR = 0, sumG = 0, sumB = 0, nonBlack = 0;
          for (let j = 0; j < pixels.length; j += 4) {
            if (pixels[j] > 10 || pixels[j+1] > 10 || pixels[j+2] > 10) {
              sumR += pixels[j];
              sumG += pixels[j+1];
              sumB += pixels[j+2];
              nonBlack++;
            }
          }
          const avgR = nonBlack > 0 ? Math.round(sumR / nonBlack) : 0;
          const avgG = nonBlack > 0 ? Math.round(sumG / nonBlack) : 0;
          const avgB = nonBlack > 0 ? Math.round(sumB / nonBlack) : 0;
          console.log(`[PASS OUTPUT] ${passName} (pass ${i}): avg=rgb(${avgR},${avgG},${avgB}), non-black=${nonBlack}/10000`);
        };
        checkOutput();
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
