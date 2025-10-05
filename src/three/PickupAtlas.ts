import * as THREE from 'three';

// Import pickup patterns from Pong404.tsx
// Each pattern is a 4x4 boolean array
type PickupPattern = boolean[][];

interface PickupPatterns {
  [key: string]: PickupPattern;
}

export class PickupAtlas {
  private texture: THREE.CanvasTexture;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pickupNames: string[] = [];
  private pickupMap: Map<string, number> = new Map();

  // Atlas configuration
  private readonly PICKUP_SIZE = 4; // 4x4 pixel patterns
  private readonly SLOT_SIZE = 16; // 16x16 pixel slots (with padding)
  private readonly SLOTS_PER_ROW = 8;
  private readonly TOTAL_ROWS = 6; // 8x6 = 48 slots (enough for 41 pickups)

  constructor(patterns: PickupPatterns) {
    // Calculate atlas dimensions
    const atlasWidth = this.SLOT_SIZE * this.SLOTS_PER_ROW;
    const atlasHeight = this.SLOT_SIZE * this.TOTAL_ROWS;

    // Create canvas for atlas
    this.canvas = document.createElement('canvas');
    this.canvas.width = atlasWidth;
    this.canvas.height = atlasHeight;
    this.ctx = this.canvas.getContext('2d')!;

    // Clear to transparent
    this.ctx.clearRect(0, 0, atlasWidth, atlasHeight);

    // Generate atlas from patterns
    this.generateAtlas(patterns);

    // Create Three.js texture
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter; // Pixel-perfect rendering
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;

    console.log(`[PickupAtlas] Generated atlas with ${this.pickupNames.length} pickups (${atlasWidth}x${atlasHeight})`);
  }

  private generateAtlas(patterns: PickupPatterns): void {
    let index = 0;

    for (const [name, pattern] of Object.entries(patterns)) {
      if (index >= this.SLOTS_PER_ROW * this.TOTAL_ROWS) {
        console.warn(`[PickupAtlas] Too many pickups! Skipping ${name}`);
        break;
      }

      // Calculate slot position in atlas
      const col = index % this.SLOTS_PER_ROW;
      const row = Math.floor(index / this.SLOTS_PER_ROW);
      const slotX = col * this.SLOT_SIZE;
      const slotY = row * this.SLOT_SIZE;

      // Center the 4x4 pattern in the 16x16 slot
      const offsetX = slotX + (this.SLOT_SIZE - this.PICKUP_SIZE) / 2;
      const offsetY = slotY + (this.SLOT_SIZE - this.PICKUP_SIZE) / 2;

      // Draw pattern pixel by pixel
      this.ctx.fillStyle = '#ffffff';
      for (let py = 0; py < 4; py++) {
        for (let px = 0; px < 4; px++) {
          if (pattern[py] && pattern[py][px]) {
            this.ctx.fillRect(
              Math.floor(offsetX + px),
              Math.floor(offsetY + py),
              1,
              1
            );
          }
        }
      }

      // Store mapping
      this.pickupNames.push(name);
      this.pickupMap.set(name, index);
      index++;
    }
  }

  public getTexture(): THREE.CanvasTexture {
    return this.texture;
  }

  /**
   * Get UV coordinates for a pickup by name
   * Returns [u_min, v_min, u_max, v_max] for texture mapping
   */
  public getUVCoords(pickupName: string): [number, number, number, number] | null {
    const index = this.pickupMap.get(pickupName);
    if (index === undefined) {
      console.warn(`[PickupAtlas] Pickup not found: ${pickupName}`);
      return null;
    }

    const col = index % this.SLOTS_PER_ROW;
    const row = Math.floor(index / this.SLOTS_PER_ROW);

    const atlasWidth = this.SLOT_SIZE * this.SLOTS_PER_ROW;
    const atlasHeight = this.SLOT_SIZE * this.TOTAL_ROWS;

    const u_min = (col * this.SLOT_SIZE) / atlasWidth;
    const v_min = (row * this.SLOT_SIZE) / atlasHeight;
    const u_max = ((col + 1) * this.SLOT_SIZE) / atlasWidth;
    const v_max = ((row + 1) * this.SLOT_SIZE) / atlasHeight;

    return [u_min, v_min, u_max, v_max];
  }

  /**
   * Get the index of a pickup by name (for uniform arrays)
   */
  public getPickupIndex(pickupName: string): number {
    return this.pickupMap.get(pickupName) ?? -1;
  }

  /**
   * Get all pickup names in atlas order
   */
  public getPickupNames(): string[] {
    return [...this.pickupNames];
  }

  public dispose(): void {
    this.texture.dispose();
  }

  /**
   * Debug: Export atlas as data URL for inspection
   */
  public getDebugDataURL(): string {
    return this.canvas.toDataURL();
  }
}
