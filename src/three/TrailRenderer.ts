import * as THREE from 'three';
import { GeometryPool } from './GeometryPool';

/**
 * Trail Renderer using Instanced Rendering
 *
 * Phase 6 optimization: Uses InstancedMesh for efficient rendering of motion trails.
 * Each trail is a ring buffer of positions with alpha fade.
 *
 * Performance Benefits:
 * - Single draw call for all trail particles across all objects
 * - GPU-instanced rendering (1 draw call vs N draw calls)
 * - Efficient buffer updates (no geometry allocation per frame)
 * - Supports multiple objects (ball + 4 paddles) efficiently
 */

interface TrailParticle {
  position: THREE.Vector3;
  alpha: number;
  age: number; // 0-1, where 1 is oldest
  size: number; // Particle size
}

export class TrailRenderer {
  private scene: THREE.Scene;
  private instancedMesh: THREE.InstancedMesh;
  private maxTrailLength: number;

  // Trail data
  private trails: Map<string, TrailParticle[]>; // key = object id (ball, paddle_left, etc.)
  private currentParticleCount: number = 0;

  // Temporary objects for matrix calculations (avoid allocation per particle)
  private tempMatrix: THREE.Matrix4 = new THREE.Matrix4();
  private tempQuaternion: THREE.Quaternion = new THREE.Quaternion();
  private tempScale: THREE.Vector3 = new THREE.Vector3();

  // Trail configuration
  private baseParticleSize: number = 8; // Base size for trail particles
  private fadeRate: number = 0.95; // Alpha multiplier per frame (0.95 = medium fade)

  /**
   * Create trail renderer
   * @param scene Three.js scene to add trails to
   * @param maxTrailLength Maximum particles per trail
   * @param maxObjects Maximum number of objects that can have trails
   */
  constructor(scene: THREE.Scene, maxTrailLength: number = 30, maxObjects: number = 5) {
    this.scene = scene;
    this.maxTrailLength = maxTrailLength;
    this.trails = new Map();

    // Create instanced mesh for all trail particles
    // Use quad geometry from pool (will scale per instance)
    const geometry = GeometryPool.getQuadGeometry();

    // Basic material with transparency and additive blending
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    // Create instanced mesh with maximum capacity
    const maxInstances = maxTrailLength * maxObjects;
    this.instancedMesh = new THREE.InstancedMesh(geometry, material, maxInstances);
    this.instancedMesh.count = 0; // Start with no visible instances
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    // Create instance color attribute for per-instance alpha
    const colors = new Float32Array(maxInstances * 3);
    for (let i = 0; i < maxInstances; i++) {
      colors[i * 3] = 1.0;     // R
      colors[i * 3 + 1] = 1.0; // G
      colors[i * 3 + 2] = 1.0; // B
    }
    this.instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);

    // Z position slightly behind game objects to avoid occlusion
    this.instancedMesh.position.z = -0.1;

    this.scene.add(this.instancedMesh);

