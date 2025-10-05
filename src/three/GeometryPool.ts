import * as THREE from 'three';

/**
 * Geometry Pool
 * Reuses geometries and materials to reduce memory allocations and improve performance
 * Singleton pattern ensures only one instance of each geometry exists
 */
export class GeometryPool {
  // Cached geometries
  private static quadGeometry: THREE.PlaneGeometry | null = null;
  private static ballGeometry: THREE.PlaneGeometry | null = null;
  private static paddleGeometry: THREE.PlaneGeometry | null = null;

  // Cached materials
  private static basicMaterials: Map<string, THREE.MeshBasicMaterial> = new Map();

  /**
   * Get shared quad geometry (1x1 unit square)
   * Use with scale for different sizes
   */
  public static getQuadGeometry(): THREE.PlaneGeometry {
    if (!this.quadGeometry) {
      this.quadGeometry = new THREE.PlaneGeometry(1, 1);
      console.log('[GeometryPool] Created shared quad geometry');
    }
    return this.quadGeometry;
  }

  /**
   * Get shared ball geometry (12x12 pixels)
   */
  public static getBallGeometry(): THREE.PlaneGeometry {
    if (!this.ballGeometry) {
      this.ballGeometry = new THREE.PlaneGeometry(12, 12);
      console.log('[GeometryPool] Created shared ball geometry');
    }
    return this.ballGeometry;
  }

  /**
   * Get shared paddle geometry (20x100 pixels - base size)
   * Use with scale for different paddle sizes
   */
  public static getPaddleGeometry(): THREE.PlaneGeometry {
    if (!this.paddleGeometry) {
      this.paddleGeometry = new THREE.PlaneGeometry(20, 100);
      console.log('[GeometryPool] Created shared paddle geometry');
    }
    return this.paddleGeometry;
  }

  /**
   * Get or create a basic material with specific color
   * Materials are cached by color hex string
   */
  public static getBasicMaterial(color: number | string, transparent: boolean = false): THREE.MeshBasicMaterial {
    const colorKey = `${color.toString()}_${transparent}`;

    let material = this.basicMaterials.get(colorKey);
    if (!material) {
      material = new THREE.MeshBasicMaterial({
        color: typeof color === 'string' ? new THREE.Color(color) : color,
        transparent
      });
      this.basicMaterials.set(colorKey, material);
      console.log('[GeometryPool] Created material for color:', colorKey);
    }

    return material;
  }

  /**
   * Create a new material instance (not pooled)
   * Use this when you need a material that will have unique properties
   */
  public static createMaterial(options: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial(options);
  }

  /**
   * Get statistics about pooled resources
   */
  public static getStats(): {
    geometries: number;
    materials: number;
  } {
    let geometryCount = 0;
    if (this.quadGeometry) geometryCount++;
    if (this.ballGeometry) geometryCount++;
    if (this.paddleGeometry) geometryCount++;

    return {
      geometries: geometryCount,
      materials: this.basicMaterials.size
    };
  }

  /**
   * Dispose all pooled resources (call on app shutdown)
   */
  public static dispose(): void {
    // Dispose geometries
    this.quadGeometry?.dispose();
    this.ballGeometry?.dispose();
    this.paddleGeometry?.dispose();

    this.quadGeometry = null;
    this.ballGeometry = null;
    this.paddleGeometry = null;

    // Dispose materials
    this.basicMaterials.forEach(material => material.dispose());
    this.basicMaterials.clear();

    console.log('[GeometryPool] Disposed all pooled resources');
  }
}
