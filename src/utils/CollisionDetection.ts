// 🎯 CENTRALIZED COLLISION DETECTION SYSTEM
// Replaces all scattered collision detection throughout the Pong app

export interface CollisionObject {
  x: number;
  y: number;
  width: number;
  height: number;
  vx?: number; // velocity for continuous collision detection
  vy?: number;
}

export interface Ball extends CollisionObject {
  size: number; // width and height are the same for balls
  lastTouchedBy?: string;
}

export interface Paddle extends CollisionObject {
  side: 'left' | 'right' | 'top' | 'bottom';
  playerId?: string;
  height: number;
}

export interface Wall {
  side: 'left' | 'right' | 'top' | 'bottom';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CollisionResult {
  hit: boolean;
  object1: CollisionObject;
  object2: CollisionObject;
  point: { x: number; y: number };
  normal: { x: number; y: number }; // collision normal vector
  penetration: number;
  side: 'left' | 'right' | 'top' | 'bottom';
  hitPosition: number; // 0-1 for paddles (where on the paddle was hit)
  continuous: boolean; // was this detected via continuous collision detection
}

export interface CollisionBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export class CollisionDetector {
  private static readonly COLLISION_BUFFER = 2; // Standard collision buffer
  private static readonly BOUNDARY_SPACING = 32; // Standard spacing from walls (matches rendering)

  // 🔧 Core collision detection utilities
  static getBounds(obj: CollisionObject): CollisionBounds {
    return {
      left: obj.x,
      right: obj.x + obj.width,
      top: obj.y,
      bottom: obj.y + obj.height
    };
  }

  static getBallBounds(ball: Ball): CollisionBounds {
    return {
      left: ball.x,
      right: ball.x + ball.size,
      top: ball.y,
      bottom: ball.y + ball.size
    };
  }

  // 🎯 AABB (Axis-Aligned Bounding Box) collision detection with buffer
  static detectAABB(obj1: CollisionObject, obj2: CollisionObject, buffer: number = 0): CollisionResult {
    const bounds1 = this.getBounds(obj1);
    const bounds2 = this.getBounds(obj2);

    const hit = bounds1.right + buffer > bounds2.left - buffer &&
                bounds1.left - buffer < bounds2.right + buffer &&
                bounds1.bottom + buffer > bounds2.top - buffer &&
                bounds1.top - buffer < bounds2.bottom + buffer;

    if (!hit) {
      return {
        hit: false,
        object1: obj1,
        object2: obj2,
        point: { x: 0, y: 0 },
        normal: { x: 0, y: 0 },
        penetration: 0,
        side: 'left',
        hitPosition: 0,
        continuous: false
      };
    }

    // Calculate collision details
    const overlapLeft = bounds1.right - bounds2.left;
    const overlapRight = bounds2.right - bounds1.left;
    const overlapTop = bounds1.bottom - bounds2.top;
    const overlapBottom = bounds2.bottom - bounds1.top;

    // Find minimum overlap to determine collision side
    const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

    let side: 'left' | 'right' | 'top' | 'bottom';
    let normal: { x: number; y: number };

    if (minOverlap === overlapLeft) {
      side = 'right';
      normal = { x: -1, y: 0 };
    } else if (minOverlap === overlapRight) {
      side = 'left';
      normal = { x: 1, y: 0 };
    } else if (minOverlap === overlapTop) {
      side = 'bottom';
      normal = { x: 0, y: -1 };
    } else {
      side = 'top';
      normal = { x: 0, y: 1 };
    }

    const collisionPoint = {
      x: (bounds1.left + bounds1.right + bounds2.left + bounds2.right) / 4,
      y: (bounds1.top + bounds1.bottom + bounds2.top + bounds2.bottom) / 4
    };

    return {
      hit: true,
      object1: obj1,
      object2: obj2,
      point: collisionPoint,
      normal,
      penetration: minOverlap,
      side,
      hitPosition: 0.5, // Default to center, calculated specifically for paddles
      continuous: false
    };
  }

  // 🚀 Continuous collision detection for fast-moving objects
  static detectContinuous(
    obj1: CollisionObject,
    obj2: CollisionObject,
    buffer: number = 0
  ): CollisionResult {
    if (!obj1.vx || !obj1.vy) {
      return this.detectAABB(obj1, obj2, buffer);
    }

    // Calculate next position
    const nextObj1 = {
      ...obj1,
      x: obj1.x + obj1.vx,
      y: obj1.y + obj1.vy
    };

    // Check if trajectory would cross the object
    const currentResult = this.detectAABB(obj1, obj2, buffer);
    const nextResult = this.detectAABB(nextObj1, obj2, buffer);

    if (nextResult.hit || currentResult.hit) {
      const result = nextResult.hit ? nextResult : currentResult;
      return {
        ...result,
        continuous: true
      };
    }

    return currentResult;
  }

