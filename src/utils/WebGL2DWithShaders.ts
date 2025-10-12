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

  // Track shader state changes with logging
  get shadersEnabled(): boolean {
    // Check if value was changed externally
    if ((this as any)._lastKnownValue !== undefined && this._shadersEnabled !== (this as any)._lastKnownValue) {
      console.error(`❌❌❌ shadersEnabled was changed EXTERNALLY from ${(this as any)._lastKnownValue} to ${this._shadersEnabled} without calling setter!`);
      console.error('Stack trace:', new Error().stack);
    }
    (this as any)._lastKnownValue = this._shadersEnabled;
    return this._shadersEnabled;
  }

  set shadersEnabled(value: boolean) {
    if (this._shadersEnabled !== value) {
      // Only log when changing to false (shader being disabled)
      if (value === false) {
        console.error(`🔴🔴🔴 SHADER DISABLED 🔴🔴🔴`);
        console.error(`shadersEnabled changed: ${this._shadersEnabled} → ${value}`);
        console.error('Stack trace:', new Error().stack);
      } else {
        console.log(`🔄 [WebGL2DWithShaders] shadersEnabled changed: ${this._shadersEnabled} → ${value}`);
      }
    }
    this._shadersEnabled = value;
    (this as any)._lastKnownValue = value;
  }

  // Quad for final render
  private quadVAO: WebGLVertexArrayObject | null = null;
  private passthroughProgram: WebGLProgram | null = null;

  constructor(canvas: HTMLCanvasElement, config: ShaderConfig = { enabled: false, bypassOnError: true }) {
    const instanceId = Math.random().toString(36).substring(7);
    console.log(`🎬 [WebGL2DWithShaders] NEW INSTANCE CREATED: ${instanceId}`);
    (this as any).instanceId = instanceId;

    this.canvas = canvas;
    this.width = canvas.width;
    this.height = canvas.height;

    // Create WebGL2D renderer
    this.webgl2d = new WebGL2D(canvas);
    this.gl = this.webgl2d.getGL();

    // Store instance ID for debugging
    (this as any).__instanceId = Math.random().toString(36).substr(2, 9);
    console.log(`[WebGL2DWithShaders] Initialized base renderer - instance ${(this as any).__instanceId}`);

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
              console.log('='.repeat(80));
              console.log('🎉🎉🎉 SHADER PRESET LOADED SUCCESSFULLY 🎉🎉🎉');
              console.log('[WebGL2DWithShaders] ✅ Preset loaded, enabling shaders NOW');
              this.shadersEnabled = true;
              this.frameCount = 0; // Reset frame count for proper logging
              console.log(`[WebGL2DWithShaders] ✅ shadersEnabled = ${this.shadersEnabled} (should be true)`);
              console.log(`[WebGL2DWithShaders] State check: renderer=${!!this.shaderRenderer}, texture=${!!this.framebufferTexture}, failed=${this.shadersFailed}`);
              console.log('🎨 MEGA BEZEL SHADERS NOW ACTIVE - Watch for green checkmarks ✅');
              console.log('='.repeat(80));
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

    // Fragment shader with CRT effects, bezel, and reflection
    const fragmentShaderSource = `#version 300 es
      precision highp float;
      in vec2 v_texCoord;
      uniform sampler2D u_texture;
      out vec4 outColor;

      void main() {
        vec2 uv = v_texCoord;

        // Scale down game to 75% to make room for visible bezel
        vec2 gameUV = (uv - 0.5) / 0.75 + 0.5;

        // CRT Curvature (subtle)
        vec2 cc = gameUV - 0.5;
        float dist = dot(cc, cc) * 0.2;
        gameUV = gameUV + cc * (1.0 + dist) * dist * 0.05;

        // Check if we're inside the game area
        bool inGame = gameUV.x >= 0.0 && gameUV.x <= 1.0 && gameUV.y >= 0.0 && gameUV.y <= 1.0;

        vec3 col = vec3(0.0);

        if (inGame) {
          // Sample game texture
          col = texture(u_texture, gameUV).rgb;

          // CRT Scanlines
          float scanline = sin(gameUV.y * 800.0) * 0.04;
          col -= scanline;

          // Vignette on game area only
          float vignette = smoothstep(0.7, 0.4, length(cc));
          col *= vignette;
        } else {
          // Bezel area - visible monitor frame
          float bezelDist = min(
            min(uv.x, 1.0 - uv.x),
            min(uv.y, 1.0 - uv.y)
          );

          // Bright metallic bezel with gradient (visible!)
          float bezelGradient = smoothstep(0.0, 0.2, bezelDist);
          col = vec3(0.2, 0.22, 0.25) * bezelGradient;

          // Add strong specular highlights on bezel edges
          float edgeHighlight = smoothstep(0.15, 0.18, bezelDist) * (1.0 - smoothstep(0.18, 0.22, bezelDist));
          col += vec3(0.6, 0.65, 0.7) * edgeHighlight;

          // Add reflection on bezel surface (dimmed game content)
          float reflectionStrength = smoothstep(0.05, 0.15, bezelDist) * 0.25;
          vec2 reflectUV = vec2(gameUV.x, 1.0 - gameUV.y * 0.5);
          if (reflectUV.x >= 0.0 && reflectUV.x <= 1.0 && reflectUV.y >= 0.0 && reflectUV.y <= 1.0) {
            vec3 reflection = texture(u_texture, reflectUV).rgb * reflectionStrength;
            col += reflection;
          }
        }

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
    // Track begin/end frame pairs
    (this as any)._frameBegun = true;

    // Always render to framebuffer if we have one (even while shaders are loading)
    // This ensures the framebuffer has content when shaders finish loading
    if (this.framebuffer && !this.shadersFailed) {
      // Bind framebuffer to capture WebGL2D output
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);

      // DEBUG: Verify framebuffer is bound
      const boundFB = this.gl.getParameter(this.gl.FRAMEBUFFER_BINDING);
      if (this.frameCount < 3) {
        console.log(`[beginFrame] Frame ${this.frameCount}: Framebuffer bound = ${boundFB === this.framebuffer}, FB=${this.framebuffer}, Bound=${boundFB}`);
      }

      // NOTE: Don't clear here! The game code will clear with ctx.fillRect()
      // If we clear here, we clear BEFORE WebGL2D has drawn anything,
      // and then WebGL2D's commands go to the framebuffer after our clear.
      // The game's fillRect() will clear with the correct background color.
    }
    // Otherwise render directly to canvas
  }

  /**
   * End rendering and apply shader effects
   */
  endFrame(): void {
    // Skip if beginFrame wasn't called
    if (!(this as any)._frameBegun) {
      console.error(`❌ endFrame() called without beginFrame()! Skipping.`);
      return;
    }
    (this as any)._frameBegun = false; // Reset flag

    this.frameCount++;

    // Detect and SKIP duplicate endFrame calls within same frame (< 8ms)
    const now = performance.now();
    const callSite = (this as any)._callSite || 'UNKNOWN';
    const lastCallSite = (this as any)._lastCallSite || 'NONE';
    const timeSinceLastCall = (this as any)._lastEndFrameTime ? (now - (this as any)._lastEndFrameTime) : 999;

    // Skip if called within same frame (< 8ms for 120fps displays)
    if (timeSinceLastCall < 8) {
      if (this.frameCount < 200) { // Log more to see pattern
        console.warn(`⚠️ SKIP duplicate endFrame() - Frame ${this.frameCount}, ${timeSinceLastCall.toFixed(1)}ms since last (${lastCallSite} → ${callSite})`);
      }
      return; // Skip this duplicate render to prevent shader corruption
    }

    (this as any)._lastEndFrameTime = now;
    (this as any)._lastCallSite = callSite;

    if (this.frameCount % 60 === 0) {
      console.log(`[endFrame] Frame ${this.frameCount}: callSite=${callSite}, shadersEnabled=${this.shadersEnabled}`);
    }

    // If we have a framebuffer, we need to render its content to screen
    if (this.framebuffer && !this.shadersFailed) {
      const gl = this.gl;

      // Unbind framebuffer
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      // Apply shader effects if enabled and ready
      const hasRenderer = !!this.shaderRenderer;
      const hasTexture = !!this.framebufferTexture;
      const isEnabled = this.shadersEnabled;

      // CRITICAL: Check if enabled changed during endFrame execution
      const enabledAtEnd = this.shadersEnabled;
      if (isEnabled !== enabledAtEnd) {
        console.error(`⚠️⚠️⚠️ shadersEnabled CHANGED during endFrame! Start: ${isEnabled}, End: ${enabledAtEnd}`);
      }

      // Log every 60 frames to track state
      if (this.frameCount % 60 === 0) {
        console.log(`[SHADER CHECK] Frame ${this.frameCount}: renderer=${hasRenderer}, texture=${hasTexture}, enabled=${isEnabled}`);
      }

      // Log when condition fails - only ERROR after initial loading period
      if (!(hasRenderer && hasTexture && isEnabled)) {
        // During first 120 frames (2 seconds), this is expected while shaders load - use log, not error
        if (this.frameCount < 120) {
          // Suppressed - shaders are loading
        } else if (this.frameCount < 300 || this.frameCount % 60 === 0) {
          // After 2 seconds, this is an actual error
          console.error(`❌ SHADER CONDITION FAILED - Frame ${this.frameCount}: renderer=${hasRenderer}, texture=${hasTexture}, enabled=${isEnabled}, enabledNow=${this.shadersEnabled}`);
        }
      }

      if (hasRenderer && hasTexture && isEnabled) {
        // REAL MEGA BEZEL ACTIVE - Log more frequently to catch transitions
        // Reduce logging frequency
        if (this.frameCount === 1 || this.frameCount === 60 || this.frameCount % 300 === 0) {
          console.log(`✅ [MEGA BEZEL] Rendering with shaders - frame ${this.frameCount}, callSite=${(this as any)._callSite}`);
        }

        try {
          // DEBUG: Sample pixels BEFORE and AFTER shader to verify transformation
          // ENABLED to debug black screen issue
          let beforePixels: Uint8Array | null = null;
          if (this.frameCount % 60 === 0 && this.frameCount > 0) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
            beforePixels = new Uint8Array(100 * 100 * 4);
            gl.readPixels(this.width / 2 - 50, this.height / 2 - 50, 100, 100, gl.RGBA, gl.UNSIGNED_BYTE, beforePixels);

            // Calculate average color of sample area BEFORE shader
            let sumR = 0, sumG = 0, sumB = 0, nonBlack = 0;
            for (let i = 0; i < beforePixels.length; i += 4) {
              if (beforePixels[i] > 10 || beforePixels[i+1] > 10 || beforePixels[i+2] > 10) {
                sumR += beforePixels[i];
                sumG += beforePixels[i+1];
                sumB += beforePixels[i+2];
                nonBlack++;
              }
            }
            const avgR = nonBlack > 0 ? Math.round(sumR / nonBlack) : 0;
            const avgG = nonBlack > 0 ? Math.round(sumG / nonBlack) : 0;
            const avgB = nonBlack > 0 ? Math.round(sumB / nonBlack) : 0;
            console.log(`[BEFORE SHADER] Frame ${this.frameCount}: Framebuffer avg color = rgb(${avgR}, ${avgG}, ${avgB}), non-black=${nonBlack}/${100*100}`);
          }

          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          this.shaderRenderer.registerTexture('gameTexture', this.framebufferTexture);
          this.shaderRenderer.render('gameTexture');
          gl.flush();

          // Check pixels AFTER shader render
          if (beforePixels && this.frameCount % 60 === 0 && this.frameCount > 0) {
            const afterPixels = new Uint8Array(100 * 100 * 4);
            gl.readPixels(this.width / 2 - 50, this.height / 2 - 50, 100, 100, gl.RGBA, gl.UNSIGNED_BYTE, afterPixels);

            // Calculate average color of sample area AFTER shader
            let sumR = 0, sumG = 0, sumB = 0, nonBlack = 0;
            for (let i = 0; i < afterPixels.length; i += 4) {
              if (afterPixels[i] > 10 || afterPixels[i+1] > 10 || afterPixels[i+2] > 10) {
                sumR += afterPixels[i];
                sumG += afterPixels[i+1];
                sumB += afterPixels[i+2];
                nonBlack++;
              }
            }
            const avgR = nonBlack > 0 ? Math.round(sumR / nonBlack) : 0;
            const avgG = nonBlack > 0 ? Math.round(sumG / nonBlack) : 0;
            const avgB = nonBlack > 0 ? Math.round(sumB / nonBlack) : 0;
            console.log(`[AFTER SHADER] Frame ${this.frameCount}: Screen avg color = rgb(${avgR}, ${avgG}, ${avgB}), non-black=${nonBlack}/${100*100}`);

            // Compare to detect if shader is transforming
            const beforeAvgR = beforePixels ? Math.round(Array.from(beforePixels.filter((_, i) => i % 4 === 0)).reduce((a, b) => a + b, 0) / (beforePixels.length / 4)) : 0;
            const beforeAvgG = beforePixels ? Math.round(Array.from(beforePixels.filter((_, i) => i % 4 === 1)).reduce((a, b) => a + b, 0) / (beforePixels.length / 4)) : 0;
            const beforeAvgB = beforePixels ? Math.round(Array.from(beforePixels.filter((_, i) => i % 4 === 2)).reduce((a, b) => a + b, 0) / (beforePixels.length / 4)) : 0;
            const diff = Math.abs(avgR - beforeAvgR) + Math.abs(avgG - beforeAvgG) + Math.abs(avgB - beforeAvgB);

            if (diff < 5) {
              console.error('='.repeat(80));
              console.error(`🚨🚨🚨 INVISIBLE SHADER BUG DETECTED! 🚨🚨🚨`);
              console.error(`Shaders are RUNNING but NOT TRANSFORMING pixels (diff=${diff})`);
              console.error(`Before: rgb(${beforeAvgR}, ${beforeAvgG}, ${beforeAvgB})`);
              console.error(`After:  rgb(${avgR}, ${avgG}, ${avgB})`);
              console.error(`This is the bug you're seeing - shaders active but output looks unshaded!`);
              console.error('='.repeat(80));
            } else {
              console.log(`✅ SHADER IS TRANSFORMING! Color difference = ${diff}`);
            }
          }

          const glError = gl.getError();
          if (glError !== gl.NO_ERROR) {
            console.error(`❌ [WebGL2DWithShaders] WebGL ERROR: ${glError}`);
            throw new Error(`WebGL error: ${glError}`);
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
          // REMOVED PASSTHROUGH - Let it fail visibly
          throw error; // Re-throw to make failure obvious
        }
      } else {
        // SHADERS NOT READY - Show black screen during initial loading
        if (this.frameCount <= 20) {
          console.log(`⏳ [LOADING] Shaders not ready yet - frame ${this.frameCount}, callSite=${(this as any)._callSite} (renderer=${!!this.shaderRenderer}, enabled=${this.shadersEnabled})`);
        }
        // REMOVED PASSTHROUGH - Just show black screen until shaders load
        // This makes it obvious when shaders are NOT working
      }
    }
  }

  /**
   * Render framebuffer texture to screen with passthrough shader
   */
  private renderPassthrough(): void {
    if (this.frameCount % 120 === 0) {
      console.warn(`⚠️ [renderPassthrough] Called at frame ${this.frameCount}`);
    }
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
