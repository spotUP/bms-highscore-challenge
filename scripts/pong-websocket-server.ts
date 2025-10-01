import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Force redeploy - 2025-09-26T16:47:00Z - Root directory already empty, forcing webhook

// 🎯 CENTRALIZED COLLISION DETECTION SYSTEM (Server-side)
// Import the same collision detection logic used by the client
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Import collision detection from client-side module
// We'll need to create a compatible interface since we can't directly import TypeScript modules
interface CollisionObject {
  x: number;
  y: number;
  width: number;
  height: number;
  vx?: number; // velocity for continuous collision detection
  vy?: number;
}

interface Ball extends CollisionObject {
  size: number; // width and height are the same for balls
  lastTouchedBy?: string;
  spin?: number; // Angular velocity for curve balls (rad/sec)
}

interface Paddle extends CollisionObject {
  side: 'left' | 'right' | 'top' | 'bottom';
  playerId?: string;
  height: number;
}

interface CollisionResult {
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

// Server-side Collision Detector using the same logic as client
// 🏓 CENTRALIZED PADDLE DIMENSIONS - matches client-side constants
const PADDLE_LENGTH = 140; // Length of paddles in their movement direction
const PADDLE_THICKNESS = 12; // Thickness of all paddles (matches border thickness)

class ServerCollisionDetector {
  private static readonly COLLISION_BUFFER = 0; // No buffer for pixel-perfect collision detection

  // 🎮 ARKANOID-STYLE PHYSICS PARAMETERS
  private static readonly BASE_BALL_SPEED = 5; // Base speed (pixels per frame)
  private static readonly MIN_ANGLE_DEG = 15; // Minimum bounce angle (prevents too shallow)
  private static readonly MAX_ANGLE_DEG = 75; // Maximum bounce angle (prevents too steep)
  private static readonly PADDLE_INFLUENCE = 0.3; // How much paddle velocity affects ball (0-1)

  // 🌀 SPIN MECHANICS (Curve Ball Physics)
  private static readonly SPIN_TRANSFER = 1.2; // How much paddle velocity becomes spin (0-1) - INCREASED for much easier curves
  private static readonly MAGNUS_FORCE = 0.05; // Magnus effect strength (curve amount) - REDUCED for subtler curves
  private static readonly SPIN_DECAY = 0.995; // Spin reduces by 0.5% per frame - MUCH SLOWER decay (keeps spin longer)
  private static readonly MAX_SPIN = 12; // Maximum spin rate (rad/sec) - INCREASED for stronger curves

  // 🎯 Apply Arkanoid-style physics to ball bounce with spin
  static applyArkanoidPhysics(
    ball: { dx: number; dy: number; x: number; y: number; size: number; spin?: number },
    paddle: { x: number; y: number; width: number; height: number; side: string; velocity?: number },
    hitPosition: number // 0-1, where 0.5 is center
  ): { dx: number; dy: number; spin: number } {
    const currentSpeed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
    const targetSpeed = this.BASE_BALL_SPEED;

    // Calculate relative hit position (-1 to 1, where 0 is center)
    const relativeHit = (hitPosition - 0.5) * 2;

    // Paddle velocity influence (moving paddle adds momentum)
    const paddleVelocity = paddle.velocity || 0;
    const paddleInfluence = paddleVelocity * this.PADDLE_INFLUENCE;

    let newDx = ball.dx;
    let newDy = ball.dy;

    if (paddle.side === 'left' || paddle.side === 'right') {
      // Vertical paddles - calculate angle based on hit position
      // Hit position affects vertical angle: center = straight, edges = angled
      const baseAngle = relativeHit * (this.MAX_ANGLE_DEG - this.MIN_ANGLE_DEG);
      const angleRad = (baseAngle * Math.PI) / 180;

      // Direction based on paddle side
      const direction = paddle.side === 'left' ? 1 : -1;

      // Calculate new velocity with angle
      newDx = direction * targetSpeed * Math.cos(angleRad);
      newDy = targetSpeed * Math.sin(angleRad) + paddleInfluence;

      // Ensure minimum horizontal velocity
      const minDx = targetSpeed * Math.cos((this.MAX_ANGLE_DEG * Math.PI) / 180);
      if (Math.abs(newDx) < minDx) {
        newDx = direction * minDx;
      }
    } else {
      // Horizontal paddles - calculate angle based on hit position
      const baseAngle = relativeHit * (this.MAX_ANGLE_DEG - this.MIN_ANGLE_DEG);
      const angleRad = (baseAngle * Math.PI) / 180;

      // Direction based on paddle side
      const direction = paddle.side === 'top' ? 1 : -1;

      // Calculate new velocity with angle
      newDy = direction * targetSpeed * Math.cos(angleRad);
      newDx = targetSpeed * Math.sin(angleRad) + paddleInfluence;

      // Ensure minimum vertical velocity
      const minDy = targetSpeed * Math.cos((this.MAX_ANGLE_DEG * Math.PI) / 180);
      if (Math.abs(newDy) < minDy) {
        newDy = direction * minDy;
      }
    }

    // Normalize to maintain constant speed
    const newSpeed = Math.sqrt(newDx * newDx + newDy * newDy);
    const speedRatio = targetSpeed / newSpeed;
    newDx *= speedRatio;
    newDy *= speedRatio;

    // 🌀 CALCULATE SPIN from paddle velocity
    // Paddle moving perpendicular to ball direction creates spin
    // Spin direction: paddle moving up/right = positive spin (clockwise)
    let newSpin = paddleVelocity * this.SPIN_TRANSFER;

    // Clamp spin to maximum
    newSpin = Math.max(-this.MAX_SPIN, Math.min(this.MAX_SPIN, newSpin));

    if (Math.abs(newSpin) > 0.5) {
      console.log(`🌀 SPIN APPLIED: ${newSpin.toFixed(2)} (from paddle velocity: ${paddleVelocity.toFixed(2)})`);
    }

    return { dx: newDx, dy: newDy, spin: newSpin };
  }

  // 🌀 Apply Magnus effect (spin creates curve)
  static applyMagnusEffect(ball: { dx: number; dy: number; spin: number }): { dx: number; dy: number } {
    if (!ball.spin || Math.abs(ball.spin) < 0.1) {
      return { dx: ball.dx, dy: ball.dy }; // No spin, no curve
    }

    // Magnus force is perpendicular to velocity
    // Positive spin curves right/down, negative spin curves left/up
    const speed = Math.sqrt(ball.dx * ball.dx + ball.dy * ball.dy);
    const angle = Math.atan2(ball.dy, ball.dx);

    // Perpendicular angle (90 degrees rotated)
    const perpAngle = angle + Math.PI / 2;

    // Magnus force magnitude based on spin and speed
    const magnusStrength = ball.spin * this.MAGNUS_FORCE;

    // Apply Magnus force
    const curveX = Math.cos(perpAngle) * magnusStrength;
    const curveY = Math.sin(perpAngle) * magnusStrength;

    let newDx = ball.dx + curveX;
    let newDy = ball.dy + curveY;

    // Increase speed when spinning - spin adds energy (very minimal boost)
    const spinSpeedBoost = 1 + (Math.abs(ball.spin) * 0.005); // Up to ~6% faster at max spin (12 * 0.005 = 0.06)
    newDx *= spinSpeedBoost;
    newDy *= spinSpeedBoost;

    if (Math.abs(magnusStrength) > 0.5) {
      console.log(`🌊 MAGNUS CURVE: spin=${ball.spin.toFixed(2)}, curve=(${curveX.toFixed(2)}, ${curveY.toFixed(2)}), boost=${spinSpeedBoost.toFixed(2)}x, velocity=(${ball.dx.toFixed(2)}, ${ball.dy.toFixed(2)}) → (${newDx.toFixed(2)}, ${newDy.toFixed(2)})`);
    }

    return {
      dx: newDx,
      dy: newDy
    };
  }

  // 🏓 Ball-paddle collision with hit position calculation
  static detectBallPaddle(ball: Ball, paddle: Paddle): CollisionResult {
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

    return {
      ...result,
      hitPosition
    };
  }