  // 🏓 Specialized ball-paddle collision with hit position calculation
  static detectBallPaddle(ball: Ball, paddle: Paddle): CollisionResult {
    const ballBounds = this.getBallBounds(ball);
    const paddleBounds = this.getBounds(paddle);

    // Use continuous collision detection for moving balls
    const ballObj: CollisionObject = {
      x: ball.x,
      y: ball.y,
      width: ball.size,
      height: ball.size,
      vx: ball.vx,
      vy: ball.vy
    };

    const result = this.detectContinuous(ballObj, paddle, this.COLLISION_BUFFER);

    if (!result.hit) {
      return result;
    }

    // Calculate hit position (0 = start edge, 1 = end edge, 0.5 = center)
    let hitPosition: number;

    if (paddle.side === 'left' || paddle.side === 'right') {
      // Vertical paddles: hit position along Y axis
      const ballCenterY = ball.y + ball.size / 2;
      const paddleCenterY = paddle.y + paddle.height / 2;
      const relativeHit = (ballCenterY - paddleCenterY) / (paddle.height / 2);
      hitPosition = Math.max(0, Math.min(1, (relativeHit + 1) / 2));
    } else {
      // Horizontal paddles: hit position along X axis
      const ballCenterX = ball.x + ball.size / 2;
      const paddleCenterX = paddle.x + paddle.width / 2;
      const relativeHit = (ballCenterX - paddleCenterX) / (paddle.width / 2);
      hitPosition = Math.max(0, Math.min(1, (relativeHit + 1) / 2));
    }

    // Validate collision direction (ball should come from the correct side)
    const validDirection = this.validateCollisionDirection(ball, paddle);

    return {
      ...result,
      hitPosition,
      hit: result.hit && validDirection
    };
  }

  // 🧱 Validate that ball is approaching paddle from correct direction
  private static validateCollisionDirection(ball: Ball, paddle: Paddle): boolean {
    if (!ball.vx || !ball.vy) return true; // If no velocity, allow collision

    const ballCenterX = ball.x + ball.size / 2;
    const ballCenterY = ball.y + ball.size / 2;
    const paddleCenterX = paddle.x + paddle.width / 2;
    const paddleCenterY = paddle.y + paddle.height / 2;

    switch (paddle.side) {
      case 'left':
        return ball.vx < 0 && ballCenterX > paddleCenterX; // Ball moving left, coming from right
      case 'right':
        return ball.vx > 0 && ballCenterX < paddleCenterX; // Ball moving right, coming from left
      case 'top':
        return ball.vy > 0 && ballCenterY < paddleCenterY; // Ball moving down, coming from above (FIXED)
      case 'bottom':
        return ball.vy < 0 && ballCenterY > paddleCenterY; // Ball moving up, coming from below (FIXED)
      default:
        return true;
    }
  }

  // 🏆 Ball-wall collision detection for scoring
  static detectBallWall(ball: Ball, canvasWidth: number, canvasHeight: number): CollisionResult | null {
    const ballBounds = this.getBallBounds(ball);

    // Check each wall boundary
    if (ballBounds.right < -ball.size) {
      return this.createWallCollisionResult(ball, 'left', -ball.size, canvasHeight);
    }

    if (ballBounds.left > canvasWidth + ball.size) {
      return this.createWallCollisionResult(ball, 'right', canvasWidth + ball.size, canvasHeight);
    }

    if (ballBounds.bottom < -ball.size) {
      return this.createWallCollisionResult(ball, 'top', canvasWidth, -ball.size);
    }

    if (ballBounds.top > canvasHeight + ball.size) {
      return this.createWallCollisionResult(ball, 'bottom', canvasWidth, canvasHeight + ball.size);
    }

    return null;
  }

  private static createWallCollisionResult(
    ball: Ball,
    side: 'left' | 'right' | 'top' | 'bottom',
    boundaryX: number,
    boundaryY: number
  ): CollisionResult {
    const wallObj: CollisionObject = {
      x: side === 'left' ? boundaryX : side === 'right' ? boundaryX : 0,
      y: side === 'top' ? boundaryY : side === 'bottom' ? boundaryY : 0,
      width: side === 'top' || side === 'bottom' ? boundaryX : 1,
      height: side === 'left' || side === 'right' ? boundaryY : 1
    };

    return {
      hit: true,
      object1: ball,
      object2: wallObj,
      point: { x: ball.x + ball.size / 2, y: ball.y + ball.size / 2 },
      normal: side === 'left' ? { x: 1, y: 0 } :
              side === 'right' ? { x: -1, y: 0 } :
              side === 'top' ? { x: 0, y: 1 } : { x: 0, y: -1 },
      penetration: 0,
      side,
      hitPosition: 0.5,
      continuous: false
    };
  }

  // ⚔️ Paddle-to-paddle collision detection (for corner cases)
  static detectPaddlePaddle(paddle1: Paddle, paddle2: Paddle): CollisionResult {
    return this.detectAABB(paddle1, paddle2, this.COLLISION_BUFFER);
  }

