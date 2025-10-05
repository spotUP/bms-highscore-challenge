import * as THREE from 'three';

interface TextSprite {
  sprite: THREE.Sprite;
  text: string;
  color: THREE.Color;
}

export class TextRenderer {
  private scene: THREE.Scene;
  private fontTexture: THREE.CanvasTexture;
  private fontCanvas: HTMLCanvasElement;
  private fontCtx: CanvasRenderingContext2D;
  private textSprites: Map<string, TextSprite> = new Map();

  // Font atlas configuration
  private readonly CHAR_WIDTH = 32;
  private readonly CHAR_HEIGHT = 48;
  private readonly CHARS_PER_ROW = 16;
  private readonly FONT_SIZE = 48;
  private readonly FONT_FAMILY = '"Press Start 2P", monospace';

  // Character set (ASCII 32-126)
  private readonly CHARSET = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
  private charMap: Map<string, { u: number; v: number }> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.generateFontAtlas();
  }

  private generateFontAtlas(): void {
    // Calculate atlas size (16 chars per row, 6 rows = 96 chars)
    const atlasWidth = this.CHAR_WIDTH * this.CHARS_PER_ROW;
    const atlasHeight = this.CHAR_HEIGHT * Math.ceil(this.CHARSET.length / this.CHARS_PER_ROW);

    // Create canvas for font atlas
    this.fontCanvas = document.createElement('canvas');
    this.fontCanvas.width = atlasWidth;
    this.fontCanvas.height = atlasHeight;
    this.fontCtx = this.fontCanvas.getContext('2d')!;

    // Configure canvas for crisp pixel rendering
    this.fontCtx.imageSmoothingEnabled = false;
    this.fontCtx.font = `${this.FONT_SIZE}px ${this.FONT_FAMILY}`;
    this.fontCtx.textBaseline = 'top';
    this.fontCtx.textAlign = 'left';

    // Draw characters to atlas
    let x = 0;
    let y = 0;

    for (let i = 0; i < this.CHARSET.length; i++) {
      const char = this.CHARSET[i];

      // Fill with white (will be colored via material)
      this.fontCtx.fillStyle = 'white';
      this.fontCtx.fillText(char, x + 4, y); // Small padding

      // Store UV coordinates for this character
      this.charMap.set(char, {
        u: x / atlasWidth,
        v: y / atlasHeight
      });

      // Move to next position
      x += this.CHAR_WIDTH;
      if (x >= atlasWidth) {
        x = 0;
        y += this.CHAR_HEIGHT;
      }
    }

    // Create Three.js texture from canvas
    this.fontTexture = new THREE.CanvasTexture(this.fontCanvas);
    this.fontTexture.magFilter = THREE.NearestFilter;
    this.fontTexture.minFilter = THREE.NearestFilter;
    this.fontTexture.generateMipmaps = false;

    console.log(`[TextRenderer] Font atlas generated (${atlasWidth}x${atlasHeight}, ${this.CHARSET.length} chars)`);
  }

  /**
   * Create or update text sprite
   * @param id Unique identifier for this text
   * @param text Text to display
   * @param x X position (game coordinates, top-left)
   * @param y Y position (game coordinates, top-left)
   * @param color Text color (CSS color or hex)
   * @param scale Text scale multiplier (default 1.0)
   */
  public setText(
    id: string,
    text: string,
    x: number,
    y: number,
    color: string | number = 0xffffff,
    scale: number = 1.0
  ): void {
    const existing = this.textSprites.get(id);

    if (existing) {
      // Update existing sprite
      this.updateTextSprite(existing, text, x, y, color, scale);
    } else {
      // Create new sprite
      this.createTextSprite(id, text, x, y, color, scale);
    }
  }

  private createTextSprite(
    id: string,
    text: string,
    x: number,
    y: number,
    color: string | number,
    scale: number
  ): void {
    // Create canvas for this text
    const textCanvas = this.renderTextToCanvas(text);
    const textTexture = new THREE.CanvasTexture(textCanvas);
    textTexture.magFilter = THREE.NearestFilter;
    textTexture.minFilter = THREE.NearestFilter;
    textTexture.generateMipmaps = false;

    // Create sprite material
    const material = new THREE.SpriteMaterial({
      map: textTexture,
      transparent: true,
      color: typeof color === 'string' ? new THREE.Color(color) : color
    });

    const sprite = new THREE.Sprite(material);

    // Position and scale sprite
    const spriteWidth = textCanvas.width * scale;
    const spriteHeight = textCanvas.height * scale;

    // Convert from game coordinates (top-left, Y-down) to Three.js (center, Y-up)
    sprite.position.set(
      x + spriteWidth / 2,
      800 - (y + spriteHeight / 2),
      10 // High Z value for UI layer
    );

    sprite.scale.set(spriteWidth, spriteHeight, 1);

    this.scene.add(sprite);

    // Store sprite
    this.textSprites.set(id, {
      sprite,
      text,
      color: new THREE.Color(color)
    });
  }

  private updateTextSprite(
    textSprite: TextSprite,
    text: string,
    x: number,
    y: number,
    color: string | number,
    scale: number
  ): void {
    const { sprite } = textSprite;

    // Update text if changed
    if (text !== textSprite.text) {
      const textCanvas = this.renderTextToCanvas(text);
      const textTexture = new THREE.CanvasTexture(textCanvas);
      textTexture.magFilter = THREE.NearestFilter;
      textTexture.minFilter = THREE.NearestFilter;
      textTexture.generateMipmaps = false;

      // Dispose old texture
      if (sprite.material.map) {
        sprite.material.map.dispose();
      }

      sprite.material.map = textTexture;
      sprite.material.needsUpdate = true;
      textSprite.text = text;

      // Update scale
      const spriteWidth = textCanvas.width * scale;
      const spriteHeight = textCanvas.height * scale;
      sprite.scale.set(spriteWidth, spriteHeight, 1);
    }

    // Update color if changed
    const newColor = new THREE.Color(color);
    if (!newColor.equals(textSprite.color)) {
      sprite.material.color.copy(newColor);
      textSprite.color.copy(newColor);
    }

    // Update position
    const spriteWidth = sprite.scale.x;
    const spriteHeight = sprite.scale.y;
    sprite.position.set(
      x + spriteWidth / 2,
      800 - (y + spriteHeight / 2),
      10
    );
  }

  private renderTextToCanvas(text: string): HTMLCanvasElement {
    // Calculate canvas size based on text length
    const width = text.length * this.CHAR_WIDTH;
    const height = this.CHAR_HEIGHT;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.font = `${this.FONT_SIZE}px ${this.FONT_FAMILY}`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'white';

    // Draw each character
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      ctx.fillText(char, i * this.CHAR_WIDTH + 4, 0);
    }

    return canvas;
  }

  /**
   * Remove text sprite
   */
  public removeText(id: string): void {
    const textSprite = this.textSprites.get(id);
    if (!textSprite) return;

    this.scene.remove(textSprite.sprite);

    // Dispose resources
    if (textSprite.sprite.material.map) {
      textSprite.sprite.material.map.dispose();
    }
    textSprite.sprite.material.dispose();

    this.textSprites.delete(id);
  }

  /**
   * Remove all text sprites
   */
  public removeAllText(): void {
    this.textSprites.forEach((_, id) => {
      this.removeText(id);
    });
  }

  /**
   * Update text position only (faster than setText)
   */
  public updatePosition(id: string, x: number, y: number): void {
    const textSprite = this.textSprites.get(id);
    if (!textSprite) return;

    const spriteWidth = textSprite.sprite.scale.x;
    const spriteHeight = textSprite.sprite.scale.y;

    textSprite.sprite.position.set(
      x + spriteWidth / 2,
      800 - (y + spriteHeight / 2),
      10
    );
  }

  /**
   * Show/hide text
   */
  public setVisible(id: string, visible: boolean): void {
    const textSprite = this.textSprites.get(id);
    if (!textSprite) return;

    textSprite.sprite.visible = visible;
  }

  public dispose(): void {
    // Dispose font texture
    this.fontTexture.dispose();

    // Remove all text sprites
    this.removeAllText();

    console.log('[TextRenderer] Disposed');
  }

  /**
   * Debug: Export font atlas as data URL
   */
  public getDebugFontAtlas(): string {
    return this.fontCanvas.toDataURL();
  }
}
