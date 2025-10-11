/**
 * WebGL2DWithShaders - Extends WebGL2D with shader post-processing
 *
 * This wrapper allows WebGL2D to render to a framebuffer, then applies
 * shader effects before displaying the final result.
 *
 * CRITICAL DESIGN:
 * - WebGL2D renders identically to before (no changes to game logic)
 * - Framebuffer capture is optional and can be toggled
 * - If shaders fail, falls back to direct rendering
 * - Incremental approach: test each layer before adding complexity
 */

import { WebGL2D } from './WebGL2D';
import { PureWebGL2Renderer } from './PureWebGL2Renderer';
import { PureWebGL2MultiPassRenderer } from './PureWebGL2MultiPassRenderer';

export interface ShaderConfig {
  enabled: boolean;
  presetPath?: string;
  bypassOnError: boolean;
}

export class WebGL2DWithShaders {
  private webgl2d: WebGL2D;
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;

  // Framebuffer for capturing WebGL2D output
  private framebuffer: WebGLFramebuffer | null = null;
  private framebufferTexture: WebGLTexture | null = null;
  private width: number;
  private height: number;

  // Shader renderer (optional)
  private shaderRenderer: PureWebGL2MultiPassRenderer | null = null;
  private _shadersEnabled: boolean = false;
  private shadersFailed: boolean = false;
  private frameCount = 0;

  // Getter/setter to track all changes to shadersEnabled
  private get shadersEnabled(): boolean {
    return this._shadersEnabled;
  }
  private set shadersEnabled(value: boolean) {
    this._shadersEnabled = value;
  }

  // Quad for final render
  private quadVAO: WebGLVertexArrayObject | null = null;
  private passthroughProgram: WebGLProgram | null = null;