  // 🎯 Generic pickup/object collision
  static detectBallPickup(ball: Ball, pickup: CollisionObject): CollisionResult {
    const ballObj: CollisionObject = {
      x: ball.x,
      y: ball.y,
      width: ball.size,
      height: ball.size
    };

    return this.detectAABB(ballObj, pickup, this.COLLISION_BUFFER);
  }

  // 🌍 Get standard game boundaries (32px spacing)
  static getGameBoundaries(canvasWidth: number, canvasHeight: number): Wall[] {
    return [
      { side: 'left', x: 0, y: 0, width: this.BOUNDARY_SPACING, height: canvasHeight },
      { side: 'right', x: canvasWidth - this.BOUNDARY_SPACING, y: 0, width: this.BOUNDARY_SPACING, height: canvasHeight },
      { side: 'top', x: 0, y: 0, width: canvasWidth, height: this.BOUNDARY_SPACING },
      { side: 'bottom', x: 0, y: canvasHeight - this.BOUNDARY_SPACING, width: canvasWidth, height: this.BOUNDARY_SPACING }
    ];
  }
}

// 🎮 Collision Manager - orchestrates all collision detection
export class CollisionManager {
  private eventHandlers: Map<string, ((result: CollisionResult) => void)[]> = new Map();

  // Register collision event handlers
  on(eventType: string, handler: (result: CollisionResult) => void): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  // Emit collision events
  private emit(eventType: string, result: CollisionResult): void {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.forEach(handler => handler(result));
  }

  // 🚀 MAIN COLLISION DETECTION - replaces all scattered collision code
  detectAllCollisions(gameState: any, canvasWidth: number, canvasHeight: number): CollisionResult[] {
    const results: CollisionResult[] = [];

    const ball: Ball = {
      x: gameState.ball.x,
      y: gameState.ball.y,
      size: gameState.ball.size,
      width: gameState.ball.size,
      height: gameState.ball.size,
      vx: gameState.ball.dx,
      vy: gameState.ball.dy,
      lastTouchedBy: gameState.ball.lastTouchedBy
    };

    // 🏓 Ball-Paddle Collisions
    const paddles: Paddle[] = [
      { ...gameState.paddles.left, side: 'left' as const },
      { ...gameState.paddles.right, side: 'right' as const },
      ...(gameState.paddles.top ? [{ ...gameState.paddles.top, side: 'top' as const }] : []),
      ...(gameState.paddles.bottom ? [{ ...gameState.paddles.bottom, side: 'bottom' as const }] : [])
    ];

    paddles.forEach(paddle => {
      const result = CollisionDetector.detectBallPaddle(ball, paddle);
      if (result.hit) {
        results.push(result);
        this.emit('ball-paddle', result);
      }
    });

    // ⚔️ Paddle-Paddle Collisions (corner cases)
    for (let i = 0; i < paddles.length; i++) {
      for (let j = i + 1; j < paddles.length; j++) {
        const result = CollisionDetector.detectPaddlePaddle(paddles[i], paddles[j]);
        if (result.hit) {
          results.push(result);
          this.emit('paddle-paddle', result);
        }
      }
    }

    // 🏆 Ball-Wall Collisions (scoring)
    const wallResult = CollisionDetector.detectBallWall(ball, canvasWidth, canvasHeight);
    if (wallResult) {
      results.push(wallResult);
      this.emit('ball-wall', wallResult);
    }

    // 🎯 Ball-Pickup Collisions
    if (gameState.pickups) {
      gameState.pickups.forEach((pickup: any) => {
        const result = CollisionDetector.detectBallPickup(ball, pickup);
        if (result.hit) {
          results.push(result);
          this.emit('ball-pickup', result);
        }
      });
    }

    // 🟠 Extra Ball Collisions
    if (gameState.extraBalls) {
      gameState.extraBalls.forEach((extraBall: any, index: number) => {
        const extraBallObj: Ball = {
          x: extraBall.x,
          y: extraBall.y,
          size: extraBall.size,
          width: extraBall.size,
          height: extraBall.size,
          vx: extraBall.dx,
          vy: extraBall.dy
        };

        // Extra ball vs paddles
        paddles.forEach(paddle => {
          const result = CollisionDetector.detectBallPaddle(extraBallObj, paddle);
          if (result.hit) {
            results.push({ ...result, object1: { ...result.object1, extraBallIndex: index } });
            this.emit('extra-ball-paddle', result);
          }
        });

        // Extra ball vs walls
        const wallResult = CollisionDetector.detectBallWall(extraBallObj, canvasWidth, canvasHeight);
        if (wallResult) {
          results.push({ ...wallResult, object1: { ...wallResult.object1, extraBallIndex: index } });
          this.emit('extra-ball-wall', wallResult);
        }
      });
    }

    return results;
  }
}