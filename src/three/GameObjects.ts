import * as THREE from 'three';
import { PickupAtlas } from './PickupAtlas';
import { TextRenderer } from './TextRenderer';
import { GeometryPool } from './GeometryPool';
import { TrailRenderer } from './TrailRenderer';

interface Pickup {
  mesh: THREE.Mesh;
  type: string;
  id: string;
}

export class GameObjects {
  private scene: THREE.Scene;
  private pickupAtlas: PickupAtlas | null = null;
  public textRenderer: TextRenderer;
  public trailRenderer: TrailRenderer;

  // Game entities
  public ball: THREE.Mesh;
  public paddles: {
    left: THREE.Mesh;
    right: THREE.Mesh;
    top: THREE.Mesh;
    bottom: THREE.Mesh;
  };
  public pickups: Map<string, Pickup> = new Map();

  // Velocity tracking
  private previousPositions: Map<THREE.Mesh, THREE.Vector2>;
  private velocities: Map<THREE.Mesh, THREE.Vector2>;
  private lastUpdateTime: number;

  // Trail configuration
  private trailsEnabled: boolean = true;
  private trailSpawnRate: number = 2; // Spawn trail every N frames

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.previousPositions = new Map();
    this.velocities = new Map();
    this.lastUpdateTime = performance.now();
    this.textRenderer = new TextRenderer(scene);
    this.trailRenderer = new TrailRenderer(scene, 30, 5); // 30 particles per trail, 5 objects (ball + 4 paddles)
    this.initBall();
    this.initPaddles();
    this.initVelocityTracking();
  }

  public setPickupAtlas(atlas: PickupAtlas): void {
    this.pickupAtlas = atlas;
    console.log('[GameObjects] Pickup atlas set');
  }

  private initBall(): void {
    // Use pooled geometry
    const geometry = GeometryPool.getBallGeometry();
    const material = GeometryPool.createMaterial({
      color: 0xffffff,
      transparent: true
    });

    this.ball = new THREE.Mesh(geometry, material);
    this.scene.add(this.ball);
  }

  private initPaddles(): void {
    const createPaddle = (color: number) => {
      // Use pooled paddle geometry (20x100 base size)
      const geometry = GeometryPool.getPaddleGeometry();
      const material = GeometryPool.createMaterial({ color });
      const mesh = new THREE.Mesh(geometry, material);
      this.scene.add(mesh);
      return mesh;
    };

    this.paddles = {
      left: createPaddle(0xff0000),   // Red
      right: createPaddle(0x00ff00),  // Green
      top: createPaddle(0x0000ff),    // Blue
      bottom: createPaddle(0xffff00)  // Yellow
    };

    // Rotate top/bottom paddles 90 degrees
    this.paddles.top.rotation.z = Math.PI / 2;
    this.paddles.bottom.rotation.z = Math.PI / 2;
  }

  public updateBall(x: number, y: number, size: number = 12): void {
    // Three.js uses center-based positioning
    // Convert from top-left (Canvas 2D) to center-based (Three.js)
    // Also flip Y axis (Canvas Y-down vs Three.js Y-up in our ortho camera)
    const threeX = x + size / 2;
    const threeY = 800 - (y + size / 2);
    this.ball.position.set(threeX, threeY, 0);

    // Update velocity tracking
    this.updateVelocity(this.ball);

    // Add trail particle for ball
    if (this.trailsEnabled) {
      this.trailRenderer.addTrailParticle('ball', threeX, threeY, size);
    }
  }

  public updatePaddle(
    paddle: THREE.Mesh,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    // Convert from top-left corner to center position
    const centerX = x + width / 2;
    const centerY = 800 - (y + height / 2);
    paddle.position.set(centerX, centerY, 0);

    // Update scale if paddle size changed (for pickup effects)
    const baseWidth = paddle === this.paddles.left || paddle === this.paddles.right ? 20 : 100;
    const baseHeight = paddle === this.paddles.left || paddle === this.paddles.right ? 100 : 20;
    paddle.scale.set(width / baseWidth, height / baseHeight, 1);

    // Update velocity tracking
    this.updateVelocity(paddle);

    // Add trail particle for paddle
    if (this.trailsEnabled) {
      // Determine paddle ID
      let paddleId = 'paddle_unknown';
      if (paddle === this.paddles.left) paddleId = 'paddle_left';
      else if (paddle === this.paddles.right) paddleId = 'paddle_right';
      else if (paddle === this.paddles.top) paddleId = 'paddle_top';
      else if (paddle === this.paddles.bottom) paddleId = 'paddle_bottom';

      // Use smaller particle size for paddles
      const particleSize = Math.min(width, height) * 0.3;
      this.trailRenderer.addTrailParticle(paddleId, centerX, centerY, particleSize);
    }
  }

  public setBallColor(color: string): void {
    const material = this.ball.material as THREE.MeshBasicMaterial;
    material.color.set(color);
  }

  public setPaddleColor(paddle: THREE.Mesh, color: string): void {
    const material = paddle.material as THREE.MeshBasicMaterial;
    material.color.set(color);
  }

  private initVelocityTracking(): void {
    // Initialize velocity tracking for all objects
    const allObjects = [
      this.ball,
      this.paddles.left,
      this.paddles.right,
      this.paddles.top,
      this.paddles.bottom
    ];

    allObjects.forEach(obj => {
      this.previousPositions.set(obj, new THREE.Vector2(obj.position.x, obj.position.y));
      this.velocities.set(obj, new THREE.Vector2(0, 0));
    });

    console.log('[GameObjects] Velocity tracking initialized for 5 objects');
  }

  private updateVelocity(mesh: THREE.Mesh): void {
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastUpdateTime) / 1000, 0.1); // Max 100ms to prevent spikes

    if (deltaTime > 0) {
      const currentPos = new THREE.Vector2(mesh.position.x, mesh.position.y);
      const prevPos = this.previousPositions.get(mesh) || currentPos.clone();

      // Calculate velocity (pixels per second)
      const velocity = currentPos.clone().sub(prevPos).divideScalar(deltaTime);

      // Clamp maximum velocity to prevent unrealistic blur
      const MAX_VELOCITY = 2000;
      const magnitude = velocity.length();
      if (magnitude > MAX_VELOCITY) {
        velocity.normalize().multiplyScalar(MAX_VELOCITY);
      }

      // Store velocity
      this.velocities.set(mesh, velocity);

      // Update previous position
      this.previousPositions.set(mesh, currentPos.clone());
    }

    this.lastUpdateTime = currentTime;
  }

  public getVelocities(): Map<THREE.Mesh, THREE.Vector2> {
    return this.velocities;
  }

  // Pickup management
  public addPickup(id: string, type: string, x: number, y: number, scale: number = 1): void {
    if (!this.pickupAtlas) {
      console.warn('[GameObjects] Cannot add pickup: atlas not set');
      return;
    }

    // Get UV coordinates from atlas
    const uvCoords = this.pickupAtlas.getUVCoords(type);
    if (!uvCoords) {
      console.warn(`[GameObjects] Unknown pickup type: ${type}`);
      return;
    }

    // Create pickup geometry (16x16 slot size, scaled by pickup scale)
    // Note: Cannot use pooled geometry here because each pickup needs unique UV coords
    const size = 16 * scale;
    const geometry = new THREE.PlaneGeometry(size, size);

    // Create material with atlas texture and UV mapping
    const material = GeometryPool.createMaterial({
      map: this.pickupAtlas.getTexture(),
      transparent: true,
      alphaTest: 0.1 // Discard fully transparent pixels
    });

    // Set UV coordinates for this specific pickup
    const [u_min, v_min, u_max, v_max] = uvCoords;
    const uvAttribute = geometry.attributes.uv as THREE.BufferAttribute;
    // Bottom-left
    uvAttribute.setXY(0, u_min, v_max);
    // Bottom-right
    uvAttribute.setXY(1, u_max, v_max);
    // Top-right
    uvAttribute.setXY(2, u_max, v_min);
    // Top-left
    uvAttribute.setXY(3, u_min, v_min);
    uvAttribute.needsUpdate = true;

    const mesh = new THREE.Mesh(geometry, material);

    // Position pickup (convert from top-left to center, flip Y)
    mesh.position.set(x + size / 2, 800 - (y + size / 2), 0.5); // Z=0.5 so pickups render above playfield

    this.scene.add(mesh);

    // Store pickup
    this.pickups.set(id, { mesh, type, id });
  }

  public updatePickup(id: string, x: number, y: number, scale: number = 1): void {
    const pickup = this.pickups.get(id);
    if (!pickup) return;

    const size = 16 * scale;
    pickup.mesh.position.set(x + size / 2, 800 - (y + size / 2), 0.5);

    // Update scale if changed
    pickup.mesh.scale.set(scale, scale, 1);
  }

  public removePickup(id: string): void {
    const pickup = this.pickups.get(id);
    if (!pickup) return;

    this.scene.remove(pickup.mesh);
    pickup.mesh.geometry.dispose();
    (pickup.mesh.material as THREE.Material).dispose();
    this.pickups.delete(id);
  }

  public removeAllPickups(): void {
    this.pickups.forEach((pickup) => {
      this.scene.remove(pickup.mesh);
      pickup.mesh.geometry.dispose();
      (pickup.mesh.material as THREE.Material).dispose();
    });
    this.pickups.clear();
  }

  // Trail management methods
  public setTrailsEnabled(enabled: boolean): void {
    this.trailsEnabled = enabled;
    if (!enabled) {
      this.trailRenderer.clearAll();
    }
  }

  public setTrailFadeRate(rate: number): void {
    this.trailRenderer.setFadeRate(rate);
  }

  public setTrailParticleSize(size: number): void {
    this.trailRenderer.setParticleSize(size);
  }

  public clearAllTrails(): void {
    this.trailRenderer.clearAll();
  }

  public updateTrails(deltaTime: number): void {
    this.trailRenderer.update(deltaTime);
  }

  public dispose(): void {
    // Dispose materials only (geometries are pooled and shared)
    // Ball
    (this.ball.material as THREE.Material).dispose();

    // Paddles
    Object.values(this.paddles).forEach(paddle => {
      (paddle.material as THREE.Material).dispose();
    });

    // Dispose pickups (these have individual geometries and materials)
    this.removeAllPickups();

    // Dispose text renderer
    this.textRenderer.dispose();

    // Dispose trail renderer
    this.trailRenderer.dispose();

    // Clear velocity tracking
    this.previousPositions.clear();
    this.velocities.clear();

    console.log('[GameObjects] Disposed (pooled geometries preserved)');
  }
}