    console.log(`[TrailRenderer] Initialized with ${maxInstances} max instances (${maxObjects} objects × ${maxTrailLength} particles)`);
  }

  /**
   * Add a new trail particle for an object
   * @param objectId Unique identifier for the object (e.g., 'ball', 'paddle_left')
   * @param x X position
   * @param y Y position
   * @param size Size of the particle (defaults to base size)
   */
  public addTrailParticle(objectId: string, x: number, y: number, size: number = this.baseParticleSize): void {
    // Get or create trail for this object
    let trail = this.trails.get(objectId);
    if (!trail) {
      trail = [];
      this.trails.set(objectId, trail);
    }

    // Add new particle at position
    const particle: TrailParticle = {
      position: new THREE.Vector3(x, y, 0),
      alpha: 1.0,
      age: 0.0,
      size
    };

    trail.push(particle);

    // Remove oldest particle if trail is too long
    if (trail.length > this.maxTrailLength) {
      trail.shift();
    }
  }

  /**
   * Update trail rendering (call once per frame)
   * Should be called before rendering
   */
  public update(deltaTime: number = 0.016): void {
    let instanceIndex = 0;

    // Iterate through all trails
    this.trails.forEach((trail, objectId) => {
      // Update each particle in the trail
      for (let i = 0; i < trail.length; i++) {
        const particle = trail[i];

        // Age particle based on position in trail
        particle.age = i / Math.max(1, trail.length); // 0 = newest, 1 = oldest

        // Fade alpha over time
        particle.alpha *= this.fadeRate;

        // Skip if particle is too faded
        if (particle.alpha < 0.01) {
          continue;
        }

        // Set instance matrix (position and scale)
        // Scale decreases with age for nice tapering effect
        const scaleFactor = 1.0 - particle.age * 0.3; // 100% to 70% size
        this.tempScale.set(particle.size * scaleFactor, particle.size * scaleFactor, 1);
        this.tempMatrix.compose(particle.position, this.tempQuaternion, this.tempScale);
        this.instancedMesh.setMatrixAt(instanceIndex, this.tempMatrix);

        // Set instance color (RGB for color, use opacity for alpha)
        // All white for now, can add color variation later
        const color = this.instancedMesh.instanceColor!;
        const alpha = particle.alpha;
        color.setXYZ(instanceIndex, alpha, alpha, alpha);

        instanceIndex++;
      }

      // Remove particles that are too faded (cleanup)
      while (trail.length > 0 && trail[0].alpha < 0.01) {
        trail.shift();
      }
    });

    // Update instance count (how many instances to render)
    this.instancedMesh.count = instanceIndex;
    this.currentParticleCount = instanceIndex;

    // Mark matrices and colors as needing update
    if (instanceIndex > 0) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
      if (this.instancedMesh.instanceColor) {
        this.instancedMesh.instanceColor.needsUpdate = true;
      }
    }
  }

  /**
   * Clear all trails
   */
  public clearAll(): void {
    this.trails.clear();
    this.instancedMesh.count = 0;
    this.currentParticleCount = 0;
  }

  /**
   * Clear trail for specific object
   */
  public clearTrail(objectId: string): void {
    this.trails.delete(objectId);
  }

  /**
   * Set fade rate (how quickly trails disappear)
   * @param rate Value between 0-1 (0.98 = slow fade, 0.90 = fast fade, 0.95 = medium)
   */
  public setFadeRate(rate: number): void {
    this.fadeRate = Math.max(0, Math.min(1, rate));
  }

  /**
   * Set base particle size
   */
  public setParticleSize(size: number): void {
    this.baseParticleSize = size;
  }

  /**
   * Set trail color
   */
  public setColor(color: number): void {
    (this.instancedMesh.material as THREE.MeshBasicMaterial).color.set(color);
  }

  /**
   * Get current particle count (for debugging/profiling)
   */
  public getParticleCount(): number {
    return this.currentParticleCount;
  }

  /**
   * Get trail count (for debugging/profiling)
   */
  public getTrailCount(): number {
    return this.trails.size;
  }

  /**
   * Get statistics for performance monitoring
   */
  public getStats(): {
    particleCount: number;
    trailCount: number;
    maxInstances: number;
    instanceUsage: number;
  } {
    const maxInstances = this.instancedMesh.count;
    return {
      particleCount: this.currentParticleCount,
      trailCount: this.trails.size,
      maxInstances: maxInstances,
      instanceUsage: maxInstances > 0 ? this.currentParticleCount / maxInstances : 0
    };
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.scene.remove(this.instancedMesh);
    // Don't dispose geometry (it's pooled)
    (this.instancedMesh.material as THREE.Material).dispose();
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.array = new Float32Array(0);
    }
    this.trails.clear();
    console.log('[TrailRenderer] Disposed');
  }
}