  constructor(canvas: HTMLCanvasElement, config: ShaderConfig = { enabled: false, bypassOnError: true }) {
    this.canvas = canvas;
    this.width = canvas.width;
    this.height = canvas.height;

    // Create WebGL2D renderer
    this.webgl2d = new WebGL2D(canvas);
    this.gl = this.webgl2d.getGL();

    console.log('[WebGL2DWithShaders] Initialized base renderer');

    // Setup framebuffer and shader pipeline if enabled
    if (config.enabled) {
      try {
        this.setupFramebuffer();
        this.setupPassthroughShader();

        // Load shader preset if provided
        if (config.presetPath) {
          // Disable shaders until loading completes
          this.shadersEnabled = false;
          console.log('[WebGL2DWithShaders] 🔄 Loading shader preset, shadersEnabled = false');

          this.loadShaderPreset(config.presetPath)
            .then(() => {
              // Only enable shaders after successful load
              console.log('[WebGL2DWithShaders] ✅ Preset loaded, enabling shaders NOW');
              this.shadersEnabled = true;
              this.frameCount = 0; // Reset frame count for proper logging
              console.log(`[WebGL2DWithShaders] ✅ shadersEnabled = ${this.shadersEnabled} (should be true)`);
              console.log(`[WebGL2DWithShaders] State check: renderer=${!!this.shaderRenderer}, texture=${!!this.framebufferTexture}, failed=${this.shadersFailed}`);
            })
            .catch(err => {
              console.error('[WebGL2DWithShaders] ❌ Failed to load shader preset:', err);
              if (config.bypassOnError) {
                console.warn('[WebGL2DWithShaders] ⚠️ Bypassing shaders due to error - shadersFailed = true');
                this.shadersFailed = true;
              }
            });
        } else {
          // No preset path, enable simple passthrough shaders
          this.shadersEnabled = true;
        }

        console.log('[WebGL2DWithShaders] Shader pipeline initialized');
      } catch (error) {
        console.error('[WebGL2DWithShaders] Failed to setup shaders:', error);
        if (config.bypassOnError) {
          console.warn('[WebGL2DWithShaders] Falling back to direct rendering');
          this.shadersEnabled = false;
          this.shadersFailed = true;
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Setup framebuffer to capture WebGL2D output
   */
  private setupFramebuffer(): void {
    const gl = this.gl;

    // Create texture for framebuffer
    this.framebufferTexture = gl.createTexture();
    if (!this.framebufferTexture) {
      throw new Error('Failed to create framebuffer texture');
    }

    gl.bindTexture(gl.TEXTURE_2D, this.framebufferTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      this.width,
      this.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // Create framebuffer
    this.framebuffer = gl.createFramebuffer();
    if (!this.framebuffer) {
      throw new Error('Failed to create framebuffer');
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      this.framebufferTexture,
      0
    );

    // Check framebuffer status
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer incomplete: ${status}`);
    }

    // Unbind framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    if (false) console.log('[WebGL2DWithShaders] Framebuffer created successfully');
  }

  /**
   * Setup simple passthrough shader for testing
   */
  private setupPassthroughShader(): void {
    const gl = this.gl;

    // Vertex shader
    const vertexShaderSource = `#version 300 es
      in vec2 a_position;
      in vec2 a_texCoord;
      out vec2 v_texCoord;

      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    // Fragment shader with CRT effects
    const fragmentShaderSource = `#version 300 es
      precision highp float;
      in vec2 v_texCoord;
      uniform sampler2D u_texture;
      out vec4 outColor;

      void main() {
        vec2 uv = v_texCoord;

        // CRT Scanlines
        float scanline = sin(uv.y * 800.0) * 0.04;

        // CRT Curvature (subtle)
        vec2 cc = uv - 0.5;
        float dist = dot(cc, cc) * 0.2;
        uv = uv + cc * (1.0 + dist) * dist * 0.05;

        // Sample texture
        vec3 col = texture(u_texture, uv).rgb;

        // Apply scanlines
        col -= scanline;

        // Vignette
        float vignette = smoothstep(0.7, 0.4, length(cc));
        col *= vignette;

        outColor = vec4(col, 1.0);
      }
    `;

    // Compile shaders
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      throw new Error('Passthrough vertex shader error: ' + gl.getShaderInfoLog(vertexShader));
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      throw new Error('Passthrough fragment shader error: ' + gl.getShaderInfoLog(fragmentShader));
    }

    // Link program
    this.passthroughProgram = gl.createProgram()!;
    gl.attachShader(this.passthroughProgram, vertexShader);
    gl.attachShader(this.passthroughProgram, fragmentShader);
    gl.linkProgram(this.passthroughProgram);
    if (!gl.getProgramParameter(this.passthroughProgram, gl.LINK_STATUS)) {
      throw new Error('Passthrough program link error: ' + gl.getProgramInfoLog(this.passthroughProgram));
    }

    // Create fullscreen quad
    this.quadVAO = gl.createVertexArray();
    gl.bindVertexArray(this.quadVAO);

    // Positions (NDC)
    const positions = new Float32Array([
      -1, -1,  // Bottom-left
       1, -1,  // Bottom-right
      -1,  1,  // Top-left
       1,  1,  // Top-right
    ]);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    const positionLoc = gl.getAttribLocation(this.passthroughProgram, 'a_position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Texture coordinates
    const texCoords = new Float32Array([
      0, 0,  // Bottom-left
      1, 0,  // Bottom-right
      0, 1,  // Top-left
      1, 1,  // Top-right
    ]);

    const texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
    const texCoordLoc = gl.getAttribLocation(this.passthroughProgram, 'a_texCoord');
    gl.enableVertexAttribArray(texCoordLoc);
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    console.log('[WebGL2DWithShaders] Passthrough shader created');
  }

  /**
   * Load shader preset for post-processing
   */
  private async loadShaderPreset(presetPath: string): Promise<void> {
    console.log('[WebGL2DWithShaders] Loading shader preset:', presetPath);

    try {
      // Pass the WebGL context (not canvas) to avoid context conflicts
      this.shaderRenderer = new PureWebGL2MultiPassRenderer(
        this.gl,  // Pass WebGL context instead of canvas
        this.width,
        this.height
      );

      const success = await this.shaderRenderer.loadPreset(presetPath);
      if (!success) {
        throw new Error('Failed to load shader preset');
      }

      console.log('[WebGL2DWithShaders] ✅ Shader preset loaded successfully');
    } catch (error) {
      console.error('[WebGL2DWithShaders] Failed to load preset:', error);
      throw error;
    }
  }

  /**
   * Begin rendering to framebuffer (if shaders enabled OR loading)
   */
  beginFrame(): void {
    // Always render to framebuffer if we have one (even while shaders are loading)
    // This ensures the framebuffer has content when shaders finish loading
    if (this.framebuffer && !this.shadersFailed) {
      // Bind framebuffer to capture WebGL2D output
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);

      // Don't clear - let the game clear with its background color
      // This avoids a frame of black flashing
    }
    // Otherwise render directly to canvas
  }

  /**
   * End rendering and apply shader effects
   */
  endFrame(): void {
    this.frameCount++;

    if (this.frameCount % 120 === 0) {
      console.log(`[WebGL2DWithShaders] endFrame() called - frame ${this.frameCount}, shadersEnabled=${this.shadersEnabled}`);
    }

    // If we have a framebuffer, we need to render its content to screen
    if (this.framebuffer && !this.shadersFailed) {
      const gl = this.gl;

      // Unbind framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      // Apply shader effects if enabled and ready
      if (this.shaderRenderer && this.framebufferTexture && this.shadersEnabled) {
        // Log every frame to see the pattern
        if (!(window as any).__shaderFrameCount) (window as any).__shaderFrameCount = 0;
        (window as any).__shaderFrameCount++;

        if ((window as any).__shaderFrameCount === 1 || (window as any).__shaderFrameCount === 60 || (window as any).__shaderFrameCount === 120 || (window as any).__shaderFrameCount % 180 === 0) {
          console.log(`[SHADER] Rendering WITH shader - frame ${this.frameCount}, shader frames: ${(window as any).__shaderFrameCount}`);
        }

        try {
          // Make sure we're rendering to screen
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);

          // Register the framebuffer texture with the renderer
          this.shaderRenderer.registerTexture('gameTexture', this.framebufferTexture);

          // Render through the shader pipeline
          this.shaderRenderer.render('gameTexture');

          // Force flush to ensure rendering completes
          gl.flush();

          // Check for WebGL errors
          const glError = gl.getError();
          if (glError !== gl.NO_ERROR) {
            console.error(`❌ [WebGL2DWithShaders] WebGL ERROR after shader render: ${glError} (0x${glError.toString(16)})`);
            console.error(`Frame ${this.frameCount} - Error codes: INVALID_ENUM=0x${gl.INVALID_ENUM.toString(16)}, INVALID_VALUE=0x${gl.INVALID_VALUE.toString(16)}, INVALID_OPERATION=0x${gl.INVALID_OPERATION.toString(16)}, OUT_OF_MEMORY=0x${gl.OUT_OF_MEMORY.toString(16)}`);
            throw new Error(`WebGL error: ${glError}`);
          }

          // Debug: Check if anything was rendered
          if (this.frameCount === 1) {
            console.log('[WebGL2DWithShaders] First frame rendered through shader pipeline');
          }
        } catch (error) {
          console.error('❌❌❌ [WebGL2DWithShaders] MULTI-PASS RENDERING FAILED ❌❌❌');
          console.error('Error details:', error);
          console.error('Error message:', error instanceof Error ? error.message : String(error));
          console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack');
          console.error(`Frame ${this.frameCount} - Setting shadersFailed = true, shadersEnabled will be permanently disabled`);
          console.error(`Condition check: renderer=${!!this.shaderRenderer}, texture=${!!this.framebufferTexture}, enabled=${this.shadersEnabled}`);
          this.shadersEnabled = false;
          this.shadersFailed = true;
          // Fallback to passthrough
          this.renderPassthrough();
        }
      } else {
        // No complex shaders or still loading, use passthrough
        if (!(window as any).__noShaderFrameCount) (window as any).__noShaderFrameCount = 0;
        (window as any).__noShaderFrameCount++;

        if ((window as any).__noShaderFrameCount % 60 === 0) {
          console.log(`[SHADER] Rendering WITHOUT shader (passthrough) - frame ${this.frameCount}, no-shader frames: ${(window as any).__noShaderFrameCount}, reason: renderer=${!!this.shaderRenderer}, texture=${!!this.framebufferTexture}, enabled=${this.shadersEnabled}`);
        }

        this.renderPassthrough();
      }
    }
  }

  /**
   * Render framebuffer texture to screen with passthrough shader
   */
  private renderPassthrough(): void {
    const gl = this.gl;

    // Clear screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Use passthrough program
    gl.useProgram(this.passthroughProgram);

    // Bind framebuffer texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.framebufferTexture);
    const textureLoc = gl.getUniformLocation(this.passthroughProgram!, 'u_texture');
    gl.uniform1i(textureLoc, 0);

    // Draw quad
    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  /**
   * Get WebGL2D instance for drawing
   */
  getWebGL2D(): WebGL2D {
    return this.webgl2d;
  }

  /**
   * Toggle shaders on/off
   */
  setShadersEnabled(enabled: boolean): void {
    const prevState = this.shadersEnabled;
    this.shadersEnabled = enabled && !this.shadersFailed;
    console.log(`[WebGL2DWithShaders] setShadersEnabled(${enabled}) - shadersFailed=${this.shadersFailed} - Result: ${prevState} → ${this.shadersEnabled}`);

    if (enabled && this.shadersFailed) {
      console.warn('[WebGL2DWithShaders] ⚠️ Cannot enable shaders - shadersFailed is true. Shaders encountered a fatal error.');
    }
  }

  /**
   * Check if shaders are currently active
   */
  areShadersActive(): boolean {
    return this.shadersEnabled && !this.shadersFailed;
  }
}