  // 🚀 Continuous collision detection for fast-moving objects
  static detectContinuous(
    obj1: CollisionObject,
    obj2: CollisionObject,
    buffer: number = 0
  ): CollisionResult {
    // Check if object has velocity (checking for existence AND non-zero)
    if (!obj1.vx && !obj1.vy) {
      return this.detectAABB(obj1, obj2, buffer);
    }

    // Calculate next position
    const nextObj1 = {
      ...obj1,
      x: obj1.x + (obj1.vx || 0),
      y: obj1.y + (obj1.vy || 0)
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

  // 🎯 AABB collision detection with buffer
  static detectAABB(obj1: CollisionObject, obj2: CollisionObject, buffer: number = 0): CollisionResult {
    const bounds1 = {
      left: obj1.x,
      right: obj1.x + obj1.width,
      top: obj1.y,
      bottom: obj1.y + obj1.height
    };
    const bounds2 = {
      left: obj2.x,
      right: obj2.x + obj2.width,
      top: obj2.y,
      bottom: obj2.y + obj2.height
    };

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

  // 🏆 Ball-wall collision detection for scoring
  static detectBallWall(ball: Ball, canvasWidth: number, canvasHeight: number): CollisionResult | null {
    // Check if ball goes past canvas boundaries (fixed to trigger at edge, not 2x past)
    if (ball.x + ball.size < 0) {
      return this.createWallCollisionResult(ball, 'left', canvasWidth, canvasHeight);
    }

    if (ball.x > canvasWidth) {
      return this.createWallCollisionResult(ball, 'right', canvasWidth, canvasHeight);
    }

    if (ball.y + ball.size < 0) {
      return this.createWallCollisionResult(ball, 'top', canvasWidth, canvasHeight);
    }

    if (ball.y > canvasHeight) {
      return this.createWallCollisionResult(ball, 'bottom', canvasWidth, canvasHeight);
    }

    return null;
  }

  private static createWallCollisionResult(
    ball: Ball,
    side: 'left' | 'right' | 'top' | 'bottom',
    canvasWidth: number,
    canvasHeight: number
  ): CollisionResult {
    const wallObj: CollisionObject = {
      x: side === 'left' ? 0 : side === 'right' ? canvasWidth : 0,
      y: side === 'top' ? 0 : side === 'bottom' ? canvasHeight : 0,
      width: side === 'top' || side === 'bottom' ? canvasWidth : 1,
      height: side === 'left' || side === 'right' ? canvasHeight : 1
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
}

// Server-side collision detection constants (match client-side values)
const COLLISION_BUFFER = 0; // No buffer for pixel-perfect collision detection
const BORDER_THICKNESS = 12; // Border thickness to match client-side visual rendering
const SPEED_BOOST = 1.02; // Speed boost for collision excitement

// Types for game entities
interface Pickup {
  id: string;
  x: number;
  y: number;
  type: 'speed_up' | 'speed_down' | 'big_ball' | 'small_ball' | 'drunk_ball' | 'grow_paddle' | 'shrink_paddle' | 'reverse_controls' | 'invisible_ball' | 'multi_ball' | 'freeze_opponent' | 'super_speed' | 'coin_shower' | 'gravity_in_space' | 'super_striker' | 'sticky_paddles' | 'machine_gun' | 'dynamic_playfield' | 'switch_sides' | 'time_warp' | 'portal_ball' | 'mirror_mode' | 'quantum_ball' | 'black_hole' | 'lightning_storm' | 'invisible_paddles' | 'ball_trail_mine' | 'paddle_swap' | 'disco_mode' | 'pac_man' | 'banana_peel' | 'rubber_ball' | 'drunk_paddles' | 'magnet_ball' | 'balloon_ball' | 'earthquake' | 'confetti_cannon' | 'hypno_ball' | 'conga_line' | 'arkanoid' | 'attractor' | 'repulsor' | 'wind' | 'great_wall' | 'labyrinth';
  createdAt: number;
  size?: number;
}

interface MazeWall {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LabyrinthCoin {
  id: string;
  x: number;
  y: number;
  collected: boolean;
  collectedAt?: number;
  rotation?: number;
}

interface Coin {
  id: string;
  x: number;
  y: number;
  createdAt: number;
  size: number;
  collected?: boolean;
  collectedAt?: number;
  rotation?: number;
}

interface ActiveEffect {
  type: 'speed_up' | 'speed_down' | 'big_ball' | 'small_ball' | 'drunk_ball' | 'grow_paddle' | 'shrink_paddle' | 'reverse_controls' | 'invisible_ball' | 'multi_ball' | 'freeze_opponent' | 'super_speed' | 'coin_shower' | 'gravity_in_space' | 'super_striker' | 'sticky_paddles' | 'machine_gun' | 'dynamic_playfield' | 'switch_sides' | 'blocker' | 'time_warp' | 'portal_ball' | 'mirror_mode' | 'quantum_ball' | 'black_hole' | 'lightning_storm' | 'invisible_paddles' | 'ball_trail_mine' | 'paddle_swap' | 'disco_mode' | 'pac_man' | 'banana_peel' | 'rubber_ball' | 'drunk_paddles' | 'magnet_ball' | 'balloon_ball' | 'earthquake' | 'confetti_cannon' | 'hypno_ball' | 'conga_line' | 'arkanoid' | 'attractor' | 'repulsor' | 'wind' | 'great_wall';
  startTime: number;
  duration: number;
  originalValue?: any;
  side?: string;
  x?: number; // Position for force fields
  y?: number;
  activator?: string; // For reverse_controls - who activated it
  excludePaddle?: string; // For freeze_opponent - which paddle to exclude from freeze
}

interface GameState {
  ball: {
    x: number;
    y: number;
    dx: number;
    dy: number;
    size: number;
    originalSize: number;
    isDrunk: boolean;
    drunkAngle: number;
    isTeleporting: boolean;
    lastTeleportTime: number;
    stuckCheckStartTime: number;
    stuckCheckStartX: number;
    lastTouchedBy: 'left' | 'right' | 'top' | 'bottom' | null;
    previousTouchedBy: 'left' | 'right' | 'top' | 'bottom' | null;
    hasGravity: boolean;
    isAiming: boolean;
    aimStartTime: number;
    aimX: number;
    aimY: number;
    aimTargetX: number;
    aimTargetY: number;
    spin: number; // 🌀 Curve ball spin rate
    spinDistanceTraveled: number; // 🌀 Distance traveled since last paddle hit (for delayed curve)
    // New pickup properties
    isStuck: boolean;
    stuckToPaddle: 'left' | 'right' | 'top' | 'bottom' | null;
    stuckStartTime: number;
    stuckOffset: { x: number; y: number };
    hasPortal: boolean;
    portalX: number;
    portalY: number;
    isMirror: boolean;
    mirrorBalls: any[];
    isQuantum: boolean;
    quantumPositions: { x: number; y: number }[];
    quantumLastJump?: number;
    hasTrailMines: boolean;
    trailMines: any[];
    lastMineDropTime?: number;
    isSlippery: boolean;
    bounciness: number;
    isMagnetic: boolean;
    isFloating: boolean;
    isHypnotic: boolean;
    hasWind: boolean;
    hasGreatWall: boolean;
    greatWallSide: 'left' | 'right' | 'top' | 'bottom' | null;
  };
  paddles: {
    left: { y: number; height: number; width: number; speed: number; velocity: number; targetY: number; originalHeight: number };
    right: { y: number; height: number; width: number; speed: number; velocity: number; targetY: number; originalHeight: number };
    top: { x: number; height: number; width: number; speed: number; velocity: number; targetX: number; originalWidth: number };
    bottom: { x: number; height: number; width: number; speed: number; velocity: number; targetX: number; originalWidth: number };
  };
  score: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  isPlaying: boolean;
  showStartScreen: boolean;
  gameMode: 'auto' | 'player' | 'multiplayer';
  colorIndex: number;
  isPaused: boolean;
  pauseEndTime: number;
  winner: 'left' | 'right' | 'top' | 'bottom' | null;
  gameEnded: boolean;
  decrunchEffect: {
    isActive: boolean;
    startTime: number;
    duration: number;
  };
  pickups: Pickup[];
  coins: Coin[];
  nextPickupTime: number;
  activeEffects: ActiveEffect[];
  pickupEffect: {
    isActive: boolean;
    startTime: number;
    x: number;
    y: number;
  };
  rumbleEffect: {
    isActive: boolean;
    startTime: number;
    intensity: number;
  };
  // New pickup effect properties
  machineGunBalls: any[];
  machineGunActive: boolean;
  machineGunStartTime: number;
  machineGunShooter: 'left' | 'right' | 'top' | 'bottom' | null;
  stickyPaddlesActive: boolean;
  playfieldScale: number;
  playfieldScaleTarget: number;
  playfieldScaleStart: number;
  playfieldScaleTime: number;
  walls: any[];
  timeWarpActive: boolean;
  timeWarpFactor: number;
  blackHoles: any[];
  lightningStrikes: any[];
  paddleVisibility: { left: number; right: number; top: number; bottom: number };
  discoMode: boolean;
  discoStartTime: number;
  sidesSwitched: boolean;
  paddleSwapActive: boolean;
  nextPaddleSwapTime: number;
  pacMans: any[];
  paddlesDrunk: boolean;
  paddlesDrunkAngle?: number;
  drunkStartTime: number;
  earthquakeActive: boolean;
  earthquakeStartTime: number;
  lastLightningTime?: number;
  confetti: any[];
  hypnoStartTime: number;
  congaBalls: any[];
  extraBalls: any[];
  // Arkanoid mode properties
  arkanoidBricks: any[];
  arkanoidActive: boolean;
  arkanoidMode: boolean;
  // Labyrinth mode properties
  labyrinthActive: boolean;
  mazeWalls: MazeWall[];
  labyrinthCoins: LabyrinthCoin[];
  labyrinthStartTime: number;
  arkanoidBricksHit: number;
  isDebugMode: boolean;
}

interface Player {
  id: string;
  side: 'left' | 'right' | 'top' | 'bottom' | 'spectator';
  ws: any;
  roomId: string;
  lastSeen: number;
  lastPaddleSequence?: number; // Track sequence to ignore out-of-order updates
}

interface GameRoom {
  id: string;
  gameState: GameState;
  players: Map<string, Player>;
  gamemaster: string | null;
  lastUpdate: number;
  isActive: boolean;
  canvasSize: { width: number; height: number };
}

class PongWebSocketServer {
  private wss: WebSocketServer;
  private server: any;
  private rooms: Map<string, GameRoom> = new Map();
  private players: Map<string, Player> = new Map();
  private port: number;
  private instanceId: string;
  private lastLogTime: number = 0;
  private lastPickupLog: number = 0;

  constructor(port = 3002) {
    this.port = port;
    this.instanceId = Math.random().toString(36).substr(2, 9);
    this.server = createServer();

    // Handle port already in use error before starting
    this.server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[✖] Port ${this.port} is already in use!`);
        console.error(`[✖] Another WebSocket server is already running.`);
        console.error(`[✖] Please stop the existing server before starting a new one.`);
        process.exit(1);
      } else {
        console.error(`[✖] Server error:`, err);
        process.exit(1);
      }
    });

    this.wss = new WebSocketServer({
      server: this.server,
      perMessageDeflate: true, // Enable compression for better network performance
      maxPayload: 1024 * 1024 // 1MB
    });
    this.setupWebSocketHandlers();
    this.createPersistentMainRoom();
    this.startCleanupInterval();
    this.startGameLoop();
  }

  private setupWebSocketHandlers() {
    this.wss.on('connection', (ws) => {
      const connectionTime = Date.now();
      console.log('[▶] New WebSocket connection at', new Date().toISOString());
      let playerId: string | null = null;

      // Enhanced connection tracking
      (ws as any)._connectionTime = connectionTime;

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          // console.log('📨 Received message:', data);
          this.handleMessage(ws, data);
          playerId = data.playerId || playerId;
        } catch (error) {
          console.error('[X] Error parsing message:', error);
          ws.send(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });

      ws.on('close', (code, reason) => {
        const closeTime = Date.now();
        const connectionDuration = closeTime - (ws as any)._connectionTime;
        console.log('🔌 WebSocket disconnected');
        console.log(`   ├─ Close code: ${code}`);
        console.log(`   ├─ Reason: ${reason ? reason.toString() : 'none'}`);
        console.log(`   ├─ Connection duration: ${connectionDuration}ms`);
        console.log(`   └─ Player ID: ${playerId || 'none'}`);

        if (playerId) {
          this.handlePlayerDisconnect(playerId);
        }
      });

      ws.on('error', (error) => {
        console.error('[X] WebSocket error:', error);
      });
    });
  }

  private handleMessage(ws: any, message: any) {
    // Support both old and new compact message formats
    const type = message.type || message.t;
    const playerId = message.playerId || message.p;
    const roomId = message.roomId || message.r;
    const data = message.data || message.d;

    // Map compact types to full types
    const fullType = {
      'up': 'update_paddle',
      'ugsd': 'update_game_state_delta',
      'jr': 'join_room',
      'ugs': 'update_game_state',
      'rr': 'reset_room'
    }[type] || type;

    switch (fullType) {
      case 'join_room':
        this.handleJoinRoom(ws, playerId, roomId, data?.forceSpectator);
        break;
      case 'update_paddle':
        // Handle compact paddle data format
        const paddleData = data?.v !== undefined ? {
          y: data.y,
          velocity: data.v,
          targetY: data.tY
        } : data;
        this.handlePaddleUpdate(playerId, paddleData);
        break;
      case 'update_game_state':
        this.handleGameStateUpdate(playerId, roomId, data);
        break;
      case 'update_game_state_delta':
        this.handleGameStateDeltaUpdate(playerId, roomId, data);
        break;
      case 'reset_room':
        this.handleResetRoom(playerId, roomId);
        break;
      case 'ping':
        // Respond to ping with pong to keep connection alive
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        if (playerId) {
          const player = this.players.get(playerId);
          if (player) player.lastSeen = Date.now();
        }
        break;
      case 'test_pickup':
        console.log(`🔧 Received test_pickup message: playerId=${playerId}, roomId=${roomId}, pickupType=${message.pickupType || data?.pickupType}`);
        this.handleTestPickup(playerId, roomId, message.pickupType || data?.pickupType);
        break;
      case 'reset_paddle_sizes':
        this.handleResetPaddleSizes(playerId, roomId);
        break;
      default:
        console.log('[?] Unknown message type:', fullType, 'original:', type);
    }
  }

  private handleJoinRoom(ws: any, playerId: string, roomId: string, forceSpectator?: boolean) {
    console.log(`🏓 Player ${playerId} joining room ${roomId} (Instance: ${this.instanceId})`);
    console.log(`   ├─ Current rooms: ${this.rooms.size}`);
    console.log(`   ├─ Current players: ${this.players.size}`);

    // Get or create room
    let room = this.rooms.get(roomId);
    if (!room) {
      console.log(`   ├─ Creating new room: ${roomId}`);
      room = this.createNewRoom(roomId);
      this.rooms.set(roomId, room);
    } else {
      console.log(`   ├─ Found existing room with ${room.players.size} players`);
    }

    // Determine player side
    let playerSide: 'left' | 'right' | 'top' | 'bottom' | 'spectator' = 'spectator';

    // DISABLED: Force spectator mode for main room (was for 4-AI testing environment)
    if (false && roomId === 'main') {
      console.log(`   ├─ Main room detected - forcing spectator mode for 4-AI testing`);
      playerSide = 'spectator';
    } else if (forceSpectator) {
      console.log(`   ├─ Player ${playerId} forced to spectator mode`);
      playerSide = 'spectator';
    } else {
      const leftPlayer = Array.from(room.players.values()).find(p => p.side === 'left');
      const rightPlayer = Array.from(room.players.values()).find(p => p.side === 'right');
      const topPlayer = Array.from(room.players.values()).find(p => p.side === 'top');
      const bottomPlayer = Array.from(room.players.values()).find(p => p.side === 'bottom');

      if (!rightPlayer) {
        playerSide = 'right';
        if (!room.gamemaster) room.gamemaster = playerId;
      } else if (!leftPlayer) {
        playerSide = 'left';
      } else if (!topPlayer) {
        playerSide = 'top';
      } else if (!bottomPlayer) {
        playerSide = 'bottom';
      } else {
        // All 4 positions are taken, join as spectator
        playerSide = 'spectator';
        console.log(`   ├─ All 4 positions taken, player ${playerId} joining as spectator`);
      }
    }

    // Create player
    const player: Player = {
      id: playerId,
      side: playerSide,
      ws,
      roomId,
      lastSeen: Date.now()
    };

    // Add player to room and global players map
    room.players.set(playerId, player);
    this.players.set(playerId, player);

    // Send join confirmation
    ws.send(JSON.stringify({
      type: 'joined_room',
      data: {
        playerId,
        roomId,
        playerSide,
        isGameMaster: room.gamemaster === playerId,
        playerCount: room.players.size,
        gameState: room.gameState
      }
    }));

    // Notify other players
    this.broadcastToRoom(roomId, {
      type: 'player_joined',
      data: {
        playerId,
        playerSide,
        playerCount: room.players.size
      }
    }, playerId);

    console.log(`[✓] Player ${playerId} joined as ${playerSide} (${room.players.size} total players)`);

    // RESET and START fresh game when human players join (server-authoritative)
    if (room.players.size >= 1) {
      // Activate room for game loop processing
      room.isActive = true;

      // Reset all game state for fresh human game
      room.gameState.score = { left: 0, right: 0, top: 0, bottom: 0 };
      room.gameState.winner = null;
      room.gameState.gameEnded = false;
      room.gameState.isPlaying = true;
      room.gameState.showStartScreen = false;
      room.gameState.gameMode = 'multiplayer';
      room.gameState.isPaused = false;
      room.gameState.pauseEndTime = 0;
      // Reset ball to center
      room.gameState.ball.x = 400;
      room.gameState.ball.y = 300;
      // Reduce ball velocity to make gameplay more reasonable (was 10, now 3)
      room.gameState.ball.dx = Math.random() > 0.5 ? 3 : -3;
      room.gameState.ball.dy = Math.random() > 0.5 ? 3 : -3;
      // Reset all paddle sizes to original
      room.gameState.paddles.left.height = room.gameState.paddles.left.originalHeight;
      room.gameState.paddles.right.height = room.gameState.paddles.right.originalHeight;
      room.gameState.paddles.top.width = room.gameState.paddles.top.originalWidth;
      room.gameState.paddles.bottom.width = room.gameState.paddles.bottom.originalWidth;

      // Reset all pickup states
      room.gameState.activeEffects = [];
      room.gameState.extraBalls = [];
      room.gameState.coins = [];
      room.gameState.stickyPaddlesActive = false;
      room.gameState.machineGunActive = false;
      room.gameState.earthquakeActive = false;

      console.log(`🎮 FRESH GAME STARTED in room ${roomId} with ${room.players.size} player(s) - All scores reset to 0-0-0-0`);
    }
  }

  private handlePaddleUpdate(playerId: string, data: any) {
    const player = this.players.get(playerId);
    if (!player) return;

    const room = this.rooms.get(player.roomId);
    if (!room) return;

    // Check sequence number to ignore out-of-order updates
    if (data.seq && player.lastPaddleSequence && data.seq <= player.lastPaddleSequence) {
      // This is an old update that arrived out of order - ignore it
      return;
    }
    player.lastPaddleSequence = data.seq;

    player.lastSeen = Date.now();

    // Save old position before update
    const oldPositions = {
      left: { x: room.gameState.paddles.left.x, y: room.gameState.paddles.left.y },
      right: { x: room.gameState.paddles.right.x, y: room.gameState.paddles.right.y },
      top: { x: room.gameState.paddles.top.x, y: room.gameState.paddles.top.y },
      bottom: { x: room.gameState.paddles.bottom.x, y: room.gameState.paddles.bottom.y }
    };

    // Update paddle position in game state
    if (player.side === 'left') {
      room.gameState.paddles.left.y = data.y;
      room.gameState.paddles.left.velocity = data.velocity || 0;
      room.gameState.paddles.left.targetY = data.targetY || data.y;
    } else if (player.side === 'right') {
      room.gameState.paddles.right.y = data.y;
      room.gameState.paddles.right.velocity = data.velocity || 0;
      room.gameState.paddles.right.targetY = data.targetY || data.y;
    } else if (player.side === 'top') {
      room.gameState.paddles.top.x = data.x;
      room.gameState.paddles.top.velocity = data.velocity || 0;
      room.gameState.paddles.top.targetX = data.targetX || data.x;
    } else if (player.side === 'bottom') {
      room.gameState.paddles.bottom.x = data.x;
      room.gameState.paddles.bottom.velocity = data.velocity || 0;
      room.gameState.paddles.bottom.targetX = data.targetX || data.x;
    }

    // Apply drunk paddle effect (erratic movement) - only to opponents
    if (room.gameState.paddlesDrunk) {
      const drunkEffect = room.gameState.activeEffects.find(e => e.type === 'drunk_paddles');
      const shouldBeDrunk = drunkEffect && drunkEffect.activator !== player.side;

      if (shouldBeDrunk) {
        const drunkTime = Date.now() - room.gameState.drunkStartTime;
        const drunkIntensity = 30; // Maximum pixel offset
        const drunkFrequency = 0.005; // Oscillation speed

        // Create erratic sine wave movement
        const offset = Math.sin(drunkTime * drunkFrequency) * drunkIntensity;

        if (player.side === 'left' || player.side === 'right') {
          const paddle = room.gameState.paddles[player.side];
          paddle.y += offset;
          // Clamp to boundaries (border is outside playfield, so 0 to height)
          const maxY = this.canvasSize.height - paddle.height;
          paddle.y = Math.max(0, Math.min(paddle.y, maxY));
        } else {
          const paddle = room.gameState.paddles[player.side];
          paddle.x += offset;
          // Clamp to boundaries (border is outside playfield, so 0 to width)
          const maxX = this.canvasSize.width - paddle.width;
          paddle.x = Math.max(0, Math.min(paddle.x, maxX));
        }
      }
    }

    // DISABLED: Paddle-to-paddle collision (causing physics issues)
    // In 4-player Pong, paddles can overlap in corners

    // Broadcast paddle update to other players
    // Use the actual game state position (which may have been reverted by collision detection)
    const updateData: any = {
      side: player.side,
      velocity: data.velocity
    };

    // Add appropriate position data based on paddle side (from game state, not from client data)
    if (player.side === 'left') {
      updateData.y = room.gameState.paddles.left.y;
      updateData.targetY = room.gameState.paddles.left.targetY;
    } else if (player.side === 'right') {
      updateData.y = room.gameState.paddles.right.y;
      updateData.targetY = room.gameState.paddles.right.targetY;
    } else if (player.side === 'top') {
      updateData.x = room.gameState.paddles.top.x;
      updateData.targetX = room.gameState.paddles.top.targetX;
    } else if (player.side === 'bottom') {
      updateData.x = room.gameState.paddles.bottom.x;
      updateData.targetX = room.gameState.paddles.bottom.targetX;
    }

    this.broadcastToRoom(player.roomId, {
      type: 'paddle_updated',
      data: updateData
    }, playerId);
  }

  private handleGameStateUpdate(playerId: string, roomId: string, gameState: GameState) {
    const room = this.rooms.get(roomId);
    if (!room || room.gamemaster !== playerId) return;

    const player = this.players.get(playerId);
    if (player) player.lastSeen = Date.now();

    // Update room game state
    room.gameState = { ...gameState };
    room.lastUpdate = Date.now();

    // Broadcast to all other players
    this.broadcastToRoom(roomId, {
      type: 'game_state_updated',
      data: gameState
    }, playerId);
  }

  private handleGameStateDeltaUpdate(playerId: string, roomId: string, deltaData: any) {
    const room = this.rooms.get(roomId);
    if (!room || room.gamemaster !== playerId) return;

    const player = this.players.get(playerId);
    if (player) player.lastSeen = Date.now();

    // Apply delta to room game state
    if (deltaData.ball) {
      room.gameState.ball = { ...room.gameState.ball, ...deltaData.ball };
    }

    // CRITICAL FIX: Server is authoritative for scoring - never accept score updates from clients
    // Clients should never send score data in a server-authoritative architecture
    // All scoring is handled by server-side ball physics and collision detection
    if (deltaData.score) {
      console.log('🚨 IGNORED: Client attempted to send score update - server is authoritative for scoring');
      console.log('   ├─ Attempted score update:', deltaData.score);
      console.log('   ├─ Current server score:', room.gameState.score);
      // Do not apply client score updates
    }

    if (deltaData.isPlaying !== undefined) room.gameState.isPlaying = deltaData.isPlaying;
    if (deltaData.showStartScreen !== undefined) room.gameState.showStartScreen = deltaData.showStartScreen;
    if (deltaData.isPaused !== undefined) room.gameState.isPaused = deltaData.isPaused;
    if (deltaData.winner !== undefined) room.gameState.winner = deltaData.winner;
    if (deltaData.gameEnded !== undefined) room.gameState.gameEnded = deltaData.gameEnded;

    if (deltaData.pickups) room.gameState.pickups = deltaData.pickups;
    if (deltaData.coins) room.gameState.coins = deltaData.coins;
    if (deltaData.nextPickupTime !== undefined) room.gameState.nextPickupTime = deltaData.nextPickupTime;

    if (deltaData.activeEffects) room.gameState.activeEffects = deltaData.activeEffects;

    if (deltaData.pickupEffect) room.gameState.pickupEffect = deltaData.pickupEffect;
    if (deltaData.decrunchEffect) room.gameState.decrunchEffect = deltaData.decrunchEffect;

    room.lastUpdate = Date.now();

    // Broadcast delta to all other players
    this.broadcastToRoom(roomId, {
      type: 'update_game_state_delta',
      data: deltaData
    }, playerId);
  }

  private handleResetRoom(playerId: string, roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room || room.gamemaster !== playerId) return;

    // Reset game state
    room.gameState = this.createInitialGameState();
    room.lastUpdate = Date.now();

    // Broadcast reset to all players
    this.broadcastToRoom(roomId, {
      type: 'game_reset',
      data: room.gameState
    });

    console.log(`[↻] Room ${roomId} reset by gamemaster ${playerId}`);
  }

  private handleResetPaddleSizes(playerId: string, roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      console.log(`[X] Reset paddle sizes failed: Room ${roomId} not found`);
      return;
    }

    console.log(`🔧 Resetting all paddle sizes to original in room ${roomId}`);

    // Reset all paddle sizes to original
    room.gameState.paddles.left.height = room.gameState.paddles.left.originalHeight;
    room.gameState.paddles.right.height = room.gameState.paddles.right.originalHeight;
    room.gameState.paddles.top.width = room.gameState.paddles.top.originalWidth;
    room.gameState.paddles.bottom.width = room.gameState.paddles.bottom.originalWidth;

    // Broadcast updated game state
    this.broadcastToRoom(roomId, {
      type: 'game_state',
      data: room.gameState
    });
  }


  private handleTestPickup(playerId: string, roomId: string, pickupType: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      console.log(`[X] Test pickup failed: Room ${roomId} not found`);
      return;
    }

    console.log(`🔧 Test pickup activated: ${pickupType} in room ${roomId}`);

    // Enable debug mode to disable random pickup spawning
    room.gameState.isDebugMode = true;

    // Clear all existing pickups and effects
    room.gameState.pickups = [];
    room.gameState.activeEffects = [];
    room.gameState.coins = [];
    room.gameState.walls = [];
    room.gameState.confetti = [];
    room.gameState.congaBalls = [];
    room.gameState.labyrinthCoins = [];
    room.gameState.mazeWalls = [];
    room.gameState.labyrinthActive = false;
    room.gameState.arkanoidBricks = [];
    room.gameState.arkanoidActive = false;

    // Reset ball effects
    room.gameState.ball.isDrunk = false;
    room.gameState.ball.isStuck = false;
    room.gameState.ball.stuckToPaddle = null;
    room.gameState.ball.hasPortal = false;
    room.gameState.ball.isMirror = false;
    room.gameState.ball.mirrorBalls = [];
    room.gameState.ball.isQuantum = false;
    room.gameState.ball.quantumPositions = [];
    room.gameState.ball.hasTrailMines = false;
    room.gameState.ball.trailMines = [];
    room.gameState.ball.isSlippery = false;
    room.gameState.ball.bounciness = 1;
    room.gameState.ball.isMagnetic = false;
    room.gameState.ball.isFloating = false;
    room.gameState.ball.isHypnotic = false;
    room.gameState.ball.hasWind = false;
    room.gameState.ball.hasGreatWall = false;
    room.gameState.ball.greatWallSide = null;
    room.gameState.ball.hasGravity = false;
    room.gameState.ball.isAiming = false;
    room.gameState.ball.aimStartTime = 0;
    room.gameState.ball.aimX = 0;
    room.gameState.ball.aimY = 0;

    // Reset paddle effects (but NOT paddle sizes - let them animate)
    room.gameState.paddlesDrunk = false;
    room.gameState.drunkStartTime = 0;
    room.gameState.earthquakeActive = false;
    room.gameState.earthquakeStartTime = 0;
    room.gameState.discoMode = false;
    room.gameState.discoStartTime = 0;
    room.gameState.hypnoStartTime = 0;
    room.gameState.stickyPaddlesActive = false;
    room.gameState.machineGunActive = false;
    room.gameState.machineGunBalls = [];
    room.gameState.extraBalls = [];

    // DON'T reset paddle sizes here - let the grow/shrink effects handle it
    // This allows the animation to work properly without constant resets

    // Reset ball size to original (except for ball size pickups)
    if (pickupType !== 'big_ball' && pickupType !== 'small_ball') {
      room.gameState.ball.size = room.gameState.ball.originalSize;
    }

    // Find which side this player is on
    const player = room.players.get(playerId);
    if (player) {
      // Set lastTouchedBy to the player's side so pickups affect the correct paddle
      room.gameState.ball.lastTouchedBy = player.side;
      console.log(`🔧 Test pickup: Player ${playerId} is on ${player.side} side - will affect ${player.side} paddle`);
      console.log(`🔧 Current paddle sizes: left=${room.gameState.paddles.left.height}, right=${room.gameState.paddles.right.height}, top=${room.gameState.paddles.top.width}, bottom=${room.gameState.paddles.bottom.width}`);
    } else {
      console.log(`🔧 Test pickup: Player ${playerId} NOT FOUND in room`);
    }

    // Create a virtual pickup at ball position
    const pickup: Pickup = {
      id: `test_${Date.now()}`,
      x: room.gameState.ball.x,
      y: room.gameState.ball.y,
      type: pickupType as any,
      createdAt: Date.now(),
      size: 32
    };

    // Activate the pickup immediately
    this.applyPickupEffect(room.gameState, pickup, roomId);

    // Broadcast updated game state
    this.broadcastToRoom(roomId, {
      type: 'game_state',
      data: room.gameState
    });
  }

  private handlePlayerDisconnect(playerId: string) {
    const player = this.players.get(playerId);
    if (!player) return;

    const room = this.rooms.get(player.roomId);
    if (room) {
      room.players.delete(playerId);

      // If gamemaster left, assign new gamemaster
      if (room.gamemaster === playerId && room.players.size > 0) {
        const newGamemaster = Array.from(room.players.keys())[0];
        room.gamemaster = newGamemaster;

        // Notify new gamemaster
        const newGM = room.players.get(newGamemaster);
        if (newGM) {
          newGM.ws.send(JSON.stringify({
            type: 'gamemaster_assigned',
            data: { isGameMaster: true }
          }));
        }
      }

      // Check if we need to promote a spectator to fill the leaving player's position
      let promotedSpectator = false;
      let replacementType = 'ai';

      if (player.side !== 'spectator') {
        // Find a spectator to promote to the leaving player's position
        const spectators = Array.from(room.players.values()).filter(p => p.side === 'spectator');
        if (spectators.length > 0) {
          const spectator = spectators[0];
          spectator.side = player.side;
          promotedSpectator = true;
          replacementType = 'spectator';

          // Notify the promoted spectator
          spectator.ws.send(JSON.stringify({
            type: 'joined_room',
            data: {
              playerSide: player.side,
              isGameMaster: false,
              playerCount: room.players.size
            }
          }));

          console.log(`[↻] Spectator ${spectator.id} promoted to ${player.side} position`);
        }
      }

      // Clean up empty rooms (except main room which is persistent)
      if (room.players.size === 0 && player.roomId !== 'main') {
        this.rooms.delete(player.roomId);
        console.log(`🗑️ Empty room ${player.roomId} deleted`);
      } else if (room.players.size === 0 && player.roomId === 'main') {
        console.log(`[⌂] Main room kept alive (empty but persistent)`);
      } else {
        // Notify remaining players
        this.broadcastToRoom(player.roomId, {
          type: 'player_left',
          data: {
            playerId,
            playerSide: player.side,
            playerCount: room.players.size,
            replacementType,
            promotedSpectator
          }
        });
      }

      // Stop game when last human player disconnects (save server resources)
      if (room.players.size === 0) {
        room.gameState.isPlaying = false;
        room.gameState.isPaused = false;
        room.gameState.pauseEndTime = 0;
        console.log(`⏸️ Game stopped in room ${player.roomId} - no human players remaining`);
      }
    }

    this.players.delete(playerId);
    console.log(`👋 Player ${playerId} disconnected`);
  }

  private broadcastToRoom(roomId: string, message: any, excludePlayerId?: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const messageStr = JSON.stringify(message);
    room.players.forEach((player) => {
      if (player.id !== excludePlayerId && player.ws.readyState === 1) {
        try {
          player.ws.send(messageStr);
        } catch (error) {
          console.error(`[X] Error sending message to player ${player.id}:`, error);
        }
      }
    });
  }

  private createNewRoom(roomId: string): GameRoom {
    return {
      id: roomId,
      gameState: this.createInitialGameState(),
      players: new Map(),
      gamemaster: null,
      lastUpdate: Date.now(),
      isActive: false, // Start inactive - activate when first player joins
      canvasSize: { width: 800, height: 800 }
    };
  }

  private createInitialGameState(): GameState {
    return {
      ball: {
        x: 400,
        y: 300,
        dx: 10,
        dy: Math.random() > 0.5 ? 10 : -10, // Random vertical direction
        size: 12,
        originalSize: 12,
        isDrunk: false,
        drunkAngle: 0,
        isTeleporting: false,
        lastTeleportTime: 0,
        stuckCheckStartTime: 0,
        stuckCheckStartX: 0,
        lastTouchedBy: null,
        previousTouchedBy: null,
        hasGravity: false,
        isAiming: false,
        aimStartTime: 0,
        aimX: 0,
        aimY: 0,
        aimTargetX: 0,
        aimTargetY: 0,
        spin: 0, // 🌀 Initial spin is 0
        spinDistanceTraveled: 0, // 🌀 Initial distance is 0
        // Extended ball properties
        isStuck: false,
        stuckToPaddle: null,
        stuckStartTime: 0,
        stuckOffset: { x: 0, y: 0 },
        hasPortal: false,
        portalX: 0,
        portalY: 0,
        isMirror: false,
        mirrorBalls: [],
        isQuantum: false,
        quantumPositions: [],
        hasTrailMines: false,
        trailMines: [],
        isSlippery: false,
        bounciness: 1,
        isMagnetic: false,
        isFloating: false,
        isHypnotic: false,
        hasWind: false,
        hasGreatWall: false,
        greatWallSide: null
      },
      paddles: {
        left: { x: BORDER_THICKNESS * 2, y: 250, height: PADDLE_LENGTH, width: PADDLE_THICKNESS, speed: 32, velocity: 0, targetY: 250, originalHeight: PADDLE_LENGTH },
        right: { x: 800 - PADDLE_THICKNESS - (BORDER_THICKNESS * 2), y: 250, height: PADDLE_LENGTH, width: PADDLE_THICKNESS, speed: 32, velocity: 0, targetY: 250, originalHeight: PADDLE_LENGTH },
        top: { x: 360, y: 60, height: PADDLE_THICKNESS, width: PADDLE_LENGTH, speed: 32, velocity: 0, targetX: 360, originalWidth: PADDLE_LENGTH },
        bottom: { x: 360, y: 728, height: PADDLE_THICKNESS, width: PADDLE_LENGTH, speed: 32, velocity: 0, targetX: 360, originalWidth: PADDLE_LENGTH }
      },
      score: {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0
      },
      isPlaying: true, // Auto-start for 4-AI testing (skip start screen)
      showStartScreen: false, // Skip start screen for testing
      gameMode: 'multiplayer' as const,
      colorIndex: 0,
      isPaused: false,
      pauseEndTime: 0,
      winner: null,
      gameEnded: false,
      decrunchEffect: {
        isActive: false,
        startTime: 0,
        duration: 0
      },
      pickups: [],
      coins: [],
      nextPickupTime: Date.now() + 5000, // First pickup in 5 seconds
      activeEffects: [],
      pickupEffect: {
        isActive: false,
        startTime: 0,
        x: 0,
        y: 0
      },
      rumbleEffect: {
        isActive: false,
        startTime: 0,
        intensity: 0
      },
      // Pickup effect properties
      machineGunBalls: [],
      machineGunActive: false,
      machineGunStartTime: 0,
      machineGunShooter: null,
      stickyPaddlesActive: false,
      playfieldScale: 1,
      playfieldScaleTarget: 1,
      playfieldScaleStart: 1,
      playfieldScaleTime: 0,
      walls: [],
      timeWarpActive: false,
      timeWarpFactor: 1,
      blackHoles: [],
      lightningStrikes: [],
      paddleVisibility: { left: 1, right: 1, top: 1, bottom: 1 },
      discoMode: false,
      discoStartTime: 0,
      sidesSwitched: false,
      paddleSwapActive: false,
      nextPaddleSwapTime: 0,
      pacMans: [],
      paddlesDrunk: false,
      drunkStartTime: 0,
      earthquakeActive: false,
      earthquakeStartTime: 0,
      confetti: [],
      hypnoStartTime: 0,
      congaBalls: [],
      extraBalls: [],
      // Arkanoid mode properties
      arkanoidBricks: [],
      arkanoidActive: false,
      arkanoidMode: false,
      // Labyrinth mode properties
      labyrinthActive: false,
      mazeWalls: [],
      labyrinthCoins: [],
      labyrinthStartTime: 0,
      arkanoidBricksHit: 0,
      isDebugMode: false
    };
  }


  private startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      const timeout = 30000; // 30 seconds

      // Clean up inactive players
      this.players.forEach((player, playerId) => {
        if (now - player.lastSeen > timeout) {
          console.log(`[~] Cleaning up inactive player ${playerId}`);
          this.handlePlayerDisconnect(playerId);
        }
      });

      // Deactivate rooms with no players (except main room which persists)
      this.rooms.forEach((room, roomId) => {
        if (room.players.size === 0 && room.isActive) {
          console.log(`[~] Deactivating empty room ${roomId}`);
          room.isActive = false;
          room.gameState.isPlaying = false;
        }

        // Clean up non-main rooms after timeout
        if (roomId !== 'main' && now - room.lastUpdate > timeout && room.players.size === 0) {
          console.log(`[~] Cleaning up inactive room ${roomId}`);
          this.rooms.delete(roomId);
        }
      });
    }, 10000); // Check every 10 seconds
  }

  private createPersistentMainRoom() {
    // Create the main room that persists even when empty
    const mainRoom = this.createNewRoom('main');
    this.rooms.set('main', mainRoom);

    // Don't auto-start game - wait for players to join
    mainRoom.isActive = false;
    mainRoom.gameState.isPlaying = false;
    console.log(`[⌂] Persistent main room created (idle until players join)`);
  }

  private startGameLoop() {
    // Server-side game loop running at 60 FPS for smooth physics
    const GAME_LOOP_FPS = 60;
    const GAME_LOOP_INTERVAL = 1000 / GAME_LOOP_FPS;

    setInterval(() => {
      this.updateGameLogic();
    }, GAME_LOOP_INTERVAL);

    // console.log(`[↻] Server game loop started at ${GAME_LOOP_FPS} FPS`);
  }

  private updateGameLogic() {
    const now = Date.now();

    this.rooms.forEach((room, roomId) => {
      // Only update active game rooms - allow AI-only games for testing
      if (!room.isActive) return;

      const gameState = room.gameState;
      const canvasSize = room.canvasSize;

      // Check if pause timer has expired
      if (gameState.isPaused && gameState.pauseEndTime > 0 && Date.now() >= gameState.pauseEndTime) {
        gameState.isPaused = false;
        gameState.pauseEndTime = 0;
        console.log('⏰ Pause timer expired, resuming game');
      }

      // Minimal server status logging
      if (this.lastLogTime === 0) this.lastLogTime = now;
      // Reduced logging frequency to every 5 seconds
      if (now - this.lastLogTime > 5000) {
        console.log('⚡ Server Status:', {
          ballPos: gameState.ball.x + ',' + gameState.ball.y,
          isPlaying: gameState.isPlaying,
          players: room.players.size
        });
        this.lastLogTime = now;
      }

      let gameStateChanged = false;

      // Only update ball/pickup/effect physics if game is playing and not paused
      if (gameState.isPlaying && !gameState.isPaused && !gameState.gameEnded) {
        // Update ball physics (with ALL pickup effects disabled)
        const ballPhysicsChanged = this.updateBallPhysics(gameState, canvasSize, roomId);
        if (ballPhysicsChanged) {
          gameStateChanged = true;
        }

        // Physics debug removed for cleaner console

        // Handle pickups generation and collision
        if (this.updatePickups(gameState, canvasSize, now, roomId)) {
          gameStateChanged = true;
        }

        // Update active effects
        if (this.updateActiveEffects(gameState, now)) {
          gameStateChanged = true;
        }
      }

      // 📐 Update playfield scaling animation (always, even when paused)
      if (this.updatePlayfieldScale(gameState, now)) {
        gameStateChanged = true;
      }

      // Broadcast debug removed for cleaner console

      // ALWAYS broadcast paddle positions - players should be able to move at all times
      // Force broadcast every frame to ensure smooth client updates
      // Log machine gun balls before broadcast
      if (gameState.machineGunBalls && gameState.machineGunBalls.length > 0) {
        console.log(`🔫 BROADCASTING ${gameState.machineGunBalls.length} machine gun balls to clients`);
      }

      // (Since client runs at 90 FPS and server at 60 FPS, we need frequent updates)
      this.broadcastToRoom(roomId, {
        type: 'server_game_update',
        data: {
          ball: gameState.ball,
          paddles: gameState.paddles, // Always include paddle positions so players can move
          score: gameState.score,
          pickups: gameState.pickups,
          coins: gameState.coins,
          activeEffects: gameState.activeEffects,
          pickupEffect: gameState.pickupEffect,
          rumbleEffect: gameState.rumbleEffect,
          winner: gameState.winner,
          gameEnded: gameState.gameEnded,
          isPlaying: gameState.isPlaying,
          isPaused: gameState.isPaused,
          showStartScreen: gameState.showStartScreen,
          colorIndex: gameState.colorIndex,
          extraBalls: gameState.extraBalls,
          machineGunBalls: gameState.machineGunBalls,
          machineGunActive: gameState.machineGunActive,
          playfieldScale: gameState.playfieldScale // 📐 Broadcast playfield scaling for dynamic playfield effect
        }
      });

      room.lastUpdate = now;
    });
  }

  private updateBallPhysics(gameState: GameState, canvasSize: { width: number; height: number }, roomId: string): boolean {
    let ballChanged = false;

    // 🎯 COMPREHENSIVE BALL DEBUG OUTPUT
    const ballCenterX = gameState.ball.x + gameState.ball.size / 2;
    const ballCenterY = gameState.ball.y + gameState.ball.size / 2;

    // Log current ball state every few frames for tracking
    const frameCount = Date.now();
    if (frameCount % 300 < 50) { // Every ~5 frames at 60fps
      console.log(`\n📍 BALL STATE: pos(${gameState.ball.x.toFixed(1)}, ${gameState.ball.y.toFixed(1)}) center(${ballCenterX.toFixed(1)}, ${ballCenterY.toFixed(1)}) vel(${gameState.ball.dx.toFixed(2)}, ${gameState.ball.dy.toFixed(2)})`);

      // Show ball boundaries
      const ballBounds = {
        left: gameState.ball.x,
        right: gameState.ball.x + gameState.ball.size,
        top: gameState.ball.y,
        bottom: gameState.ball.y + gameState.ball.size
      };
      console.log(`🎯 BALL BOUNDS: L=${ballBounds.left.toFixed(1)} R=${ballBounds.right.toFixed(1)} T=${ballBounds.top.toFixed(1)} B=${ballBounds.bottom.toFixed(1)}`);

      // Show canvas boundaries and paddle zones
      console.log(`🏟️  CANVAS: ${canvasSize.width}x${canvasSize.height}`);
      console.log(`🚧 PADDLE ZONES: Left[x≤44] Right[x≥${canvasSize.width-44}] Top[y≤44] Bottom[y≥${canvasSize.height-44}]`);
    }

    // Update AI paddles to track the ball
    const topPaddleCenter = gameState.paddles.top.x + gameState.paddles.top.width / 2;
    const bottomPaddleCenter = gameState.paddles.bottom.x + gameState.paddles.bottom.width / 2;
    const leftPaddleCenter = gameState.paddles.left.y + gameState.paddles.left.height / 2;
    const rightPaddleCenter = gameState.paddles.right.y + gameState.paddles.right.height / 2;

    // Advanced AI with trajectory prediction and wall bounces
    const predictBallPosition = (
      ballX: number,
      ballY: number,
      ballDX: number,
      ballDY: number,
      ballSpin: number, // 🌀 Include spin in prediction
      targetX: number,
      canvasWidth: number,
      canvasHeight: number,
      isHorizontal: boolean
    ): number => {
      // Simulate ball movement until it reaches the target X or Y coordinate
      let x = ballX;
      let y = ballY;
      let dx = ballDX;
      let dy = ballDY;
      let spin = ballSpin;
      const maxIterations = 200; // Prevent infinite loops
      let iterations = 0;

      while (iterations < maxIterations) {
        // 🌀 Apply Magnus effect (curve) to velocity if ball is spinning
        if (spin && Math.abs(spin) > 0.1) {
          const magnusEffect = ServerCollisionDetector.applyMagnusEffect({ dx, dy, spin });
          dx = magnusEffect.dx;
          dy = magnusEffect.dy;
          spin *= ServerCollisionDetector['SPIN_DECAY']; // Spin decays over time
        }

        // Move ball one step
        x += dx;
        y += dy;

        // In 4-player Pong, balls don't bounce off walls - they score!
        // Don't simulate wall bounces in prediction
        // If ball goes out of bounds, stop predicting (it will score)
        if (y <= 0 || y >= canvasHeight || x <= 0 || x >= canvasWidth) {
          // Ball will score, return current paddle center as fallback
          return isHorizontal ? canvasWidth / 2 : canvasHeight / 2;
        }

        // Check if we've reached the target
        if (isHorizontal) {
          // For horizontal paddles (top/bottom), track along Y axis, return X position
          if ((dy > 0 && y >= targetX) || (dy < 0 && y <= targetX)) {
            return x; // Return predicted X position when ball reaches target Y
          }
        } else {
          // For vertical paddles (left/right), track along X axis, return Y position
          if ((dx > 0 && x >= targetX) || (dx < 0 && x <= targetX)) {
            return y; // Return predicted Y position when ball reaches target X
          }
        }

        iterations++;
      }

      // Fallback: return current ball position
      return isHorizontal ? ballY : ballX;
    };

    const updatePaddleAI = (
      paddleName: 'left' | 'right' | 'top' | 'bottom',
      paddle: any,
      canvasWidth: number,
      canvasHeight: number
    ) => {
      const isVertical = paddleName === 'left' || paddleName === 'right';
      const axis = isVertical ? 'y' : 'x';
      const paddleSize = isVertical ? paddle.height : paddle.width;
      const canvasDimension = isVertical ? canvasHeight : canvasWidth;

      // Determine if ball is approaching this paddle
      const isApproaching = (
        (paddleName === 'left' && gameState.ball.dx < 0) ||
        (paddleName === 'right' && gameState.ball.dx > 0) ||
        (paddleName === 'top' && gameState.ball.dy < 0) ||
        (paddleName === 'bottom' && gameState.ball.dy > 0)
      );

      if (!isApproaching) return; // Don't move if ball is moving away

      const oldPos = paddle[axis];

      // Predict where ball will be
      const targetCoord = paddleName === 'left' ? 32 :
                          paddleName === 'right' ? canvasWidth - 32 :
                          paddleName === 'top' ? 32 :
                          canvasHeight - 32;

      const predictedPos = predictBallPosition(
        gameState.ball.x,
        gameState.ball.y,
        gameState.ball.dx,
        gameState.ball.dy,
        gameState.ball.spin || 0, // 🌀 Pass spin for curve prediction
        targetCoord,
        canvasWidth,
        canvasHeight,
        !isVertical
      );

      // Calculate distance to ball for curve ball strategy
      const ballAxisPos = isVertical ? gameState.ball.y : gameState.ball.x;
      const ballDistanceToImpact = isVertical
        ? Math.abs(gameState.ball.x - (paddleName === 'left' ? 32 : canvasWidth - 32))
        : Math.abs(gameState.ball.y - (paddleName === 'top' ? 32 : canvasHeight - 32));

      // Store target if not exists or recalculate if ball direction/position changed significantly
      if (!paddle.targetPos || Math.abs(paddle.lastPredictedPos - predictedPos) > 20) {
        // Increased imperfection for more variety and mistakes
        const imperfection = (Math.random() - 0.5) * 40; // Increased from 10 to 40

        paddle.targetPos = predictedPos + imperfection - (paddleSize / 2);
        paddle.lastPredictedPos = predictedPos;
      }

      const targetPos = paddle.targetPos;

      // Calculate distance and speed
      const paddleCenter = paddle[axis] + (paddleSize / 2);
      const distance = Math.abs(targetPos + (paddleSize / 2) - paddleCenter);

      // Dynamic speed: faster when far, slower when close
      // Reduced AI speed to make it less perfect
      const minSpeed = 1.5; // Reduced from 2.0
      const maxSpeed = 6.0; // Reduced from 8.0

      const speedMultiplier = Math.min(1, distance / 100); // Scale based on distance
      const speed = minSpeed + (maxSpeed - minSpeed) * speedMultiplier;

      // Only move if distance is significant (deadzone larger than max speed to prevent oscillation)
      const deadzone = 15; // Increased from 10 to make AI less twitchy
      if (distance > deadzone) {
        const direction = (targetPos + (paddleSize / 2)) > paddleCenter ? 1 : -1;
        const movement = direction * speed;

        // Prevent overshoot: don't move past the target
        if (Math.abs(movement) > distance) {
          paddle[axis] = targetPos;
        } else {
          paddle[axis] += movement;
        }

        // No clamping - paddles can move freely across entire canvas
        // Border is purely visual, only ball needs boundary checking for scoring

        const newPos = paddle[axis];
        const delta = newPos - oldPos;
        console.log(`🤖 ${paddleName.toUpperCase()}: ${oldPos.toFixed(1)} → ${newPos.toFixed(1)} (Δ${delta.toFixed(1)}) predicted=${predictedPos.toFixed(1)} speed=${speed.toFixed(1)}`);
      }
    };

    // Save old positions before AI updates
    const oldPositions = {
      left: { x: gameState.paddles.left.x, y: gameState.paddles.left.y },
      right: { x: gameState.paddles.right.x, y: gameState.paddles.right.y },
      top: { x: gameState.paddles.top.x, y: gameState.paddles.top.y },
      bottom: { x: gameState.paddles.bottom.x, y: gameState.paddles.bottom.y }
    };

    // Check which paddles have human players
    const room = this.rooms.get(roomId);
    if (!room) return;

    const humanPlayers = {
      left: Array.from(room.players.values()).some(p => p.side === 'left'),
      right: Array.from(room.players.values()).some(p => p.side === 'right'),
      top: Array.from(room.players.values()).some(p => p.side === 'top'),
      bottom: Array.from(room.players.values()).some(p => p.side === 'bottom')
    };

    // Only update AI for paddles WITHOUT human players
    // Human players control their own paddles
    if (!humanPlayers.left) {
      updatePaddleAI('left', gameState.paddles.left, canvasSize.width, canvasSize.height);
    }
    if (!humanPlayers.right) {
      updatePaddleAI('right', gameState.paddles.right, canvasSize.width, canvasSize.height);
    }
    if (!humanPlayers.top) {
      updatePaddleAI('top', gameState.paddles.top, canvasSize.width, canvasSize.height);
    }
    if (!humanPlayers.bottom) {
      updatePaddleAI('bottom', gameState.paddles.bottom, canvasSize.width, canvasSize.height);
    }

    // Calculate ALL paddle velocities for spin transfer (both AI and human)
    // For AI paddles, use old positions saved before AI update
    // For human paddles, keep the velocity they sent (already set in paddle update handler)
    if (!humanPlayers.left) {
      const velocity = gameState.paddles.left.y - oldPositions.left.y;
      gameState.paddles.left.velocity = velocity;
      if (Math.abs(velocity) > 0.1) console.log(`⚡ LEFT AI velocity: ${velocity.toFixed(2)}`);
    }
    if (!humanPlayers.right) {
      const velocity = gameState.paddles.right.y - oldPositions.right.y;
      gameState.paddles.right.velocity = velocity;
      if (Math.abs(velocity) > 0.1) console.log(`⚡ RIGHT AI velocity: ${velocity.toFixed(2)}`);
    }
    if (!humanPlayers.top) {
      const velocity = gameState.paddles.top.x - oldPositions.top.x;
      gameState.paddles.top.velocity = velocity;
      if (Math.abs(velocity) > 0.1) console.log(`⚡ TOP AI velocity: ${velocity.toFixed(2)}`);
    }
    if (!humanPlayers.bottom) {
      const velocity = gameState.paddles.bottom.x - oldPositions.bottom.x;
      gameState.paddles.bottom.velocity = velocity;
      if (Math.abs(velocity) > 0.1) console.log(`⚡ BOTTOM AI velocity: ${velocity.toFixed(2)}`);
    }

    // DISABLED: Paddle-to-paddle collision detection (causing AI to get stuck)
    // In 4-player Pong, paddles don't collide - they can overlap in corners


    // 🎯 CENTRALIZED COLLISION DETECTION (Server-side)
    // Use the same collision detection logic as the client for consistency

    // Create ball object for collision detection
    const ballForCollision: Ball = {
      x: gameState.ball.x,
      y: gameState.ball.y,
      size: gameState.ball.size,
      width: gameState.ball.size,
      height: gameState.ball.size,
      vx: gameState.ball.dx,
      vy: gameState.ball.dy,
      lastTouchedBy: gameState.ball.lastTouchedBy
    };

    // Create paddle objects
    const leftPaddle: Paddle = {
      x: BORDER_THICKNESS * 2,
      y: gameState.paddles.left.y,
      width: gameState.paddles.left.width,
      height: gameState.paddles.left.height,
      side: 'left',
      velocity: gameState.paddles.left.velocity || 0
    };

    const rightPaddle: Paddle = {
      x: canvasSize.width - gameState.paddles.right.width - (BORDER_THICKNESS * 2),
      y: gameState.paddles.right.y,
      width: gameState.paddles.right.width,
      height: gameState.paddles.right.height,
      side: 'right',
      velocity: gameState.paddles.right.velocity || 0
    };

    const topPaddle: Paddle = {
      x: gameState.paddles.top.x,
      y: 60,
      width: gameState.paddles.top.width,
      height: gameState.paddles.top.height,
      side: 'top',
      velocity: gameState.paddles.top.velocity || 0
    };

    const bottomPaddle: Paddle = {
      x: gameState.paddles.bottom.x,
      y: 728,
      width: gameState.paddles.bottom.width,
      height: gameState.paddles.bottom.height,
      side: 'bottom',
      velocity: gameState.paddles.bottom.velocity || 0
    };

    // 🎯 DETAILED PADDLE DEBUG OUTPUT
    if (frameCount % 600 < 100) { // Every ~10 frames at 60fps - less frequent than ball state
      console.log(`\n🏓 PADDLE BOUNDARIES:`);
      console.log(`  LEFT: x=${leftPaddle.x}-${leftPaddle.x + leftPaddle.width} y=${leftPaddle.y.toFixed(1)}-${(leftPaddle.y + leftPaddle.height).toFixed(1)}`);
      console.log(`  RIGHT: x=${rightPaddle.x}-${rightPaddle.x + rightPaddle.width} y=${rightPaddle.y.toFixed(1)}-${(rightPaddle.y + rightPaddle.height).toFixed(1)}`);
      console.log(`  TOP: x=${topPaddle.x.toFixed(1)}-${(topPaddle.x + topPaddle.width).toFixed(1)} y=${topPaddle.y}-${topPaddle.y + topPaddle.height}`);
      console.log(`  BOTTOM: x=${bottomPaddle.x.toFixed(1)}-${(bottomPaddle.x + bottomPaddle.width).toFixed(1)} y=${bottomPaddle.y}-${bottomPaddle.y + bottomPaddle.height}`);
    }

    // CHECK WALL COLLISIONS FIRST (before paddle collisions)
    // This ensures balls can score on walls even if near paddle position

    // 🏆 CHECK FOR WALL SCORING FIRST
    const wallCollisionCheck = ServerCollisionDetector.detectBallWall(ballForCollision, canvasSize.width, canvasSize.height);
    if (wallCollisionCheck && wallCollisionCheck.hit) {
      // Wall collision detected - handle scoring before paddle collision
      const now = Date.now();
      if (!gameState.ball.lastWallCollisionTime) gameState.ball.lastWallCollisionTime = 0;
      const wallCollisionCooldown = 200;

      if (now - gameState.ball.lastWallCollisionTime > wallCollisionCooldown) {
        console.log(`🏆 MAIN BALL SCORED: Hit ${wallCollisionCheck.side} boundary - resetting`);
        gameState.ball.lastWallCollisionTime = now;
        this.handleScoring(gameState, wallCollisionCheck.side, gameState.ball.lastTouchedBy, gameState.ball.previousTouchedBy, false, true);
        ballChanged = true;

        // Skip paddle collision checks if wall scoring occurred
        return ballChanged;
      } else {
        // Cooldown active - bounce ball back to prevent getting stuck
        if (wallCollisionCheck.side === 'top' || wallCollisionCheck.side === 'bottom') {
          gameState.ball.dy = -gameState.ball.dy;
        } else {
          gameState.ball.dx = -gameState.ball.dx;
        }
        console.log(`⚠️ Ball bounce (cooldown active) - preventing stuck ball`);
        ballChanged = true;
      }
    }

    // Check collisions for all paddles (both human and AI)
    const paddles: Paddle[] = [leftPaddle, rightPaddle, topPaddle, bottomPaddle];

    if (room && frameCount % 60 === 0) {
      const hasLeftPlayer = Array.from(room.players.values()).some(p => p.side === 'left');
      const hasRightPlayer = Array.from(room.players.values()).some(p => p.side === 'right');
      const hasTopPlayer = Array.from(room.players.values()).some(p => p.side === 'top');
      const hasBottomPlayer = Array.from(room.players.values()).some(p => p.side === 'bottom');

      // Log which paddles have human players once per second
      console.log(`👥 ACTIVE PADDLES: Left=${hasLeftPlayer}, Right=${hasRightPlayer}, Top=${hasTopPlayer}, Bottom=${hasBottomPlayer}`);
    }

    // Add collision cooldown to prevent multiple collisions per frame
    const now = Date.now();
    if (!gameState.ball.lastCollisionTime) gameState.ball.lastCollisionTime = 0;
    const collisionCooldown = 50; // 50ms cooldown - short enough to catch fast balls

    // 🚨 COLLISION DETECTION WITH EXTENSIVE DEBUGGING
    let collisionDetected = false;
    if (now - gameState.ball.lastCollisionTime > collisionCooldown) {
      for (const paddle of paddles) {
        const collision = ServerCollisionDetector.detectBallPaddle(ballForCollision, paddle);

        // Log collision attempts for debugging
        if (frameCount % 1000 < 100) { // Less frequent collision attempt logging
          const distance = Math.abs(
            paddle.side === 'left' || paddle.side === 'right'
              ? ballCenterX - (paddle.x + paddle.width/2)
              : ballCenterY - (paddle.y + paddle.height/2)
          );
          console.log(`🔍 ${paddle.side.toUpperCase()} collision check: hit=${collision.hit}, distance=${distance.toFixed(1)}`);
        }

        if (collision.hit) {
          // Additional debugging to understand false collisions
          const ballTop = gameState.ball.y;
          const ballBottom = gameState.ball.y + gameState.ball.size;
          const paddleTop = paddle.y;
          const paddleBottom = paddle.y + paddle.height;
          const yOverlap = ballBottom > paddleTop && ballTop < paddleBottom;

          console.log(`\n🚨 ${paddle.side.toUpperCase()} PADDLE COLLISION DETECTED!`);
          console.log(`  📍 Ball: pos(${gameState.ball.x.toFixed(1)}, ${gameState.ball.y.toFixed(1)}) vel(${gameState.ball.dx.toFixed(2)}, ${gameState.ball.dy.toFixed(2)})`);
          console.log(`  🏓 Paddle: x=${paddle.x}-${paddle.x + paddle.width} y=${paddle.y.toFixed(1)}-${(paddle.y + paddle.height).toFixed(1)}`);
          console.log(`  📐 Y-overlap: ${yOverlap} (ball: ${ballTop.toFixed(1)}-${ballBottom.toFixed(1)}, paddle: ${paddleTop.toFixed(1)}-${paddleBottom.toFixed(1)})`);

          // Only process collision if there's actual Y overlap
          if (!yOverlap && (paddle.side === 'left' || paddle.side === 'right')) {
            console.log(`  ❌ FALSE POSITIVE: Ball not in paddle Y range, skipping collision`);
            continue;
          }

          collisionDetected = true;

          // Set collision cooldown
          gameState.ball.lastCollisionTime = now;

          // Check if sticky paddles is active and this is the activator's paddle
          const stickyEffect = gameState.activeEffects.find(e => e.type === 'sticky_paddles');
          const shouldStick = stickyEffect && stickyEffect.activator === paddle.side && !gameState.ball.isStuck;

          if (shouldStick) {
            // Stick the ball to the paddle
            gameState.ball.isStuck = true;
            gameState.ball.stuckToPaddle = paddle.side;
            gameState.ball.stuckStartTime = now;

            // Calculate offset from paddle center
            if (paddle.side === 'left' || paddle.side === 'right') {
              gameState.ball.stuckOffset = {
                x: paddle.side === 'left' ? paddle.width : -gameState.ball.size,
                y: gameState.ball.y - paddle.y
              };
            } else {
              gameState.ball.stuckOffset = {
                x: gameState.ball.x - paddle.x,
                y: paddle.side === 'top' ? paddle.height : -gameState.ball.size
              };
            }

            // Stop ball movement
            gameState.ball.dx = 0;
            gameState.ball.dy = 0;

            console.log(`🧲 STICKY PADDLE: Ball stuck to ${paddle.side} paddle (activator)`);
          } else {
            // 🎮 ARKANOID-STYLE PHYSICS - Position-based angle control + paddle velocity influence
            const oldDx = gameState.ball.dx;
            const oldDy = gameState.ball.dy;

            // Get paddle velocity for momentum transfer
            const paddleWithVelocity = {
              ...paddle,
              velocity: paddle.velocity || 0
            };

            console.log(`🎯 PADDLE VELOCITY: ${paddle.side} = ${paddleWithVelocity.velocity.toFixed(2)}`);

            // Apply Arkanoid physics using hit position from collision result
            const newVelocity = ServerCollisionDetector.applyArkanoidPhysics(
              gameState.ball,
              paddleWithVelocity,
              collision.hitPosition
            );

            gameState.ball.dx = newVelocity.dx;
            gameState.ball.dy = newVelocity.dy;

            // 🌀 ADD new spin to existing spin on paddle hit
            const oldSpin = gameState.ball.spin || 0;
            gameState.ball.spin = oldSpin + newVelocity.spin;

            // Clamp total spin to max
            gameState.ball.spin = Math.max(-ServerCollisionDetector['MAX_SPIN'], Math.min(ServerCollisionDetector['MAX_SPIN'], gameState.ball.spin));

            // 🌀 Reset distance traveled (delays curve effect)
            gameState.ball.spinDistanceTraveled = 0;

            console.log(`🌀 BALL SPIN: ${oldSpin.toFixed(2)} + ${newVelocity.spin.toFixed(2)} = ${gameState.ball.spin.toFixed(2)} (velocity: ${paddleWithVelocity.velocity.toFixed(2)})`);

            // 🌀 Announce curve ball if significant spin was applied
            if (Math.abs(gameState.ball.spin) > 0.8) {
              const compliments = [
                'CURVE BALL!',
                'NICE SPIN!',
                'CURVED IT!',
                'WHAT A CURVE!',
                'SPIN MASTER!',
                'CURVING!',
                'BENT IT!'
              ];
              const compliment = compliments[Math.floor(Math.random() * compliments.length)];
              this.broadcastToRoom(roomId, {
                type: 'robot_speech',
                data: { text: compliment }
              });
              console.log(`🌀 CURVE BALL ANNOUNCED! Spin: ${gameState.ball.spin.toFixed(2)} - "${compliment}"`);
            }

            // Position ball outside paddle to prevent overlap
            if (paddle.side === 'left') {
              gameState.ball.x = paddle.x + paddle.width + 1;
            } else if (paddle.side === 'right') {
              gameState.ball.x = paddle.x - gameState.ball.size - 1;
            } else if (paddle.side === 'top') {
              gameState.ball.y = paddle.y + paddle.height + 1;
            } else if (paddle.side === 'bottom') {
              gameState.ball.y = paddle.y - gameState.ball.size - 1;
            }

            console.log(`🎮 ARKANOID PHYSICS: (${oldDx.toFixed(2)}, ${oldDy.toFixed(2)}) → (${gameState.ball.dx.toFixed(2)}, ${gameState.ball.dy.toFixed(2)}) | Hit: ${collision.hitPosition.toFixed(2)}`);

            // Apply rubber_ball bounciness (increased velocity on bounce)
            if (gameState.ball.bounciness > 1) {
              gameState.ball.dx *= gameState.ball.bounciness;
              gameState.ball.dy *= gameState.ball.bounciness;
              console.log(`🏀 RUBBER BALL: Velocity boosted by ${gameState.ball.bounciness}x → (${gameState.ball.dx.toFixed(2)}, ${gameState.ball.dy.toFixed(2)})`);
            }
            // Apply balloon_ball reduced bounciness
            else if (gameState.ball.bounciness < 1) {
              gameState.ball.dx *= gameState.ball.bounciness;
              gameState.ball.dy *= gameState.ball.bounciness;
              console.log(`🎈 BALLOON BALL: Velocity reduced by ${gameState.ball.bounciness}x → (${gameState.ball.dx.toFixed(2)}, ${gameState.ball.dy.toFixed(2)})`);
            }
          }

          // Track ball touch for scoring system
          gameState.ball.lastTouchedBy = paddle.side;

          // Cycle through ball colors on paddle collision (0-7)
          gameState.colorIndex = (gameState.colorIndex + 1) % 8;
          console.log(`🎨 Ball color cycled to index: ${gameState.colorIndex}`);

          // NO SPEED INCREASE - Keep ball velocity constant at 3
          // The ball should always move at a constant speed with simple physics

          ballChanged = true;

          // Only process first collision to avoid multiple collisions per frame
          break;
        }
      }
    } // Close collision cooldown check

    // Arkanoid brick collision detection
    // TESTING: Disable Arkanoid
    if (false && gameState.arkanoidActive && gameState.arkanoidBricks && gameState.arkanoidBricks.length > 0) {
      for (let i = gameState.arkanoidBricks.length - 1; i >= 0; i--) {
        const brick = gameState.arkanoidBricks[i];

        // Check collision with brick - define ball bounds
        const ballLeft = gameState.ball.x;
        const ballRight = gameState.ball.x + gameState.ball.size;
        const ballTop = gameState.ball.y;
        const ballBottom = gameState.ball.y + gameState.ball.size;

        const brickCollision = ballRight >= brick.x &&
                              ballLeft <= brick.x + brick.width &&
                              ballBottom >= brick.y &&
                              ballTop <= brick.y + brick.height;

        if (brickCollision) {
          // Remove the brick
          gameState.arkanoidBricks.splice(i, 1);
          gameState.arkanoidBricksHit++;

          // Score every 4th brick hit
          if (gameState.arkanoidBricksHit % 4 === 0) {
            // Award point to the player who last touched the ball
            if (gameState.ball.lastTouchedBy) {
              gameState.score[gameState.ball.lastTouchedBy]++;
            }
          }

          // Determine collision direction and bounce appropriately
          const brickCenterX = brick.x + brick.width / 2;
          const brickCenterY = brick.y + brick.height / 2;
          const ballCenterXCurrent = gameState.ball.x + gameState.ball.size / 2;
          const ballCenterYCurrent = gameState.ball.y + gameState.ball.size / 2;

          const prevBallCenterX = ballCenterXCurrent - gameState.ball.dx;
          const prevBallCenterY = ballCenterYCurrent - gameState.ball.dy;

          // Determine which side of the brick was hit
          const deltaX = ballCenterXCurrent - brickCenterX;
          const deltaY = ballCenterYCurrent - brickCenterY;
          const absX = Math.abs(deltaX);
          const absY = Math.abs(deltaY);

          // Hit from left or right side
          if (absX > absY) {
            gameState.ball.dx = -gameState.ball.dx;
            // Position ball outside the brick
            if (deltaX > 0) {
              gameState.ball.x = brick.x + brick.width + 1;
            } else {
              gameState.ball.x = brick.x - gameState.ball.size - 1;
            }
          }
          // Hit from top or bottom
          else {
            gameState.ball.dy = -gameState.ball.dy;
            // Position ball outside the brick
            if (deltaY > 0) {
              gameState.ball.y = brick.y + brick.height + 1;
            } else {
              gameState.ball.y = brick.y - gameState.ball.size - 1;
            }
          }

          ballChanged = true;

          // Check if all bricks are cleared
          if (gameState.arkanoidBricks.length === 0) {
            // End Arkanoid mode
            gameState.arkanoidActive = false;
            gameState.arkanoidMode = false;

            // Remove the effect
            gameState.activeEffects = gameState.activeEffects.filter(
              effect => effect.type !== 'arkanoid'
            );

            // Bonus points for clearing all bricks
            if (gameState.ball.lastTouchedBy) {
              gameState.score[gameState.ball.lastTouchedBy] += 2; // 2 bonus points
            }
          }

          // Only handle one brick collision per frame
          break;
        }
      }
    }

    // ========================================
    // STICKY PADDLE LOGIC
    // Update ball position if stuck to paddle
    // ========================================
    if (gameState.ball.isStuck && gameState.ball.stuckToPaddle) {
      const stuckPaddle = gameState.paddles[gameState.ball.stuckToPaddle];

      // Update ball position to follow paddle
      if (gameState.ball.stuckToPaddle === 'left' || gameState.ball.stuckToPaddle === 'right') {
        gameState.ball.x = stuckPaddle.x + gameState.ball.stuckOffset.x;
        gameState.ball.y = stuckPaddle.y + gameState.ball.stuckOffset.y;
      } else {
        gameState.ball.x = stuckPaddle.x + gameState.ball.stuckOffset.x;
        gameState.ball.y = stuckPaddle.y + gameState.ball.stuckOffset.y;
      }

      // Release after 3 seconds
      const stuckDuration = now - gameState.ball.stuckStartTime;
      if (stuckDuration > 3000) {
        gameState.ball.isStuck = false;

        // Launch ball in direction away from paddle
        const speed = 3;
        if (gameState.ball.stuckToPaddle === 'left') {
          gameState.ball.dx = speed;
          gameState.ball.dy = (Math.random() - 0.5) * speed;
        } else if (gameState.ball.stuckToPaddle === 'right') {
          gameState.ball.dx = -speed;
          gameState.ball.dy = (Math.random() - 0.5) * speed;
        } else if (gameState.ball.stuckToPaddle === 'top') {
          gameState.ball.dx = (Math.random() - 0.5) * speed;
          gameState.ball.dy = speed;
        } else if (gameState.ball.stuckToPaddle === 'bottom') {
          gameState.ball.dx = (Math.random() - 0.5) * speed;
          gameState.ball.dy = -speed;
        }

        console.log(`🚀 STICKY PADDLE: Ball released from ${gameState.ball.stuckToPaddle} paddle`);
        gameState.ball.stuckToPaddle = null;
      }

      ballChanged = true;
    }

    // ========================================
    // PICKUP PHYSICS EFFECTS
    // Apply special ball physics effects before movement
    // ========================================

    // Apply gravity effect
    if (gameState.ball.hasGravity) {
      const gravity = 0.3;
      gameState.ball.dy += gravity;
      ballChanged = true;
    }

    // Apply attractor and repulsor force fields
    const ballCenterForForces = {
      x: gameState.ball.x + gameState.ball.size / 2,
      y: gameState.ball.y + gameState.ball.size / 2
    };

    for (const effect of gameState.activeEffects) {
      if ((effect.type === 'attractor' || effect.type === 'repulsor') && effect.x !== undefined && effect.y !== undefined) {
        const dx = effect.x - ballCenterForForces.x;
        const dy = effect.y - ballCenterForForces.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 400;

        if (distance > 0 && distance < maxDistance) {
          const forceMagnitude = (effect.type === 'attractor' ? 150 : -150) * (1 - (distance / maxDistance) ** 2);
          const dirX = dx / distance;
          const dirY = dy / distance;
          const forceX = dirX * forceMagnitude * 0.01;
          const forceY = dirY * forceMagnitude * 0.01;

          gameState.ball.dx += forceX;
          gameState.ball.dy += forceY;
          ballChanged = true;

          const maxVelocity = 25;
          const currentSpeed = Math.sqrt(gameState.ball.dx ** 2 + gameState.ball.dy ** 2);
          if (currentSpeed > maxVelocity) {
            const scale = maxVelocity / currentSpeed;
            gameState.ball.dx *= scale;
            gameState.ball.dy *= scale;
          }
        }
      }
    }

    // Apply drunk ball effect
    if (gameState.ball.isDrunk) {
      gameState.ball.drunkAngle += 0.3 + Math.random() * 0.2;
      const chaosX = Math.sin(gameState.ball.drunkAngle) * 1.5 + Math.cos(gameState.ball.drunkAngle * 1.5) * 0.5;
      const chaosY = Math.cos(gameState.ball.drunkAngle * 1.2) * 1.5 + Math.sin(gameState.ball.drunkAngle * 1.8) * 0.5;

      if (Math.random() < 0.03) {
        gameState.ball.dx += (Math.random() - 0.5) * 2;
        gameState.ball.dy += (Math.random() - 0.5) * 2;
      }

      gameState.ball.dx += chaosX * 0.15 + (Math.random() - 0.5) * 0.5;
      gameState.ball.dy += chaosY * 0.15 + (Math.random() - 0.5) * 0.5;

      if (Math.random() < 0.02) {
        const speedMultiplier = 0.7 + Math.random() * 0.6;
        gameState.ball.dx *= speedMultiplier;
        gameState.ball.dy *= speedMultiplier;
      }

      if (Math.random() < 0.02) {
        gameState.ball.dx *= -1;
        gameState.ball.dy *= -1;
      }

      const maxDrunkSpeed = 10;
      const currentSpeed = Math.sqrt(gameState.ball.dx * gameState.ball.dx + gameState.ball.dy * gameState.ball.dy);
      if (currentSpeed > maxDrunkSpeed) {
        const speedRatio = maxDrunkSpeed / currentSpeed;
        gameState.ball.dx *= speedRatio;
        gameState.ball.dy *= speedRatio;
      }

      ballChanged = true;
    }

    // Apply magnetic ball effect
    if (gameState.ball.isMagnetic) {
      const magnetStrength = 0.3;
      const paddles = [
        { x: 24, y: gameState.paddles.left.y + gameState.paddles.left.height / 2 },
        { x: canvasSize.width - 24, y: gameState.paddles.right.y + gameState.paddles.right.height / 2 }
      ];

      for (const paddle of paddles) {
        const dx = paddle.x - (gameState.ball.x + gameState.ball.size / 2);
        const dy = paddle.y - (gameState.ball.y + gameState.ball.size / 2);
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0 && distance < 200) {
          const force = magnetStrength * (1 - distance / 200);
          gameState.ball.dx += (dx / distance) * force;
          gameState.ball.dy += (dy / distance) * force;
          ballChanged = true;
        }
      }
    }

    // Apply black hole gravitational pull
    if (gameState.blackHoles && gameState.blackHoles.length > 0) {
      const ballCenter = {
        x: gameState.ball.x + gameState.ball.size / 2,
        y: gameState.ball.y + gameState.ball.size / 2
      };
      
      for (const hole of gameState.blackHoles) {
        const dx = hole.x - ballCenter.x;
        const dy = hole.y - ballCenter.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0 && distance < hole.radius * 5) {
          const pullStrength = (hole.strength / (distance * distance)) * 0.1;
          gameState.ball.dx += (dx / distance) * pullStrength;
          gameState.ball.dy += (dy / distance) * pullStrength;
          ballChanged = true;
        }
      }
    }

    // Apply wind force
    if (gameState.ball.hasWind) {
      const windX = Math.sin(Date.now() / 500) * 0.5;
      const windY = Math.cos(Date.now() / 700) * 0.3;
      gameState.ball.dx += windX;
      gameState.ball.dy += windY;
      ballChanged = true;
    }


    // Update extra balls (multi_ball)
    if (gameState.extraBalls && gameState.extraBalls.length > 0) {
      const extraBallsToRemove: number[] = [];

      for (let i = 0; i < gameState.extraBalls.length; i++) {
        const extraBall = gameState.extraBalls[i];

        // Check paddle collisions BEFORE moving (to prevent pass-through)
        // Use SAME paddle creation logic as main ball (with hardcoded X/Y positions)
        const leftPaddle: Paddle = {
          x: BORDER_THICKNESS * 2,
          y: gameState.paddles.left.y,
          width: gameState.paddles.left.width,
          height: gameState.paddles.left.height,
          side: 'left'
        };
        const rightPaddle: Paddle = {
          x: canvasSize.width - gameState.paddles.right.width - (BORDER_THICKNESS * 2),
          y: gameState.paddles.right.y,
          width: gameState.paddles.right.width,
          height: gameState.paddles.right.height,
          side: 'right'
        };
        const topPaddle: Paddle = {
          x: gameState.paddles.top.x,
          y: 60,
          width: gameState.paddles.top.width,
          height: gameState.paddles.top.height,
          side: 'top'
        };
        const bottomPaddle: Paddle = {
          x: gameState.paddles.bottom.x,
          y: 728,
          width: gameState.paddles.bottom.width,
          height: gameState.paddles.bottom.height,
          side: 'bottom'
        };
        const paddles: Paddle[] = [leftPaddle, rightPaddle, topPaddle, bottomPaddle];

        // Create collision object with CURRENT position (before movement) - MATCH main ball format
        const extraBallForCollision: Ball = {
          x: extraBall.x,
          y: extraBall.y,
          size: extraBall.size,
          width: extraBall.size,
          height: extraBall.size,
          vx: extraBall.dx,
          vy: extraBall.dy,
          lastTouchedBy: extraBall.lastTouchedBy
        };

        for (const paddle of paddles) {
          // MATCH main ball paddle format exactly - must include velocity
          const paddleForCollision: Paddle = {
            x: paddle.x,
            y: paddle.y,
            width: paddle.width,
            height: paddle.height,
            side: paddle.side,
            velocity: paddle.velocity || 0
          };

          const collisionResult = ServerCollisionDetector.detectBallPaddle(extraBallForCollision, paddleForCollision);
          if (collisionResult.hit) {
            console.log(`🎾 EXTRA BALL: Hit ${paddle.side} paddle at (${extraBall.x.toFixed(1)}, ${extraBall.y.toFixed(1)})`);

            // 🎮 ARKANOID-STYLE PHYSICS - Same sophisticated physics as main ball
            const oldDx = extraBall.dx;
            const oldDy = extraBall.dy;

            // Get paddle velocity for momentum transfer
            const paddleWithVelocityForPhysics = {
              x: paddle.x,
              y: paddle.y,
              width: paddle.width,
              height: paddle.height,
              side: paddle.side,
              velocity: paddle.velocity || 0
            };

            // Apply Arkanoid physics using hit position from collision result
            const newVelocity = ServerCollisionDetector.applyArkanoidPhysics(
              extraBall,
              paddleWithVelocityForPhysics,
              collisionResult.hitPosition
            );

            extraBall.dx = newVelocity.dx;
            extraBall.dy = newVelocity.dy;
            extraBall.spin = newVelocity.spin; // 🌀 Apply spin to extra balls

            // Position ball outside paddle to prevent overlap
            if (paddle.side === 'left') {
              extraBall.x = paddle.x + paddle.width + 1;
            } else if (paddle.side === 'right') {
              extraBall.x = paddle.x - extraBall.size - 1;
            } else if (paddle.side === 'top') {
              extraBall.y = paddle.y + paddle.height + 1;
            } else if (paddle.side === 'bottom') {
              extraBall.y = paddle.y - extraBall.size - 1;
            }

            console.log(`🎮 EXTRA BALL ARKANOID PHYSICS: (${oldDx.toFixed(2)}, ${oldDy.toFixed(2)}) → (${extraBall.dx.toFixed(2)}, ${extraBall.dy.toFixed(2)}) | Hit: ${collisionResult.hitPosition.toFixed(2)}`);

            // Track ball touch for scoring system
            extraBall.lastTouchedBy = paddle.side;

            ballChanged = true;
            break;
          }
        }

        // 🌀 APPLY MAGNUS EFFECT to extra balls (spin creates curve)
        if (!extraBall.spin) extraBall.spin = 0;

        if (Math.abs(extraBall.spin) > 0.1) {
          const curvedVelocity = ServerCollisionDetector.applyMagnusEffect({
            dx: extraBall.dx,
            dy: extraBall.dy,
            spin: extraBall.spin
          });
          extraBall.dx = curvedVelocity.dx;
          extraBall.dy = curvedVelocity.dy;

          // Apply spin decay (friction)
          extraBall.spin *= ServerCollisionDetector['SPIN_DECAY'];
        }

        // Move ball AFTER collision check and Magnus effect
        extraBall.x += extraBall.dx;
        extraBall.y += extraBall.dy;

        // Check wall collisions for scoring (after movement)
        const wallCollisionCheck = ServerCollisionDetector.detectBallWall(
          {
            x: extraBall.x,
            y: extraBall.y,
            width: extraBall.size,
            height: extraBall.size,
            dx: extraBall.dx,
            dy: extraBall.dy,
            vx: extraBall.dx,
            vy: extraBall.dy,
            lastTouchedBy: extraBall.lastTouchedBy
          },
          canvasSize.width,
          canvasSize.height
        );
        if (wallCollisionCheck && wallCollisionCheck.hit) {
          console.log(`🎾 EXTRA BALL: Hit ${wallCollisionCheck.side} boundary (lastTouchedBy: ${extraBall.lastTouchedBy})`);
          this.handleScoring(gameState, wallCollisionCheck.side, extraBall.lastTouchedBy, null, false, false); // Don't pause for extra balls
          extraBallsToRemove.push(i);
          ballChanged = true;
          continue;
        }

        ballChanged = true;
      }

      // Remove extra balls that hit walls (in reverse order to preserve indices)
      for (let i = extraBallsToRemove.length - 1; i >= 0; i--) {
        gameState.extraBalls.splice(extraBallsToRemove[i], 1);
      }
    }

    // 🔫 MACHINE GUN: Rapidly fire balls from the shooter's paddle (FIRING ONLY)
    if (gameState.machineGunActive && gameState.machineGunShooter) {
      const now = Date.now();
      const timeSinceStart = now - gameState.machineGunStartTime;
      const fireInterval = 300; // Fire every 300ms (3.3 balls per second - half the rate)
      const ballsFired = Math.floor(timeSinceStart / fireInterval);
      const expectedBallCount = ballsFired;

      if (frameCount % 60 === 0) {
        console.log(`🔫 MACHINE GUN STATUS: active=${gameState.machineGunActive}, shooter=${gameState.machineGunShooter}, timeSince=${timeSinceStart}ms, ballsFired=${ballsFired}, currentBalls=${gameState.machineGunBalls.length}`);
      }

      // Fire balls if we haven't reached the expected count yet
      if (gameState.machineGunBalls.length < expectedBallCount) {
        const shooter = gameState.machineGunShooter;
        const ballSize = 10; // Smaller balls
        const speed = 6.0; // Quadruple original speed (was 1.5, then 3.0, now 6.0)
        let startX = 400;
        let startY = 300;
        let dx = 0;
        let dy = 0;

        // Position and velocity based on shooter side with WIDE angle spread
        if (shooter === 'left') {
          startX = 50;
          startY = gameState.paddles.left.y + gameState.paddles.left.height / 2 - ballSize / 2;
          // Wide angle: -60 to +60 degrees (120 degree cone)
          const angle = (Math.random() - 0.5) * (Math.PI / 1.5); // ±60 degrees
          const baseAngle = 0; // Shoot right
          const finalAngle = baseAngle + angle;
          dx = Math.cos(finalAngle) * speed;
          dy = Math.sin(finalAngle) * speed;
        } else if (shooter === 'right') {
          startX = canvasSize.width - 50 - ballSize;
          startY = gameState.paddles.right.y + gameState.paddles.right.height / 2 - ballSize / 2;
          // Wide angle: -60 to +60 degrees (120 degree cone)
          const angle = (Math.random() - 0.5) * (Math.PI / 1.5);
          const baseAngle = Math.PI; // Shoot left
          const finalAngle = baseAngle + angle;
          dx = Math.cos(finalAngle) * speed;
          dy = Math.sin(finalAngle) * speed;
        } else if (shooter === 'top') {
          startX = gameState.paddles.top.x + gameState.paddles.top.width / 2 - ballSize / 2;
          startY = 70;
          // Wide angle: -60 to +60 degrees (120 degree cone)
          const angle = (Math.random() - 0.5) * (Math.PI / 1.5);
          const baseAngle = Math.PI / 2; // Shoot down
          const finalAngle = baseAngle + angle;
          dx = Math.cos(finalAngle) * speed;
          dy = Math.sin(finalAngle) * speed;
        } else if (shooter === 'bottom') {
          startX = gameState.paddles.bottom.x + gameState.paddles.bottom.width / 2 - ballSize / 2;
          startY = canvasSize.height - 70 - ballSize;
          // Wide angle: -60 to +60 degrees (120 degree cone)
          const angle = (Math.random() - 0.5) * (Math.PI / 1.5);
          const baseAngle = -Math.PI / 2; // Shoot up
          const finalAngle = baseAngle + angle;
          dx = Math.cos(finalAngle) * speed;
          dy = Math.sin(finalAngle) * speed;
        }

        // Create new machine gun ball
        gameState.machineGunBalls.push({
          x: startX,
          y: startY,
          dx,
          dy,
          size: ballSize,
          spin: 0,
          lastTouchedBy: shooter
        });

        console.log(`🔫 MACHINE GUN: Fired ball #${gameState.machineGunBalls.length} from ${shooter}`);
        ballChanged = true;
      }
    }

    // 🔫 MACHINE GUN BALLS: Update existing balls (runs even after firing stops)
    if (gameState.machineGunBalls.length > 0) {
      if (frameCount % 30 === 0) {
        console.log(`🔫 UPDATING ${gameState.machineGunBalls.length} machine gun balls (active=${gameState.machineGunActive})`);
      }
      // Update machine gun balls (same logic as extra balls)
      const mgBallsToRemove: number[] = [];
      for (let i = 0; i < gameState.machineGunBalls.length; i++) {
        const mgBall = gameState.machineGunBalls[i];

        if (frameCount % 30 === 0 && i < 3) {
          console.log(`🔫 Ball ${i}: pos=(${mgBall.x.toFixed(1)}, ${mgBall.y.toFixed(1)}) vel=(${mgBall.dx.toFixed(2)}, ${mgBall.dy.toFixed(2)})`);
        }

        // Create paddle collision objects
        const leftPaddle = { x: BORDER_THICKNESS * 2, y: gameState.paddles.left.y, width: gameState.paddles.left.width, height: gameState.paddles.left.height, side: 'left' as const, velocity: gameState.paddles.left.velocity || 0 };
        const rightPaddle = { x: canvasSize.width - gameState.paddles.right.width - (BORDER_THICKNESS * 2), y: gameState.paddles.right.y, width: gameState.paddles.right.width, height: gameState.paddles.right.height, side: 'right' as const, velocity: gameState.paddles.right.velocity || 0 };
        const topPaddle = { x: gameState.paddles.top.x, y: 60, width: gameState.paddles.top.width, height: gameState.paddles.top.height, side: 'top' as const, velocity: gameState.paddles.top.velocity || 0 };
        const bottomPaddle = { x: gameState.paddles.bottom.x, y: 728, width: gameState.paddles.bottom.width, height: gameState.paddles.bottom.height, side: 'bottom' as const, velocity: gameState.paddles.bottom.velocity || 0 };
        const paddles: Paddle[] = [leftPaddle, rightPaddle, topPaddle, bottomPaddle];

        // Check paddle collisions
        const mgBallForCollision: Ball = {
          x: mgBall.x,
          y: mgBall.y,
          size: mgBall.size,
          width: mgBall.size,
          height: mgBall.size,
          vx: mgBall.dx,
          vy: mgBall.dy,
          lastTouchedBy: mgBall.lastTouchedBy
        };

        for (const paddle of paddles) {
          const collision = ServerCollisionDetector.detectBallPaddle(mgBallForCollision, paddle);
          if (collision.hit) {
            // Apply physics
            const newVelocity = ServerCollisionDetector.applyArkanoidPhysics(mgBall, paddle, collision.hitPosition);
            mgBall.dx = newVelocity.dx;
            mgBall.dy = newVelocity.dy;
            mgBall.spin = newVelocity.spin;
            mgBall.lastTouchedBy = paddle.side;

            // Position ball outside paddle
            if (paddle.side === 'left') mgBall.x = paddle.x + paddle.width + 1;
            else if (paddle.side === 'right') mgBall.x = paddle.x - mgBall.size - 1;
            else if (paddle.side === 'top') mgBall.y = paddle.y + paddle.height + 1;
            else if (paddle.side === 'bottom') mgBall.y = paddle.y - mgBall.size - 1;

            ballChanged = true;
            break;
          }
        }

        // Apply Magnus effect to machine gun balls
        if (mgBall.spin && Math.abs(mgBall.spin) > 0.1) {
          const curved = ServerCollisionDetector.applyMagnusEffect({ dx: mgBall.dx, dy: mgBall.dy, spin: mgBall.spin });
          mgBall.dx = curved.dx;
          mgBall.dy = curved.dy;
          mgBall.spin *= ServerCollisionDetector['SPIN_DECAY'];
        }

        // Move ball
        mgBall.x += mgBall.dx;
        mgBall.y += mgBall.dy;

        if (frameCount % 10 === 0 && i === 0) {
          console.log(`🔫 MG Ball #${i}: pos=(${mgBall.x.toFixed(1)}, ${mgBall.y.toFixed(1)}) vel=(${mgBall.dx.toFixed(1)}, ${mgBall.dy.toFixed(1)})`);
        }

        // Check wall collision (scoring)
        const wallCollision = ServerCollisionDetector.detectBallWall(
          { x: mgBall.x, y: mgBall.y, size: mgBall.size, width: mgBall.size, height: mgBall.size, vx: mgBall.dx, vy: mgBall.dy, lastTouchedBy: mgBall.lastTouchedBy },
          canvasSize.width,
          canvasSize.height
        );

        if (wallCollision && wallCollision.hit) {
          console.log(`🔫 MACHINE GUN BALL SCORED: Hit ${wallCollision.side} boundary - NO PAUSE/RESET`);
          this.handleScoring(gameState, wallCollision.side, mgBall.lastTouchedBy, null, false, false); // Don't pause for machine gun balls
          mgBallsToRemove.push(i);
          ballChanged = true;
          continue;
        }

        ballChanged = true;
      }

      // Remove machine gun balls that scored
      if (mgBallsToRemove.length > 0) {
        console.log(`🔫 REMOVING ${mgBallsToRemove.length} balls that hit walls`);
      }
      for (let i = mgBallsToRemove.length - 1; i >= 0; i--) {
        gameState.machineGunBalls.splice(mgBallsToRemove[i], 1);
      }
      if (frameCount % 30 === 0) {
        console.log(`🔫 After cleanup: ${gameState.machineGunBalls.length} balls remaining`);
      }
    }


    // 🚀 BALL MOVEMENT WITH COMPREHENSIVE DEBUG TRACKING
    if (!gameState.ball.isAiming) {
      const prevX = gameState.ball.x;
      const prevY = gameState.ball.y;

      // 🌀 APPLY MAGNUS EFFECT (spin creates curve) - but only after 50 pixels
      if (!gameState.ball.spin) gameState.ball.spin = 0;
      if (!gameState.ball.spinDistanceTraveled) gameState.ball.spinDistanceTraveled = 0;

      // Track distance traveled
      const speed = Math.sqrt(gameState.ball.dx * gameState.ball.dx + gameState.ball.dy * gameState.ball.dy);
      gameState.ball.spinDistanceTraveled += speed;

      // Only apply Magnus effect after ball has traveled 50 pixels
      if (Math.abs(gameState.ball.spin) > 0.1 && gameState.ball.spinDistanceTraveled >= 50) {
        const curvedVelocity = ServerCollisionDetector.applyMagnusEffect({
          dx: gameState.ball.dx,
          dy: gameState.ball.dy,
          spin: gameState.ball.spin
        });
        gameState.ball.dx = curvedVelocity.dx;
        gameState.ball.dy = curvedVelocity.dy;

        // Apply spin decay (friction)
        const oldSpin = gameState.ball.spin;
        gameState.ball.spin *= ServerCollisionDetector['SPIN_DECAY'];

        // Debug: Log spin decay every 30 frames if spin is significant
        if (Math.abs(gameState.ball.spin) > 1.0 && frameCount % 30 === 0) {
          console.log(`🌀 SPIN DECAY: ${oldSpin.toFixed(2)} → ${gameState.ball.spin.toFixed(2)} (decay=${ServerCollisionDetector['SPIN_DECAY']})`);
        }
      }

      gameState.ball.x += gameState.ball.dx;
      gameState.ball.y += gameState.ball.dy;

      // Apply balloon_ball floating physics (upward force)
      if (gameState.ball.isFloating) {
        gameState.ball.dy -= 0.05; // Gentle upward force (reduces downward velocity)
        // Limit upward velocity to prevent excessive floating
        if (gameState.ball.dy < -2) {
          gameState.ball.dy = -2;
        }
      }

      // Update conga line balls to follow main ball
      if (gameState.congaBalls && gameState.congaBalls.length > 0) {
        // Each ball smoothly follows the ball in front of it
        for (let i = 0; i < gameState.congaBalls.length; i++) {
          const congaBall = gameState.congaBalls[i];

          // Determine target (either main ball or previous conga ball)
          const target = i === 0
            ? { x: gameState.ball.x, y: gameState.ball.y }
            : { x: gameState.congaBalls[i - 1].x, y: gameState.congaBalls[i - 1].y };

          // Smooth interpolation towards target (0.15 = 15% movement per frame)
          const lerpFactor = 0.15;
          congaBall.x += (target.x - congaBall.x) * lerpFactor;
          congaBall.y += (target.y - congaBall.y) * lerpFactor;

          // Store target for rendering
          congaBall.targetX = target.x;
          congaBall.targetY = target.y;
        }
      }

      // Check labyrinth coin collection
      if (gameState.labyrinthActive && gameState.labyrinthCoins.length > 0) {
        for (const coin of gameState.labyrinthCoins) {
          if (coin.collected) continue;

          // Check if ball touches coin
          const ballCenterX = gameState.ball.x + gameState.ball.size / 2;
          const ballCenterY = gameState.ball.y + gameState.ball.size / 2;
          const coinCenterX = coin.x + 8; // 16px coin, center at 8
          const coinCenterY = coin.y + 8;

          const dx = ballCenterX - coinCenterX;
          const dy = ballCenterY - coinCenterY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < (gameState.ball.size / 2 + 8)) {
            // Coin collected!
            coin.collected = true;
            coin.collectedAt = Date.now();
            coin.rotation = 0;

            // Award point to the player who last touched the ball
            if (gameState.ball.lastTouchedBy) {
              gameState.score[gameState.ball.lastTouchedBy]++;
              console.log(`🪙 Coin collected by ${gameState.ball.lastTouchedBy}! New score: ${gameState.score[gameState.ball.lastTouchedBy]}`);
            }
          }
        }
      }

      // Check coin_shower coin collection
      if (gameState.coins && gameState.coins.length > 0) {
        for (const coin of gameState.coins) {
          if (coin.collected) continue;

          // Check if ball touches coin
          const ballCenterX = gameState.ball.x + gameState.ball.size / 2;
          const ballCenterY = gameState.ball.y + gameState.ball.size / 2;
          const coinCenterX = coin.x + coin.size / 2;
          const coinCenterY = coin.y + coin.size / 2;

          const dx = ballCenterX - coinCenterX;
          const dy = ballCenterY - coinCenterY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < (gameState.ball.size / 2 + coin.size / 2)) {
            // Coin collected!
            coin.collected = true;
            coin.collectedAt = Date.now();
            coin.rotation = 0;

            // Award point to the player who last touched the ball
            if (gameState.ball.lastTouchedBy) {
              gameState.score[gameState.ball.lastTouchedBy]++;
              console.log(`💰 Coin shower coin collected by ${gameState.ball.lastTouchedBy}! New score: ${gameState.score[gameState.ball.lastTouchedBy]}`);
            }
          }
        }
      }

      // Check labyrinth wall collisions
      if (gameState.labyrinthActive && gameState.mazeWalls.length > 0) {
        for (const wall of gameState.mazeWalls) {
          // Simple AABB collision
          const ballLeft = gameState.ball.x;
          const ballRight = gameState.ball.x + gameState.ball.size;
          const ballTop = gameState.ball.y;
          const ballBottom = gameState.ball.y + gameState.ball.size;

          const wallLeft = wall.x;
          const wallRight = wall.x + wall.width;
          const wallTop = wall.y;
          const wallBottom = wall.y + wall.height;

          if (ballRight > wallLeft && ballLeft < wallRight &&
              ballBottom > wallTop && ballTop < wallBottom) {

            // Collision detected - bounce off the wall
            const overlapLeft = ballRight - wallLeft;
            const overlapRight = wallRight - ballLeft;
            const overlapTop = ballBottom - wallTop;
            const overlapBottom = wallBottom - ballTop;

            // Find minimum overlap to determine bounce direction
            const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

            if (minOverlap === overlapLeft || minOverlap === overlapRight) {
              // Horizontal collision
              gameState.ball.dx = -gameState.ball.dx;
              // Push ball out of wall
              if (minOverlap === overlapLeft) {
                gameState.ball.x = wallLeft - gameState.ball.size - 1;
              } else {
                gameState.ball.x = wallRight + 1;
              }
            } else {
              // Vertical collision
              gameState.ball.dy = -gameState.ball.dy;
              // Push ball out of wall
              if (minOverlap === overlapTop) {
                gameState.ball.y = wallTop - gameState.ball.size - 1;
              } else {
                gameState.ball.y = wallBottom + 1;
              }
            }

            console.log(`🏛️ Ball bounced off labyrinth wall at (${wall.x}, ${wall.y})`);
            break; // Only handle one collision per frame
          }
        }
      }

      // Log ball movement every few frames for tracking trajectory
      if (frameCount % 400 < 50) { // Every ~7 frames at 60fps
        console.log(`🚀 BALL MOVEMENT: (${prevX.toFixed(1)}, ${prevY.toFixed(1)}) → (${gameState.ball.x.toFixed(1)}, ${gameState.ball.y.toFixed(1)}) | Δ(${gameState.ball.dx.toFixed(2)}, ${gameState.ball.dy.toFixed(2)})`);

        // Check distance from boundaries
        const distToLeft = gameState.ball.x;
        const distToRight = canvasSize.width - (gameState.ball.x + gameState.ball.size);
        const distToTop = gameState.ball.y;
        const distToBottom = canvasSize.height - (gameState.ball.y + gameState.ball.size);
        console.log(`🌍 BOUNDARY DISTANCES: L=${distToLeft.toFixed(1)} R=${distToRight.toFixed(1)} T=${distToTop.toFixed(1)} B=${distToBottom.toFixed(1)}`);

        // Check if ball is approaching boundaries
        const approachingLeft = gameState.ball.dx < 0 && distToLeft < 100;
        const approachingRight = gameState.ball.dx > 0 && distToRight < 100;
        const approachingTop = gameState.ball.dy < 0 && distToTop < 100;
        const approachingBottom = gameState.ball.dy > 0 && distToBottom < 100;

        if (approachingLeft || approachingRight || approachingTop || approachingBottom) {
          console.log(`⚠️ BOUNDARY APPROACH: Left=${approachingLeft} Right=${approachingRight} Top=${approachingTop} Bottom=${approachingBottom}`);
        }
      }

      // 🛡️ SAFETY LIMITS: Prevent extreme ball velocities and positions
      const MAX_VELOCITY = 20; // Maximum allowed velocity
      const MAX_POSITION = 2000; // Maximum position (well outside normal canvas)

      // Clamp velocities to prevent runaway acceleration
      if (Math.abs(gameState.ball.dx) > MAX_VELOCITY) {
        console.warn(`⚠️ Ball velocity too high: dx=${gameState.ball.dx}, clamping to ${MAX_VELOCITY}`);
        gameState.ball.dx = Math.sign(gameState.ball.dx) * MAX_VELOCITY;
      }
      if (Math.abs(gameState.ball.dy) > MAX_VELOCITY) {
        console.warn(`⚠️ Ball velocity too high: dy=${gameState.ball.dy}, clamping to ${MAX_VELOCITY}`);
        gameState.ball.dy = Math.sign(gameState.ball.dy) * MAX_VELOCITY;
      }

      // Clamp positions to prevent extreme coordinates
      if (Math.abs(gameState.ball.x) > MAX_POSITION || Math.abs(gameState.ball.y) > MAX_POSITION) {
        console.warn(`⚠️ Ball position too extreme: (${gameState.ball.x},${gameState.ball.y}), resetting ball`);
        this.resetBall(gameState);
        ballChanged = true;
      }
    }

    // 🎯 CENTRALIZED BALL BOUNDARY COLLISION DETECTION FOR SCORING
    // Update ball object with current position for boundary detection
    ballForCollision.x = gameState.ball.x;
    ballForCollision.y = gameState.ball.y;
    ballForCollision.vx = gameState.ball.dx;
    ballForCollision.vy = gameState.ball.dy;

    // Wall collision check has been moved to before paddle collision
    // This section now only logs near-boundary status for debugging

    // Always log when ball is near boundary
    const nearLeft = ballForCollision.x < 50;
    const nearRight = ballForCollision.x + ballForCollision.size > canvasSize.width - 50;
    const nearTop = ballForCollision.y < 50;
    const nearBottom = ballForCollision.y + ballForCollision.size > canvasSize.height - 50;

    if (nearLeft || nearRight || nearTop || nearBottom) {
      console.log(`⚠️ NEAR BOUNDARY: Ball at (${ballForCollision.x.toFixed(1)}, ${ballForCollision.y.toFixed(1)}), velocity (${gameState.ball.dx.toFixed(2)}, ${gameState.ball.dy.toFixed(2)})`);
      console.log(`  Near: L=${nearLeft} R=${nearRight} T=${nearTop} B=${nearBottom}`);
    }

    return ballChanged;
  }

  private handleScoring(gameState: GameState, boundaryHit: 'left' | 'right' | 'top' | 'bottom', lastTouchedBy?: 'left' | 'right' | 'top' | 'bottom' | null, previousTouchedBy?: 'left' | 'right' | 'top' | 'bottom' | null, shouldPause: boolean = true, isMainBall: boolean = true): void {
    // Check for Great Wall protection (only for main ball)
    if (!lastTouchedBy && gameState.ball.hasGreatWall && gameState.ball.greatWallSide === boundaryHit) {
      console.log(`🧱 GREAT WALL: Protecting ${boundaryHit} wall - no score!`);
      // Bounce ball back instead of scoring
      if (boundaryHit === 'left' || boundaryHit === 'right') {
        gameState.ball.dx *= -1;
      } else {
        gameState.ball.dy *= -1;
      }
      return;
    }

    let scoringPlayer: 'left' | 'right' | 'top' | 'bottom';

    // Use provided lastTouchedBy or fall back to main ball's lastTouchedBy
    const effectiveLastTouchedBy = lastTouchedBy !== undefined ? lastTouchedBy : gameState.ball.lastTouchedBy;
    const effectivePreviousTouchedBy = previousTouchedBy !== undefined ? previousTouchedBy : gameState.ball.previousTouchedBy;

    // Determine who gets the score based on last touch
    if (effectiveLastTouchedBy) {
      // Check for self-goal (player hit ball into their own wall)
      const isSelfGoal = effectiveLastTouchedBy === boundaryHit;
      if (isSelfGoal && effectivePreviousTouchedBy) {
        // Self-goal: previous player gets the score
        scoringPlayer = effectivePreviousTouchedBy;
      } else if (!isSelfGoal) {
        // Normal goal: last toucher gets the score
        scoringPlayer = effectiveLastTouchedBy;
      } else {
        // Self-goal with no previous player - default opposite wall
        scoringPlayer = boundaryHit === 'left' ? 'right' :
                      boundaryHit === 'right' ? 'left' :
                      boundaryHit === 'top' ? 'bottom' : 'top';
      }
    } else {
      // No one touched the ball - default opposite wall scoring
      scoringPlayer = boundaryHit === 'left' ? 'right' :
                    boundaryHit === 'right' ? 'left' :
                    boundaryHit === 'top' ? 'bottom' : 'top';
    }

    // Award the score
    gameState.score[scoringPlayer]++;
    console.log(`🏆 SERVER SCORING: ${scoringPlayer} scores! New scores:`, gameState.score);

    // Check for winner (first to 1000 points)
    if (gameState.score[scoringPlayer] >= 1000) {
      gameState.winner = scoringPlayer;
      gameState.gameEnded = true;
      gameState.isPlaying = false;
      console.log(`🎉 Game Over! Winner: ${scoringPlayer}`);
    }
    // No more pausing - just keep the action going!

    // Reset ball position when main ball scores (not machine gun/extra balls)
    if (isMainBall) {
      this.resetBall(gameState);
      console.log(`⚡ Ball reset - continuing gameplay without pause`);
    }
  }

  private resetBall(gameState: GameState): void {
    gameState.ball.x = 400;
    gameState.ball.y = 300;
    // Reduce ball velocity to make gameplay more reasonable (was 10, now 3)
    gameState.ball.dx = Math.random() > 0.5 ? 3 : -3;
    gameState.ball.dy = Math.random() > 0.5 ? 3 : -3;
    gameState.ball.spin = 0; // 🌀 Reset spin when ball is reset
    gameState.ball.spinDistanceTraveled = 0; // 🌀 Reset distance traveled
    gameState.ball.lastTouchedBy = null;
    gameState.ball.previousTouchedBy = null;
    gameState.ball.hasGravity = false;
    gameState.ball.isAiming = false;
    gameState.ball.aimStartTime = 0;
    gameState.ball.aimX = 0;
    gameState.ball.aimY = 0;
    gameState.ball.aimTargetX = 0;
    gameState.ball.aimTargetY = 0;
  }

  private updatePickups(gameState: GameState, canvasSize: { width: number; height: number }, now: number, roomId: string): boolean {
    let pickupsChanged = false;

    // Skip random pickup spawning in debug/test mode
    if (gameState.isDebugMode) {
      return pickupsChanged;
    }

    // Debug logging every 5 seconds
    if (!this.lastPickupLog) this.lastPickupLog = 0;
    if (now - this.lastPickupLog > 5000) {
      console.log(`🔄 Pickup check: now=${now}, nextPickupTime=${gameState.nextPickupTime}, pickups=${gameState.pickups.length}, ready=${now >= gameState.nextPickupTime}`);
      this.lastPickupLog = now;
    }

    // Generate new pickups (max 2 on playfield, less frequent)
    if (now >= gameState.nextPickupTime && gameState.pickups.length < 2) {
      this.generatePickup(gameState, canvasSize);

      // Slower pickup frequency (starts at 15s, decreases to 10s)
      const gameTime = now - (gameState.nextPickupTime - 5000); // Game start time estimation
      const baseInterval = 15000; // 15 seconds (increased from 8s)
      const minInterval = 10000; // 10 seconds minimum (increased from 4s)
      const progressionRate = gameTime / 60000; // Over 1 minute
      const currentInterval = Math.max(minInterval, baseInterval - (progressionRate * 5000));

      gameState.nextPickupTime = now + currentInterval;
      pickupsChanged = true;
    }

    // Check ball collision with pickups (reverse loop to avoid index issues when splicing)
    for (let i = gameState.pickups.length - 1; i >= 0; i--) {
      const pickup = gameState.pickups[i];
      const pickupCenterX = pickup.x + (pickup.size || 32) / 2;
      const pickupCenterY = pickup.y + (pickup.size || 32) / 2;
      let collected = false;

      // Check main ball collision
      const ballCenterX = gameState.ball.x + gameState.ball.size / 2;
      const ballCenterY = gameState.ball.y + gameState.ball.size / 2;
      const ballDistance = Math.sqrt(
        Math.pow(ballCenterX - pickupCenterX, 2) + Math.pow(ballCenterY - pickupCenterY, 2)
      );

      if (ballDistance < (gameState.ball.size + (pickup.size || 32)) / 2) {
        collected = true;
      }

      // Check extra balls collision
      if (!collected && gameState.extraBalls) {
        for (const extraBall of gameState.extraBalls) {
          const extraBallCenterX = extraBall.x + extraBall.size / 2;
          const extraBallCenterY = extraBall.y + extraBall.size / 2;
          const extraBallDistance = Math.sqrt(
            Math.pow(extraBallCenterX - pickupCenterX, 2) + Math.pow(extraBallCenterY - pickupCenterY, 2)
          );

          if (extraBallDistance < (extraBall.size + (pickup.size || 32)) / 2) {
            collected = true;
            break;
          }
        }
      }

      if (collected) {
        // Pickup collected!
        console.log(`🎁 Pickup collected: ${pickup.type} at (${pickup.x.toFixed(0)}, ${pickup.y.toFixed(0)})`);
        this.applyPickupEffect(gameState, pickup, roomId);
        gameState.pickups.splice(i, 1);

        // Create pickup effect animation
        gameState.pickupEffect = {
          isActive: true,
          startTime: now,
          x: pickup.x,
          y: pickup.y
        };

        pickupsChanged = true;
      }
    }

    return pickupsChanged;
  }

  private generatePickup(gameState: GameState, canvasSize: { width: number; height: number }): void {
    const pickupTypes: Pickup['type'][] = [
      'speed_up', 'speed_down', 'big_ball', 'small_ball', 'drunk_ball', 'grow_paddle', 'shrink_paddle',
      'reverse_controls', 'invisible_ball', 'freeze_opponent', 'multi_ball', 'super_speed', 'coin_shower',
      'gravity_in_space', 'super_striker', 'sticky_paddles', 'machine_gun', 'dynamic_playfield',
      'switch_sides', 'time_warp', 'mirror_mode', 'quantum_ball', 'black_hole',
      'lightning_storm', 'invisible_paddles', 'ball_trail_mine', 'paddle_swap', 'disco_mode', 'pac_man',
      'banana_peel', 'rubber_ball', 'drunk_paddles', 'magnet_ball', 'balloon_ball', 'earthquake',
      'confetti_cannon', 'hypno_ball', 'conga_line', 'arkanoid', 'attractor', 'repulsor', 'great_wall', 'labyrinth'
    ]; // Removed 'portal_ball' and 'blocker' (too complex, needs proper implementation)
    const type = pickupTypes[Math.floor(Math.random() * pickupTypes.length)];

    // Pickup size is 32x32 (matches score counter font size)
    // Paddles are at edges with 44px safe zone (per paddle collision code)
    // Add 32px for pickup size to avoid spawning on paddles
    const padding = 76; // 44px paddle zone + 32px pickup size

    const pickup: Pickup = {
      id: Math.random().toString(36).substr(2, 9),
      x: Math.random() * (canvasSize.width - padding * 2) + padding,
      y: Math.random() * (canvasSize.height - padding * 2) + padding,
      type,
      createdAt: Date.now(),
      size: 32
    };

    gameState.pickups.push(pickup);
    console.log(`✨ Generated pickup: ${type} at (${pickup.x.toFixed(0)}, ${pickup.y.toFixed(0)})`);
  }

  private applyPickupEffect(gameState: GameState, pickup: Pickup, roomId?: string): void {
    const effect: ActiveEffect = {
      type: pickup.type,
      startTime: Date.now(),
      duration: 5000 // 5 seconds
    };

    gameState.activeEffects.push(effect);

    // Debug: Log pickup type before switch
    console.log(`🔍 PICKUP DEBUG: About to switch on type="${pickup.type}" (typeof: ${typeof pickup.type})`);

    // Apply immediate effects based on pickup type
    switch (pickup.type) {
      case 'speed_up':
        gameState.ball.dx *= 1.5;
        gameState.ball.dy *= 1.5;
        effect.duration = 6000;
        break;
      case 'speed_down':
        gameState.ball.dx *= 0.4;
        gameState.ball.dy *= 0.4;
        effect.duration = 6000;
        break;
      case 'big_ball':
        effect.originalValue = gameState.ball.size;
        gameState.ball.size = 18;
        break;
      case 'small_ball':
        effect.originalValue = gameState.ball.size;
        gameState.ball.size = 6;
        break;
      case 'drunk_ball':
        gameState.ball.isDrunk = true;
        gameState.ball.drunkAngle = 0;
        effect.duration = 4000;
        break;
      case 'grow_paddle':
        // In test/debug mode or regular gameplay, grow the paddle of the player who activated it
        // Use lastTouchedBy which is set to the player's side in test mode
        const growSide = (gameState.ball.lastTouchedBy || 'right') as 'left' | 'right' | 'top' | 'bottom';
        effect.side = growSide;
        effect.activator = growSide; // Mark who activated it for proper restoration

        if (growSide === 'left' || growSide === 'right') {
          effect.originalValue = gameState.paddles[growSide].height;
          gameState.paddles[growSide].height = Math.min(300, gameState.paddles[growSide].height * 2.0);
        } else {
          effect.originalValue = gameState.paddles[growSide].width;
          gameState.paddles[growSide].width = Math.min(300, gameState.paddles[growSide].width * 2.0);
        }
        break;
      case 'shrink_paddle':
        // Shrink ALL opponent paddles (not the player who touched the ball)
        const currentPlayer = gameState.ball.lastTouchedBy || 'right';
        const allOpponents: Array<'left' | 'right' | 'top' | 'bottom'> = ['left', 'right', 'top', 'bottom'].filter(s => s !== currentPlayer);

        // Store original values for all opponents
        effect.originalValues = {};

        // Shrink all opponent paddles
        for (const opponentSide of allOpponents) {
          if (opponentSide === 'left' || opponentSide === 'right') {
            effect.originalValues[opponentSide] = gameState.paddles[opponentSide].height;
            gameState.paddles[opponentSide].height = Math.max(30, gameState.paddles[opponentSide].height * 0.5);
          } else {
            effect.originalValues[opponentSide] = gameState.paddles[opponentSide].width;
            gameState.paddles[opponentSide].width = Math.max(30, gameState.paddles[opponentSide].width * 0.5);
          }
        }

        effect.affectedSides = allOpponents; // Track which sides were affected
        break;
      case 'reverse_controls':
        // Store who activated it so we can exclude them from the reversal
        effect.activator = gameState.ball.lastTouchedBy || 'none';
        effect.duration = 6000; // 6 seconds
        console.log(`🔄 REVERSE CONTROLS activated by: ${effect.activator}`);
        break;
      case 'invisible_ball':
        // Visual effect handled on client side
        effect.duration = 4000;
        break;
      case 'freeze_opponent':
        // Freeze all opponents except the player who collected the pickup
        effect.excludePaddle = gameState.ball.lastTouchedBy || 'none';
        effect.duration = 3000; // 3 seconds
        console.log(`❄️ FREEZE OPPONENT activated by: ${effect.excludePaddle}`);
        break;
      case 'super_speed':
        gameState.ball.dx *= 2.5;
        gameState.ball.dy *= 2.5;
        effect.duration = 3000;
        break;
      case 'sticky_paddles':
        // Ball will stick to paddles for 3 seconds before shooting - only for activator
        gameState.stickyPaddlesActive = true;
        effect.activator = gameState.ball.lastTouchedBy || 'none';
        effect.duration = 15000; // Effect lasts 15 seconds
        console.log(`🧲 STICKY PADDLES activated by: ${effect.activator}`);
        break;
      case 'machine_gun':
        // Rapidly fire balls for 3 seconds
        gameState.machineGunActive = true;
        gameState.machineGunStartTime = Date.now();
        // Default to 'right' if ball hasn't touched any paddle yet
        gameState.machineGunShooter = gameState.ball.lastTouchedBy || 'right';
        effect.duration = 3000; // 3 seconds of machine gun
        effect.activator = gameState.ball.lastTouchedBy || 'right';
        console.log(`🔫 MACHINE GUN activated by: ${gameState.machineGunShooter}`);
        break;
      case 'dynamic_playfield':
        // Pulsating playfield for 15 seconds - CHAOTIC zoom for maximum challenge
        gameState.playfieldScaleStart = gameState.playfieldScale;
        gameState.playfieldScaleTarget = 0.3 + Math.random() * 0.7; // Scale between 0.3-1.0 (EXTREME zoom)
        gameState.playfieldScaleTime = Date.now();
        effect.duration = 15000; // 15 seconds of pulsating
        console.log(`📐 DYNAMIC PLAYFIELD: Starting at ${gameState.playfieldScale.toFixed(2)}x, target ${gameState.playfieldScaleTarget.toFixed(2)}x (pulsating for 15s)`);
        break;
      case 'switch_sides':
        // All players switch to opposite sides and their scores follow them
        // First, swap player side assignments in the room
        const room = this.rooms.get(roomId);
        if (room) {
          const sideMapping: { [key: string]: 'left' | 'right' | 'top' | 'bottom' } = {
            'left': 'right',
            'right': 'left',
            'top': 'bottom',
            'bottom': 'top'
          };

          // Update each player's side assignment
          for (const [playerId, player] of room.players.entries()) {
            if (player.side !== 'spectator') {
              const oldSide = player.side;
              const newSide = sideMapping[player.side];
              player.side = newSide;
              console.log(`🔄 SWITCH_SIDES: Player ${playerId} switched from ${oldSide} to ${newSide}`);

              // Notify the player of their new side
              player.ws.send(JSON.stringify({
                type: 'side_switched',
                data: {
                  newSide: newSide,
                  oldSide: oldSide
                }
              }));
            }
          }
        }

        // Swap the scores so they follow the players
        const tempLeftScore = gameState.score.left;
        const tempRightScore = gameState.score.right;
        const tempTopScore = gameState.score.top;
        const tempBottomScore = gameState.score.bottom;
        gameState.score.left = tempRightScore;
        gameState.score.right = tempLeftScore;
        gameState.score.top = tempBottomScore;
        gameState.score.bottom = tempTopScore;
        gameState.sidesSwitched = !gameState.sidesSwitched;
        effect.duration = 3000; // Show effect for 3 seconds
        console.log('🔄 SWITCH_SIDES: Scores swapped', gameState.score);
        break;
      case 'time_warp':
        // Slow down or speed up time
        gameState.timeWarpActive = true;
        gameState.timeWarpFactor = Math.random() > 0.5 ? 0.5 : 2.0; // Half speed or double speed
        effect.duration = 8000; // 8 seconds
        break;
      case 'gravity_in_space':
        gameState.ball.hasGravity = true;
        effect.duration = 10000; // 10 seconds of gravity
        break;
      case 'super_striker':
        // Pause the ball and enter aiming mode
        gameState.ball.isAiming = true;
        gameState.ball.aimStartTime = Date.now();
        gameState.ball.aimX = gameState.ball.x;
        gameState.ball.aimY = gameState.ball.y;
        gameState.ball.dx = 0; // Stop the ball
        gameState.ball.dy = 0;
        effect.activator = gameState.ball.lastTouchedBy || 'none'; // Store who activated it
        effect.duration = 3000; // 3 seconds to aim before auto-fire
        console.log(`🎯 SUPER STRIKER activated by: ${effect.activator}`);
        break;
      case 'arkanoid':
        // Create arkanoid bricks in + formation
        gameState.arkanoidBricks = [];
        gameState.arkanoidActive = true;
        gameState.arkanoidMode = true;
        gameState.arkanoidBricksHit = 0;

        // Create + formation with 16 bricks (7 horizontal + 9 vertical, center overlaps)
        const centerX = 400; // Center of 800px canvas
        const centerY = 300; // Center of 600px canvas
        const brickWidth = 40;
        const brickHeight = 20;
        const spacing = 5;

        // Horizontal line of the + (7 bricks)
        for (let i = -3; i <= 3; i++) {
          gameState.arkanoidBricks.push({
            x: centerX + i * (brickWidth + spacing) - brickWidth / 2,
            y: centerY - brickHeight / 2,
            width: brickWidth,
            height: brickHeight,
            id: `h_${i}`,
            life: 1
          });
        }

        // Vertical line of the + (9 bricks, excluding center overlap)
        for (let i = -4; i <= 4; i++) {
          if (i !== 0) { // Skip center to avoid overlap
            gameState.arkanoidBricks.push({
              x: centerX - brickWidth / 2,
              y: centerY + i * (brickHeight + spacing) - brickHeight / 2,
              width: brickWidth,
              height: brickHeight,
              id: `v_${i}`,
              life: 1
            });
          }
        }

        effect.duration = 30000; // 30 seconds or until all bricks destroyed
        break;
      case 'multi_ball':
        // Add 3 extra balls shooting out from center in different directions
        const multiBallCenterX = 400;
        const multiBallCenterY = 400;
        const baseSpeed = 5; // Base speed for extra balls

        for (let i = 0; i < 3; i++) {
          // Shoot balls in 3 different directions: 0°, 120°, 240° (evenly spaced)
          const angle = (i * 2 * Math.PI / 3); // 0, 120, 240 degrees in radians

          gameState.extraBalls.push({
            x: multiBallCenterX,
            y: multiBallCenterY,
            dx: Math.cos(angle) * baseSpeed,
            dy: Math.sin(angle) * baseSpeed,
            size: gameState.ball.size,
            id: `extra_${Date.now()}_${i}`
          });
        }
        console.log(`🎾 MULTI-BALL: Added 3 extra balls shooting from center, total extraBalls: ${gameState.extraBalls.length}`);
        // No duration - multiball stays active until all extra balls are removed by scoring
        effect.duration = Infinity;
        break;
      case 'rubber_ball':
        // Increase ball bounciness
        effect.originalValue = gameState.ball.bounciness;
        gameState.ball.bounciness = 1.5;
        gameState.ball.isSlippery = false; // Ensure clean state
        effect.duration = 10000; // 10 seconds
        break;
      case 'balloon_ball':
        // Make ball float and bounce gently
        gameState.ball.isFloating = true;
        effect.originalValue = gameState.ball.bounciness;
        gameState.ball.bounciness = 0.8;
        effect.duration = 8000; // 8 seconds
        break;
      case 'magnet_ball':
        // Ball attracted to paddles
        gameState.ball.isMagnetic = true;
        effect.duration = 12000; // 12 seconds
        break;
      case 'attractor':
        // Create an attractor force field that pulls the ball towards it
        effect.x = pickup.x + (pickup.size || 32) / 2;
        effect.y = pickup.y + (pickup.size || 32) / 2;
        effect.duration = 10000; // 10 seconds
        console.log(`🧲 Attractor created at (${effect.x}, ${effect.y})`);
        break;
      case 'repulsor':
        // Create a repulsor force field that pushes the ball away
        effect.x = pickup.x + (pickup.size || 32) / 2;
        effect.y = pickup.y + (pickup.size || 32) / 2;
        effect.duration = 10000; // 10 seconds
        console.log(`💨 Repulsor created at (${effect.x}, ${effect.y})`);
        break;
      case 'invisible_paddles':
        // Make paddles partially invisible
        gameState.paddleVisibility = { left: 0.2, right: 0.2, top: 0.2, bottom: 0.2 };
        effect.duration = 8000; // 8 seconds
        break;
      case 'drunk_paddles':
        // Make opponent paddles move erratically
        gameState.paddlesDrunk = true;
        gameState.drunkStartTime = Date.now();
        effect.activator = gameState.ball.lastTouchedBy || 'none';
        effect.duration = 10000; // 10 seconds
        console.log(`🍺 DRUNK PADDLES activated by: ${effect.activator}`);
        break;
      case 'earthquake':
        // Shake the playfield
        gameState.earthquakeActive = true;
        gameState.earthquakeStartTime = Date.now();
        effect.duration = 6000; // 6 seconds
        break;
      case 'hypno_ball':
        // Ball hypnotic effect
        gameState.ball.isHypnotic = true;
        gameState.hypnoStartTime = Date.now();
        effect.duration = 8000; // 8 seconds
        break;
      case 'disco_mode':
        // Disco effect
        gameState.discoMode = true;
        gameState.discoStartTime = Date.now();
        effect.duration = 15000; // 15 seconds
        break;
      case 'conga_line':
        // Create a line of balls following the main ball
        gameState.congaBalls = [];
        for (let i = 0; i < 3; i++) {
          gameState.congaBalls.push({
            x: gameState.ball.x - (i + 1) * 20,
            y: gameState.ball.y,
            targetX: gameState.ball.x,
            targetY: gameState.ball.y,
            id: `conga_${i}`
          });
        }
        effect.duration = 12000; // 12 seconds
        break;

      case 'labyrinth':
        // Generate maze with clear edges (50 pixels = ~5cm at typical scale)
        gameState.labyrinthActive = true;
        gameState.labyrinthStartTime = Date.now();
        gameState.mazeWalls = this.generateMaze(this.canvasSize.width, this.canvasSize.height);
        gameState.labyrinthCoins = this.generateLabyrinthCoins(gameState.mazeWalls, this.canvasSize.width, this.canvasSize.height);
        effect.duration = 30000; // 30 seconds
        console.log(`🏛️ LABYRINTH activated: ${gameState.mazeWalls.length} walls, ${gameState.labyrinthCoins.length} coins`);
        break;
      case 'confetti_cannon':
        // Create confetti particles
        gameState.confetti = [];
        for (let i = 0; i < 20; i++) {
          gameState.confetti.push({
            x: gameState.ball.x,
            y: gameState.ball.y,
            dx: (Math.random() - 0.5) * 10,
            dy: (Math.random() - 0.5) * 10,
            color: `hsl(${Math.random() * 360}, 70%, 60%)`,
            life: 3000,
            id: `confetti_${i}`
          });
        }
        effect.duration = 3000; // 3 seconds
        break;
      case 'coin_shower':
        console.log(`💰 ENTERING COIN_SHOWER CASE`);
        // Create coins for collection with accelerating spawn delay (slow to fast)
        gameState.coins = [];
        const now = Date.now();
        let cumulativeDelay = 0;
        for (let i = 0; i < 10; i++) {
          // Accelerating: start with 400ms between coins, decreasing to 85ms
          const delayIncrement = 400 - (i * 35); // 400, 365, 330, 295, 260, 225, 190, 155, 120, 85
          cumulativeDelay += delayIncrement;

          // Spread coins evenly across entire playfield (80-720 for both x and y)
          // Avoid paddle zones: left (x<60), right (x>740), top (y<80), bottom (y>720)
          gameState.coins.push({
            id: `coin_${now}_${i}`,
            x: 80 + Math.random() * 640, // 80-720 (full width, avoiding paddles)
            y: 80 + Math.random() * 640, // 80-720 (full height, avoiding paddles)
            createdAt: now,
            spawnDelay: cumulativeDelay,
            size: 32 // Bigger coins (8x8 pixels at 4px each)
          });
        }
        console.log(`💰 COIN SHOWER: Created ${gameState.coins.length} coins:`, JSON.stringify(gameState.coins.slice(0, 2)));
        effect.duration = Infinity; // Never expires - coins stay until collected
        break;
      case 'blocker':
        // Blocker pickup disabled
        effect.duration = 0;
        break;
      case 'portal_ball':
        // Portal ball pickup disabled - was preventing scoring
        // Do nothing when this pickup is collected
        effect.duration = 0;
        break;
      case 'mirror_mode':
        // Create mirror balls
        gameState.ball.isMirror = true;
        gameState.ball.mirrorBalls = [];
        for (let i = 0; i < 2; i++) {
          gameState.ball.mirrorBalls.push({
            x: 800 - gameState.ball.x,
            y: 600 - gameState.ball.y,
            dx: -gameState.ball.dx,
            dy: -gameState.ball.dy,
            id: `mirror_${i}`
          });
        }
        effect.duration = 12000; // 12 seconds
        break;
      case 'quantum_ball':
        // Create quantum positions
        gameState.ball.isQuantum = true;
        gameState.ball.quantumPositions = [];
        for (let i = 0; i < 3; i++) {
          gameState.ball.quantumPositions.push({
            x: Math.random() * 600 + 100,
            y: Math.random() * 400 + 100
          });
        }
        effect.duration = 8000; // 8 seconds
        break;
      case 'black_hole':
        // Create black holes
        gameState.blackHoles = [];
        for (let i = 0; i < 2; i++) {
          gameState.blackHoles.push({
            x: Math.random() * 600 + 100,
            y: Math.random() * 400 + 100,
            radius: 40,
            strength: 150,
            id: `blackhole_${i}`
          });
        }
        effect.duration = 15000; // 15 seconds
        break;
      case 'lightning_storm':
        // Create lightning strikes
        gameState.lightningStrikes = [];
        effect.duration = 10000; // 10 seconds
        break;
      case 'ball_trail_mine':
        // Enable trail mines
        gameState.ball.hasTrailMines = true;
        gameState.ball.trailMines = [];
        effect.duration = 15000; // 15 seconds
        break;
      case 'paddle_swap':
        // Swap paddle positions
        gameState.paddleSwapActive = true;
        gameState.nextPaddleSwapTime = Date.now() + 2000; // First swap in 2 seconds
        effect.duration = 10000; // 10 seconds
        break;
      case 'pac_man':
        // Create pac-man enemies
        gameState.pacMans = [];
        for (let i = 0; i < 3; i++) {
          gameState.pacMans.push({
            x: Math.random() * 600 + 100,
            y: Math.random() * 400 + 100,
            dx: (Math.random() - 0.5) * 4,
            dy: (Math.random() - 0.5) * 4,
            id: `pacman_${i}`,
            size: 20
          });
        }
        effect.duration = 15000; // 15 seconds
        break;
      case 'banana_peel':
        // Make ball slippery
        gameState.ball.isSlippery = true;
        effect.originalValue = gameState.ball.bounciness;
        gameState.ball.bounciness = 1.2;
        effect.duration = 8000; // 8 seconds
        break;
      case 'wind':
        gameState.ball.hasWind = true;
        effect.duration = 4000;
        break;
      case 'great_wall':
        // Protect the losing side's wall
        const scores = [
          { side: 'left' as const, score: gameState.score.left },
          { side: 'right' as const, score: gameState.score.right },
          { side: 'top' as const, score: gameState.score.top },
          { side: 'bottom' as const, score: gameState.score.bottom }
        ];
        const losingSide = scores.reduce((min, curr) => curr.score < min.score ? curr : min);
        gameState.ball.hasGreatWall = true;
        gameState.ball.greatWallSide = losingSide.side;
        effect.duration = 8000;
        break;
      default:
        // For any unimplemented pickup, give it a default 5 second duration
        effect.duration = 5000;
        break;
    }
  }


  private updateActiveEffects(gameState: GameState, now: number): boolean {
    let effectsChanged = false;

    // Remove expired effects
    const initialLength = gameState.activeEffects.length;
    gameState.activeEffects = gameState.activeEffects.filter(effect => {
      // Special handling for multi_ball - expires when all extra balls are gone
      if (effect.type === 'multi_ball') {
        const isExpired = gameState.extraBalls.length === 0;
        if (isExpired) {
          console.log('🎾 MULTI-BALL: Effect expired - all extra balls removed');
          this.reversePickupEffect(gameState, effect);
        }
        return !isExpired;
      }

      const isExpired = now - effect.startTime > effect.duration;

      if (isExpired) {
        // Reverse effect when it expires
        this.reversePickupEffect(gameState, effect);
      }

      return !isExpired;
    });

    if (gameState.activeEffects.length !== initialLength) {
      effectsChanged = true;
    }

    // Update pickup effect animation
    if (gameState.pickupEffect.isActive && now - gameState.pickupEffect.startTime > 1000) {
      gameState.pickupEffect.isActive = false;
      effectsChanged = true;
    }

    // Update rumble effect
    if (gameState.rumbleEffect.isActive && now - gameState.rumbleEffect.startTime > 500) {
      gameState.rumbleEffect.isActive = false;
      effectsChanged = true;
    }

    return effectsChanged;
  }

  // 📐 Easing function for bouncy playfield scaling animation
  private easeInOutBack(t: number): number {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  }

  // 📐 Update playfield scaling with smooth animation
  private updatePlayfieldScale(gameState: GameState, now: number): boolean {
    // Check if dynamic playfield effect is active
    const dynamicPlayfieldActive = gameState.activeEffects.some(e => e.type === 'dynamic_playfield');

    if (gameState.playfieldScale === gameState.playfieldScaleTarget) {
      // If dynamic playfield is active and animation completed, start a new pulse
      if (dynamicPlayfieldActive) {
        gameState.playfieldScaleStart = gameState.playfieldScale;
        gameState.playfieldScaleTarget = 0.3 + Math.random() * 0.7; // New random scale between 0.3-1.0 (EXTREME zoom)
        gameState.playfieldScaleTime = now;
        console.log(`📐 NEW PULSE: ${gameState.playfieldScale.toFixed(2)}x → ${gameState.playfieldScaleTarget.toFixed(2)}x`);
        return true;
      }
      return false; // No animation in progress
    }

    const ANIMATION_DURATION = 500; // 0.5 seconds for FAST, CHAOTIC transitions
    const elapsed = now - gameState.playfieldScaleTime;

    if (elapsed >= ANIMATION_DURATION) {
      // Animation complete
      gameState.playfieldScale = gameState.playfieldScaleTarget;
      console.log(`📐 Pulse complete: ${gameState.playfieldScale.toFixed(2)}x`);
      return true;
    }

    // Calculate eased progress (0-1) with bouncy overshoot
    const progress = elapsed / ANIMATION_DURATION;
    const easedProgress = this.easeInOutBack(progress);

    // Interpolate between start and target
    gameState.playfieldScale = gameState.playfieldScaleStart +
      (gameState.playfieldScaleTarget - gameState.playfieldScaleStart) * easedProgress;

    return true;
  }

  private reversePickupEffect(gameState: GameState, effect: ActiveEffect): void {
    switch (effect.type) {
      case 'big_ball':
      case 'small_ball':
        if (effect.originalValue !== undefined) {
          gameState.ball.size = effect.originalValue;
        }
        break;

      case 'drunk_ball':
        gameState.ball.isDrunk = false;
        gameState.ball.drunkAngle = 0;
        break;

      case 'grow_paddle':
        if (effect.side && effect.originalValue !== undefined) {
          const side = effect.side as 'left' | 'right' | 'top' | 'bottom';
          if (side === 'left' || side === 'right') {
            gameState.paddles[side].height = effect.originalValue;
          } else {
            gameState.paddles[side].width = effect.originalValue;
          }
        }
        break;

      case 'shrink_paddle':
        // Restore all affected paddles
        if (effect.affectedSides && effect.originalValues) {
          for (const side of effect.affectedSides as Array<'left' | 'right' | 'top' | 'bottom'>) {
            if (side === 'left' || side === 'right') {
              gameState.paddles[side].height = effect.originalValues[side];
            } else {
              gameState.paddles[side].width = effect.originalValues[side];
            }
          }
        }
        break;

      case 'gravity_in_space':
        gameState.ball.hasGravity = false;
        break;

      case 'super_striker':
        // Auto-fire after 3 seconds if player hasn't fired manually
        if (gameState.ball.isAiming) {
          // Calculate direction towards center or opponent's side based on activator
          const ballCenterX = gameState.ball.x + gameState.ball.size / 2;
          const ballCenterY = gameState.ball.y + gameState.ball.size / 2;

          let targetX = 400; // Center X
          let targetY = 300; // Center Y

          // Aim towards opponent's goal based on who activated it
          if (effect.activator === 'left') {
            targetX = 750; // Aim right
          } else if (effect.activator === 'right') {
            targetX = 50; // Aim left
          } else if (effect.activator === 'top') {
            targetY = 550; // Aim down
          } else if (effect.activator === 'bottom') {
            targetY = 50; // Aim up
          }

          const angle = Math.atan2(targetY - ballCenterY, targetX - ballCenterX);
          const speed = 15; // Super striker speed

          gameState.ball.dx = Math.cos(angle) * speed;
          gameState.ball.dy = Math.sin(angle) * speed;
          gameState.ball.isAiming = false;

          console.log(`🎯 SUPER STRIKER auto-fired by ${effect.activator} at angle ${(angle * 180 / Math.PI).toFixed(1)}°`);
        }
        break;

      case 'sticky_paddles':
        gameState.stickyPaddlesActive = false;
        break;

      case 'machine_gun':
        gameState.machineGunActive = false;
        // Don't clear balls - let them finish their flight
        break;

      case 'dynamic_playfield':
        // Animate back to normal size
        gameState.playfieldScaleStart = gameState.playfieldScale;
        gameState.playfieldScaleTarget = 1.0;
        gameState.playfieldScaleTime = Date.now();
        console.log(`📐 DYNAMIC PLAYFIELD ENDING: Animating back from ${gameState.playfieldScale.toFixed(2)}x to 1.00x`);
        break;

      case 'time_warp':
        gameState.timeWarpActive = false;
        gameState.timeWarpFactor = 1.0;
        break;

      case 'arkanoid':
        gameState.arkanoidBricks = [];
        gameState.arkanoidActive = false;
        gameState.arkanoidMode = false;
        gameState.arkanoidBricksHit = 0;
        break;

      case 'multi_ball':
        // Don't clear extra balls - they are removed naturally when they score
        // The effect expires when extraBalls.length === 0 (checked elsewhere)
        break;


      case 'rubber_ball':
        if (effect.originalValue !== undefined) {
          gameState.ball.bounciness = effect.originalValue;
        }
        gameState.ball.isSlippery = false;
        break;

      case 'balloon_ball':
        gameState.ball.isFloating = false;
        if (effect.originalValue !== undefined) {
          gameState.ball.bounciness = effect.originalValue;
        }
        break;

      case 'magnet_ball':
        gameState.ball.isMagnetic = false;
        break;

      case 'invisible_paddles':
        gameState.paddleVisibility = { left: 1, right: 1, top: 1, bottom: 1 };
        break;

      case 'drunk_paddles':
        gameState.paddlesDrunk = false;
        break;

      case 'earthquake':
        gameState.earthquakeActive = false;
        break;

      case 'hypno_ball':
        gameState.ball.isHypnotic = false;
        break;

      case 'disco_mode':
        gameState.discoMode = false;
        break;

      case 'conga_line':
        gameState.congaBalls = [];
        break;

      case 'labyrinth':
        gameState.labyrinthActive = false;
        gameState.mazeWalls = [];
        gameState.labyrinthCoins = [];
        console.log('🏛️ LABYRINTH expired: Maze cleared');
        break;

      case 'confetti_cannon':
        gameState.confetti = [];
        break;

      case 'coin_shower':
        gameState.coins = [];
        break;

      case 'blocker':
        gameState.walls = [];
        break;

      case 'portal_ball':
        console.log('🌀 PORTAL PICKUP EXPIRED: Ball will no longer teleport at edges');
        gameState.ball.hasPortal = false;
        break;

      case 'mirror_mode':
        gameState.ball.isMirror = false;
        gameState.ball.mirrorBalls = [];
        break;

      case 'quantum_ball':
        gameState.ball.isQuantum = false;
        gameState.ball.quantumPositions = [];
        break;

      case 'black_hole':
        gameState.blackHoles = [];
        break;

      case 'lightning_storm':
        gameState.lightningStrikes = [];
        break;

      case 'ball_trail_mine':
        gameState.ball.hasTrailMines = false;
        gameState.ball.trailMines = [];
        break;

      case 'paddle_swap':
        gameState.paddleSwapActive = false;
        break;

      case 'pac_man':
        gameState.pacMans = [];
        break;

      case 'banana_peel':
        gameState.ball.isSlippery = false;
        if (effect.originalValue !== undefined) {
          gameState.ball.bounciness = effect.originalValue;
        }
        break;

      case 'wind':
        gameState.ball.hasWind = false;
        break;

      case 'great_wall':
        gameState.ball.hasGreatWall = false;
        gameState.ball.greatWallSide = null;
        break;

      // For other effects, no cleanup needed (visual effects, etc.)
      default:
        break;
    }
  }

  private lineIntersectsRect(x1: number, y1: number, x2: number, y2: number, rx: number, ry: number, rw: number, rh: number): boolean {
    // Check if line intersects with rectangle
    const left = rx;
    const right = rx + rw;
    const top = ry;
    const bottom = ry + rh;

    // Check intersection with each edge of the rectangle
    return (
      this.lineIntersectsLine(x1, y1, x2, y2, left, top, right, top) ||    // Top edge
      this.lineIntersectsLine(x1, y1, x2, y2, right, top, right, bottom) || // Right edge
      this.lineIntersectsLine(x1, y1, x2, y2, right, bottom, left, bottom) || // Bottom edge
      this.lineIntersectsLine(x1, y1, x2, y2, left, bottom, left, top)       // Left edge
    );
  }

  private lineIntersectsLine(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): boolean {
    const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (denominator === 0) return false;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;

    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  public start() {
    // Add health check endpoint
    this.server.on('request', (req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(JSON.stringify({
          status: 'ok',
          timestamp: Date.now(),
          serverInstanceId: this.instanceId,
          rooms: this.rooms.size,
          players: this.players.size
        }));
        return;
      }

      // Default response for other requests
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('WebSocket server running');
    });

    this.server.listen(this.port, '0.0.0.0', () => {
      console.log(`[▲] Pong WebSocket server running on http://0.0.0.0:${this.port}`);
      console.log(`[💓] Health endpoint available at http://0.0.0.0:${this.port}/health`);
      console.log(`[▶] Ready for Pong multiplayer connections!`);
      console.log(`[#] Server Instance ID: ${this.instanceId}`);
    }).on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[✗] ERROR: Port ${this.port} is already in use. Another server is running.`);
        console.error(`[✗] Kill existing server first: lsof -ti:${this.port} | xargs kill -9`);
        process.exit(1);
      } else {
        console.error(`[✗] Server error:`, err);
        process.exit(1);
      }
    });

    // Send periodic heartbeat to all connected clients
    setInterval(() => {
      // Skip heartbeat if no players connected
      if (this.players.size === 0) return;

      this.players.forEach((player) => {
        if (player.ws.readyState === 1) { // WebSocket.OPEN
          try {
            player.ws.send(JSON.stringify({
              type: 'heartbeat',
              timestamp: Date.now(),
              serverInstanceId: this.instanceId
            }));
          } catch (error) {
            console.error(`[X] Error sending heartbeat to player ${player.id}:`, error);
          }
        }
      });
    }, 30000); // Send heartbeat every 30 seconds
  }

  private generateMaze(width: number, height: number): MazeWall[] {
    const walls: MazeWall[] = [];
    const clearEdge = 50; // 50 pixels clear at edges (~5cm)
    const wallThickness = 12; // Match border thickness
    const cellSize = 80; // Size of maze cells

    // Calculate maze area
    const mazeLeft = clearEdge;
    const mazeRight = width - clearEdge;
    const mazeTop = clearEdge;
    const mazeBottom = height - clearEdge;
    const mazeWidth = mazeRight - mazeLeft;
    const mazeHeight = mazeBottom - mazeTop;

    // Create grid of cells
    const cols = Math.floor(mazeWidth / cellSize);
    const rows = Math.floor(mazeHeight / cellSize);

    // Create a simple maze pattern with multiple entrances
    // Using a modified recursive division algorithm
    const horizontalWalls: boolean[][] = Array(rows + 1).fill(null).map(() => Array(cols).fill(false));
    const verticalWalls: boolean[][] = Array(rows).fill(null).map(() => Array(cols + 1).fill(false));

    // Add some horizontal walls with gaps (entrances)
    for (let row = 1; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        // Add walls with 60% probability to create openings
        if (Math.random() < 0.6) {
          horizontalWalls[row][col] = true;
        }
      }
      // Ensure at least 2 gaps per row for multiple entrances
      const gaps = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < gaps; i++) {
        const gapCol = Math.floor(Math.random() * cols);
        horizontalWalls[row][gapCol] = false;
      }
    }

    // Add some vertical walls with gaps
    for (let row = 0; row < rows; row++) {
      for (let col = 1; col < cols; col++) {
        // Add walls with 60% probability
        if (Math.random() < 0.6) {
          verticalWalls[row][col] = true;
        }
      }
      // Ensure at least 2 gaps per row
      const gaps = Math.floor(Math.random() * 3) + 2;
      for (let i = 0; i < gaps; i++) {
        const gapCol = Math.floor(Math.random() * (cols - 1)) + 1;
        verticalWalls[row][gapCol] = false;
      }
    }

    // Convert grid to wall objects
    // Horizontal walls
    for (let row = 0; row <= rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (horizontalWalls[row][col]) {
          walls.push({
            x: mazeLeft + col * cellSize,
            y: mazeTop + row * cellSize - wallThickness / 2,
            width: cellSize,
            height: wallThickness
          });
        }
      }
    }

    // Vertical walls
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col <= cols; col++) {
        if (verticalWalls[row][col]) {
          walls.push({
            x: mazeLeft + col * cellSize - wallThickness / 2,
            y: mazeTop + row * cellSize,
            width: wallThickness,
            height: cellSize
          });
        }
      }
    }

    console.log(`🏛️ Generated maze: ${rows}x${cols} grid, ${walls.length} walls`);
    return walls;
  }

  private generateLabyrinthCoins(walls: MazeWall[], width: number, height: number): LabyrinthCoin[] {
    const coins: LabyrinthCoin[] = [];
    const clearEdge = 50;
    const coinSize = 16; // 4x4 grid with 4px pixel size
    const numCoins = 20; // Spawn 20 coins in the maze
    const minDistance = 40; // Minimum distance between coins

    let attempts = 0;
    const maxAttempts = 500;

    while (coins.length < numCoins && attempts < maxAttempts) {
      attempts++;

      // Random position within maze area
      const x = clearEdge + Math.random() * (width - clearEdge * 2 - coinSize);
      const y = clearEdge + Math.random() * (height - clearEdge * 2 - coinSize);

      // Check if coin overlaps with any walls
      const overlapsWall = walls.some(wall =>
        x < wall.x + wall.width &&
        x + coinSize > wall.x &&
        y < wall.y + wall.height &&
        y + coinSize > wall.y
      );

      if (overlapsWall) continue;

      // Check if coin is too close to other coins
      const tooClose = coins.some(coin => {
        const dx = coin.x - x;
        const dy = coin.y - y;
        return Math.sqrt(dx * dx + dy * dy) < minDistance;
      });

      if (tooClose) continue;

      // Add coin
      coins.push({
        id: `labyrinth_coin_${coins.length}`,
        x,
        y,
        collected: false
      });
    }

    console.log(`🪙 Generated ${coins.length} labyrinth coins`);
    return coins;
  }

  public getStats() {
    return {
      activeRooms: this.rooms.size,
      totalPlayers: this.players.size,
      roomDetails: Array.from(this.rooms.entries()).map(([roomId, room]) => ({
        roomId,
        players: room.players.size,
        gamemaster: room.gamemaster,
        isActive: room.isActive
      }))
    };
  }
}

// Start the server
const port = process.env.PORT ? parseInt(process.env.PORT) : 3002;
const pongServer = new PongWebSocketServer(port);
pongServer.start();

// Log stats periodically
setInterval(() => {
  const stats = pongServer.getStats();
  if (stats.totalPlayers > 0 || stats.activeRooms > 0) {
    console.log('📊 Server Stats:', JSON.stringify(stats, null, 2));
  }
}, 30000);

export default pongServer;