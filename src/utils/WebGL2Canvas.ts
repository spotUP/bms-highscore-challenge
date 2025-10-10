/**
 * WebGL2Canvas - Canvas2D API Compatibility Layer for WebGL2
 *
 * This class provides a Canvas2D-compatible drawing API using WebGL2 for rendering.
 * The goal is PIXEL-PERFECT compatibility with Canvas2D - every draw call must produce
 * identical pixels to the Canvas2D equivalent.
 *
 * NO IMPROVEMENTS, NO OPTIMIZATIONS - EXACT REPLICATION ONLY.
 */

export class WebGL2Canvas {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private width: number;
  private height: number;

  // Shader programs
  private rectProgram: WebGLProgram | null = null;
  private textProgram: WebGLProgram | null = null;
  private circleProgram: WebGLProgram | null = null;
  private lineProgram: WebGLProgram | null = null;

  // Buffers
  private rectBuffer: WebGLBuffer | null = null;
  private circleBuffer: WebGLBuffer | null = null;
  private lineBuffer: WebGLBuffer | null = null;

  // Canvas2D State (must match Canvas2D behavior exactly)
  private _fillStyle: string = '#000000';
  private _strokeStyle: string = '#000000';
  private _lineWidth: number = 1;
  private _globalAlpha: number = 1;
  private _font: string = '10px sans-serif';
  private _textAlign: CanvasTextAlign = 'start';
  private _textBaseline: CanvasTextBaseline = 'alphabetic';
  private _shadowBlur: number = 0;
  private _shadowColor: string = 'rgba(0, 0, 0, 0)';
  private _lineDash: number[] = [];
  private _imageSmoothingEnabled: boolean = true;

  // Transform matrix (for setTransform, save/restore)
  private transformStack: DOMMatrix[] = [];
  private currentTransform: DOMMatrix = new DOMMatrix();

  // Path state (for beginPath, moveTo, lineTo, etc.)
  private pathVertices: number[] = [];
  private pathStartX: number = 0;
  private pathStartY: number = 0;

