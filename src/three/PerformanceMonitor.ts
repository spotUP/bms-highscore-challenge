import * as THREE from 'three';

/**
 * Performance Monitor
 * Tracks FPS, draw calls, triangles, and other performance metrics
 */
export class PerformanceMonitor {
  private renderer: THREE.WebGLRenderer;
  private frameCount: number = 0;
  private lastTime: number = performance.now();
  private fps: number = 60;
  private frameTime: number = 16.67;

  // Performance targets
  private readonly TARGET_FPS = 60;
  private readonly TARGET_DRAW_CALLS = 10;
  private readonly TARGET_TRIANGLES = 5000;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
  }

  /**
   * Update performance metrics (call once per frame)
   */
  public update(): void {
    this.frameCount++;
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;

    // Update FPS every second
    if (deltaTime >= 1000) {
      this.fps = (this.frameCount * 1000) / deltaTime;
      this.frameTime = deltaTime / this.frameCount;
      this.frameCount = 0;
      this.lastTime = currentTime;
    }
  }

  /**
   * Get current FPS
   */
  public getFPS(): number {
    return Math.round(this.fps);
  }

  /**
   * Get average frame time in milliseconds
   */
  public getFrameTime(): number {
    return Math.round(this.frameTime * 100) / 100;
  }

  /**
   * Get renderer info (draw calls, triangles, etc.)
   */
  public getRendererInfo(): {
    drawCalls: number;
    triangles: number;
    points: number;
    lines: number;
    textures: number;
    geometries: number;
    programs: number;
  } {
    const info = this.renderer.info;

    return {
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      points: info.render.points,
      lines: info.render.lines,
      textures: info.memory.textures,
      geometries: info.memory.geometries,
      programs: info.programs ? info.programs.length : 0
    };
  }

  /**
   * Check if performance is meeting targets
   */
  public isPerformanceGood(): {
    fps: boolean;
    drawCalls: boolean;
    triangles: boolean;
    overall: boolean;
  } {
    const info = this.getRendererInfo();

    const fpsGood = this.fps >= this.TARGET_FPS * 0.9; // 90% of target
    const drawCallsGood = info.drawCalls <= this.TARGET_DRAW_CALLS;
    const trianglesGood = info.triangles <= this.TARGET_TRIANGLES;

    return {
      fps: fpsGood,
      drawCalls: drawCallsGood,
      triangles: trianglesGood,
      overall: fpsGood && drawCallsGood && trianglesGood
    };
  }

  /**
   * Get performance summary string
   */
  public getSummary(): string {
    const info = this.getRendererInfo();
    const perf = this.isPerformanceGood();

    return `FPS: ${this.getFPS()}/${this.TARGET_FPS} ${perf.fps ? '✓' : '✗'} | ` +
           `Frame: ${this.getFrameTime()}ms | ` +
           `Draw Calls: ${info.drawCalls}/${this.TARGET_DRAW_CALLS} ${perf.drawCalls ? '✓' : '✗'} | ` +
           `Triangles: ${info.triangles}/${this.TARGET_TRIANGLES} ${perf.triangles ? '✓' : '✗'}`;
  }

  /**
   * Log performance metrics to console
   */
  public logMetrics(): void {
    const info = this.getRendererInfo();
    const perf = this.isPerformanceGood();

    console.log('[PerformanceMonitor] ================');
    console.log('[PerformanceMonitor] FPS:', this.getFPS(), '/', this.TARGET_FPS, perf.fps ? '✓' : '✗');
    console.log('[PerformanceMonitor] Frame Time:', this.getFrameTime(), 'ms');
    console.log('[PerformanceMonitor] Draw Calls:', info.drawCalls, '/', this.TARGET_DRAW_CALLS, perf.drawCalls ? '✓' : '✗');
    console.log('[PerformanceMonitor] Triangles:', info.triangles, '/', this.TARGET_TRIANGLES, perf.triangles ? '✓' : '✗');
    console.log('[PerformanceMonitor] Textures:', info.textures);
    console.log('[PerformanceMonitor] Geometries:', info.geometries);
    console.log('[PerformanceMonitor] Programs:', info.programs);
    console.log('[PerformanceMonitor] Overall:', perf.overall ? 'GOOD ✓' : 'NEEDS OPTIMIZATION ✗');
    console.log('[PerformanceMonitor] ================');
  }

  /**
   * Reset renderer info counters
   */
  public reset(): void {
    this.renderer.info.reset();
  }
}