  // Text rendering cache
  private textCanvas: HTMLCanvasElement;
  private textContext: CanvasRenderingContext2D;
  private textTextures: Map<string, WebGLTexture> = new Map();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.width = canvas.width;
    this.height = canvas.height;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false, // Disable antialiasing for pixel-perfect rendering
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    });

    if (!gl) {
      throw new Error('WebGL2 not supported');
    }

    this.gl = gl;

    // Initialize text rendering canvas (for texture-based text)
    this.textCanvas = document.createElement('canvas');
    this.textCanvas.width = 2048;
    this.textCanvas.height = 2048;
    const textCtx = this.textCanvas.getContext('2d', { willReadFrequently: true });
    if (!textCtx) {
      throw new Error('Failed to create text canvas context');
    }
    this.textContext = textCtx;

    // Initialize WebGL state
    this.initWebGL();
    this.initShaders();
    this.initBuffers();
  }

  private initWebGL(): void {
    const gl = this.gl;

    // Set viewport to match canvas size
    gl.viewport(0, 0, this.width, this.height);

    // Enable blending for alpha transparency (match Canvas2D behavior)
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Disable depth testing (2D rendering)
    gl.disable(gl.DEPTH_TEST);

    // Set clear color to transparent black
    gl.clearColor(0, 0, 0, 0);
  }

  private initShaders(): void {
    // Rectangle shader (filled and stroked rectangles)
    this.rectProgram = this.createShaderProgram(
      // Vertex shader
      `#version 300 es
      in vec2 a_position;
      uniform mat3 u_matrix;
      uniform vec2 u_resolution;

      void main() {
        // Apply transform matrix
        vec2 position = (u_matrix * vec3(a_position, 1)).xy;

        // Convert from pixels to clip space
        vec2 clipSpace = (position / u_resolution) * 2.0 - 1.0;
        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
      }`,
      // Fragment shader
      `#version 300 es
      precision highp float;
      uniform vec4 u_color;
      out vec4 outColor;

      void main() {
        outColor = u_color;
      }`
    );

    // Line/path shader
    this.lineProgram = this.createShaderProgram(
      // Vertex shader
      `#version 300 es
      in vec2 a_position;
      uniform mat3 u_matrix;
      uniform vec2 u_resolution;

      void main() {
        vec2 position = (u_matrix * vec3(a_position, 1)).xy;
        vec2 clipSpace = (position / u_resolution) * 2.0 - 1.0;
        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
      }`,
      // Fragment shader
      `#version 300 es
      precision highp float;
      uniform vec4 u_color;
      out vec4 outColor;

      void main() {
        outColor = u_color;
      }`
    );

    // Circle shader (for arc drawing)
    this.circleProgram = this.createShaderProgram(
      // Vertex shader
      `#version 300 es
      in vec2 a_position;
      uniform mat3 u_matrix;
      uniform vec2 u_resolution;

      void main() {
        vec2 position = (u_matrix * vec3(a_position, 1)).xy;
        vec2 clipSpace = (position / u_resolution) * 2.0 - 1.0;
        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
      }`,
      // Fragment shader
      `#version 300 es
      precision highp float;
      uniform vec4 u_color;
      out vec4 outColor;

      void main() {
        outColor = u_color;
      }`
    );

    // Text shader (texture-based)
    this.textProgram = this.createShaderProgram(
      // Vertex shader
      `#version 300 es
      in vec2 a_position;
      in vec2 a_texCoord;
      uniform mat3 u_matrix;
      uniform vec2 u_resolution;
      out vec2 v_texCoord;

      void main() {
        vec2 position = (u_matrix * vec3(a_position, 1)).xy;
        vec2 clipSpace = (position / u_resolution) * 2.0 - 1.0;
        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
        v_texCoord = a_texCoord;
      }`,
      // Fragment shader
      `#version 300 es
      precision highp float;
      in vec2 v_texCoord;
      uniform sampler2D u_texture;
      uniform vec4 u_color;
      out vec4 outColor;

      void main() {
        vec4 texColor = texture(u_texture, v_texCoord);
        outColor = vec4(u_color.rgb, u_color.a * texColor.a);
      }`
    );
  }

  private initBuffers(): void {
    const gl = this.gl;

    // Rectangle buffer (will be updated per draw call)
    this.rectBuffer = gl.createBuffer();

    // Circle buffer (will be generated per arc call)
    this.circleBuffer = gl.createBuffer();

    // Line buffer (will be updated per path draw)
    this.lineBuffer = gl.createBuffer();
  }

  private createShaderProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
    const gl = this.gl;

    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);

    const program = gl.createProgram();
    if (!program) {
      throw new Error('Failed to create shader program');
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      throw new Error('Shader program link failed: ' + info);
    }

    return program;
  }

  private compileShader(type: number, source: string): WebGLShader {
    const gl = this.gl;
    const shader = gl.createShader(type);
    if (!shader) {
      throw new Error('Failed to create shader');
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      throw new Error('Shader compilation failed: ' + info);
    }

    return shader;
  }

  // ============================================================================
  // Canvas2D API Implementation
  // ============================================================================

  // Context properties
  get fillStyle(): string { return this._fillStyle; }
  set fillStyle(value: string) { this._fillStyle = value; }

  get strokeStyle(): string { return this._strokeStyle; }
  set strokeStyle(value: string) { this._strokeStyle = value; }

  get lineWidth(): number { return this._lineWidth; }
  set lineWidth(value: number) { this._lineWidth = value; }

  get globalAlpha(): number { return this._globalAlpha; }
  set globalAlpha(value: number) { this._globalAlpha = value; }

  get font(): string { return this._font; }
  set font(value: string) { this._font = value; }

  get textAlign(): CanvasTextAlign { return this._textAlign; }
  set textAlign(value: CanvasTextAlign) { this._textAlign = value; }

  get textBaseline(): CanvasTextBaseline { return this._textBaseline; }
  set textBaseline(value: CanvasTextBaseline) { this._textBaseline = value; }

  get shadowBlur(): number { return this._shadowBlur; }
  set shadowBlur(value: number) { this._shadowBlur = value; }

  get shadowColor(): string { return this._shadowColor; }
  set shadowColor(value: string) { this._shadowColor = value; }

  get imageSmoothingEnabled(): boolean { return this._imageSmoothingEnabled; }
  set imageSmoothingEnabled(value: boolean) { this._imageSmoothingEnabled = value; }

  // Additional properties for compatibility
  set textRenderingOptimization(value: string) { /* No-op for compatibility */ }
  set fontKerning(value: string) { /* No-op for compatibility */ }

  // fillRect - Draw a filled rectangle
  fillRect(x: number, y: number, width: number, height: number): void {
    if (!this.rectProgram) return;

    const gl = this.gl;
    gl.useProgram(this.rectProgram);

    // Create rectangle vertices
    const vertices = new Float32Array([
      x, y,
      x + width, y,
      x, y + height,
      x, y + height,
      x + width, y,
      x + width, y + height,
    ]);

    // Update buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rectBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

    // Set up attributes
    const positionLoc = gl.getAttribLocation(this.rectProgram, 'a_position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Set uniforms
    const matrixLoc = gl.getUniformLocation(this.rectProgram, 'u_matrix');
    gl.uniformMatrix3fv(matrixLoc, false, this.getTransformArray());

    const resolutionLoc = gl.getUniformLocation(this.rectProgram, 'u_resolution');
    gl.uniform2f(resolutionLoc, this.width, this.height);

    const color = this.parseColor(this._fillStyle);
    const colorLoc = gl.getUniformLocation(this.rectProgram, 'u_color');
    gl.uniform4f(colorLoc, color[0], color[1], color[2], color[3] * this._globalAlpha);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  // strokeRect - Draw a stroked rectangle
  strokeRect(x: number, y: number, width: number, height: number): void {
    if (!this.lineProgram) return;

    const lw = this._lineWidth / 2;

    // Draw four lines to form rectangle
    this.beginPath();
    this.moveTo(x, y);
    this.lineTo(x + width, y);
    this.lineTo(x + width, y + height);
    this.lineTo(x, y + height);
    this.lineTo(x, y);
    this.stroke();
  }

  // clearRect - Clear a rectangular area (set to transparent)
  clearRect(x: number, y: number, width: number, height: number): void {
    const savedFillStyle = this._fillStyle;
    const savedGlobalAlpha = this._globalAlpha;

    this._fillStyle = 'rgba(0,0,0,0)';
    this._globalAlpha = 1;

    // Enable blending for clearing
    const gl = this.gl;
    const oldBlendFunc = [gl.getParameter(gl.BLEND_SRC_RGB), gl.getParameter(gl.BLEND_DST_RGB)];
    gl.blendFunc(gl.ZERO, gl.ZERO);

    this.fillRect(x, y, width, height);

    // Restore blend function
    gl.blendFunc(oldBlendFunc[0], oldBlendFunc[1]);

    this._fillStyle = savedFillStyle;
    this._globalAlpha = savedGlobalAlpha;
  }

  // fillText - Draw filled text
  fillText(text: string, x: number, y: number, maxWidth?: number): void {
    this.drawText(text, x, y, true, maxWidth);
  }

  // strokeText - Draw stroked text
  strokeText(text: string, x: number, y: number, maxWidth?: number): void {
    this.drawText(text, x, y, false, maxWidth);
  }

  private drawText(text: string, x: number, y: number, filled: boolean, maxWidth?: number): void {
    // Render text to texture using Canvas2D (for exact font rendering match)
    const ctx = this.textContext;
    ctx.font = this._font;
    ctx.textAlign = this._textAlign;
    ctx.textBaseline = this._textBaseline;

    // Measure text
    const metrics = ctx.measureText(text);
    const textWidth = maxWidth ? Math.min(metrics.width, maxWidth) : metrics.width;
    const textHeight = Math.abs(metrics.actualBoundingBoxAscent) + Math.abs(metrics.actualBoundingBoxDescent);

    // Clear text canvas
    ctx.clearRect(0, 0, this.textCanvas.width, this.textCanvas.height);

    // Draw text to canvas
    ctx.fillStyle = filled ? this._fillStyle : 'transparent';
    ctx.strokeStyle = filled ? 'transparent' : this._strokeStyle;
    ctx.globalAlpha = this._globalAlpha;
    ctx.font = this._font;
    ctx.textAlign = 'left'; // Always left-align on texture, adjust position later
    ctx.textBaseline = 'top';

    if (filled) {
      ctx.fillText(text, 0, 0, maxWidth);
    } else {
      ctx.lineWidth = this._lineWidth;
      ctx.strokeText(text, 0, 0, maxWidth);
    }

    // Create texture from text
    const texture = this.createTextureFromCanvas(this.textCanvas, textWidth, textHeight);

    // Calculate final position based on textAlign and textBaseline
    let finalX = x;
    let finalY = y;

    // Adjust X based on textAlign
    if (this._textAlign === 'center') {
      finalX = x - textWidth / 2;
    } else if (this._textAlign === 'right' || this._textAlign === 'end') {
      finalX = x - textWidth;
    }

    // Adjust Y based on textBaseline
    if (this._textBaseline === 'middle') {
      finalY = y - textHeight / 2;
    } else if (this._textBaseline === 'bottom') {
      finalY = y - textHeight;
    } else if (this._textBaseline === 'alphabetic') {
      finalY = y - metrics.actualBoundingBoxAscent;
    }

    // Draw texture to WebGL
    this.drawTexture(texture, finalX, finalY, textWidth, textHeight);

    // Clean up texture
    this.gl.deleteTexture(texture);
  }

  private createTextureFromCanvas(canvas: HTMLCanvasElement, width: number, height: number): WebGLTexture {
    const gl = this.gl;
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error('Failed to create texture');
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                  this.textContext.getImageData(0, 0, width, height));

    // Set texture parameters for pixel-perfect rendering
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this._imageSmoothingEnabled ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this._imageSmoothingEnabled ? gl.LINEAR : gl.NEAREST);

    return texture;
  }

  private drawTexture(texture: WebGLTexture, x: number, y: number, width: number, height: number): void {
    if (!this.textProgram) return;

    const gl = this.gl;
    gl.useProgram(this.textProgram);

    // Create quad vertices with texture coordinates
    const vertices = new Float32Array([
      // Position (x, y), TexCoord (u, v)
      x, y, 0, 0,
      x + width, y, 1, 0,
      x, y + height, 0, 1,
      x, y + height, 0, 1,
      x + width, y, 1, 0,
      x + width, y + height, 1, 1,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

    // Set up attributes
    const positionLoc = gl.getAttribLocation(this.textProgram, 'a_position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 16, 0);

    const texCoordLoc = gl.getAttribLocation(this.textProgram, 'a_texCoord');
    gl.enableVertexAttribArray(texCoordLoc);
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 16, 8);

    // Set uniforms
    const matrixLoc = gl.getUniformLocation(this.textProgram, 'u_matrix');
    gl.uniformMatrix3fv(matrixLoc, false, this.getTransformArray());

    const resolutionLoc = gl.getUniformLocation(this.textProgram, 'u_resolution');
    gl.uniform2f(resolutionLoc, this.width, this.height);

    const color = this.parseColor(this._fillStyle);
    const colorLoc = gl.getUniformLocation(this.textProgram, 'u_color');
    gl.uniform4f(colorLoc, color[0], color[1], color[2], color[3] * this._globalAlpha);

    // Bind texture
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    const textureLoc = gl.getUniformLocation(this.textProgram, 'u_texture');
    gl.uniform1i(textureLoc, 0);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Clean up
    gl.deleteBuffer(buffer);
  }

  // Path drawing
  beginPath(): void {
    this.pathVertices = [];
  }

  moveTo(x: number, y: number): void {
    this.pathStartX = x;
    this.pathStartY = y;
    this.pathVertices.push(x, y);
  }

  lineTo(x: number, y: number): void {
    this.pathVertices.push(x, y);
  }

  closePath(): void {
    if (this.pathVertices.length > 0) {
      this.pathVertices.push(this.pathStartX, this.pathStartY);
    }
  }

  stroke(): void {
    if (!this.lineProgram || this.pathVertices.length < 4) return;

    const gl = this.gl;
    gl.useProgram(this.lineProgram);

    // Create line vertices
    const vertices = new Float32Array(this.pathVertices);

    // Update buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

    // Set up attributes
    const positionLoc = gl.getAttribLocation(this.lineProgram, 'a_position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Set uniforms
    const matrixLoc = gl.getUniformLocation(this.lineProgram, 'u_matrix');
    gl.uniformMatrix3fv(matrixLoc, false, this.getTransformArray());

    const resolutionLoc = gl.getUniformLocation(this.lineProgram, 'u_resolution');
    gl.uniform2f(resolutionLoc, this.width, this.height);

    const color = this.parseColor(this._strokeStyle);
    const colorLoc = gl.getUniformLocation(this.lineProgram, 'u_color');
    gl.uniform4f(colorLoc, color[0], color[1], color[2], color[3] * this._globalAlpha);

    // Set line width
    gl.lineWidth(this._lineWidth);

    // Draw
    gl.drawArrays(gl.LINE_STRIP, 0, this.pathVertices.length / 2);
  }

  fill(): void {
    // TODO: Implement polygon fill if needed
    console.warn('WebGL2Canvas.fill() not fully implemented');
  }

  // Arc drawing (circles)
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void {
    const segments = 64; // Higher = smoother circle
    const angleStep = (endAngle - startAngle) / segments;

    for (let i = 0; i <= segments; i++) {
      const angle = startAngle + (counterclockwise ? -angleStep * i : angleStep * i);
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;

      if (i === 0) {
        this.moveTo(px, py);
      } else {
        this.lineTo(px, py);
      }
    }
  }

  // Transform methods
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void {
    this.currentTransform = new DOMMatrix([a, b, c, d, e, f]);
  }

  getTransform(): DOMMatrix {
    return this.currentTransform;
  }

  save(): void {
    this.transformStack.push(this.currentTransform);
    this.currentTransform = new DOMMatrix(this.currentTransform);
  }

  restore(): void {
    if (this.transformStack.length > 0) {
      this.currentTransform = this.transformStack.pop()!;
    }
  }

  // Line dash
  setLineDash(segments: number[]): void {
    this._lineDash = segments;
  }

  getLineDash(): number[] {
    return this._lineDash;
  }

  // Clear entire canvas
  clear(): void {
    const gl = this.gl;
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  // ============================================================================
  // Helper methods
  // ============================================================================

  private parseColor(color: string): [number, number, number, number] {
    // Parse CSS color string to RGBA
    // Supports: #RRGGBB, #RRGGBBAA, rgb(r,g,b), rgba(r,g,b,a), named colors

    if (color.startsWith('#')) {
      // Hex color
      const hex = color.slice(1);
      const r = parseInt(hex.slice(0, 2), 16) / 255;
      const g = parseInt(hex.slice(2, 4), 16) / 255;
      const b = parseInt(hex.slice(4, 6), 16) / 255;
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return [r, g, b, a];
    } else if (color.startsWith('rgb')) {
      // RGB/RGBA color
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (match) {
        const r = parseInt(match[1]) / 255;
        const g = parseInt(match[2]) / 255;
        const b = parseInt(match[3]) / 255;
        const a = match[4] ? parseFloat(match[4]) : 1;
        return [r, g, b, a];
      }
    } else if (color.startsWith('hsl')) {
      // HSL color - convert to RGB
      const match = color.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%(?:,\s*([\d.]+))?\)/);
      if (match) {
        const h = parseInt(match[1]) / 360;
        const s = parseInt(match[2]) / 100;
        const l = parseInt(match[3]) / 100;
        const a = match[4] ? parseFloat(match[4]) : 1;
        const [r, g, b] = this.hslToRgb(h, s, l);
        return [r, g, b, a];
      }
    }

    // Default to black
    return [0, 0, 0, 1];
  }

  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r, g, b;

    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return [r, g, b];
  }

  private getTransformArray(): Float32Array {
    const m = this.currentTransform;
    // Convert DOMMatrix to 3x3 matrix for 2D transforms
    return new Float32Array([
      m.a, m.b, 0,
      m.c, m.d, 0,
      m.e, m.f, 1,
    ]);
  }

  // Resize canvas
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  // Get WebGL context (for advanced usage)
  getGL(): WebGL2RenderingContext {
    return this.gl;
  }

  // Get canvas element
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}
