import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import SamJs from 'sam-js';
import { getDynamicTauntSystem, GameContext, PlayerBehavior } from '../utils/browserTauntSystem';
import SpaceBlazersLogo from '../components/SpaceBlazersLogo';

interface Pickup {
  x: number;
  y: number;
  size: number;
  type: string;
  icon: string;
  color: string;
  description: string;
  spawnTime: number;
}

interface Coin {
  x: number;
  y: number;
  size: number;
  spawnTime: number;
}

interface TrailPoint {
  x: number;
  y: number;
  timestamp: number;
  width?: number; // For paddle trails
  height?: number; // For paddle trails
}

interface ActiveEffect {
  type: string;
  startTime: number;
  duration: number;
  side?: 'left' | 'right';
  originalValue?: number;
}

interface PhysicsForce {
  id: string;
  x: number;
  y: number;
  type: 'attractor' | 'repulsor';
  strength: number;
  radius: number;
  spawnTime: number;
  lifespan: number;
  animationPhase: number;
  pulseSpeed: number;
  color: string;
  hasPlayedSound: boolean;
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
  rumbleEffect: {
    isActive: boolean;
    startTime: number;
    intensity: number;
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
  trails: {
    ball: TrailPoint[];
    leftPaddle: TrailPoint[];
    rightPaddle: TrailPoint[];
    topPaddle: TrailPoint[];
    bottomPaddle: TrailPoint[];
  };
  decrunchEffect: {
    isActive: boolean;
    startTime: number;
    duration: number;
  };
  physicsForces: PhysicsForce[];
  nextForceSpawnTime: number;
}

interface MultiplayerState {
  playerId: string;
  playerSide: 'left' | 'right' | 'top' | 'bottom' | 'spectator';
  isConnected: boolean;
  roomId: string;
  isGameMaster: boolean;
  playerCount: number;
}

interface WebSocketMessage {
  type: string;
  playerId?: string;
  roomId?: string;
  data?: any;
}

// Canvas size will be calculated dynamically based on viewport
const PADDLE_SPEED = 12; // Faster base speed for keyboard control
const PADDLE_LENGTH = 200; // Length of paddles in their movement direction
const PADDLE_THICKNESS = 20; // Thickness of paddles perpendicular to movement - increased for better visibility
const BALL_SPEED = 4; // Moderate speed for playable gameplay
const MIN_BALL_SPEED = 3;  // Slower minimum speed
const MAX_BALL_SPEED = 6; // Slower maximum speed
// 🎯 Game runs at display refresh rate with frame-rate independent ball physics for constant speed
const PADDLE_ACCELERATION = 0.2; // Reduced acceleration for smoother control
const PADDLE_FRICTION = 0.88; // Slightly more friction for better control
const HUMAN_REACTION_DELAY = 8; // Reduced delay for more responsive AI at 60fps
const PANIC_MOVE_CHANCE = 0.08; // Lower chance for panic moves at 60fps
const COLLISION_BUFFER = 0; // Precise collision detection - hitbox matches paddle size exactly
const PANIC_VELOCITY_MULTIPLIER = 8; // Reduced panic speed multiplier
const EXTREME_PANIC_CHANCE = 0.04; // Lower extreme panic chance
const EXTREME_PANIC_MULTIPLIER = 20; // Reduced extreme panic speed

// Continuous collision detection helper functions for catching fast-moving balls
const lineIntersectsRect = (x1: number, y1: number, x2: number, y2: number,
                           rectX: number, rectY: number, rectW: number, rectH: number): boolean => {
  // Check if line segment from (x1,y1) to (x2,y2) intersects with rectangle
  // Add buffer to rectangle for more reliable detection
  const buffer = COLLISION_BUFFER;
  const left = rectX - buffer;
  const right = rectX + rectW + buffer;
  const top = rectY - buffer;
  const bottom = rectY + rectH + buffer;

  // Check intersection with all four edges of the rectangle
  return (
    lineIntersectsLine(x1, y1, x2, y2, left, top, right, top) ||      // Top edge
    lineIntersectsLine(x1, y1, x2, y2, right, top, right, bottom) ||  // Right edge
    lineIntersectsLine(x1, y1, x2, y2, right, bottom, left, bottom) || // Bottom edge
    lineIntersectsLine(x1, y1, x2, y2, left, bottom, left, top) ||    // Left edge
    (x1 >= left && x1 <= right && y1 >= top && y1 <= bottom) ||       // Start point inside
    (x2 >= left && x2 <= right && y2 >= top && y2 <= bottom)          // End point inside
  );
};

const lineIntersectsLine = (x1: number, y1: number, x2: number, y2: number,
                           x3: number, y3: number, x4: number, y4: number): boolean => {
  // Check if line segment (x1,y1)-(x2,y2) intersects with line segment (x3,y3)-(x4,y4)
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.0001) return false; // Lines are parallel

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
};

// Musical scales for dystopic outer space atmosphere
const MUSICAL_SCALES = {
  // Locrian mode - most dissonant, perfect for lost in space feeling
  locrian: [220.00, 233.08, 246.94, 277.18, 293.66, 311.13, 369.99], // A3 Locrian

  // Phrygian mode - dark and mysterious
  phrygian: [220.00, 233.08, 261.63, 293.66, 329.63, 349.23, 392.00], // A3 Phrygian

  // Hungarian minor - exotic and unsettling
  hungarian: [220.00, 246.94, 277.18, 311.13, 329.63, 369.99, 415.30], // A3 Hungarian minor

  // Whole tone scale - dreamy but alien
  wholetone: [220.00, 246.94, 277.18, 311.13, 349.23, 392.00, 440.00], // A3 Whole tone

  // Diminished scale - tense and unstable
  diminished: [220.00, 233.08, 261.63, 277.18, 311.13, 329.63, 369.99, 392.00], // A3 Diminished
};

// Sound pattern sequences for different game events
let melodyState = {
  paddleHitIndex: 0,
  wallHitIndex: 0,
  scoreIndex: 0,
  pickupIndex: 0,
  currentScale: 'locrian',
  lastScaleChange: 0,
};

// Pickup system constants with musical approach
const PICKUP_TYPES = [
  { type: 'speed_up', pattern: 'zigzag', color: '#ffff00', description: 'Speed Boost!', scale: 'wholetone', note: 5 },
  { type: 'speed_down', pattern: 'waves', color: '#8B4513', description: 'Slow Motion!', scale: 'locrian', note: 1 },
  { type: 'big_ball', pattern: 'circle', color: '#0066ff', description: 'Big Ball!', scale: 'phrygian', note: 3 },
  { type: 'small_ball', pattern: 'dot', color: '#ff3300', description: 'Tiny Ball!', scale: 'hungarian', note: 6 },
  { type: 'drunk_ball', pattern: 'spiral', color: '#ff6600', description: 'Drunk Ball!', scale: 'diminished', note: 2 },
  { type: 'grow_paddle', pattern: 'arrow_up', color: '#00ff00', description: 'Grow Paddle!', scale: 'phrygian', note: 4 },
  { type: 'shrink_paddle', pattern: 'arrow_down', color: '#ff0066', description: 'Shrink Paddle!', scale: 'hungarian', note: 1 },
  { type: 'reverse_controls', pattern: 'arrows', color: '#9900ff', description: 'Reverse Controls!', scale: 'diminished', note: 5 },
  { type: 'invisible_ball', pattern: 'ghost', color: '#cccccc', description: 'Invisible Ball!', scale: 'locrian', note: 6 },
  { type: 'multi_ball', pattern: 'plus', color: '#ff9900', description: 'Multi-Ball!', scale: 'wholetone', note: 3 },
  { type: 'freeze_opponent', pattern: 'cross', color: '#00ffff', description: 'Freeze Enemy!', scale: 'locrian', note: 0 },
  { type: 'super_speed', pattern: 'stripes', color: '#ffffff', description: 'LUDICROUS SPEED!', scale: 'diminished', note: 7 },
  { type: 'coin_shower', pattern: 'diamond', color: '#ffdd00', description: 'Coin Shower!', scale: 'wholetone', note: 4 },
  { type: 'teleport_ball', pattern: 'star', color: '#9966ff', description: 'Teleport Ball!', scale: 'diminished', note: 1 },
];

// WebSocket server URL - using working Render service
const WS_SERVER_URL = import.meta.env.DEV
  ? 'ws://localhost:3002'
  : 'wss://bms-highscore-challenge.onrender.com';

const COLOR_PALETTE = [
  { background: '#1a0b3d', foreground: '#ff006e' }, // Deep Purple & Hot Pink
  { background: '#0d1b2a', foreground: '#ffd60a' }, // Dark Navy & Gold
  { background: '#2d1b69', foreground: '#00f5ff' }, // Royal Purple & Cyan
  { background: '#1e3a8a', foreground: '#f59e0b' }, // Royal Blue & Orange
  { background: '#065f46', foreground: '#ec4899' }, // Forest Green & Pink
  { background: '#7c2d12', foreground: '#06d6a0' }, // Burnt Orange & Mint
  { background: '#581c87', foreground: '#fbbf24' }, // Deep Purple & Yellow
  { background: '#1f2937', foreground: '#f97316' }, // Charcoal & Orange
  { background: '#4c1d95', foreground: '#10b981' }, // Indigo & Emerald
  { background: '#b91c1c', foreground: '#38bdf8' }, // Deep Red & Sky Blue
  { background: '#166534', foreground: '#f472b6' }, // Dark Green & Pink
  { background: '#1e40af', foreground: '#facc15' }, // Blue & Yellow
  { background: '#7c3aed', foreground: '#fb923c' }, // Violet & Orange
  { background: '#dc2626', foreground: '#22d3ee' }, // Red & Cyan
  { background: '#0f172a', foreground: '#a78bfa' }, // Slate & Purple
  { background: '#4338ca', foreground: '#fde047' }, // Indigo & Lime
];

// Function to get a contrasting human player color from the palette
const getHumanPlayerColor = (currentColorIndex: number): string => {
  // Find a color that contrasts well with the current background
  // We'll use a different palette entry that has good contrast
  const alternativeIndexes = [
    (currentColorIndex + 8) % COLOR_PALETTE.length,  // Half offset for maximum contrast
    (currentColorIndex + 4) % COLOR_PALETTE.length,  // Quarter offset as backup
    (currentColorIndex + 12) % COLOR_PALETTE.length, // Three-quarter offset as backup
  ];

  // Return the foreground color from the first alternative index
  return COLOR_PALETTE[alternativeIndexes[0]].foreground;
};

// 🚀 PRECALCULATED PERFORMANCE OPTIMIZATIONS
// Precalculate all expensive operations to eliminate runtime calculations

// 🎵 PRECALCULATED AUDIO CONFIGURATIONS
const PRECALC_AUDIO = {
  // Beep frequency table for instant lookup
  frequencies: {
    paddle: 220,    // A3
    wall: 440,      // A4
    score: 880,     // A5
    pickup: 660,    // E5
    start: 523      // C5
  },

  // Gain values precalculated
  volumes: {
    beep: 0.15,
    speech: 0.28, // Reduced by 30% from 0.4 to fix distortions
    ambient: 0.3
  },

  // Filter configurations precalculated
  filterConfigs: {
    humming: { type: 'lowpass' as BiquadFilterType, freq: 400, q: 0.8 },
    ominous: { type: 'lowpass' as BiquadFilterType, freq: 200, q: 3.0 },
    suspense: { type: 'bandpass' as BiquadFilterType, freq: 300, q: 4.0 },
    epic: { type: 'notch' as BiquadFilterType, freq: 500, q: 2.5 },
    intense: { type: 'highpass' as BiquadFilterType, freq: 150, q: 5.0 },
    ethereal: { type: 'peaking' as BiquadFilterType, freq: 800, q: 6.0 },
    sparkle: { type: 'allpass' as BiquadFilterType, freq: 1000, q: 8.0 }
  }
};

// 🎮 PRECALCULATED GAME CONSTANTS
const PRECALC_CONSTANTS = {
  // Trigonometric values for pickup patterns
  sin45: Math.sin(Math.PI / 4),    // 0.7071...
  cos45: Math.cos(Math.PI / 4),    // 0.7071...
  sin60: Math.sin(Math.PI / 3),    // 0.8660...
  cos60: Math.cos(Math.PI / 3),    // 0.5
  pi2: Math.PI * 2,                // 6.2831...
  halfPi: Math.PI / 2,             // 1.5707...

  // Common multipliers
  sqrt2: Math.sqrt(2),             // 1.4142...
  sqrt3: Math.sqrt(3),             // 1.7320...

  // Animation easing curves (precalculated for 60fps)
  pulseValues: Array.from({ length: 60 }, (_, i) =>
    0.8 + 0.2 * Math.sin((i / 60) * Math.PI * 2)
  ),

  // CRT flicker values (precalculated for 60fps)
  flickerValues: Array.from({ length: 60 }, (_, i) =>
    0.98 + 0.015 * Math.sin((i / 60) * 47 * Math.PI * 2)
  )
};

// 🎯 PRECALCULATED PICKUP PATTERNS (eliminates nested loops during gameplay)
const PRECALC_PICKUP_PATTERNS = {
  lightning: Array.from({ length: 12 }, (_, row) =>
    Array.from({ length: 12 }, (_, col) =>
      (row < 4 && col >= 6 && col <= 8) ||
      (row >= 4 && row < 8 && col >= 3 && col <= 5) ||
      (row >= 8 && col >= 6 && col <= 8)
    )
  ),

  waves: Array.from({ length: 12 }, (_, row) =>
    Array.from({ length: 12 }, (_, col) =>
      (row === 3 || row === 6 || row === 9) && Math.sin(col * 0.8) > 0
    )
  ),

  circle: Array.from({ length: 12 }, (_, row) =>
    Array.from({ length: 12 }, (_, col) => {
      const centerX = 6, centerY = 6, radius = 3;
      const dist = Math.sqrt((col - centerX) ** 2 + (row - centerY) ** 2);
      return dist <= radius && dist >= radius - 1.5;
    })
  ),

  dot: Array.from({ length: 12 }, (_, row) =>
    Array.from({ length: 12 }, (_, col) => {
      const dotSize = 3;
      const startX = Math.floor((12 - dotSize) / 2);
      const startY = Math.floor((12 - dotSize) / 2);
      return row >= startY && row < startY + dotSize &&
             col >= startX && col < startX + dotSize;
    })
  ),

  spiral: Array.from({ length: 12 }, (_, row) =>
    Array.from({ length: 12 }, (_, col) => {
      const angle = Math.atan2(row - 6, col - 6);
      const dist = Math.sqrt((col - 6) ** 2 + (row - 6) ** 2);
      return Math.sin(angle * 3 + dist * 0.5) > 0.5;
    })
  ),

  arrow_up: Array.from({ length: 12 }, (_, row) =>
    Array.from({ length: 12 }, (_, col) =>
      (row >= 2 && row <= 6 && col >= 5 && col <= 7) || // Stem
      (row >= 0 && row <= 4 && Math.abs(col - 6) <= row) // Arrow head
    )
  ),

  arrow_down: Array.from({ length: 12 }, (_, row) =>
    Array.from({ length: 12 }, (_, col) =>
      (row >= 2 && row <= 8 && col >= 5 && col <= 7) || // Stem
      (row >= 6 && row <= 10 && Math.abs(col - 6) <= (10 - row)) // Arrow head
    )
  ),

  double_arrow: Array.from({ length: 12 }, (_, row) =>
    Array.from({ length: 12 }, (_, col) =>
      (row >= 4 && row <= 6 && col >= 1 && col <= 4) || // Left arrow
      (row >= 3 && row <= 7 && col === 1) ||
      (row >= 4 && row <= 6 && col >= 8 && col <= 11) || // Right arrow
      (row >= 3 && row <= 7 && col === 11)
    )
  ),

  plus: Array.from({ length: 12 }, (_, row) =>
    Array.from({ length: 12 }, (_, col) =>
      (row >= 4 && row <= 7 && col >= 1 && col <= 10) || // Horizontal
      (col >= 4 && col <= 7 && row >= 1 && row <= 10) // Vertical
    )
  ),

  cross: Array.from({ length: 12 }, (_, row) =>
    Array.from({ length: 12 }, (_, col) =>
      Math.abs(row - col) <= 1 || Math.abs(row - (12 - col - 1)) <= 1
    )
  ),

  stripes: Array.from({ length: 12 }, (_, row) =>
    Array.from({ length: 12 }, (_, col) =>
      (row + col) % 3 === 0
    )
  ),

  diamond: Array.from({ length: 12 }, (_, row) =>
    Array.from({ length: 12 }, (_, col) => {
      const centerX = 6, centerY = 6;
      const distanceFromCenter = Math.abs(row - centerY) + Math.abs(col - centerX);
      return distanceFromCenter >= 3 && distanceFromCenter <= 4;
    })
  ),

  star: Array.from({ length: 12 }, (_, row) =>
    Array.from({ length: 12 }, (_, col) => {
      const centerX = 6, centerY = 6;
      const dx = col - centerX, dy = row - centerY;
      return (Math.abs(dx) <= 1 && Math.abs(dy) <= 4) || // Vertical line
             (Math.abs(dy) <= 1 && Math.abs(dx) <= 4) || // Horizontal line
             (Math.abs(dx - dy) <= 1 && Math.abs(dx) <= 3) || // Diagonal 1
             (Math.abs(dx + dy) <= 1 && Math.abs(dx) <= 3); // Diagonal 2
    })
  )
};

const Pong404: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);

  // 📊 FPS Counter
  const fpsRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(Date.now());

  // 🎯 60 FPS Frame Rate Control
  const lastFrameTimeRef = useRef<number>(0);
  const targetFPS = 60;
  const targetFrameTime = 1000 / targetFPS; // 16.67ms per frame

  // ⚡ Performance: Cached time values to reduce Date.now() calls
  const cachedTimeRef = useRef<number>(Date.now());
  const timeUpdateCountRef = useRef<number>(0);

  // 🕒 Delta time for frame-rate independent physics
  const deltaTimeRef = useRef<number>(targetFrameTime);

  // 🚀 Fast time getter - use cached value instead of Date.now()
  const getTime = useCallback(() => cachedTimeRef.current, []);

  // 🎨 CACHED GRADIENTS - Create once, reuse forever (major performance boost)
  const gradientCacheRef = useRef<{
    curvature?: CanvasGradient;
    scanline?: CanvasGradient;
    vignette?: CanvasGradient;
    lastCanvasSize?: { width: number; height: number };
  }>({});
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastHeartbeatRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  // Function refs to avoid game loop recomputation
  const playMelodyNoteRef = useRef<any>(null);
  const updateGameStateRef = useRef<any>(null);
  const updatePaddlePositionRef = useRef<any>(null);
  const createPickupRef = useRef<any>(null);
  const applyPickupEffectRef = useRef<any>(null);
  const updateEffectsRef = useRef<any>(null);
  const initializeAudioRef = useRef<any>(null);
  const speakRoboticRef = useRef<any>(null);
  const predictGameStateRef = useRef<any>(null);
  const interpolateGameStateRef = useRef<any>(null);
  const attemptRobotTauntRef = useRef<any>(null);
  const checkRandomTauntRef = useRef<any>(null);
  const multiplayerStateRef = useRef<any>(null);

  // Check URL parameters for spectator mode
  const urlParams = new URLSearchParams(window.location.search);
  const isSpectatorMode = urlParams.get('spectator') === 'true' || urlParams.get('mode') === 'spectator';

  // Fixed square canvas size for perfect square gameplay
  const [canvasSize, setCanvasSize] = useState(() => {
    const FIXED_SQUARE_SIZE = 800; // Fixed 800x800 square
    return { width: FIXED_SQUARE_SIZE, height: FIXED_SQUARE_SIZE };
  });
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'warming' | 'connected' | 'error' | 'retrying'>('idle');
  const [retryCount, setRetryCount] = useState(0);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [isCRTEnabled, setIsCRTEnabled] = useState(false);

  const [gameState, _setGameState] = useState<GameState>({
    ball: {
      x: canvasSize.width / 2,
      y: canvasSize.height / 2,
      dx: 0,
      dy: 0,
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
    },
    paddles: {
      left: { y: Math.max(0, Math.min(canvasSize.height - PADDLE_LENGTH, canvasSize.height / 2 - PADDLE_LENGTH/2)), height: PADDLE_LENGTH, width: PADDLE_THICKNESS, speed: PADDLE_SPEED, velocity: 0, targetY: Math.max(0, Math.min(canvasSize.height - PADDLE_LENGTH, canvasSize.height / 2 - PADDLE_LENGTH/2)), originalHeight: PADDLE_LENGTH },
      right: { y: Math.max(0, Math.min(canvasSize.height - PADDLE_LENGTH, canvasSize.height / 2 - PADDLE_LENGTH/2)), height: PADDLE_LENGTH, width: PADDLE_THICKNESS, speed: PADDLE_SPEED, velocity: 0, targetY: Math.max(0, Math.min(canvasSize.height - PADDLE_LENGTH, canvasSize.height / 2 - PADDLE_LENGTH/2)), originalHeight: PADDLE_LENGTH },
      top: { x: Math.max(0, Math.min(canvasSize.width - PADDLE_LENGTH, canvasSize.width / 2 - PADDLE_LENGTH/2)), height: PADDLE_THICKNESS, width: PADDLE_LENGTH, speed: PADDLE_SPEED, velocity: 0, targetX: Math.max(0, Math.min(canvasSize.width - PADDLE_LENGTH, canvasSize.width / 2 - PADDLE_LENGTH/2)), originalWidth: PADDLE_LENGTH },
      bottom: { x: Math.max(0, Math.min(canvasSize.width - PADDLE_LENGTH, canvasSize.width / 2 - PADDLE_LENGTH/2)), height: PADDLE_THICKNESS, width: PADDLE_LENGTH, speed: PADDLE_SPEED, velocity: 0, targetX: Math.max(0, Math.min(canvasSize.width - PADDLE_LENGTH, canvasSize.width / 2 - PADDLE_LENGTH/2)), originalWidth: PADDLE_LENGTH },
    },
    score: { left: 0, right: 0, top: 0, bottom: 0 }, // 4-player scoring
    isPlaying: false,
    showStartScreen: false,
    gameMode: 'auto',
    colorIndex: 0,
    isPaused: false,
    pauseEndTime: 0,
    winner: null,
    gameEnded: false,
    rumbleEffect: {
      isActive: false,
      startTime: 0,
      intensity: 0,
    },
    pickups: [],
    coins: [],
    nextPickupTime: Date.now() + Math.random() * 10000 + 5000, // 5-15 seconds
    activeEffects: [],
    pickupEffect: {
      isActive: false,
      startTime: 0,
      x: 0,
      y: 0,
    },
    trails: {
      ball: [],
      leftPaddle: [],
      rightPaddle: [],
      topPaddle: [],
      bottomPaddle: [],
    },
    decrunchEffect: {
      isActive: false,
      startTime: 0,
      duration: 0,
    },
    physicsForces: [],
    nextForceSpawnTime: Date.now() + Math.random() * 60000 + 60000, // 60-120 seconds for first force
  });

  // Wrapper around setGameState to ensure top/bottom paddles are always preserved
  const setGameState = useCallback((newStateOrUpdater: GameState | ((prev: GameState) => GameState)) => {
    if (typeof newStateOrUpdater === 'function') {
      _setGameState(prevState => {
        const newState = newStateOrUpdater(prevState);

        // Always ensure top and bottom paddles exist
        if (!newState.paddles.top && prevState.paddles.top) {
          // Restoring missing TOP paddle
          newState.paddles.top = prevState.paddles.top;
        }
        if (!newState.paddles.bottom && prevState.paddles.bottom) {
          // Restoring missing BOTTOM paddle
          newState.paddles.bottom = prevState.paddles.bottom;
        }

        return newState;
      });
    } else {
      // Direct state replacement - ensure paddles are preserved
      _setGameState(prevState => {
        const finalState = { ...newStateOrUpdater };

        // Always preserve top and bottom paddles from previous state
        if (!finalState.paddles.top && prevState?.paddles.top) {
          // Restoring missing TOP paddle from direct replacement
          finalState.paddles.top = prevState.paddles.top;
        }
        if (!finalState.paddles.bottom && prevState?.paddles.bottom) {
          // Restoring missing BOTTOM paddle from direct replacement
          finalState.paddles.bottom = prevState.paddles.bottom;
        }

        return finalState;
      });
    }
  }, []);

  // Multiplayer state
  const [multiplayerState, setMultiplayerState] = useState<MultiplayerState>({
    playerId: Math.random().toString(36).substr(2, 9),
    playerSide: 'spectator',
    isConnected: false,
    roomId: 'main',
    isGameMaster: false,
    playerCount: 0
  });

  // Ref to track the latest multiplayer state for immediate access during rendering
  const latestMultiplayerStateRef = useRef(multiplayerState);

  // Helper function to update both state and ref for immediate access
  const updateMultiplayerState = useCallback((newState: MultiplayerState) => {
    latestMultiplayerStateRef.current = newState;
    setMultiplayerState(newState);
  }, []);

  const [localTestMode, setLocalTestMode] = useState(false);
  const [crtEffect, setCrtEffect] = useState(true); // CRT shader enabled by default
  const [showAudioPrompt, setShowAudioPrompt] = useState(true); // Show audio interaction prompt on first load
  const audioPromptDismissedRef = useRef(false); // Track if audio prompt was dismissed


  // Local multiplayer using localStorage for cross-tab sync
  const connectLocalMultiplayer = useCallback(() => {
    setConnectionStatus('connected');

    // Set up localStorage for cross-tab communication
    const playerId = multiplayerState.playerId || 'player-' + Math.random().toString(36).substr(2, 9);
    const roomId = 'main'; // Always use 'main' room for consistency

    // Check existing players in localStorage
    const existingPlayers = JSON.parse(localStorage.getItem('pong-players') || '[]');
    const leftPlayer = existingPlayers.find((p: any) => p.side === 'left');
    const rightPlayer = existingPlayers.find((p: any) => p.side === 'right');

    let playerSide: 'left' | 'right' | 'spectator' = 'spectator';
    let isGameMaster = false;

    // FIXED: Assign right paddle first (matches arrow key controls)
    if (!rightPlayer) {
      playerSide = 'right';
      isGameMaster = true;
    } else if (!leftPlayer) {
      playerSide = 'left';
    }

    const playerData = { id: playerId, side: playerSide, timestamp: Date.now() };
    const updatedPlayers = existingPlayers.filter((p: any) => p.id !== playerId);
    updatedPlayers.push(playerData);
    localStorage.setItem('pong-players', JSON.stringify(updatedPlayers));

    setMultiplayerState(prev => ({
      ...prev,
      playerId,
      roomId,
      playerSide,
      isGameMaster,
      isConnected: true,
      playerCount: updatedPlayers.length
    }));


    // Set game to multiplayer mode
    setGameState(prev => ({ ...prev, gameMode: 'multiplayer' }));

    return; // Skip WebSocket connection
  }, [multiplayerState.playerId, multiplayerState.roomId]);

  // WebSocket connection management
  const connectWebSocket = useCallback(() => {

    if (!WS_SERVER_URL) {
      setConnectionStatus('error');
      return;
    }

    // Prevent duplicate connections
    if (wsRef.current?.readyState === WebSocket.CONNECTING || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Clean up any existing connection first
    if (wsRef.current) {
      if (wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    setConnectionStatus('connecting');
    setConnectionMessage('Initializing connection to multiplayer server...');

    // Progressive timeout stages for better user feedback
    const warmingTimeout = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.CONNECTING) {
        setConnectionStatus('warming');
        setConnectionMessage('🔥 Server is warming up... This may take 30-60 seconds');
        setTimeout(() => speakRobotic('SERVER IS WARMING UP PLEASE WAIT'), 500);
      }
    }, 8000); // Switch to warming state after 8 seconds

    const connectionTimeout = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.CONNECTING) {
        setConnectionMessage('⏰ Still warming up... Almost ready!');
        setTimeout(() => speakRobotic('STILL WARMING UP ALMOST READY'), 500);
      }
    }, 25000); // Additional encouragement at 25 seconds

    const encouragementTimeout = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.CONNECTING) {
        setConnectionMessage('🚀 Servers booting up... Worth the wait!');
      }
    }, 35000); // Final encouragement at 35 seconds

    const finalTimeout = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.CONNECTING) {
        setConnectionMessage('Connection timeout - retrying...');
        wsRef.current.close();
        setConnectionStatus('retrying');
        setRetryCount(prev => prev + 1);
        // Auto-retry after short delay
        setTimeout(() => {
          connectWebSocket();
        }, 3000);
      }
    }, 45000); // Final timeout at 45 seconds

    const connectToWebSocket = () => {
      try {
        console.log('🎮 Attempting to connect to WebSocket:', WS_SERVER_URL);
        setConnectionMessage('Establishing WebSocket connection...');
        const ws = new WebSocket(WS_SERVER_URL);
        (ws as any)._createTime = Date.now();
        wsRef.current = ws;
        console.log('🎮 WebSocket instance created, readyState:', ws.readyState);


        ws.onopen = () => {
          console.log('🎮 WebSocket connection opened successfully');
          const openTime = Date.now();
          (ws as any)._openTime = openTime;
          const connectionTime = openTime - (ws as any)._createTime;
          setConnectionStatus('connected');
          setConnectionMessage('Connected! Joining game room...');
          setMultiplayerState(prev => ({ ...prev, isConnected: true }));

          // DON'T start the game yet - wait for joined_room confirmation from server
          // The game will start when we receive the joined_room message

          console.log('🎮 Connection status set to connected');
          console.log('🎮 Game state updated to multiplayer mode');

          // Clear all connection timeouts since we connected successfully
          if (warmingTimeout) clearTimeout(warmingTimeout);
          if (connectionTimeout) clearTimeout(connectionTimeout);
          if (encouragementTimeout) clearTimeout(encouragementTimeout);
          if (finalTimeout) clearTimeout(finalTimeout);

          setTimeout(() => speakRobotic('CONNECTION ESTABLISHED ENTERING MULTIPLAYER'), 300);

          // Start heartbeat monitoring
          lastHeartbeatRef.current = Date.now();
          if (heartbeatTimeoutRef.current) {
            clearTimeout(heartbeatTimeoutRef.current);
          }

          // Monitor for missed heartbeats (server sends every 30s, we check every 45s)
          const checkHeartbeat = () => {
            const now = Date.now();
            const timeSinceLastHeartbeat = now - lastHeartbeatRef.current;

            if (timeSinceLastHeartbeat > 45000) { // 45 seconds without heartbeat
              if (wsRef.current) {
                wsRef.current.close(1000, 'Heartbeat timeout');
              }
            } else {
              // Schedule next check
              heartbeatTimeoutRef.current = setTimeout(checkHeartbeat, 15000);
            }
          };

          heartbeatTimeoutRef.current = setTimeout(checkHeartbeat, 45000);

          // Send join message immediately - no delay needed
          if (ws.readyState === WebSocket.OPEN) {
            const joinMessage = {
              type: 'join_room',
              playerId: multiplayerState.playerId,
              roomId: multiplayerState.roomId,
              data: { forceSpectator: isSpectatorMode }
            };
            try {
              console.log('🎮 Sending join message:', joinMessage);
              ws.send(JSON.stringify(joinMessage));
              setConnectionMessage('Sent join request - waiting for server response...');
            } catch (error) {
              console.error('🚨 Failed to send join message:', error);
              setConnectionMessage('Failed to send join request');
            }
          } else {
          }
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log('🎮 Received WebSocket message:', message.type || message.t, message);
            handleWebSocketMessage(message);
          } catch (error) {
            console.error('🚨 Failed to parse WebSocket message:', error, event.data);
          }
        };

        ws.onclose = (event) => {
          const closeTime = Date.now();
          const openDuration = (ws as any)._openTime ? closeTime - (ws as any)._openTime : 0;
          const totalDuration = closeTime - (ws as any)._createTime;


          if (event.code === 1006) {
            setConnectionMessage('Server connection lost - attempting to reconnect...');
          } else if (event.code === 1000) {
            setConnectionMessage('Server closed connection normally');
          } else {
            setConnectionMessage(`Connection closed (code: ${event.code})`);
          }

          setConnectionStatus('error');
          setMultiplayerState(prev => ({ ...prev, isConnected: false }));

          // Attempt to reconnect with exponential backoff
          if (!event.wasClean) {
            setConnectionStatus('retrying');
            setRetryCount(prev => prev + 1);
            const retryDelay = Math.min(5000 + Math.random() * 5000, 15000); // 5-10 seconds, max 15s
            setConnectionMessage(`Reconnecting in ${Math.ceil(retryDelay/1000)} seconds... (attempt ${retryCount + 1})`);
            reconnectTimeoutRef.current = setTimeout(() => {
              connectWebSocket();
            }, retryDelay);
          }
        };

        ws.onerror = (error) => {
          console.error('🚨 WebSocket error:', error);
          // Clear all connection timeouts since we got an error
          if (warmingTimeout) clearTimeout(warmingTimeout);
          if (connectionTimeout) clearTimeout(connectionTimeout);
          if (encouragementTimeout) clearTimeout(encouragementTimeout);
          if (finalTimeout) clearTimeout(finalTimeout);

          setConnectionStatus('error');
          setConnectionMessage('Failed to connect to server - server may be sleeping or unreachable');
        };

      } catch (error) {
        setConnectionStatus('error');
        setConnectionMessage('Failed to initialize connection - please check your network');
        console.error('🚨 Connection initialization error:', error);
      }
    };

    // Skip server wake-up for localhost, use delay for production server
    if (WS_SERVER_URL.includes('localhost')) {
      connectToWebSocket();
    } else {

      // Wait 3 seconds then try WebSocket directly - the connection attempt will wake the server
      setTimeout(() => {
        connectToWebSocket();
      }, 3000);
    }
  }, [multiplayerState.playerId, multiplayerState.roomId, retryCount]);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((message: any) => {
    // Support both old and new compact message formats
    const messageType = message.type || message.t;
    const messageData = message.data || message.d;

    // Map compact types to full types for processing
    const fullType = {
      'ugsd': 'update_game_state_delta',
      'paddle_updated': 'paddle_updated',
      'gsu': 'game_state_updated',
      'gr': 'game_reset'
    }[messageType] || messageType;

    switch (fullType) {
      case 'joined_room':
        setConnectionStatus('connected');
        const playerRole = message.data.playerSide === 'spectator' ? 'spectator' : `${message.data.playerSide} player`;
        const playerCount = message.data.playerCount || 0;
        setConnectionMessage(`Connected as ${playerRole}! ${playerCount} players in room.`);
        const newMultiplayerState = {
          playerId: multiplayerState.playerId,
          roomId: multiplayerState.roomId,
          playerSide: message.data.playerSide,
          isGameMaster: message.data.isGameMaster,
          playerCount: message.data.playerCount,
          isConnected: true
        };
        updateMultiplayerState(newMultiplayerState);

        if (message.data.gameState) {
          // Server sent gameState with paddles
          setGameState(prevState => ({
            ...message.data.gameState,
            // Use server's paddles if they exist, otherwise preserve client paddles
            paddles: {
              ...message.data.gameState.paddles,
              top: message.data.gameState.paddles.top || prevState.paddles.top,
              bottom: message.data.gameState.paddles.bottom || prevState.paddles.bottom
            },
            trails: {
              ...message.data.gameState.trails,
              topPaddle: prevState.trails.topPaddle,
              bottomPaddle: prevState.trails.bottomPaddle
            }
          }));
        }

        // NOW start the game since we've successfully joined the room
        console.log('🎮 Successfully joined room, starting multiplayer game');
        setGameState(prev => ({
          ...prev,
          showStartScreen: false,
          gameMode: 'multiplayer',
          isPlaying: true,
          ball: {
            ...prev.ball,
            dx: Math.random() > 0.5 ? MIN_BALL_SPEED : -MIN_BALL_SPEED,
            dy: (Math.random() - 0.5) * MIN_BALL_SPEED * 0.8
          }
        }));
        setTimeout(() => speakRobotic(`MULTIPLAYER GAME STARTING AS ${playerRole.toUpperCase()}`), 100);
        break;

      case 'player_joined':
        setMultiplayerState(prev => ({
          ...prev,
          playerCount: message.data.playerCount
        }));

        // Robot announcement for new player
        const { playerSide } = message.data;
        if (playerSide === 'spectator') {
          setTimeout(() => speakRobotic('NEW SPECTATOR JOINS'), 100);
          // Don't reset scores for spectators
        } else {
          setTimeout(() => speakRobotic('NEW PLAYER ENTERS THE GAME'), 100);
          // Reset scores and restart game only for active players
          setGameState(prev => ({
            ...prev,
            score: { left: 0, right: 0, top: 0, bottom: 0 }, // Reset all scores
            ball: {
              ...prev.ball,
              x: canvasSize.width / 2,
              y: canvasSize.height / 2,
              dx: Math.random() > 0.5 ? MIN_BALL_SPEED : -MIN_BALL_SPEED,
              dy: (Math.random() - 0.5) * MIN_BALL_SPEED * 0.8,
              lastTouchedBy: null,
              previousTouchedBy: null
            },
            isPaused: true,
            pauseEndTime: Date.now() + 2000, // 2 second pause before ball starts
            gameEnded: false,
            isPlaying: true
          }));

          // Start ball movement after pause
          setTimeout(() => {
            setGameState(current => ({
              ...current,
                ball: {
                ...current.ball,
                dx: Math.random() > 0.5 ? BALL_SPEED : -BALL_SPEED,
                dy: Math.random() > 0.5 ? BALL_SPEED : -BALL_SPEED
              },
              isPaused: false
            }));
          }, 2000);
        }
        break;

      case 'player_left':
        setMultiplayerState(prev => ({
          ...prev,
          playerCount: message.data.playerCount
        }));

        // Robot announcement for player leaving
        const { playerSide: leavingPlayerSide, replacementType } = message.data;
        const sideNames = {
          'left': 'LEFT PLAYER',
          'right': 'RIGHT PLAYER',
          'top': 'TOP PLAYER',
          'bottom': 'BOTTOM PLAYER'
        };

        const sideName = sideNames[leavingPlayerSide as keyof typeof sideNames] || 'PLAYER';
        const replacementMessage = replacementType === 'spectator'
          ? `${sideName} LEAVES, REPLACING HIM WITH SPECTATOR`
          : `${sideName} LEAVES, REPLACING HIM WITH ROBOT PLAYER`;
        setTimeout(() => speakRobotic(replacementMessage), 100);
        break;

      case 'paddle_updated':
        setGameState(prev => {
          const newState = { ...prev };
          const now = Date.now();
          const data = message.data;

          // Calculate lag compensation if timestamp is provided
          let compensatedY = data.y;
          if (data.ts && data.velocity) {
            const networkDelay = now - data.ts;
            // Predict where paddle should be now based on velocity and network delay
            compensatedY = data.y + (data.velocity * networkDelay / 1000);
          }

          if (data.side === 'left') {
            newState.paddles.left.y = compensatedY;
            newState.paddles.left.velocity = data.velocity || 0;
            newState.paddles.left.targetY = data.targetY || compensatedY;
            // Clamp to bounds (using fixed canvas size)
            newState.paddles.left.y = Math.max(0, Math.min(newState.paddles.left.y, 800 - newState.paddles.left.height));
          } else if (data.side === 'right') {
            newState.paddles.right.y = compensatedY;
            newState.paddles.right.velocity = data.velocity || 0;
            newState.paddles.right.targetY = data.targetY || compensatedY;
            // Clamp to bounds (using fixed canvas size)
            newState.paddles.right.y = Math.max(0, Math.min(newState.paddles.right.y, 800 - newState.paddles.right.height));
          }
          return newState;
        });
        break;

      case 'game_state_updated':
        if (message.data) {
          setGameState(prevState => ({
            ...message.data,
            // Preserve client-only paddles and trails
            paddles: {
              ...message.data.paddles,
              top: prevState.paddles.top,
              bottom: prevState.paddles.bottom
            },
            trails: {
              ...message.data.trails,
              topPaddle: prevState.trails.topPaddle,
              bottomPaddle: prevState.trails.bottomPaddle
            }
          }));
        }
        break;

      case 'update_game_state_delta':
        if (messageData) {
          setGameState(prevState => {
            // Apply delta to create new authoritative network state
            const networkState = { ...prevState };

            if (messageData.ball) {
              console.log(`🎮 RECEIVING BALL UPDATE:`, {
                oldLastTouchedBy: prevState.ball.lastTouchedBy,
                newLastTouchedBy: messageData.ball.lastTouchedBy,
                ballPosition: messageData.ball.x + ',' + messageData.ball.y,
                isGameMaster: multiplayerState.isGameMaster,
                gameMode: multiplayerState.gameMode
              });
              networkState.ball = { ...prevState.ball, ...messageData.ball };
            }

            if (messageData.score) {
              console.log(`🎮 RECEIVING SCORE UPDATE:`, {
                oldScore: JSON.stringify(prevState.score),
                newScore: JSON.stringify(messageData.score),
                isGameMaster: multiplayerState.isGameMaster,
                gameMode: multiplayerState.gameMode
              });
              networkState.score = messageData.score;
            }

            if (messageData.isPlaying !== undefined) networkState.isPlaying = messageData.isPlaying;
            if (messageData.showStartScreen !== undefined) networkState.showStartScreen = messageData.showStartScreen;
            if (messageData.isPaused !== undefined) networkState.isPaused = messageData.isPaused;
            if (messageData.winner !== undefined) networkState.winner = messageData.winner;
            if (messageData.gameEnded !== undefined) networkState.gameEnded = messageData.gameEnded;

            if (messageData.pickups) networkState.pickups = messageData.pickups;
            if (messageData.coins) networkState.coins = messageData.coins;
            // Only sync nextPickupTime if we're not the game master (game master controls pickup timing)
            if (messageData.nextPickupTime !== undefined && !multiplayerState.isGameMaster) {
              networkState.nextPickupTime = messageData.nextPickupTime;
            }

            if (messageData.activeEffects) networkState.activeEffects = messageData.activeEffects;

            if (messageData.pickupEffect) networkState.pickupEffect = messageData.pickupEffect;
            if (messageData.decrunchEffect) networkState.decrunchEffect = messageData.decrunchEffect;
            if (messageData.rumbleEffect) networkState.rumbleEffect = messageData.rumbleEffect;

            // Store network state and timing for interpolation
            networkGameStateRef.current = networkState;
            lastNetworkReceiveTimeRef.current = Date.now();

            // For multiplayer, start with network state and let prediction/interpolation smooth it
            if (multiplayerState.gameMode === 'multiplayer' && !multiplayerState.isGameMaster) {
              return networkState;
            }

            return networkState;
          });
        }
        break;

      case 'game_reset':
        if (message.data) {
          setGameState(prevState => ({
            ...message.data,
            // Preserve client-only paddles and trails
            paddles: {
              ...message.data.paddles,
              top: prevState.paddles.top,
              bottom: prevState.paddles.bottom
            },
            trails: {
              ...message.data.trails,
              topPaddle: prevState.trails.topPaddle,
              bottomPaddle: prevState.trails.bottomPaddle
            }
          }));
        }
        break;

      case 'gamemaster_assigned':
        setMultiplayerState(prev => ({
          ...prev,
          isGameMaster: message.data.isGameMaster
        }));
        break;

      case 'heartbeat':
        // Respond to server heartbeat with ping
        lastHeartbeatRef.current = Date.now();
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'ping',
            playerId: multiplayerState.playerId,
            timestamp: Date.now()
          }));
        }
        break;

      case 'pong':
        // Server responded to our ping - connection is alive
        lastHeartbeatRef.current = Date.now();
        break;

      case 'server_game_update':
        // Receive authoritative game state from server
        if (data.data && multiplayerState.isConnected) {
          // Apply server's authoritative game state
          setBallPos({ x: data.data.ball.x, y: data.data.ball.y });
          setBallVel({ x: data.data.ball.dx, y: data.data.ball.dy });

          // Update scores from server
          setLeftScore(data.data.score.left);
          setRightScore(data.data.score.right);

          // Update pickups from server
          if (data.data.pickups) {
            setCoins(data.data.pickups.map((pickup: any) => ({
              x: pickup.x,
              y: pickup.y,
              type: pickup.type,
              value: pickup.value || 1,
              collected: false
            })));
          }

          // Update active effects from server
          if (data.data.activeEffects) {
            setActiveEffects(data.data.activeEffects);
          }
        }
        break;

      default:
        break;
    }
  }, [multiplayerState.playerId, multiplayerState.roomId]);

  // Paddle update throttling - 60Hz for smooth multiplayer
  const PADDLE_UPDATE_RATE = 1000 / 60; // 60Hz for paddle updates (16.67ms)
  const lastPaddleUpdateRef = useRef<number>(0);
  const pendingPaddleUpdateRef = useRef<NodeJS.Timeout | null>(null);
  const lastPaddlePositionRef = useRef<number>(0);

  // Send paddle update via WebSocket with throttling
  const updatePaddlePosition = useCallback((y: number, velocity = 0, targetY?: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && multiplayerState.isConnected) {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastPaddleUpdateRef.current;
      const positionChange = Math.abs(y - lastPaddlePositionRef.current);

      // Send immediately if ANY movement or enough time has passed (0.5px threshold for maximum responsiveness)
      if (positionChange > 0.5 || timeSinceLastUpdate >= PADDLE_UPDATE_RATE) {
        // Cancel pending update
        if (pendingPaddleUpdateRef.current) {
          clearTimeout(pendingPaddleUpdateRef.current);
          pendingPaddleUpdateRef.current = null;
        }

        wsRef.current.send(JSON.stringify({
          t: 'up', // update_paddle
          p: multiplayerState.playerId,
          d: {
            y,
            v: velocity, // shortened velocity
            tY: targetY || y, // shortened targetY
            ts: now // timestamp for lag compensation
          }
        }));

        lastPaddleUpdateRef.current = now;
        lastPaddlePositionRef.current = y;
      } else {
        // Throttle small movements
        if (!pendingPaddleUpdateRef.current) {
          const delay = PADDLE_UPDATE_RATE - timeSinceLastUpdate;
          pendingPaddleUpdateRef.current = setTimeout(() => {
            pendingPaddleUpdateRef.current = null;

            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                t: 'up', // update_paddle
                p: multiplayerState.playerId,
                d: {
                  y,
                  v: velocity, // shortened velocity
                  tY: targetY || y, // shortened targetY
                  ts: Date.now() // timestamp for lag compensation
                }
              }));

              lastPaddleUpdateRef.current = Date.now();
              lastPaddlePositionRef.current = y;
            }
          }, delay);
        }
      }
    }
  }, [multiplayerState.playerId, multiplayerState.isConnected, multiplayerState.playerSide]);

  // Track previous game state for delta compression
  const previousGameStateRef = useRef<GameState | null>(null);

  // Network update throttling - 30Hz for responsive multiplayer
  const NETWORK_UPDATE_RATE = 1000 / 30; // 33.33ms between updates
  const lastNetworkUpdateRef = useRef<number>(0);
  const pendingNetworkUpdateRef = useRef<NodeJS.Timeout | null>(null);

  // Client-side prediction and interpolation
  const networkGameStateRef = useRef<GameState | null>(null);
  const lastNetworkReceiveTimeRef = useRef<number>(0);
  const interpolationFactorRef = useRef<number>(0);
  const predictedGameStateRef = useRef<GameState | null>(null);

  // Robot taunting system
  const lastTauntTimeRef = useRef<number>(0);
  const TAUNT_COOLDOWN = 15000; // 15 seconds between taunts
  const TAUNT_CHANCE = 0.3; // 30% chance per trigger event
  const rallyCountRef = useRef<number>(0);
  const LONG_RALLY_THRESHOLD = 15; // Taunt after 15 hits in a rally
  const lastRandomTauntRef = useRef<number>(0);
  const RANDOM_TAUNT_INTERVAL = 30000; // 30 seconds between random taunts

  // Create delta between two game states
  const createGameStateDelta = useCallback((current: GameState, previous: GameState | null): Partial<GameState> | null => {
    if (!previous) return current; // Send full state if no previous state

    const delta: any = {};
    let hasChanges = false;

    // Check ball changes (high priority for smooth gameplay)
    if (Math.abs(current.ball.x - previous.ball.x) > 0.1 ||
        Math.abs(current.ball.y - previous.ball.y) > 0.1 ||
        Math.abs(current.ball.dx - previous.ball.dx) > 0.1 ||
        Math.abs(current.ball.dy - previous.ball.dy) > 0.1 ||
        current.ball.size !== previous.ball.size ||
        current.ball.isDrunk !== previous.ball.isDrunk ||
        current.ball.isTeleporting !== previous.ball.isTeleporting ||
        current.ball.lastTouchedBy !== previous.ball.lastTouchedBy) {
      delta.ball = {
        x: current.ball.x,
        y: current.ball.y,
        dx: current.ball.dx,
        dy: current.ball.dy,
        size: current.ball.size,
        isDrunk: current.ball.isDrunk,
        drunkAngle: current.ball.drunkAngle,
        isTeleporting: current.ball.isTeleporting,
        lastTouchedBy: current.ball.lastTouchedBy
      };
      hasChanges = true;
    }

    // Check score changes
    if (current.score.left !== previous.score.left ||
        current.score.right !== previous.score.right ||
        current.score.top !== previous.score.top ||
        current.score.bottom !== previous.score.bottom) {
      console.log(`📤 SENDING SCORE DELTA:`, {
        previousScore: JSON.stringify(previous.score),
        currentScore: JSON.stringify(current.score),
        changes: {
          left: current.score.left !== previous.score.left ? `${previous.score.left} -> ${current.score.left}` : 'no change',
          right: current.score.right !== previous.score.right ? `${previous.score.right} -> ${current.score.right}` : 'no change',
          top: current.score.top !== previous.score.top ? `${previous.score.top} -> ${current.score.top}` : 'no change',
          bottom: current.score.bottom !== previous.score.bottom ? `${previous.score.bottom} -> ${current.score.bottom}` : 'no change'
        }
      });
      delta.score = current.score;
      hasChanges = true;
    }

    // Check game state flags
    if (current.isPlaying !== previous.isPlaying ||
        current.showStartScreen !== previous.showStartScreen ||
        current.isPaused !== previous.isPaused ||
        current.winner !== previous.winner ||
        current.gameEnded !== previous.gameEnded) {
      delta.isPlaying = current.isPlaying;
      delta.showStartScreen = current.showStartScreen;
      delta.isPaused = current.isPaused;
      delta.winner = current.winner;
      delta.gameEnded = current.gameEnded;
      hasChanges = true;
    }

    // Check pickup changes (less frequent but important)
    if (current.pickups.length !== previous.pickups.length ||
        current.coins.length !== previous.coins.length ||
        current.nextPickupTime !== previous.nextPickupTime) {
      delta.pickups = current.pickups;
      delta.coins = current.coins;
      delta.nextPickupTime = current.nextPickupTime;
      hasChanges = true;
    }

    // Check active effects
    if (current.activeEffects.length !== previous.activeEffects.length ||
        current.activeEffects.some((effect, i) =>
          !previous.activeEffects[i] ||
          effect.type !== previous.activeEffects[i].type ||
          effect.startTime !== previous.activeEffects[i].startTime)) {
      delta.activeEffects = current.activeEffects;
      hasChanges = true;
    }

    // Check special effects
    if (current.pickupEffect.isActive !== previous.pickupEffect.isActive ||
        current.decrunchEffect.isActive !== previous.decrunchEffect.isActive ||
        current.rumbleEffect.isActive !== previous.rumbleEffect.isActive) {
      if (current.pickupEffect.isActive !== previous.pickupEffect.isActive) {
        delta.pickupEffect = current.pickupEffect;
      }
      if (current.decrunchEffect.isActive !== previous.decrunchEffect.isActive) {
        delta.decrunchEffect = current.decrunchEffect;
      }
      if (current.rumbleEffect.isActive !== previous.rumbleEffect.isActive) {
        delta.rumbleEffect = current.rumbleEffect;
      }
      hasChanges = true;
    }

    return hasChanges ? delta : null;
  }, []);

  // Predict game state based on network state and time elapsed
  const predictGameState = useCallback((networkState: GameState, deltaTime: number): GameState => {
    if (!networkState) return networkState;

    const predicted = { ...networkState };

    // Predict ball position
    if (networkState.ball && deltaTime > 0) {
      predicted.ball = {
        ...networkState.ball,
        x: networkState.ball.x + (networkState.ball.dx * deltaTime / 1000),
        y: networkState.ball.y + (networkState.ball.dy * deltaTime / 1000)
      };

      // Handle ball bouncing off walls during prediction
      if (predicted.ball.x <= 12) {
        predicted.ball.x = 12;
        predicted.ball.dx = Math.abs(predicted.ball.dx);
      } else if (predicted.ball.x >= canvasSize.width - 12) {
        predicted.ball.x = canvasSize.width - 12;
        predicted.ball.dx = -Math.abs(predicted.ball.dx);
      }

      if (predicted.ball.y <= 12) {
        predicted.ball.y = 12;
        predicted.ball.dy = Math.abs(predicted.ball.dy);
      } else if (predicted.ball.y >= canvasSize.height - 12) {
        predicted.ball.y = canvasSize.height - 12;
        predicted.ball.dy = -Math.abs(predicted.ball.dy);
      }
    }

    return predicted;
  }, [canvasSize.width, canvasSize.height]);

  // Interpolate between current state and target state for smooth movement
  const interpolateGameState = useCallback((currentState: GameState, targetState: GameState, factor: number): GameState => {
    if (!currentState || !targetState || factor >= 1) return targetState;
    if (factor <= 0) return currentState;

    const interpolated = { ...currentState };

    // Interpolate ball position for smooth movement
    if (currentState.ball && targetState.ball) {
      interpolated.ball = {
        ...targetState.ball,
        x: currentState.ball.x + (targetState.ball.x - currentState.ball.x) * factor,
        y: currentState.ball.y + (targetState.ball.y - currentState.ball.y) * factor,
        dx: targetState.ball.dx, // Keep target velocity
        dy: targetState.ball.dy  // Keep target velocity
      };
    }

    // Interpolate remote paddle positions (not controlled by this client)
    if (multiplayerState.playerSide !== 'left' && currentState.paddles.left && targetState.paddles.left) {
      interpolated.paddles.left = {
        ...targetState.paddles.left,
        y: currentState.paddles.left.y + (targetState.paddles.left.y - currentState.paddles.left.y) * factor
      };
    }

    if (multiplayerState.playerSide !== 'right' && currentState.paddles.right && targetState.paddles.right) {
      interpolated.paddles.right = {
        ...targetState.paddles.right,
        y: currentState.paddles.right.y + (targetState.paddles.right.y - currentState.paddles.right.y) * factor
      };
    }

    if (multiplayerState.playerSide !== 'top' && currentState.paddles.top && targetState.paddles.top) {
      interpolated.paddles.top = {
        ...targetState.paddles.top,
        x: currentState.paddles.top.x + (targetState.paddles.top.x - currentState.paddles.top.x) * factor
      };
    }

    if (multiplayerState.playerSide !== 'bottom' && currentState.paddles.bottom && targetState.paddles.bottom) {
      interpolated.paddles.bottom = {
        ...targetState.paddles.bottom,
        x: currentState.paddles.bottom.x + (targetState.paddles.bottom.x - currentState.paddles.bottom.x) * factor
      };
    }

    // Don't interpolate discrete game state changes
    interpolated.score = targetState.score;
    interpolated.isPlaying = targetState.isPlaying;
    interpolated.winner = targetState.winner;
    interpolated.gameEnded = targetState.gameEnded;

    return interpolated;
  }, [multiplayerState.playerSide]);

  // Initialize dynamic taunt system
  const dynamicTauntSystem = getDynamicTauntSystem();

  // Player behavior tracking refs
  const playerBehaviorRef = useRef<Map<string, PlayerBehavior>>(new Map());
  const gameStartTimeRef = useRef<number>(Date.now());
  const lastMoveTimesRef = useRef<Map<string, number>>(new Map());

  // Update player behavior analytics
  const updatePlayerBehavior = useCallback((playerId: string, position: string, reactionTime?: number) => {
    const currentBehavior = playerBehaviorRef.current.get(playerId) || {
      player_id: playerId,
      total_matches: 1,
      avg_reaction_time: reactionTime || 0.5,
      favorite_position: position,
      weakness_patterns: [],
      last_seen: new Date().toISOString(),
      personality_type: 'balanced' as const
    };

    // Update reaction time average
    if (reactionTime) {
      currentBehavior.avg_reaction_time =
        (currentBehavior.avg_reaction_time + reactionTime) / 2;
    }

    // Update favorite position tracking
    if (currentBehavior.favorite_position !== position) {
      currentBehavior.personality_type = 'erratic';
    }

    // Determine personality type based on behavior patterns
    if (currentBehavior.avg_reaction_time < 0.3) {
      currentBehavior.personality_type = 'aggressive';
    } else if (currentBehavior.avg_reaction_time > 0.7) {
      currentBehavior.personality_type = 'defensive';
    }

    currentBehavior.last_seen = new Date().toISOString();
    playerBehaviorRef.current.set(playerId, currentBehavior);

    // Update dynamic taunt system with behavior data
    const context = {
      currentScore: gameState.score,
      rallyLength: rallyCountRef.current,
      gamePhase: (Date.now() - gameStartTimeRef.current < 30000 ? 'early' :
                 Date.now() - gameStartTimeRef.current < 120000 ? 'mid' :
                 Math.max(...Object.values(gameState.score)) < 3 ? 'late' : 'overtime') as 'early' | 'mid' | 'late' | 'overtime',
      dominantPlayer: Object.entries(gameState.score).find(([_, s]) => s === Math.max(...Object.values(gameState.score)))?.[0],
      lastScorer: undefined,
      playerBehaviors: Array.from(playerBehaviorRef.current.values())
    };
    dynamicTauntSystem.analyzePlayerBehavior(playerId, context);
  }, [dynamicTauntSystem, gameState.score]);


  // Build game context for dynamic taunt generation
  const buildGameContext = useCallback((): GameContext => {
    const currentTime = Date.now();
    const gamePhase: 'early' | 'mid' | 'late' | 'overtime' =
      currentTime - gameStartTimeRef.current < 30000 ? 'early' :
      currentTime - gameStartTimeRef.current < 120000 ? 'mid' :
      Math.max(...Object.values(gameState.score)) < 3 ? 'late' : 'overtime';

    // Determine dominant player
    const scores = Object.entries(gameState.score);
    const maxScore = Math.max(...Object.values(gameState.score));
    const dominantPlayer = scores.find(([_, s]) => s === maxScore)?.[0];

    // Get current player behaviors
    const playerBehaviors: PlayerBehavior[] = Array.from(playerBehaviorRef.current.values());

    return {
      currentScore: gameState.score,
      rallyLength: rallyCountRef.current,
      gamePhase,
      dominantPlayer,
      lastScorer: undefined, // Will be set during scoring events
      playerBehaviors
    };
  }, [gameState.score]);

  const getContextualTaunt = useCallback((triggerEvent: string, playerId?: string) => {
    const context = buildGameContext();

    // Set context based on trigger event
    if (triggerEvent.includes('score')) {
      context.lastScorer = playerId;
    }

    // Determine intensity based on game state
    let intensity = 3; // Default
    if (context.rallyLength > 15) intensity = 4; // More intense for long rallies
    if (context.gamePhase === 'late') intensity = 5; // Maximum intensity late game
    if (triggerEvent === 'random') intensity = 2; // Lighter for random taunts

    return dynamicTauntSystem.generatePersonalizedTaunt(
      playerId || 'anonymous_player',
      context,
      intensity
    );
  }, [buildGameContext, dynamicTauntSystem]);


  // Send optimized game state update via WebSocket (only for gamemaster) with throttling
  const updateGameState = useCallback((newGameState: GameState) => {
    if (wsRef.current?.readyState === WebSocket.OPEN &&
        multiplayerState.isConnected &&
        multiplayerState.isGameMaster) {

      const now = Date.now();
      const timeSinceLastUpdate = now - lastNetworkUpdateRef.current;

      // Check if we need to send immediately (important changes) or can throttle
      const delta = createGameStateDelta(newGameState, previousGameStateRef.current);
      if (!delta) return; // No changes to send

      // Immediate send for critical changes (scoring, game state changes)
      const hasCriticalChange = delta.score || delta.isPlaying !== undefined ||
                               delta.winner !== undefined || delta.gameEnded !== undefined ||
                               delta.showStartScreen !== undefined;

      if (hasCriticalChange || timeSinceLastUpdate >= NETWORK_UPDATE_RATE) {
        // Cancel any pending throttled update
        if (pendingNetworkUpdateRef.current) {
          clearTimeout(pendingNetworkUpdateRef.current);
          pendingNetworkUpdateRef.current = null;
        }

        // Send update immediately
        // Optimized message format with shorter keys
        wsRef.current.send(JSON.stringify({
          t: 'ugsd', // update_game_state_delta
          p: multiplayerState.playerId,
          r: multiplayerState.roomId,
          d: delta
        }));

        lastNetworkUpdateRef.current = now;
        previousGameStateRef.current = newGameState;
      } else {
        // Throttle non-critical updates
        if (!pendingNetworkUpdateRef.current) {
          const delay = NETWORK_UPDATE_RATE - timeSinceLastUpdate;
          pendingNetworkUpdateRef.current = setTimeout(() => {
            pendingNetworkUpdateRef.current = null;

            // Re-calculate delta with current state
            const currentDelta = createGameStateDelta(newGameState, previousGameStateRef.current);
            if (currentDelta && wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                t: 'ugsd', // update_game_state_delta
                p: multiplayerState.playerId,
                r: multiplayerState.roomId,
                d: currentDelta
              }));

              lastNetworkUpdateRef.current = Date.now();
              previousGameStateRef.current = newGameState;
            }
          }, delay);
        }
      }
    }
  }, [multiplayerState.isConnected, multiplayerState.isGameMaster, multiplayerState.playerId, multiplayerState.roomId, createGameStateDelta]);

  // Reset game room
  const resetRoom = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN &&
        multiplayerState.isConnected &&
        multiplayerState.isGameMaster) {
      wsRef.current.send(JSON.stringify({
        type: 'reset_room',
        playerId: multiplayerState.playerId,
        roomId: multiplayerState.roomId
      }));
    }
  }, [multiplayerState.playerId, multiplayerState.roomId, multiplayerState.isConnected, multiplayerState.isGameMaster]);

  // Handle window resize - fill entire screen
  useEffect(() => {
    const updateCanvasSize = () => {
      // Force a fixed square size for perfect square gameplay
      const FIXED_SQUARE_SIZE = 800; // Fixed 800x800 square

      console.log('Canvas size update:', {
        fixedSize: FIXED_SQUARE_SIZE,
        willSet: { width: FIXED_SQUARE_SIZE, height: FIXED_SQUARE_SIZE }
      });

      setCanvasSize({ width: FIXED_SQUARE_SIZE, height: FIXED_SQUARE_SIZE });

      // Update game state when canvas size changes
      setGameState(prev => ({
        ...prev,
        ball: {
          ...prev.ball,
          x: Math.min(prev.ball.x, FIXED_SQUARE_SIZE - prev.ball.size),
          y: Math.min(prev.ball.y, FIXED_SQUARE_SIZE - prev.ball.size)
        },
        paddles: {
          left: {
            ...prev.paddles.left,
            y: Math.min(prev.paddles.left.y, FIXED_SQUARE_SIZE - prev.paddles.left.height)
          },
          right: {
            ...prev.paddles.right,
            y: Math.min(prev.paddles.right.y, FIXED_SQUARE_SIZE - prev.paddles.right.height)
          },
          top: {
            ...prev.paddles.top,
            x: Math.min(prev.paddles.top.x, FIXED_SQUARE_SIZE - prev.paddles.top.width)
          },
          bottom: {
            ...prev.paddles.bottom,
            x: Math.min(prev.paddles.bottom.x, FIXED_SQUARE_SIZE - prev.paddles.bottom.width)
          }
        }
      }));
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  // Initialize Web Audio API with reverb effects (only after user gesture)
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioInitAttempted = useRef<boolean>(false);
  const reverbNodeRef = useRef<ConvolverNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const echoGainRef = useRef<GainNode | null>(null);

  // Ambient spaceship sounds
  const ambienceOscillatorsRef = useRef<OscillatorNode[]>([]);
  const ambienceGainsRef = useRef<GainNode[]>([]);
  const ambienceActiveRef = useRef(false);
  const ambienceMasterGainRef = useRef<GainNode | null>(null);
  const speechMasterGainRef = useRef<GainNode | null>(null);
  const beepsMasterGainRef = useRef<GainNode | null>(null);

  // Speech queue system to prevent overlapping robot speech
  const speechQueueRef = useRef<string[]>([]);
  const isSpeakingRef = useRef(false);
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Create impulse response for reverb effect
  const createImpulseResponse = useCallback((audioContext: AudioContext) => {
    const length = audioContext.sampleRate * 2; // 2 seconds of reverb
    const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        const decay = Math.pow(1 - i / length, 2); // Exponential decay
        channelData[i] = (Math.random() * 2 - 1) * decay * 0.3;
      }
    }
    return impulse;
  }, []);

  // Initialize audio effects chain
  const initializeAudioEffects = useCallback((audioContext: AudioContext) => {
    // Create reverb
    const convolver = audioContext.createConvolver();
    convolver.buffer = createImpulseResponse(audioContext);
    reverbNodeRef.current = convolver;

    // Create echo/delay
    const delay = audioContext.createDelay(1.0);
    delay.delayTime.setValueAtTime(0.15, audioContext.currentTime); // 150ms delay
    delayNodeRef.current = delay;

    // Echo feedback gain
    const echoGain = audioContext.createGain();
    echoGain.gain.setValueAtTime(0.4, audioContext.currentTime); // 40% feedback
    echoGainRef.current = echoGain;

    // Connect echo feedback loop
    delay.connect(echoGain);
    echoGain.connect(delay);
  }, [createImpulseResponse]);

  // Initialize audio on user interaction
  const initializeAudio = useCallback(async () => {
    if (!audioContextRef.current && !audioInitAttempted.current) {
      audioInitAttempted.current = true;
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        initializeAudioEffects(audioContextRef.current);
        // Resume context if suspended
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
      } catch (error) {
        // Audio not supported - fail silently
      }
    }
  }, [initializeAudioEffects]);

  // Simple speech function with overlap prevention and effects
  const speakRobotic = useCallback((text: string) => {
    // Validate text input
    if (!text || typeof text !== 'string' || text.trim() === '') {
      console.error('🤖 SAM speech error: Invalid text input:', text);
      return;
    }

    // Skip if already speaking
    if (isSpeakingRef.current) {
      return;
    }

    isSpeakingRef.current = true;

    // Initialize audio context if needed
    if (!audioContextRef.current) {
      initializeAudio();
    }

    try {
      if (!audioContextRef.current) return;

      // Create SAM instance with classic Berzerk-style robotic settings
      const cleanText = text.trim().toUpperCase();
      const sam = new SamJs({
        pitch: 64,     // Classic robotic pitch (not too low or high)
        speed: 72,     // Moderate speech speed for clarity
        mouth: 110,    // Mouth setting for robotic character
        throat: 130    // Throat setting for classic arcade robot sound
      });

      // Get SAM audio buffer and create proper Web Audio source
      const audioBuffer = sam.buf8(cleanText);

      // Create a proper Web Audio buffer from SAM's output
      const sampleRate = 22050; // SAM's default sample rate
      const webAudioBuffer = audioContextRef.current.createBuffer(1, audioBuffer.length, sampleRate);
      const channelData = webAudioBuffer.getChannelData(0);

      // Convert SAM's 8-bit unsigned audio to Web Audio's float format
      for (let i = 0; i < audioBuffer.length; i++) {
        channelData[i] = (audioBuffer[i] - 128) / 128.0; // Convert to -1.0 to 1.0 range
      }

      // Create audio source and setup effects chain
      try {
        // Create audio source
        const source = audioContextRef.current!.createBufferSource();
        source.buffer = webAudioBuffer;

        // Create effects chain with deep reverb and echo
        const dryGain = audioContextRef.current!.createGain();
        const wetGain = audioContextRef.current!.createGain();
        const echoGain = audioContextRef.current!.createGain();
        const outputGain = audioContextRef.current!.createGain();

        // Set mixing levels for dramatic reverb and echo
        dryGain.gain.setValueAtTime(0.2, audioContextRef.current!.currentTime);  // 20% dry
        wetGain.gain.setValueAtTime(0.9, audioContextRef.current!.currentTime);  // 90% reverb
        echoGain.gain.setValueAtTime(0.6, audioContextRef.current!.currentTime); // 60% echo
        outputGain.gain.setValueAtTime(0.3, audioContextRef.current!.currentTime); // Reduced volume for better balance

        // Connect dry signal
        source.connect(dryGain);
        dryGain.connect(outputGain);

        // Connect reverb effect
        if (reverbNodeRef.current) {
          source.connect(reverbNodeRef.current);
          reverbNodeRef.current.connect(wetGain);
          wetGain.connect(outputGain);
        }

        // Connect echo/delay effect
        if (delayNodeRef.current) {
          source.connect(delayNodeRef.current);
          delayNodeRef.current.connect(echoGain);
          echoGain.connect(outputGain);
        }

        // Create and connect speech master gain if not exists
        if (!speechMasterGainRef.current) {
          speechMasterGainRef.current = audioContextRef.current!.createGain();
          speechMasterGainRef.current.gain.setValueAtTime(0.15, audioContextRef.current!.currentTime); // Lowered robot voice volume
          speechMasterGainRef.current.connect(audioContextRef.current!.destination);
        }

        // Connect to speech master gain instead of direct destination
        outputGain.connect(speechMasterGainRef.current);

        // Play the processed audio
        source.start();

        // Clean up when finished
        source.onended = () => {
          isSpeakingRef.current = false;
        };
      } catch (error) {
        console.error('🤖 SAM Web Audio error:', error);
        isSpeakingRef.current = false;
        // Fallback to basic SAM without effects if Web Audio fails
        sam.speak(cleanText);
      }

      // Reset speaking flag after estimated duration
      const speechDuration = 2500 + (cleanText.length * 80);
      setTimeout(() => {
        isSpeakingRef.current = false;
      }, speechDuration);

    } catch (error) {
      console.error('🤖 SAM speech error:', error);
      isSpeakingRef.current = false;
    }
  }, [initializeAudio]);

  const attemptRobotTaunt = useCallback((triggerEvent: string, playerId?: string) => {
    const now = Date.now();

    // Check cooldown and chance
    if (now - lastTauntTimeRef.current > TAUNT_COOLDOWN && Math.random() < TAUNT_CHANCE) {
      const taunt = getContextualTaunt(triggerEvent, playerId);

      // Delay the taunt slightly for better timing
      setTimeout(() => {
        speakRobotic(taunt);
      }, 500 + Math.random() * 2500); // Random delay between 0.5-3 seconds

      lastTauntTimeRef.current = now;
      // Dynamic taunt triggered

      // Log taunt effectiveness data for future improvements
      if (playerId) {
        // Track player behavior stats
      }
    }
  }, [getContextualTaunt, speakRobotic]);

  // Random gameplay taunts - occasionally taunt during active play using dynamic system
  const checkRandomTaunt = useCallback(() => {
    const now = Date.now();

    if (now - lastRandomTauntRef.current > RANDOM_TAUNT_INTERVAL &&
        now - lastTauntTimeRef.current > TAUNT_COOLDOWN &&
        Math.random() < 0.1) { // 10% chance per check

      // Use the dynamic taunt system for random taunts too
      const taunt = getContextualTaunt('random', 'random_player');

      setTimeout(() => {
        speakRobotic(taunt);
      }, 1000 + Math.random() * 2000); // Random delay 1-3 seconds

      lastRandomTauntRef.current = now;
      lastTauntTimeRef.current = now;
      // Dynamic random taunt generated
    }
  }, [speakRobotic, getContextualTaunt]);

  // Enhanced tone generation with custom volume
  const playTone = useCallback((frequency: number, duration: number, effectType: 'normal' | 'echo' | 'reverb' | 'both' = 'both', volume: number = 0.3) => {
    // Only create AudioContext when actually trying to play a sound (user gesture)
    if (!audioContextRef.current && !audioInitAttempted.current) {
      audioInitAttempted.current = true;
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        initializeAudioEffects(audioContextRef.current);
      } catch (error) {
        // Audio not supported - fail silently
        return;
      }
    }

    // Exit early if no audio context
    if (!audioContextRef.current) {
      return;
    }

    // Resume audio context if suspended (required for production builds)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {
        // Fail silently if resume fails
        return;
      });
    }

    const ctx = audioContextRef.current;
    const now = ctx.currentTime;

    // Create dedicated beeps audio bus if it doesn't exist
    if (!beepsMasterGainRef.current) {
      beepsMasterGainRef.current = ctx.createGain();
      beepsMasterGainRef.current.gain.setValueAtTime(0.15, ctx.currentTime); // Much lower level for beeps
      beepsMasterGainRef.current.connect(ctx.destination);
    }

    // Create oscillator and main gain
    const oscillator = ctx.createOscillator();
    const mainGain = ctx.createGain();

    // Create dry/wet mix gains
    const dryGain = ctx.createGain();
    const wetGain = ctx.createGain();
    const echoWetGain = ctx.createGain();

    // Configure oscillator
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.type = 'square'; // Classic arcade sound

    // Configure main envelope with custom volume
    mainGain.gain.setValueAtTime(volume, now); // Immediate full volume, no fade-in
    mainGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Configure mix levels based on effect type (restored advanced effects)
    const dryLevel = effectType === 'reverb' || effectType === 'both' ? 0.6 : 1.0;
    const reverbLevel = effectType === 'reverb' || effectType === 'both' ? 0.3 : 0.0;
    const echoLevel = effectType === 'echo' || effectType === 'both' ? 0.25 : 0.0;

    dryGain.gain.setValueAtTime(dryLevel, now);
    wetGain.gain.setValueAtTime(reverbLevel, now);
    echoWetGain.gain.setValueAtTime(echoLevel, now);

    // Connect the audio graph through dedicated beeps bus
    oscillator.connect(mainGain);

    // Dry signal (through beeps master gain)
    mainGain.connect(dryGain);
    dryGain.connect(beepsMasterGainRef.current!);

    // Wet signal (through reverb to beeps master gain)
    if ((effectType === 'reverb' || effectType === 'both') && reverbNodeRef.current) {
      mainGain.connect(reverbNodeRef.current);
      reverbNodeRef.current.connect(wetGain);
      wetGain.connect(beepsMasterGainRef.current!);
    }

    // Echo signal (through delay to beeps master gain)
    if ((effectType === 'echo' || effectType === 'both') && delayNodeRef.current) {
      mainGain.connect(delayNodeRef.current);
      delayNodeRef.current.connect(echoWetGain);
      echoWetGain.connect(beepsMasterGainRef.current!);
    }

    // Start and stop
    oscillator.start(now);
    oscillator.stop(now + duration);

    // Clean up nodes after oscillator stops to prevent accumulation
    setTimeout(() => {
      try {
        mainGain.disconnect();
        dryGain.disconnect();
        wetGain.disconnect();
        echoWetGain.disconnect();
      } catch (e) {
        // Nodes may already be disconnected
      }
    }, (duration * 1000) + 100); // Add small buffer
  }, [initializeAudioEffects]);


  // Legacy beep function for compatibility
  const playBeep = useCallback((frequency: number, duration: number, effectType: 'normal' | 'echo' | 'reverb' | 'both' = 'both') => {
    playTone(frequency, duration, effectType);
  }, [playTone]);

  // 🚀 OPTIMIZED melody system using precalculated frequencies
  const playMelodyNote = useCallback((eventType: 'paddle' | 'wall' | 'score' | 'pickup', pickupData?: any, effectType: 'normal' | 'echo' | 'reverb' | 'both' = 'both') => {
    const now = Date.now();

    // 🎵 Use precalculated frequencies for instant audio response
    let frequency: number;
    let duration: number;

    // Use fast lookup table instead of complex calculations
    switch (eventType) {
      case 'paddle':
        frequency = PRECALC_AUDIO.frequencies.paddle;
        duration = 0.15;
        break;

      case 'wall':
        frequency = PRECALC_AUDIO.frequencies.wall;
        duration = 0.12;
        break;

      case 'score':
        frequency = PRECALC_AUDIO.frequencies.score;
        duration = 0.8;
        break;

      case 'pickup':
        frequency = PRECALC_AUDIO.frequencies.pickup;
        duration = 0.3;
        break;

      default:
        frequency = 440;
        duration = 0.1;
    }

    // 🚀 OPTIMIZED: Play single precalculated tone (no harmony computation)
    playTone(frequency, duration, effectType);

  }, [playTone]);

  // Subtle background ambience - very low volume, deep frequencies only
  const startAmbienceSound = useCallback(() => {

    if (ambienceActiveRef.current || !audioContextRef.current) {
      return;
    }

    const ctx = audioContextRef.current;
    ambienceActiveRef.current = true;

    // Create dedicated ambient audio bus with DRAMATIC master control
    if (!ambienceMasterGainRef.current) {
      ambienceMasterGainRef.current = ctx.createGain();
      ambienceMasterGainRef.current.gain.setValueAtTime(0.5, ctx.currentTime); // Raised ambient music volume significantly
      ambienceMasterGainRef.current.connect(ctx.destination);

      // Add DRAMATIC master volume swells every 15-30 seconds
      const addMasterDrama = () => {
        if (!ambienceMasterGainRef.current || !ambienceActiveRef.current) return;

        const dramaticVolume = 0.25 + Math.random() * 0.15; // 0.25 to 0.4 - subtle background swells
        const swellDuration = 8 + Math.random() * 12; // 8-20 second swells
        const now = ctx.currentTime;

        try {
          ambienceMasterGainRef.current.gain.exponentialRampToValueAtTime(dramaticVolume, now + swellDuration);
        } catch (e) {}

        setTimeout(addMasterDrama, (15 + Math.random() * 15) * 1000); // 15-30 second intervals
      };

      setTimeout(addMasterDrama, 5000); // Start after 5 seconds
    }

    // Clear any existing oscillators
    ambienceOscillatorsRef.current.forEach(osc => {
      try { osc.stop(); } catch (e) {}
    });
    ambienceGainsRef.current.forEach(gain => gain.disconnect());
    ambienceOscillatorsRef.current = [];
    ambienceGainsRef.current = [];

    // Expanded ambient layers - increased to 15 for much more varied atmosphere
    const currentScale = MUSICAL_SCALES[melodyState.currentScale as keyof typeof MUSICAL_SCALES];
    const ambienceLayers = [
      // ESSENTIAL SPACESHIP HUMMING - Core atmosphere
      { freq: 60, volume: 0.35, type: 'sine' as OscillatorType, modDepth: 0.02, modRate: 0.08, tension: 'humming' }, // Deep engine hum
      { freq: 120, volume: 0.25, type: 'triangle' as OscillatorType, modDepth: 0.015, modRate: 0.12, tension: 'humming' }, // Ventilation system
      { freq: 180, volume: 0.15, type: 'sine' as OscillatorType, modDepth: 0.01, modRate: 0.06, tension: 'humming' }, // Generator harmonics
      { freq: 90, volume: 0.2, type: 'sawtooth' as OscillatorType, modDepth: 0.025, modRate: 0.09, tension: 'humming' }, // Low machinery
      { freq: 240, volume: 0.12, type: 'triangle' as OscillatorType, modDepth: 0.02, modRate: 0.14, tension: 'humming' }, // High systems

      // SUB-BASS FOUNDATION - Essential ominous foundation
      { freq: currentScale[0] * 0.2, volume: 0.25, type: 'sine' as OscillatorType, modDepth: 0.08, modRate: 0.05, tension: 'ominous' },
      { freq: currentScale[0] * 0.4, volume: 0.2, type: 'sine' as OscillatorType, modDepth: 0.06, modRate: 0.08, tension: 'ominous' },
      { freq: currentScale[1] * 0.3, volume: 0.18, type: 'triangle' as OscillatorType, modDepth: 0.1, modRate: 0.04, tension: 'ominous' },

      // TENSION BUILDERS - Core suspense elements
      { freq: currentScale[1] * 0.6, volume: 0.15, type: 'triangle' as OscillatorType, modDepth: 0.12, modRate: 0.18, tension: 'suspense' },
      { freq: currentScale[2] * 0.8, volume: 0.12, type: 'triangle' as OscillatorType, modDepth: 0.1, modRate: 0.15, tension: 'suspense' },
      { freq: currentScale[3] * 0.7, volume: 0.14, type: 'sawtooth' as OscillatorType, modDepth: 0.15, modRate: 0.22, tension: 'suspense' },

      // CINEMATIC LAYERS - Multiple epic elements for variety
      { freq: currentScale[0] * 1.2, volume: 0.1, type: 'triangle' as OscillatorType, modDepth: 0.15, modRate: 0.28, tension: 'epic' },
      { freq: currentScale[2] * 1.1, volume: 0.08, type: 'sine' as OscillatorType, modDepth: 0.18, modRate: 0.32, tension: 'epic' },

      // ETHEREAL WISPS - Mysterious floating elements for atmosphere
      { freq: currentScale[4] * 1.8, volume: 0.06, type: 'sine' as OscillatorType, modDepth: 0.25, modRate: 0.15, tension: 'ethereal' },
      { freq: currentScale[1] * 2.2, volume: 0.05, type: 'triangle' as OscillatorType, modDepth: 0.3, modRate: 0.11, tension: 'ethereal' },
    ];

    ambienceLayers.forEach((layer, index) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const filterNode = ctx.createBiquadFilter();

      oscillator.type = layer.type;
      oscillator.frequency.setValueAtTime(layer.freq, ctx.currentTime);

      // DRAMATIC frequency modulation for cinematic tension
      const lfoGain = ctx.createGain();
      const lfo = ctx.createOscillator();

      // Tension-based modulation characteristics
      let modCharacter;
      switch ((layer as any).tension) {
        case 'humming':
          lfo.type = 'sine'; // Smooth, continuous hum
          modCharacter = { rate: layer.modRate, depth: layer.modDepth }; // Minimal modulation for stability
          break;
        case 'ominous':
          lfo.type = 'sine'; // Smooth, mysterious
          modCharacter = { rate: layer.modRate * 0.3, depth: layer.modDepth * 1.5 };
          break;
        case 'suspense':
          lfo.type = 'triangle'; // Building tension
          modCharacter = { rate: layer.modRate * 1.8, depth: layer.modDepth * 4.0 };
          break;
        case 'epic':
          lfo.type = 'sine'; // Heroic sweep
          modCharacter = { rate: layer.modRate * 0.6, depth: layer.modDepth * 3.2 };
          break;
        case 'intense':
          lfo.type = 'triangle'; // Smooth intensity
          modCharacter = { rate: layer.modRate * 2.0, depth: layer.modDepth * 3.0 };
          break;
        case 'ethereal':
          lfo.type = 'sine'; // Mystical waves
          modCharacter = { rate: layer.modRate * 0.4, depth: layer.modDepth * 6.0 };
          break;
        case 'sparkle':
          lfo.type = 'triangle'; // Glittering
          modCharacter = { rate: layer.modRate * 3.2, depth: layer.modDepth * 8.0 };
          break;
        default:
          lfo.type = 'sine';
          modCharacter = { rate: layer.modRate, depth: layer.modDepth };
      }

      lfo.frequency.setValueAtTime(modCharacter.rate, ctx.currentTime);
      lfoGain.gain.setValueAtTime(layer.freq * modCharacter.depth, ctx.currentTime);

      lfo.connect(lfoGain);
      lfoGain.connect(oscillator.frequency);
      lfo.start();

      // DRAMATIC amplitude tremolo for intensity
      const ampLfoGain = ctx.createGain();
      const ampLfo = ctx.createOscillator();
      ampLfo.frequency.setValueAtTime(modCharacter.rate * 0.4, ctx.currentTime);
      ampLfo.type = 'sine';
      ampLfoGain.gain.setValueAtTime(layer.volume * 0.4, ctx.currentTime); // Much more dramatic amplitude variation

      ampLfo.connect(ampLfoGain);
      ampLfoGain.connect(gainNode.gain);
      ampLfo.start();

      // Add DRAMATIC filter sweeps for cinematic movement
      const filterLfoGain = ctx.createGain();
      const filterLfo = ctx.createOscillator();
      filterLfo.frequency.setValueAtTime(modCharacter.rate * 0.25, ctx.currentTime);
      filterLfo.type = 'triangle';
      filterLfoGain.gain.setValueAtTime(filterNode.frequency.value * 0.3, ctx.currentTime);

      filterLfo.connect(filterLfoGain);
      filterLfoGain.connect(filterNode.frequency);
      filterLfo.start();

      // DRAMATIC filtering based on tension character
      switch ((layer as any).tension) {
        case 'humming':
          // Spaceship system filtering - warm, muffled like inside a ship
          filterNode.type = 'lowpass';
          filterNode.frequency.setValueAtTime(400 + index * 200, ctx.currentTime); // Gentle rolloff
          filterNode.Q.setValueAtTime(0.8, ctx.currentTime); // Smooth, non-resonant
          break;
        case 'ominous':
          // Dark, brooding low-pass with high resonance
          filterNode.type = 'lowpass';
          filterNode.frequency.setValueAtTime(200 + index * 100, ctx.currentTime);
          filterNode.Q.setValueAtTime(3.0 + index * 0.5, ctx.currentTime); // High Q for drama
          break;
        case 'suspense':
          // Tense band-pass with sweeping frequency
          filterNode.type = 'bandpass';
          filterNode.frequency.setValueAtTime(300 + index * 150, ctx.currentTime);
          filterNode.Q.setValueAtTime(4.0 + index * 0.8, ctx.currentTime); // Very focused
          break;
        case 'epic':
          // Heroic notch filtering for character
          filterNode.type = 'notch';
          filterNode.frequency.setValueAtTime(500 + index * 200, ctx.currentTime);
          filterNode.Q.setValueAtTime(2.5 + index * 0.6, ctx.currentTime);
          break;
        case 'intense':
          // Aggressive high-pass with resonance
          filterNode.type = 'highpass';
          filterNode.frequency.setValueAtTime(150 + index * 80, ctx.currentTime);
          filterNode.Q.setValueAtTime(5.0 + index, ctx.currentTime); // Extreme resonance
          break;
        case 'ethereal':
          // Mystical peaking filter
          filterNode.type = 'peaking';
          filterNode.frequency.setValueAtTime(800 + index * 300, ctx.currentTime);
          filterNode.Q.setValueAtTime(6.0 + index * 1.2, ctx.currentTime); // Very sharp peaks
          filterNode.gain.setValueAtTime(12 + index * 2, ctx.currentTime); // Boost for drama
          break;
        case 'sparkle':
          // Brilliant all-pass for shimmer
          filterNode.type = 'allpass';
          filterNode.frequency.setValueAtTime(1000 + index * 500, ctx.currentTime);
          filterNode.Q.setValueAtTime(8.0 + index * 1.5, ctx.currentTime); // Maximum drama
          break;
        default:
          filterNode.type = 'lowpass';
          filterNode.frequency.setValueAtTime(400 + index * 100, ctx.currentTime);
          filterNode.Q.setValueAtTime(1.0, ctx.currentTime);
      }

      // DRAMATIC entrance based on tension type
      gainNode.gain.setValueAtTime(0, ctx.currentTime);

      let entranceTime;
      switch ((layer as any).tension) {
        case 'humming':
          entranceTime = 0.5 + index * 0.2; // Quick, steady build like systems coming online
          break;
        case 'ominous':
          entranceTime = 3 + index * 0.8; // Slow, menacing build
          break;
        case 'suspense':
          entranceTime = 0.2 + index * 0.1; // Quick, startling entrance
          break;
        case 'epic':
          entranceTime = 5 + index * 1.2; // Grand, sweeping entrance
          break;
        case 'intense':
          entranceTime = 0.05 + index * 0.05; // Immediate, aggressive
          break;
        case 'ethereal':
          entranceTime = 8 + index * 2.0; // Mystical, gradual appearance
          break;
        case 'sparkle':
          entranceTime = 0.01 + index * 0.02; // Instant, brilliant flash
          break;
        default:
          entranceTime = 1 + index * 0.3;
      }

      gainNode.gain.exponentialRampToValueAtTime(layer.volume, ctx.currentTime + entranceTime);

      // Connect chain: oscillator -> filter -> gain -> reverb -> destination
      oscillator.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(ambienceMasterGainRef.current!); // Connect to dedicated ambient bus, not main destination

      oscillator.start();

      ambienceOscillatorsRef.current.push(oscillator);
      ambienceGainsRef.current.push(gainNode);

      // Add subtle volume fluctuations (never silent)
      const addFluctuation = () => {
        if (!ambienceActiveRef.current) {
          return;
        }

          // DRAMATIC volume fluctuations based on tension type
        let dramaDynamics;
        switch ((layer as any).tension) {
          case 'humming':
            dramaDynamics = {
              variation: 0.15, // Very stable for continuous hum
              minVolume: layer.volume * 0.9, // Almost constant
              maxVolume: layer.volume * 1.1, // Tiny fluctuations
              duration: Math.random() * 8 + 5, // 5-13 second slow changes
            };
            break;
          case 'ominous':
            dramaDynamics = {
              variation: 0.4, // Subtle swells
              minVolume: layer.volume * 0.6, // Stays audible
              maxVolume: layer.volume * 1.2, // Gentle peaks
              duration: Math.random() * 3 + 2, // 2-5 second swells
            };
            break;
          case 'suspense':
            dramaDynamics = {
              variation: 0.5, // Moderate variation
              minVolume: layer.volume * 0.5, // Subtle dips
              maxVolume: layer.volume * 1.3, // Modest peaks
              duration: Math.random() * 2 + 1, // 1-3 second tension builds
            };
            break;
          case 'epic':
            dramaDynamics = {
              variation: 0.4, // Gentle swells
              minVolume: layer.volume * 0.7, // Always present
              maxVolume: layer.volume * 1.2, // Subtle heroic peaks
              duration: Math.random() * 4 + 3, // 3-7 second epic builds
            };
            break;
          case 'intense':
            dramaDynamics = {
              variation: 0.6, // Controlled intensity
              minVolume: layer.volume * 0.4, // Noticeable but not gone
              maxVolume: layer.volume * 1.4, // Moderate peaks
              duration: Math.random() * 1.5 + 0.5, // 0.5-2 second bursts
            };
            break;
          case 'ethereal':
            dramaDynamics = {
              variation: 0.7, // Mystical but subtle
              minVolume: layer.volume * 0.3, // Whisper level
              maxVolume: layer.volume * 1.5, // Gentle appearances
              duration: Math.random() * 5 + 2, // 2-7 second mystery
            };
            break;
          case 'sparkle':
            dramaDynamics = {
              variation: 0.8, // Controlled sparkle
              minVolume: layer.volume * 0.2, // Faint but present
              maxVolume: layer.volume * 1.6, // Modest flashes
              duration: Math.random() * 0.8 + 0.2, // 0.2-1 second sparkles
            };
            break;
          default:
            dramaDynamics = {
              variation: 0.6,
              minVolume: layer.volume * 0.4,
              maxVolume: layer.volume * 1.2,
              duration: Math.random() * 2 + 1,
            };
        }

        const randomVolume = Math.random() * (dramaDynamics.maxVolume - dramaDynamics.minVolume) + dramaDynamics.minVolume;
        const fluctuationDuration = dramaDynamics.duration;
        const randomTime = ctx.currentTime + fluctuationDuration;

        try {
          gainNode.gain.exponentialRampToValueAtTime(Math.max(0.001, randomVolume), randomTime);
        } catch (e) {}

        // Schedule next dramatic event with tension-specific timing
        const nextDelay = fluctuationDuration + (Math.random() * 1 - 0.5); // ±500ms variation for drama
        setTimeout(addFluctuation, nextDelay * 1000);
      };

      addFluctuation(); // Start fluctuation immediately

      // Add SLOW FREQUENCY EVOLUTION to break loop feeling
      const addFrequencyEvolution = () => {
        if (!ambienceActiveRef.current) return;

        // Slowly evolve frequency over long periods to create organic changes
        const baseFreq = layer.freq;
        const evolutionAmount = baseFreq * (0.02 + Math.random() * 0.06); // 2-8% frequency drift
        const direction = Math.random() > 0.5 ? 1 : -1;
        const newFreq = baseFreq + (evolutionAmount * direction);
        const evolutionTime = 30 + Math.random() * 60; // 30-90 second slow evolution

        try {
          oscillator.frequency.exponentialRampToValueAtTime(
            Math.max(20, Math.min(2000, newFreq)), // Keep in reasonable range
            ctx.currentTime + evolutionTime
          );
        } catch (e) {}

        // Schedule next evolution with randomized timing
        const nextEvolutionDelay = evolutionTime + (Math.random() * 20 - 10); // ±10 second variation
        setTimeout(addFrequencyEvolution, nextEvolutionDelay * 1000);
      };

      // Start frequency evolution after initial entrance, with staggered timing per layer
      setTimeout(addFrequencyEvolution, (index * 5 + Math.random() * 10) * 1000);
    });

    // Restart oscillators every 5 minutes to ensure they never end
    const restartInterval = setInterval(() => {
      if (ambienceActiveRef.current) {
        stopAmbienceSound();
        // setTimeout(() => startAmbienceSound(), 100); // Disabled - now using global ambient music
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(restartInterval);
  }, []);

  const stopAmbienceSound = useCallback(() => {
    if (!ambienceActiveRef.current) return;

    ambienceActiveRef.current = false;

    // Fade out and stop all oscillators
    ambienceGainsRef.current.forEach((gain, index) => {
      try {
        gain.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current!.currentTime + 2);
      } catch (e) {}
    });

    setTimeout(() => {
      ambienceOscillatorsRef.current.forEach(osc => {
        try { osc.stop(); } catch (e) {}
      });
      ambienceGainsRef.current.forEach(gain => gain.disconnect());
      ambienceOscillatorsRef.current = [];
      ambienceGainsRef.current = [];
    }, 2500);
  }, []);

  // Process speech queue to prevent overlapping speech

  // Force speech function for countdown numbers that bypasses speaking check with effects
  const forceSpeak = useCallback((text: string) => {
    // Validate text input
    if (!text || typeof text !== 'string' || text.trim() === '') {
      console.error('🤖 SAM force speech error: Invalid text input:', text);
      return;
    }

    // Initialize audio context if needed
    if (!audioContextRef.current) {
      initializeAudio();
    }

    try {
      if (!audioContextRef.current) return;

      // Create SAM instance with classic Berzerk-style robotic settings
      const cleanText = text.trim().toUpperCase();
      const sam = new SamJs({
        debug: false,
        pitch: 64,     // Classic robotic pitch (not too low or high)
        speed: 72,     // Moderate speech speed for clarity
        mouth: 110,    // Mouth setting for robotic character
        throat: 130    // Throat setting for classic arcade robot sound
      });

      // Get SAM audio buffer and create proper Web Audio source (force speech)
      const audioBuffer = sam.buf8(cleanText);

      // Create a proper Web Audio buffer from SAM's output
      const sampleRate = 22050; // SAM's default sample rate
      const webAudioBuffer = audioContextRef.current.createBuffer(1, audioBuffer.length, sampleRate);
      const channelData = webAudioBuffer.getChannelData(0);

      // Convert SAM's 8-bit unsigned audio to Web Audio's float format
      for (let i = 0; i < audioBuffer.length; i++) {
        channelData[i] = (audioBuffer[i] - 128) / 128.0; // Convert to -1.0 to 1.0 range
      }

      // Create audio source and setup effects chain (force speech)
      try {
        // Create audio source
        const source = audioContextRef.current!.createBufferSource();
        source.buffer = webAudioBuffer;

        // Create effects chain with deep reverb and echo
        const dryGain = audioContextRef.current!.createGain();
        const wetGain = audioContextRef.current!.createGain();
        const echoGain = audioContextRef.current!.createGain();
        const outputGain = audioContextRef.current!.createGain();

        // Set mixing levels for dramatic reverb and echo
        dryGain.gain.setValueAtTime(0.2, audioContextRef.current!.currentTime);  // 20% dry
        wetGain.gain.setValueAtTime(0.9, audioContextRef.current!.currentTime);  // 90% reverb
        echoGain.gain.setValueAtTime(0.6, audioContextRef.current!.currentTime); // 60% echo
        outputGain.gain.setValueAtTime(0.3, audioContextRef.current!.currentTime); // Reduced volume for better balance

        // Connect dry signal
        source.connect(dryGain);
        dryGain.connect(outputGain);

        // Connect reverb effect
        if (reverbNodeRef.current) {
          source.connect(reverbNodeRef.current);
          reverbNodeRef.current.connect(wetGain);
          wetGain.connect(outputGain);
        }

        // Connect echo/delay effect
        if (delayNodeRef.current) {
          source.connect(delayNodeRef.current);
          delayNodeRef.current.connect(echoGain);
          echoGain.connect(outputGain);
        }

        // Create and connect speech master gain if not exists
        if (!speechMasterGainRef.current) {
          speechMasterGainRef.current = audioContextRef.current!.createGain();
          speechMasterGainRef.current.gain.setValueAtTime(0.15, audioContextRef.current!.currentTime); // Lowered robot voice volume
          speechMasterGainRef.current.connect(audioContextRef.current!.destination);
        }

        // Connect to speech master gain instead of direct destination
        outputGain.connect(speechMasterGainRef.current);

        // Play the processed audio (force speech)
        source.start();
      } catch (error) {
        console.error('🤖 SAM force Web Audio error:', error);
        // Fallback to basic SAM without effects if Web Audio fails
        sam.speak(cleanText);
      }

    } catch (error) {
      console.error('🤖 SAM force speech error:', error);
    }
  }, [initializeAudio]);

  // Welcome message and ambient sound on start screen
  useEffect(() => {
    if (gameState.showStartScreen) {
      // Start ambient sounds on title screen
      if (audioContextRef.current && audioContextRef.current.state === 'running' && !ambienceActiveRef.current) {
        // setTimeout(() => startAmbienceSound(), 100); // Disabled - now using global ambient music
      }

      // Instant welcome message on title screen
      speakRobotic('WELCOME TO SPACE BLAZERS');
    } else {
      // Clear speech queue when leaving start screen
      speechQueueRef.current = [];
      isSpeakingRef.current = false;
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
        speechTimeoutRef.current = null;
      }
    }
  }, [gameState.showStartScreen, speakRobotic, startAmbienceSound]);

  // Auto-start ambient sounds when audio context is ready and game is active
  useEffect(() => {

    // Ambient music now handled globally - no need to start here
    // if (audioContextRef.current && audioContextRef.current.state === 'running' &&
    //     !ambienceActiveRef.current) {
    //   setTimeout(() => // startAmbienceSound() // Disabled - now using global ambient music, 200); // Much shorter delay for better reliability
    // }
  }, [gameState.gameMode, startAmbienceSound, stopAmbienceSound]);

  // Cleanup ambient sounds on unmount
  useEffect(() => {
    return () => {
      // Don't stop ambient music - it's now handled globally
      // stopAmbienceSound();
    };
  }, [stopAmbienceSound]);

  // Connect WebSocket when entering multiplayer mode
  useEffect(() => {
    if (gameState.gameMode === 'multiplayer' && !multiplayerState.isConnected && connectionStatus === 'idle') {
      connectWebSocket();
    }

    // Only clean up on component unmount, not on every dependency change
    // This prevents the WebSocket from being closed immediately after opening
  }, [gameState.gameMode, multiplayerState.isConnected, connectionStatus]);

  // Separate cleanup effect that only runs on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Delay cleanup to avoid React development mode double-mounting issues
      setTimeout(() => {
        if (!isMountedRef.current && wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
          wsRef.current.close();
        }
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
      }, 100);
    };
  }, []); // Empty dependency array = only on mount/unmount

  const [keys, setKeys] = useState({
    w: false,
    s: false,
    up: false,
    down: false,
    a: false,
    d: false,
    left: false,
    right: false,
  });

  // Mouse and touch control state
  const [mouseY, setMouseY] = useState<number | null>(null);
  const [mouseX, setMouseX] = useState<number | null>(null);
  const [touchY, setTouchY] = useState<number | null>(null);
  const [controlSide, setControlSide] = useState<'left' | 'right' | 'top' | 'bottom' | null>(null);
  const [cursorHidden, setCursorHidden] = useState(false);

  const [infoTextFadeStart, setInfoTextFadeStart] = useState<number | null>(null);

  // Track previous countdown values for robot voice announcements
  const [previousCountdowns, setPreviousCountdowns] = useState<{[effectType: string]: number}>({});
  // Track when pickup announcements were made to delay countdown
  const [pickupAnnouncementTimes, setPickupAnnouncementTimes] = useState<{[effectType: string]: number}>({});
  // Track which countdown numbers have been announced to ensure none are missed
  const [announcedCountdowns, setAnnouncedCountdowns] = useState<{[effectType: string]: Set<number>}>({});

  const leftFrameCountRef = useRef<number>(0);
  const rightFrameCountRef = useRef<number>(0);
  const topFrameCountRef = useRef<number>(0);
  const bottomFrameCountRef = useRef<number>(0);

  // Pickup system functions
  const createPickup = useCallback(() => {
    const pickupType = PICKUP_TYPES[Math.floor(Math.random() * PICKUP_TYPES.length)];
    // Stay well away from paddle zones and edges
    const horizontalPadding = 150; // Keep away from left/right paddles
    const verticalPadding = 120;   // Keep away from top/bottom paddles
    return {
      x: horizontalPadding + Math.random() * (canvasSize.width - horizontalPadding * 2),
      y: verticalPadding + Math.random() * (canvasSize.height - verticalPadding * 2),
      size: 144, // Much bigger to accommodate 12x12 pixel size (12x12 grid)
      type: pickupType.type,
      pattern: pickupType.pattern,
      color: pickupType.color,
      description: pickupType.description,
      spawnTime: Date.now(),
    };
  }, [canvasSize]);

  const applyPickupEffect = useCallback((pickup: Pickup, gameState: GameState) => {
    const effect: ActiveEffect = {
      type: pickup.type,
      startTime: Date.now(),
      duration: 8000, // 8 seconds for most effects
    };

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
        gameState.ball.size = 24;
        break;
      case 'small_ball':
        effect.originalValue = gameState.ball.size;
        gameState.ball.size = 6;
        break;
      case 'drunk_ball':
        gameState.ball.isDrunk = true;
        gameState.ball.drunkAngle = 0;
        effect.duration = 4000; // 4 seconds - halved duration
        break;
      case 'grow_paddle':
        const targetSide = Math.random() > 0.5 ? 'left' : 'right';
        effect.side = targetSide;
        effect.originalValue = gameState.paddles[targetSide].height;
        gameState.paddles[targetSide].height = Math.min(150, gameState.paddles[targetSide].height * 1.5);
        break;
      case 'shrink_paddle':
        const shrinkSide = Math.random() > 0.5 ? 'left' : 'right';
        effect.side = shrinkSide;
        effect.originalValue = gameState.paddles[shrinkSide].height;
        gameState.paddles[shrinkSide].height = Math.max(30, gameState.paddles[shrinkSide].height * 0.6);
        break;
      case 'reverse_controls':
        // This will be handled in the input logic
        break;
      case 'invisible_ball':
        // Visual effect handled in render
        effect.duration = 4000;
        break;
      case 'freeze_opponent':
        effect.side = Math.random() > 0.5 ? 'left' : 'right';
        effect.duration = 3000;
        break;
      case 'super_speed':
        gameState.ball.dx *= 2.5;
        gameState.ball.dy *= 2.5;
        effect.duration = 3000;
        break;
      case 'coin_shower':
        // Spawn 5-8 coins randomly on the playfield
        const coinCount = 5 + Math.floor(Math.random() * 4);
        for (let i = 0; i < coinCount; i++) {
          const coin: Coin = {
            x: 100 + Math.random() * (canvasSize.width - 200),
            y: 100 + Math.random() * (canvasSize.height - 200),
            size: 16,
            spawnTime: Date.now()
          };
          gameState.coins.push(coin);
        }
        effect.duration = 0; // Instant effect, no ongoing duration
        break;

      case 'teleport_ball':
        // Ball will randomly teleport during the effect duration
        gameState.ball.isTeleporting = true;
        gameState.ball.lastTeleportTime = Date.now();
        effect.duration = 6000; // 6 seconds of teleporting
        break;
      case 'multi_ball':
        // Spawn 2 extra balls with random directions for 10 seconds
        for (let i = 0; i < 2; i++) {
          const angle = (Math.random() * 2 * Math.PI);
          const speed = BALL_SPEED * (0.8 + Math.random() * 0.4); // Slightly varied speed
          const extraBall = {
            x: gameState.ball.x + (Math.random() - 0.5) * 50, // Spawn near main ball
            y: gameState.ball.y + (Math.random() - 0.5) * 50,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            size: 10, // Slightly smaller than main ball
            originalSize: 10,
            isDrunk: false,
            drunkAngle: 0,
            isTeleporting: false,
            lastTeleportTime: 0,
            stuckCheckStartTime: 0,
            stuckCheckStartX: 0,
            lastTouchedBy: null,
            previousTouchedBy: null,
            id: `extra_${Date.now()}_${i}`, // Unique ID for each extra ball
          };
          gameState.extraBalls.push(extraBall);
        }
        effect.duration = 10000; // 10 seconds of multi-ball chaos
        break;
    }

    gameState.activeEffects.push(effect);

    // Trigger pickup visual effect
    gameState.pickupEffect = {
      isActive: true,
      startTime: Date.now(),
      x: pickup.x,
      y: pickup.y,
    };

    // Play pickup sound with musical approach
    const pickupData = PICKUP_TYPES.find(p => p.type === pickup.type);
    if (pickupData) {
      playMelodyNote('pickup', pickupData, 'both');
    }
  }, [playBeep]);

  const updateEffects = useCallback((gameState: GameState) => {
    const now = Date.now();
    gameState.activeEffects = (gameState.activeEffects || []).filter(effect => {
      if (now - effect.startTime >= effect.duration) {
        // Remove effect and restore original values
        switch (effect.type) {
          case 'big_ball':
          case 'small_ball':
            gameState.ball.size = effect.originalValue || gameState.ball.originalSize;
            break;
          case 'drunk_ball':
            gameState.ball.isDrunk = false;
            gameState.ball.drunkAngle = 0;
            break;
          case 'teleport_ball':
            gameState.ball.isTeleporting = false;
            break;
          case 'grow_paddle':
          case 'shrink_paddle':
            if (effect.side && effect.originalValue) {
              gameState.paddles[effect.side].height = effect.originalValue;
            }
            break;
          case 'multi_ball':
            gameState.extraBalls = [];
            break;
        }
        return false; // Remove effect
      }
      return true; // Keep effect
    });

    // Update pickup effect
    if (gameState.pickupEffect.isActive) {
      if (now - gameState.pickupEffect.startTime >= 1000) { // 1 second duration
        gameState.pickupEffect.isActive = false;
      }
    }
  }, []);

  // Clear all pickup effects immediately (used when scoring)
  const clearAllPickupEffects = useCallback((gameState: GameState) => {
    gameState.activeEffects.forEach(effect => {
      // Restore original values immediately
      switch (effect.type) {
        case 'big_ball':
        case 'small_ball':
          gameState.ball.size = effect.originalValue || gameState.ball.originalSize;
          break;
        case 'drunk_ball':
          gameState.ball.isDrunk = false;
          gameState.ball.drunkAngle = 0;
          break;
        case 'teleport_ball':
          gameState.ball.isTeleporting = false;
          break;
        case 'grow_paddle':
        case 'shrink_paddle':
          if (effect.side && effect.originalValue) {
            gameState.paddles[effect.side].height = effect.originalValue;
          }
          break;
      }
    });
    // Clear all active effects
    gameState.activeEffects = [];
  }, []);

  // Keep function refs updated for performance optimization
  useEffect(() => {
    playMelodyNoteRef.current = playMelodyNote;
    updateGameStateRef.current = updateGameState;
    updatePaddlePositionRef.current = updatePaddlePosition;
    createPickupRef.current = createPickup;
    applyPickupEffectRef.current = applyPickupEffect;
    updateEffectsRef.current = updateEffects;
    initializeAudioRef.current = initializeAudio;
    speakRoboticRef.current = speakRobotic;
    predictGameStateRef.current = predictGameState;
    interpolateGameStateRef.current = interpolateGameState;
    attemptRobotTauntRef.current = attemptRobotTaunt;
    checkRandomTauntRef.current = checkRandomTaunt;
    multiplayerStateRef.current = multiplayerState;
  }, [playMelodyNote, updateGameState, updatePaddlePosition, createPickup, applyPickupEffect, updateEffects, initializeAudio, speakRobotic, predictGameState, interpolateGameState, attemptRobotTaunt, checkRandomTaunt, multiplayerState]);

  // Game logic
  const updateGame = useCallback(() => {
    setGameState(prevState => {
      let newState = { ...prevState };
      const now = Date.now();

      // 🕒 Frame-rate independent physics multiplier
      const deltaTimeMultiplier = deltaTimeRef.current / targetFrameTime;

      // Server-side physics mode will be added in future update

      // Apply client-side prediction and interpolation for multiplayer non-gamemaster clients
      if (multiplayerStateRef.current?.gameMode === 'multiplayer' &&
          !multiplayerStateRef.current?.isGameMaster &&
          networkGameStateRef.current &&
          lastNetworkReceiveTimeRef.current > 0) {

        const timeSinceNetworkUpdate = now - lastNetworkReceiveTimeRef.current;

        // Predict where the game state should be now based on network data
        const predictedState = predictGameStateRef.current?.(networkGameStateRef.current, timeSinceNetworkUpdate);

        // Interpolate smoothly towards the predicted state (but preserve local paddle control)
        const interpolationFactor = Math.min(timeSinceNetworkUpdate / NETWORK_UPDATE_RATE, 1.0);
        const interpolatedState = interpolateGameStateRef.current?.(prevState, predictedState, interpolationFactor * 0.7); // Stronger interpolation for smoothness

        // CRITICAL FIX: Use interpolated state if available, otherwise use network state directly
        if (interpolatedState) {
          // Use interpolated state as base, but preserve local paddle control
          newState = {
            ...interpolatedState,
            // FORCE AUTHORITATIVE NETWORK STATE for critical game elements
            score: networkGameStateRef.current.score, // Always use server scores
            ball: networkGameStateRef.current.ball,   // Always use server ball state
            paddles: {
              ...interpolatedState.paddles,
              // Keep local control of player's paddle
              [multiplayerState.playerSide]: prevState.paddles[multiplayerState.playerSide as keyof typeof prevState.paddles]
            }
          };
        } else {
          // Fallback: Use network state directly if interpolation fails
          newState = {
            ...networkGameStateRef.current,
            paddles: {
              ...networkGameStateRef.current.paddles,
              // Keep local control of player's paddle
              [multiplayerState.playerSide]: prevState.paddles[multiplayerState.playerSide as keyof typeof prevState.paddles]
            }
          };
        }

        // Store predicted state for next frame
        predictedGameStateRef.current = predictedState;
      }

      // Ensure trails object exists to prevent crashes
      if (!newState.trails) {
        newState.trails = {
          ball: [],
          leftPaddle: [],
          rightPaddle: [],
          topPaddle: [],
          bottomPaddle: []
        };
      }

      // Ensure all trail arrays exist
      if (!newState.trails.ball) newState.trails.ball = [];
      if (!newState.trails.leftPaddle) newState.trails.leftPaddle = [];
      if (!newState.trails.rightPaddle) newState.trails.rightPaddle = [];
      if (!newState.trails.topPaddle) newState.trails.topPaddle = [];
      if (!newState.trails.bottomPaddle) newState.trails.bottomPaddle = [];

      // Occasional random robot taunts during active gameplay
      if (newState.isPlaying && !newState.isPaused && !newState.gameEnded) {
        checkRandomTauntRef.current?.();
      }

      // Ensure other arrays exist
      if (!newState.pickups) newState.pickups = [];
      if (!newState.coins) newState.coins = [];
      if (!newState.activeEffects) newState.activeEffects = [];

      // Ensure effect objects exist
      if (!newState.pickupEffect) {
        newState.pickupEffect = { isActive: false, startTime: 0, x: 0, y: 0 };
      }
      if (!newState.rumbleEffect) {
        newState.rumbleEffect = { isActive: false, startTime: 0, intensity: 0 };
      }
      if (!newState.decrunchEffect) {
        newState.decrunchEffect = { isActive: false, startTime: 0, duration: 0 };
      }

      // Debug: Check if paddles are being lost in the game loop
      if (!newState.paddles.top || !newState.paddles.bottom) {
        // Paddles lost in game loop - debugging
      }



      // Check rumble effect timeout (should work even when paused)
      if (newState.rumbleEffect && newState.rumbleEffect.isActive) {
        const currentTime = Date.now();
        const elapsed = currentTime - newState.rumbleEffect.startTime;

        // Longer duration for score rumbles (800ms), shorter for paddle hits (300ms)
        const duration = newState.rumbleEffect.intensity > 20 ? 800 : 300;

        if (elapsed >= duration) {
          newState.rumbleEffect.isActive = false;
          newState.rumbleEffect.startTime = 0;
          newState.rumbleEffect.intensity = 0;
        }
      }

      // 🌀 PHYSICS FORCES MANAGEMENT - Random attractors and repulsors
      if (newState.isPlaying) {
        const currentTime = Date.now();

        // Ensure physics forces array exists
        if (!newState.physicsForces) {
          newState.physicsForces = [];
        }
        if (!newState.nextForceSpawnTime) {
          newState.nextForceSpawnTime = currentTime + Math.random() * 60000 + 60000;
        }

        // Spawn new physics forces randomly
        if (currentTime > newState.nextForceSpawnTime) {
          const forceType = Math.random() < 0.5 ? 'attractor' : 'repulsor';
          const margin = 100;
          const x = margin + Math.random() * (canvasSize.width - 2 * margin);
          const y = margin + Math.random() * (canvasSize.height - 2 * margin);

          const newForce: PhysicsForce = {
            id: `force_${currentTime}_${Math.random()}`,
            x,
            y,
            type: forceType,
            strength: 80 + Math.random() * 60, // 80-140 strength
            radius: 60 + Math.random() * 40, // 60-100 radius
            spawnTime: currentTime,
            lifespan: 8000 + Math.random() * 7000, // 8-15 seconds
            animationPhase: 0,
            pulseSpeed: 0.05 + Math.random() * 0.03, // 0.05-0.08 speed
            color: forceType === 'attractor' ? '#00ffff' : '#ff0066',
            hasPlayedSound: false
          };

          newState.physicsForces.push(newForce);
          newState.nextForceSpawnTime = currentTime + Math.random() * 60000 + 60000; // 60-120 seconds (1-2 minutes)
        }

        // Update existing physics forces
        newState.physicsForces = newState.physicsForces.filter(force => {
          const age = currentTime - force.spawnTime;

          // Remove expired forces
          if (age > force.lifespan) {
            return false;
          }

          // Update animation phase
          force.animationPhase += force.pulseSpeed;

          // Play spawn sound effect if not played yet
          if (!force.hasPlayedSound && age > 100) {
            force.hasPlayedSound = true;
            // Play sound effect using existing audio system
            if (playMelodyNoteRef.current) {
              const frequency = force.type === 'attractor' ? 800 : 400;
              playMelodyNoteRef.current(frequency, 0.3, 'sine', 150);
            }
          }

          return true;
        });
      }

      // Check if we're in a pause state
      if (newState.isPaused) {
        const currentTime = Date.now();
        if (currentTime >= newState.pauseEndTime) {
          // End pause and resume game
          newState.isPaused = false;
          newState.pauseEndTime = 0;

          // Restart ball movement if it's not moving (fix ball respawn issue)
          if (Math.abs(newState.ball.dx) < 0.1 && Math.abs(newState.ball.dy) < 0.1) {
            newState.ball.dx = Math.random() > 0.5 ? BALL_SPEED : -BALL_SPEED;
            newState.ball.dy = (Math.random() - 0.5) * BALL_SPEED * 0.8; // Random vertical component
            console.log('🏓 Ball movement restarted after pause:', { dx: newState.ball.dx, dy: newState.ball.dy });
          }
        } else {
          // Still paused - allow paddle movement but skip ball logic
          // Don't return early, just skip ball/collision logic later
        }
      }

      // SIMPLIFIED: Always allow paddle control regardless of mode
      // Auto-switch to player vs AI mode when any input is detected (if not in multiplayer)
      const hasInput = keys.w || keys.s || keys.up || keys.down || keys.a || keys.d || keys.left || keys.right || mouseY !== null || touchY !== null;

      if (newState.gameMode === 'auto' && hasInput) {
        newState.gameMode = 'player';
      }

      // SIMPLIFIED: Always allow paddle movement in any mode
      // Update paddle positions with cleaner logic (keyboard, mouse, or touch)
      if (newState.gameMode === 'player' || (hasInput && newState.gameMode !== 'multiplayer')) {
        // PLAYER MODE: Left=AI, Right=Human, Top=AI, Bottom=AI

        // In player mode, left paddle is AI-controlled - no manual input allowed
        // (AI logic handles the left paddle automatically)

        // Handle right paddle controls (keyboard, mouse, touch) - PLAYER CONTROLS
        if (controlSide === 'right' && (mouseY !== null || touchY !== null)) {
          // Mouse/touch control for right paddle (player)
          const targetY = (touchY !== null ? touchY : mouseY!) - newState.paddles.right.height / 2;
          const clampedY = Math.max(0, Math.min(canvasSize.height - newState.paddles.right.height, targetY));

          // Calculate velocity based on movement delta for trail effects
          const deltaY = clampedY - newState.paddles.right.y;
          newState.paddles.right.velocity = deltaY;

          newState.paddles.right.y = clampedY;

          // Add trail for mouse/touch controlled right paddle movement
          if (Math.abs(newState.paddles.right.velocity) > 0.01) {
            const now = Date.now();
            // Ensure trails object exists
            if (!newState.trails) {
              newState.trails = {
                ball: [],
                leftPaddle: [],
                rightPaddle: [],
                topPaddle: [],
                bottomPaddle: []
              };
            }
            // Ensure rightPaddle array exists
            if (!newState.trails.rightPaddle) {
              newState.trails.rightPaddle = [];
            }
            newState.trails.rightPaddle.push({
              x: canvasSize.width - 12 - newState.paddles.right.width / 2,
              y: newState.paddles.right.y + newState.paddles.right.height / 2,
              width: newState.paddles.right.width,
              height: newState.paddles.right.height,
              timestamp: now
            });
          }
        }

        // Arrow key controls (can work alongside mouse)
        const now = Date.now();
        if (keys.up) {
          // UP arrow moves UP (decrease Y) - with acceleration
          newState.paddles.right.velocity -= 1.2; // Reduced acceleration
          newState.paddles.right.velocity = Math.max(-newState.paddles.right.speed * 1.5, newState.paddles.right.velocity);
          newState.paddles.right.y += newState.paddles.right.velocity;

          // Add trail for right paddle movement
          if (Math.abs(newState.paddles.right.velocity) > 0.01) {
            newState.trails.rightPaddle.push({
              x: canvasSize.width - 12 - newState.paddles.right.width / 2,
              y: newState.paddles.right.y + newState.paddles.right.height / 2,
              width: newState.paddles.right.width,
              height: newState.paddles.right.height,
              timestamp: now
            });
          }
        }
        if (keys.down) {
          // DOWN arrow moves DOWN (increase Y) - with acceleration
          newState.paddles.right.velocity += 1.2; // Reduced acceleration
          newState.paddles.right.velocity = Math.min(newState.paddles.right.speed * 1.5, newState.paddles.right.velocity);
          newState.paddles.right.y += newState.paddles.right.velocity;

          // Add trail for right paddle movement
          if (Math.abs(newState.paddles.right.velocity) > 0.01) {
            newState.trails.rightPaddle.push({
              x: canvasSize.width - 12 - newState.paddles.right.width / 2,
              y: newState.paddles.right.y + newState.paddles.right.height / 2,
              width: newState.paddles.right.width,
              height: newState.paddles.right.height,
              timestamp: now
            });
          }
        }
        if (!keys.up && !keys.down) {
          // No arrow key input - apply friction to slow down
          newState.paddles.right.velocity *= 0.8; // Friction
          if (Math.abs(newState.paddles.right.velocity) < 0.1) {
            newState.paddles.right.velocity = 0; // Stop when very slow
          }
          newState.paddles.right.y += newState.paddles.right.velocity;
        }

        // Clamp right paddle position
        newState.paddles.right.y = Math.max(0, Math.min(canvasSize.height - newState.paddles.right.height, newState.paddles.right.y));

        // In player mode, make the left paddle AI-controlled (always, since player controls right)
        if (newState.gameMode === 'player') {
          const now = Date.now();
          leftFrameCountRef.current++;
          const ballCenterY = newState.ball.y + newState.ball.size / 2;

          // Use the same spinner AI as auto mode for consistency
          const updatePaddleWithSpinner = (paddle: any, isLeft: boolean, frameCount: number) => {
            // Different reaction delays for each paddle to make them feel like different humans
            const reactionDelay = isLeft ? HUMAN_REACTION_DELAY : HUMAN_REACTION_DELAY + 3;

            // Add reaction delay - only update target every few frames
            if (frameCount % reactionDelay === 0) {
              // Different inaccuracy levels for each paddle
              const baseInaccuracy = isLeft ? 12 : 18; // Left player slightly more accurate
              const inaccuracy = (Math.random() - 0.5) * baseInaccuracy;

              // Add prediction error - sometimes aim where ball was, not where it's going
              const predictionError = Math.random() < 0.3 ? (Math.random() - 0.5) * 30 : 0;

              const targetY = Math.max(
                paddle.height / 2,
                Math.min(
                  canvasSize.height - paddle.height / 2,
                  ballCenterY - paddle.height / 2 + inaccuracy + predictionError
                )
              );

              paddle.targetY = targetY;
            }

            const distance = paddle.targetY - paddle.y;
            const direction = Math.sign(distance);

            // Check for panic moves - sudden fast movements when ball is close or moving fast
            const ballDistance = Math.abs(newState.ball.x - (isLeft ? 0 : canvasSize.width));
            const ballSpeed = Math.abs(newState.ball.dx);
            const isPanicSituation = ballDistance < 300; // Much more lenient distance
            const currentPaddleCenter = paddle.y + paddle.height / 2;
            const ballPaddleDistance = Math.abs(ballCenterY - currentPaddleCenter);

            // Check if ball is heading towards this paddle
            const ballHeadingTowardsPaddle = isLeft ? newState.ball.dx < 0 : newState.ball.dx > 0;

            // Emergency panic mode - NEVER MISS THE BALL
            const isEmergencyPanic = ballHeadingTowardsPaddle && ballDistance < 150 && ballPaddleDistance > 30;

            // Much more frequent panic moves - any time ball is coming and paddle isn't perfectly positioned
            const panicChance = isPanicSituation ? 0.15 : 0.08; // Higher panic chance when ball is close
            const isPanicMove = Math.random() < panicChance;
            const isExtremePanicMove = Math.random() < 0.05; // 5% chance for extreme panic

            if (isEmergencyPanic || isExtremePanicMove) {
              // Emergency panic or extreme panic - JUMP TO BALL IMMEDIATELY
              const extremePanicDirection = Math.sign(ballCenterY - currentPaddleCenter);
              const panicMultiplier = isEmergencyPanic ? EXTREME_PANIC_MULTIPLIER * 1.5 : EXTREME_PANIC_MULTIPLIER * 2;

              // Completely replace velocity with extreme movement - MUCH FASTER
              paddle.velocity = extremePanicDirection * paddle.speed * panicMultiplier;
              // Add violent jitter to simulate frantic spinning
              paddle.velocity += (Math.random() - 0.5) * 15;
              // Override friction temporarily for this extreme move
              return; // Skip normal physics for this frame
            } else if (isPanicMove && ballHeadingTowardsPaddle) {
              // Regular panic move - faster movement toward ball
              paddle.velocity += direction * PADDLE_ACCELERATION * 5.0; // Much higher acceleration
            } else if (Math.abs(distance) > 25) {
              // Normal movement for far distances
              paddle.velocity += direction * PADDLE_ACCELERATION * 2.0;
            } else if (Math.abs(distance) > 8) {
              // Fine adjustment for close distances
              paddle.velocity += direction * PADDLE_ACCELERATION * 1.0;
            } else {
              // Very close to target - slow down
              paddle.velocity *= 0.7;
            }

            // Different friction rates for each paddle
            const friction = isLeft ? PADDLE_FRICTION : PADDLE_FRICTION * 0.95;
            paddle.velocity *= friction;

            // Slightly different max speeds for each paddle
            const maxSpeed = isLeft ? paddle.speed : paddle.speed * 0.9;
            paddle.velocity = Math.max(-maxSpeed, Math.min(maxSpeed, paddle.velocity));

            // Update position
            paddle.y += paddle.velocity;

            // Keep paddle within bounds
            paddle.y = Math.max(0, Math.min(canvasSize.height - paddle.height, paddle.y));
          };

          updatePaddleWithSpinner(newState.paddles.left, true, leftFrameCountRef.current);

          // Add trail tracking for left paddle AI movement
          if (Math.abs(newState.paddles.left.velocity) > 0.01) {
            // Ensure trails object exists
            if (!newState.trails) {
              newState.trails = {
                ball: [],
                leftPaddle: [],
                rightPaddle: [],
                topPaddle: [],
                bottomPaddle: []
              };
            }
            // Ensure leftPaddle array exists
            if (!newState.trails.leftPaddle) {
              newState.trails.leftPaddle = [];
            }
            newState.trails.leftPaddle.push({
              x: 12 + newState.paddles.left.width / 2, // Paddle center X
              y: newState.paddles.left.y + newState.paddles.left.height / 2,
              timestamp: now,
              width: newState.paddles.left.width,
              height: newState.paddles.left.height
            });
          }
        }

        // Always make top and bottom paddles AI-controlled when no players are assigned
        topFrameCountRef.current++;
        bottomFrameCountRef.current++;

        const ballCenterX = newState.ball.x + newState.ball.size / 2;
        const updateHorizontalPaddleWithAI = (paddle: any, frameCount: number, isTopPaddle: boolean) => {
          const reactionDelay = HUMAN_REACTION_DELAY;
          if (frameCount % reactionDelay === 0) {
            // Calculate where ball will be when it reaches paddle's Y position
            const paddleY = isTopPaddle ? 30 + paddle.height : canvasSize.height - 30 - paddle.height;
            const ballToleranceY = isTopPaddle ? 100 : -100; // Give more prediction range
            const targetY = paddleY + ballToleranceY;

            // Calculate time for ball to reach paddle Y position
            let predictedX = ballCenterX;

            if (Math.abs(newState.ball.dy) > 0.1) {
              const timeToReachPaddle = Math.abs((targetY - newState.ball.y) / newState.ball.dy);
              predictedX = newState.ball.x + (newState.ball.dx * timeToReachPaddle);

              // Account for ball bouncing off walls
              if (predictedX < 0) {
                predictedX = Math.abs(predictedX);
              } else if (predictedX > canvasSize.width) {
                predictedX = canvasSize.width - (predictedX - canvasSize.width);
              }
            }

            const inaccuracy = (Math.random() - 0.5) * 8; // Slight inaccuracy
            const predictionError = Math.random() < 0.05 ? (Math.random() - 0.5) * 15 : 0; // Rare prediction errors

            const targetX = Math.max(
              paddle.width / 2,
              Math.min(
                canvasSize.width - paddle.width / 2,
                predictedX - paddle.width / 2 + inaccuracy + predictionError
              )
            );
            paddle.targetX = targetX;
          }

          // Smart AI logic adapted for horizontal movement
          const distance = paddle.targetX - paddle.x;
          const direction = Math.sign(distance);
          const ballDistance = Math.abs(newState.ball.y - (isTopPaddle ? 0 : canvasSize.height)); // Distance from edge
          const isPanicSituation = ballDistance < 300;
          const currentPaddleCenter = paddle.x + paddle.width / 2;
          const ballPaddleDistance = Math.abs(ballCenterX - currentPaddleCenter);
          const ballHeadingTowardsPaddle = isTopPaddle ? newState.ball.dy < 0 : newState.ball.dy > 0; // Ball heading toward paddle
          const isEmergencyPanic = ballHeadingTowardsPaddle && ballDistance < 150 && ballPaddleDistance > 30;

          if (isEmergencyPanic) {
            const extremePanicDirection = Math.sign(ballCenterX - currentPaddleCenter);
            paddle.velocity = extremePanicDirection * paddle.speed * EXTREME_PANIC_MULTIPLIER * 2;
          } else if (Math.abs(distance) > 25) {
            paddle.velocity += direction * PADDLE_ACCELERATION * 3.0;
          } else if (Math.abs(distance) > 8) {
            paddle.velocity += direction * PADDLE_ACCELERATION * 1.2;
          } else {
            paddle.velocity *= 0.5;
          }

          paddle.velocity *= PADDLE_FRICTION * 0.95;
          const maxSpeed = paddle.speed * 0.9;
          paddle.velocity = Math.max(-maxSpeed, Math.min(maxSpeed, paddle.velocity));
          paddle.x += paddle.velocity;
          paddle.x = Math.max(0, Math.min(canvasSize.width - paddle.width, paddle.x));
        };

        if (newState.paddles.top) {
          updateHorizontalPaddleWithAI(newState.paddles.top, topFrameCountRef.current, true);

          // Add trail tracking for top paddle AI movement
          if (Math.abs(newState.paddles.top.velocity) > 0.01) {
            newState.trails.topPaddle.push({
              x: newState.paddles.top.x + newState.paddles.top.width / 2,
              y: 30 + newState.paddles.top.height / 2, // 30px spacing from top wall
              timestamp: now,
              width: newState.paddles.top.width,
              height: newState.paddles.top.height
            });
          }
        }
        if (newState.paddles.bottom) {
          updateHorizontalPaddleWithAI(newState.paddles.bottom, bottomFrameCountRef.current, false);

          // Add trail tracking for bottom paddle AI movement
          if (Math.abs(newState.paddles.bottom.velocity) > 0.01) {
            newState.trails.bottomPaddle.push({
              x: newState.paddles.bottom.x + newState.paddles.bottom.width / 2,
              y: canvasSize.height - 30 - newState.paddles.bottom.height / 2, // 30px spacing from bottom wall
              timestamp: now,
              width: newState.paddles.bottom.width,
              height: newState.paddles.bottom.height
            });
          }
        }
      } else if (newState.gameMode === 'multiplayer') {
        // MULTIPLAYER MODE: Dynamic assignment based on player connections

        // Multiplayer mode active
        // Multiplayer controls (only the paddle assigned to this player, unless in local test mode)
        if (multiplayerStateRef.current?.playerSide === 'left' || localTestMode) {
          const oldY = newState.paddles.left.y;

          // Handle mouse control for left paddle (always enabled)
          if (mouseY !== null) {
            const targetY = mouseY - newState.paddles.left.height / 2;
            const clampedY = Math.max(0, Math.min(canvasSize.height - newState.paddles.left.height,targetY));
            newState.paddles.left.velocity = clampedY - newState.paddles.left.y;
            newState.paddles.left.y = clampedY;
          }
          // Left paddle - W/S keys (W = UP, S = DOWN) - with acceleration
          // Allow simultaneous keyboard input regardless of mouse state
          if (keys.w) {
            // W key moves UP (decrease Y) - with acceleration
            newState.paddles.left.velocity -= 1.2; // Reduced acceleration
            newState.paddles.left.velocity = Math.max(-newState.paddles.left.speed * 1.5, newState.paddles.left.velocity);
            newState.paddles.left.y += newState.paddles.left.velocity;
          } else if (keys.s) {
            // S key moves DOWN (increase Y) - with acceleration
            newState.paddles.left.velocity += 1.2; // Reduced acceleration
            newState.paddles.left.velocity = Math.min(newState.paddles.left.speed * 1.5, newState.paddles.left.velocity);
            newState.paddles.left.y += newState.paddles.left.velocity;
          } else if (!(controlSide === 'left' && mouseY !== null)) {
            // Only apply friction if neither keyboard nor mouse is active
            newState.paddles.left.velocity *= 0.8; // Friction
            if (Math.abs(newState.paddles.left.velocity) < 0.1) {
              newState.paddles.left.velocity = 0; // Stop when very slow
            }
            newState.paddles.left.y += newState.paddles.left.velocity;
          }

          // Clamp left paddle position
          newState.paddles.left.y = Math.max(0, Math.min(canvasSize.height - newState.paddles.left.height,newState.paddles.left.y));

          // Add left paddle trail point
          if (Math.abs(newState.paddles.left.velocity) > 0.01) {
            newState.trails.leftPaddle.push({
              x: 12 + newState.paddles.left.width / 2, // Paddle center X
              y: newState.paddles.left.y + newState.paddles.left.height / 2,
              width: newState.paddles.left.width,
              height: newState.paddles.left.height,
              timestamp: now
            });
          }

          if (Math.abs(newState.paddles.left.y - oldY) > 0.5 && !localTestMode) {
            updatePaddlePosition(newState.paddles.left.y, newState.paddles.left.velocity, newState.paddles.left.y);
          }
        }
        if (multiplayerStateRef.current?.playerSide === 'right' || localTestMode) {
          const oldY = newState.paddles.right.y;

          // Handle mouse control for right paddle (always enabled)
          if (mouseY !== null) {
            const targetY = mouseY - newState.paddles.right.height / 2;
            const clampedY = Math.max(0, Math.min(canvasSize.height - newState.paddles.right.height, targetY));
            newState.paddles.right.velocity = clampedY - newState.paddles.right.y;
            newState.paddles.right.y = clampedY;
          }
          // Right paddle - Arrow keys (UP = UP, DOWN = DOWN) - with acceleration
          // Allow simultaneous keyboard input regardless of mouse state
          if (keys.up) {
            // UP arrow moves UP (decrease Y) - with acceleration
            newState.paddles.right.velocity -= 1.2; // Reduced acceleration
            newState.paddles.right.velocity = Math.max(-newState.paddles.right.speed * 1.5, newState.paddles.right.velocity);
            newState.paddles.right.y += newState.paddles.right.velocity;
          } else if (keys.down) {
            // DOWN arrow moves DOWN (increase Y) - with acceleration
            newState.paddles.right.velocity += 1.2; // Reduced acceleration
            newState.paddles.right.velocity = Math.min(newState.paddles.right.speed * 1.5, newState.paddles.right.velocity);
            newState.paddles.right.y += newState.paddles.right.velocity;
          } else if (!(controlSide === 'right' && mouseY !== null)) {
            // Only apply friction if neither keyboard nor mouse is active
            newState.paddles.right.velocity *= 0.8; // Friction
            if (Math.abs(newState.paddles.right.velocity) < 0.1) {
              newState.paddles.right.velocity = 0; // Stop when very slow
            }
            newState.paddles.right.y += newState.paddles.right.velocity;
          }

          // Clamp right paddle position
          newState.paddles.right.y = Math.max(0, Math.min(canvasSize.height - newState.paddles.right.height, newState.paddles.right.y));

          // Add right paddle trail point
          if (Math.abs(newState.paddles.right.velocity) > 0.01) {
            newState.trails.rightPaddle.push({
              x: canvasSize.width - 12 - newState.paddles.right.width / 2, // Paddle center X
              y: newState.paddles.right.y + newState.paddles.right.height / 2,
              width: newState.paddles.right.width,
              height: newState.paddles.right.height,
              timestamp: now
            });
          }

          if (Math.abs(newState.paddles.right.y - oldY) > 0.5 && !localTestMode) {
            updatePaddlePositionRef.current?.(newState.paddles.right.y, newState.paddles.right.velocity, newState.paddles.right.y);
          }
        }

        // Top paddle controls - A/D keys (A = LEFT, D = RIGHT)
        if ((multiplayerStateRef.current?.playerSide === 'top' || localTestMode) && newState.paddles.top) {
          const oldX = newState.paddles.top.x;

          // Handle mouse control for top paddle (always enabled)
          if (mouseX !== null) {
            const targetX = mouseX - newState.paddles.top.width / 2;
            const clampedX = Math.max(0, Math.min(canvasSize.width - newState.paddles.top.width, targetX));
            newState.paddles.top.velocity = clampedX - newState.paddles.top.x;
            newState.paddles.top.x = clampedX;
          }
          // Top paddle - A/D keys (A = LEFT, D = RIGHT) - with acceleration
          // Allow simultaneous keyboard input regardless of mouse state
          if (keys.a) {
            // A key moves LEFT (decrease X) - with acceleration
            newState.paddles.top.velocity -= 1.2; // Reduced acceleration
            newState.paddles.top.velocity = Math.max(-newState.paddles.top.speed * 1.5, newState.paddles.top.velocity);
            newState.paddles.top.x += newState.paddles.top.velocity;
          } else if (keys.d) {
            // D key moves RIGHT (increase X) - with acceleration
            newState.paddles.top.velocity += 1.2; // Reduced acceleration
            newState.paddles.top.velocity = Math.min(newState.paddles.top.speed * 1.5, newState.paddles.top.velocity);
            newState.paddles.top.x += newState.paddles.top.velocity;
          } else if (!(controlSide === 'top' && mouseX !== null)) {
            // Only apply friction if neither keyboard nor mouse is active
            newState.paddles.top.velocity *= 0.8; // Friction
            if (Math.abs(newState.paddles.top.velocity) < 0.1) {
              newState.paddles.top.velocity = 0; // Stop when very slow
            }
            newState.paddles.top.x += newState.paddles.top.velocity;
          }

          // Clamp top paddle position
          newState.paddles.top.x = Math.max(0, Math.min(canvasSize.width - newState.paddles.top.width, newState.paddles.top.x));

          // Add top paddle trail point
          const now = Date.now();
          if (Math.abs(newState.paddles.top.velocity) > 0.01) {
            newState.trails.topPaddle.push({
              x: newState.paddles.top.x + newState.paddles.top.width / 2,
              y: 30 + newState.paddles.top.height / 2, // 30px spacing from top wall
              width: newState.paddles.top.width,
              height: newState.paddles.top.height,
              timestamp: now
            });
          }

          if (Math.abs(newState.paddles.top.x - oldX) > 0.5 && !localTestMode) {
            // TODO: Add updatePaddlePosition for top paddle when WebSocket server supports it
          }
        }

        // Bottom paddle controls - Left/Right arrow keys
        if ((multiplayerStateRef.current?.playerSide === 'bottom' || localTestMode) && newState.paddles.bottom) {
          const oldX = newState.paddles.bottom.x;

          // Handle mouse control for bottom paddle (always enabled)
          if (mouseX !== null) {
            const targetX = mouseX - newState.paddles.bottom.width / 2;
            const clampedX = Math.max(0, Math.min(canvasSize.width - newState.paddles.bottom.width, targetX));
            newState.paddles.bottom.velocity = clampedX - newState.paddles.bottom.x;
            newState.paddles.bottom.x = clampedX;
          }
          // Bottom paddle - Left/Right arrow keys - with acceleration
          // Allow simultaneous keyboard input regardless of mouse state
          if (keys.left) {
            // Left arrow moves LEFT (decrease X) - with acceleration
            newState.paddles.bottom.velocity -= 1.2; // Reduced acceleration
            newState.paddles.bottom.velocity = Math.max(-newState.paddles.bottom.speed * 1.5, newState.paddles.bottom.velocity);
            newState.paddles.bottom.x += newState.paddles.bottom.velocity;
          } else if (keys.right) {
            // Right arrow moves RIGHT (increase X) - with acceleration
            newState.paddles.bottom.velocity += 1.2; // Reduced acceleration
            newState.paddles.bottom.velocity = Math.min(newState.paddles.bottom.speed * 1.5, newState.paddles.bottom.velocity);
            newState.paddles.bottom.x += newState.paddles.bottom.velocity;
          } else if (!(controlSide === 'bottom' && mouseX !== null)) {
            // Only apply friction if neither keyboard nor mouse is active
            newState.paddles.bottom.velocity *= 0.8; // Friction
            if (Math.abs(newState.paddles.bottom.velocity) < 0.1) {
              newState.paddles.bottom.velocity = 0; // Stop when very slow
            }
            newState.paddles.bottom.x += newState.paddles.bottom.velocity;
          }

          // Clamp bottom paddle position
          newState.paddles.bottom.x = Math.max(0, Math.min(canvasSize.width - newState.paddles.bottom.width, newState.paddles.bottom.x));

          // Add bottom paddle trail point
          const now = Date.now();
          if (Math.abs(newState.paddles.bottom.velocity) > 0.01) {
            newState.trails.bottomPaddle.push({
              x: newState.paddles.bottom.x + newState.paddles.bottom.width / 2,
              y: canvasSize.height - 30 - newState.paddles.bottom.height / 2, // 30px spacing from bottom wall
              width: newState.paddles.bottom.width,
              height: newState.paddles.bottom.height,
              timestamp: now
            });
          }

          if (Math.abs(newState.paddles.bottom.x - oldX) > 0.5 && !localTestMode) {
            // TODO: Add updatePaddlePosition for bottom paddle when WebSocket server supports it
          }
        }

        // AI CONTROL FOR NON-HUMAN PADDLES IN MULTIPLAYER
        const currentPlayerSide = multiplayerStateRef.current?.playerSide;

        // If player controls right paddle, make left paddle AI-controlled
        if (currentPlayerSide === 'right' && !localTestMode) {
          const now = Date.now();
          leftFrameCountRef.current++;

          // Use AI logic for left paddle
          const ballCenterY = newState.ball.y + newState.ball.size / 2;
          const paddle = newState.paddles.left;
          const reactionDelay = HUMAN_REACTION_DELAY;

          if (leftFrameCountRef.current % reactionDelay === 0) {
            const inaccuracy = (Math.random() - 0.5) * 12;
            const targetY = Math.max(
              paddle.height / 2,
              Math.min(
                canvasSize.height - paddle.height / 2,
                ballCenterY - paddle.height / 2 + inaccuracy
              )
            );
            paddle.targetY = targetY;
          }

          // Move towards target
          const distance = paddle.targetY - paddle.y;
          if (Math.abs(distance) > 2) {
            const moveSpeed = Math.min(Math.abs(distance) * 0.15, paddle.speed);
            paddle.velocity = distance > 0 ? moveSpeed : -moveSpeed;
            paddle.y += paddle.velocity;
          } else {
            paddle.velocity *= 0.8;
            paddle.y += paddle.velocity;
          }

          // Keep within bounds
          paddle.y = Math.max(0, Math.min(canvasSize.height - paddle.height, paddle.y));

          // Add trail for AI left paddle
          if (Math.abs(newState.paddles.left.velocity) > 0.01) {
            newState.trails.leftPaddle.push({
              x: 12 + newState.paddles.left.width / 2,
              y: newState.paddles.left.y + newState.paddles.left.height / 2,
              width: newState.paddles.left.width,
              height: newState.paddles.left.height,
              timestamp: now
            });
          }
        }

        // If player controls left paddle, make right paddle AI-controlled
        if (currentPlayerSide === 'left' && !localTestMode) {
          const now = Date.now();
          rightFrameCountRef.current++;

          // Use AI logic for right paddle
          const ballCenterY = newState.ball.y + newState.ball.size / 2;
          const paddle = newState.paddles.right;
          const reactionDelay = HUMAN_REACTION_DELAY + 3;

          if (rightFrameCountRef.current % reactionDelay === 0) {
            const inaccuracy = (Math.random() - 0.5) * 18;
            const targetY = Math.max(
              paddle.height / 2,
              Math.min(
                canvasSize.height - paddle.height / 2,
                ballCenterY - paddle.height / 2 + inaccuracy
              )
            );
            paddle.targetY = targetY;
          }

          // Move towards target
          const distance = paddle.targetY - paddle.y;
          if (Math.abs(distance) > 2) {
            const moveSpeed = Math.min(Math.abs(distance) * 0.15, paddle.speed);
            paddle.velocity = distance > 0 ? moveSpeed : -moveSpeed;
            paddle.y += paddle.velocity;
          } else {
            paddle.velocity *= 0.8;
            paddle.y += paddle.velocity;
          }

          // Keep within bounds
          paddle.y = Math.max(0, Math.min(canvasSize.height - paddle.height, paddle.y));

          // Add trail for AI right paddle
          if (Math.abs(newState.paddles.right.velocity) > 0.01) {
            newState.trails.rightPaddle.push({
              x: canvasSize.width - 12 - newState.paddles.right.width / 2,
              y: newState.paddles.right.y + newState.paddles.right.height / 2,
              width: newState.paddles.right.width,
              height: newState.paddles.right.height,
              timestamp: now
            });
          }
        }

        // Add AI for top and bottom paddles when no players are assigned to them

        // AI logic for horizontal paddles (copied from auto mode)
        topFrameCountRef.current++;
        bottomFrameCountRef.current++;
        const ballCenterX = newState.ball.x + newState.ball.size / 2;

        const updateHorizontalPaddleWithAI = (paddle: any, frameCount: number, isTopPaddle: boolean) => {
          const reactionDelay = HUMAN_REACTION_DELAY;
          if (frameCount % reactionDelay === 0) {
            // Calculate where ball will be when it reaches paddle's Y position
            const paddleY = isTopPaddle ? 30 + paddle.height : canvasSize.height - 30 - paddle.height;
            const ballToleranceY = isTopPaddle ? 100 : -100; // Give more prediction range
            const targetY = paddleY + ballToleranceY;

            // Calculate time for ball to reach paddle Y position
            let predictedX = ballCenterX;

            if (Math.abs(newState.ball.dy) > 0.1) {
              const timeToReachPaddle = Math.abs((targetY - newState.ball.y) / newState.ball.dy);
              predictedX = newState.ball.x + (newState.ball.dx * timeToReachPaddle);

              // Account for ball bouncing off walls
              if (predictedX < 0) {
                predictedX = Math.abs(predictedX);
              } else if (predictedX > canvasSize.width) {
                predictedX = canvasSize.width - (predictedX - canvasSize.width);
              }
            }

            const inaccuracy = (Math.random() - 0.5) * 8; // Slight inaccuracy
            const predictionError = Math.random() < 0.05 ? (Math.random() - 0.5) * 15 : 0; // Rare prediction errors

            const targetX = Math.max(
              paddle.width / 2,
              Math.min(
                canvasSize.width - paddle.width / 2,
                predictedX - paddle.width / 2 + inaccuracy + predictionError
              )
            );
            paddle.targetX = targetX;
          }

          // Smart AI logic adapted for horizontal movement
          const distance = paddle.targetX - paddle.x;
          const direction = Math.sign(distance);
          const ballDistance = Math.abs(newState.ball.y - (isTopPaddle ? 0 : canvasSize.height)); // Distance from edge
          const isPanicSituation = ballDistance < 300;
          const currentPaddleCenter = paddle.x + paddle.width / 2;
          const ballPaddleDistance = Math.abs(ballCenterX - currentPaddleCenter);
          const ballHeadingTowardsPaddle = isTopPaddle ? newState.ball.dy < 0 : newState.ball.dy > 0; // Ball heading toward paddle
          const isEmergencyPanic = ballHeadingTowardsPaddle && ballDistance < 150 && ballPaddleDistance > 30;

          if (isEmergencyPanic) {
            const extremePanicDirection = Math.sign(ballCenterX - currentPaddleCenter);
            paddle.velocity = extremePanicDirection * paddle.speed * EXTREME_PANIC_MULTIPLIER * 2;
          } else if (Math.abs(distance) > 25) {
            paddle.velocity += direction * PADDLE_ACCELERATION * 3.0;
          } else if (Math.abs(distance) > 8) {
            paddle.velocity += direction * PADDLE_ACCELERATION * 1.2;
          } else {
            paddle.velocity *= 0.5;
          }

          paddle.velocity *= PADDLE_FRICTION * 0.95;
          const maxSpeed = paddle.speed * 0.9;
          paddle.velocity = Math.max(-maxSpeed, Math.min(maxSpeed, paddle.velocity));
          paddle.x += paddle.velocity;
          paddle.x = Math.max(0, Math.min(canvasSize.width - paddle.width, paddle.x));
        };

        // Apply AI to top paddle (only if no player is controlling it)
        if (newState.paddles.top && multiplayerState.playerSide !== 'top') {
          updateHorizontalPaddleWithAI(newState.paddles.top, topFrameCountRef.current, true);

          // Add trail tracking for top paddle AI movement
          if (Math.abs(newState.paddles.top.velocity) > 0.01) {
            newState.trails.topPaddle.push({
              x: newState.paddles.top.x + newState.paddles.top.width / 2,
              y: 30 + newState.paddles.top.height / 2, // 30px spacing from top wall
              timestamp: now,
              width: newState.paddles.top.width,
              height: newState.paddles.top.height
            });
          }
        }

        // Apply AI to bottom paddle (only if no player is controlling it)
        if (newState.paddles.bottom && multiplayerState.playerSide !== 'bottom') {
          updateHorizontalPaddleWithAI(newState.paddles.bottom, bottomFrameCountRef.current, false);

          // Add trail tracking for bottom paddle AI movement
          if (Math.abs(newState.paddles.bottom.velocity) > 0.01) {
            newState.trails.bottomPaddle.push({
              x: newState.paddles.bottom.x + newState.paddles.bottom.width / 2,
              y: canvasSize.height - 30 - newState.paddles.bottom.height / 2, // 30px spacing from bottom wall
              timestamp: now,
              width: newState.paddles.bottom.width,
              height: newState.paddles.bottom.height
            });
          }
        }

      } else {
        // AUTO MODE: All paddles AI-controlled (no human input detected)

        // Human-like spinner controls with momentum and reaction delay
        leftFrameCountRef.current++;
        rightFrameCountRef.current++;
        const ballCenterY = newState.ball.y + newState.ball.size / 2;

        // Human-like paddle movement with spinner physics - each paddle independent
        const updatePaddleWithSpinner = (paddle: any, isLeft: boolean, frameCount: number) => {
          // Different reaction delays for each paddle to make them feel like different humans
          const reactionDelay = isLeft ? HUMAN_REACTION_DELAY : HUMAN_REACTION_DELAY + 3;

          // Add reaction delay - only update target every few frames
          if (frameCount % reactionDelay === 0) {
            // Different inaccuracy levels for each paddle
            const baseInaccuracy = isLeft ? 12 : 18; // Left player slightly more accurate
            const inaccuracy = (Math.random() - 0.5) * baseInaccuracy;

            // Add prediction error - sometimes aim where ball was, not where it's going
            const predictionError = Math.random() < 0.3 ? (Math.random() - 0.5) * 30 : 0;

            const targetY = Math.max(
              paddle.height / 2,
              Math.min(
                canvasSize.height - paddle.height / 2,
                ballCenterY - paddle.height / 2 + inaccuracy + predictionError
              )
            );
            paddle.targetY = targetY;
          }

          // Calculate desired movement direction
          const distance = paddle.targetY - paddle.y;
          const direction = Math.sign(distance);

          // Check for panic moves - sudden fast movements when ball is close or moving fast
          const ballDistance = Math.abs(newState.ball.x - (isLeft ? 0 : canvasSize.width));
          const ballSpeed = Math.abs(newState.ball.dx);
          const isPanicSituation = ballDistance < 300; // Much more lenient distance
          const currentPaddleCenter = paddle.y + paddle.height / 2;
          const ballPaddleDistance = Math.abs(ballCenterY - currentPaddleCenter);

          // Check if ball is heading towards this paddle
          const ballHeadingTowardsPaddle = isLeft ? newState.ball.dx < 0 : newState.ball.dx > 0;

          // Emergency panic mode - NEVER MISS THE BALL
          const isEmergencyPanic = ballHeadingTowardsPaddle && ballDistance < 150 && ballPaddleDistance > 30;

          // Much more frequent panic moves - any time ball is coming and paddle isn't perfectly positioned
          const panicThreatLevel = isPanicSituation && ballPaddleDistance > 20; // Lower threshold
          const shouldPanic = (Math.random() < PANIC_MOVE_CHANCE && panicThreatLevel) || isEmergencyPanic;
          const shouldExtremePanic = (Math.random() < EXTREME_PANIC_CHANCE && panicThreatLevel) || isEmergencyPanic;

          // Different acceleration rates for each paddle
          let acceleration = isLeft ? PADDLE_ACCELERATION : PADDLE_ACCELERATION * 0.85;

          // Apply extreme panic movement - violent spinner turn
          if (shouldExtremePanic) {
            // EXTREME PANIC: Violent spinner turn - complete override of current movement
            const extremePanicDirection = Math.sign(ballCenterY - currentPaddleCenter);

            // If it's an emergency (ball about to be missed), use MAXIMUM speed
            let panicMultiplier = EXTREME_PANIC_MULTIPLIER;
            if (isEmergencyPanic) {
              panicMultiplier = EXTREME_PANIC_MULTIPLIER * 2; // Double speed to ensure no miss
            }

            // Completely replace velocity with extreme movement - MUCH FASTER
            paddle.velocity = extremePanicDirection * paddle.speed * panicMultiplier;
            // Add violent jitter to simulate frantic spinning
            paddle.velocity += (Math.random() - 0.5) * 15;
            // Override friction temporarily for this extreme move
            paddle.velocity *= isEmergencyPanic ? 2.0 : 1.5; // Even more momentum in emergency
          } else if (shouldPanic) {
            // Regular panic move - fast correction
            const panicDirection = Math.sign(ballCenterY - currentPaddleCenter);
            // Add to existing velocity for dramatic acceleration
            paddle.velocity += panicDirection * acceleration * PANIC_VELOCITY_MULTIPLIER;
            // Add jitter to simulate nervous quick adjustments
            paddle.velocity += (Math.random() - 0.5) * 2;
          } else {
            // Normal movement - human-like decisive action
            if (Math.abs(distance) > 25) {
              // Far from target - move decisively toward ball
              paddle.velocity += direction * acceleration * 3.0;
            } else if (Math.abs(distance) > 8) {
              // Getting close - moderate movement
              paddle.velocity += direction * acceleration * 1.2;
            } else {
              // At target - stop moving (humans don't micro-adjust constantly)
              paddle.velocity *= 0.5;
            }
          }

          // Different friction rates for each paddle
          const friction = isLeft ? PADDLE_FRICTION : PADDLE_FRICTION * 0.95;
          paddle.velocity *= friction;

          // Slightly different max speeds for each paddle
          const maxSpeed = isLeft ? paddle.speed : paddle.speed * 0.9;
          paddle.velocity = Math.max(-maxSpeed, Math.min(maxSpeed, paddle.velocity));

          // Update position
          paddle.y += paddle.velocity;

          // Keep paddle within bounds
          paddle.y = Math.max(0, Math.min(canvasSize.height - paddle.height, paddle.y));
        };

        updatePaddleWithSpinner(newState.paddles.left, true, leftFrameCountRef.current);
        updatePaddleWithSpinner(newState.paddles.right, false, rightFrameCountRef.current);

        // AI for top and bottom paddles in auto mode
        topFrameCountRef.current++;
        bottomFrameCountRef.current++;
        const ballCenterX = newState.ball.x + newState.ball.size / 2;

        // Human-like horizontal paddle movement - similar to vertical paddles but for X axis
        const updateHorizontalPaddleWithSpinner = (paddle: any, isTop: boolean, frameCount: number) => {
          // Different reaction delays for each paddle
          const reactionDelay = isTop ? HUMAN_REACTION_DELAY + 2 : HUMAN_REACTION_DELAY + 4;

          if (frameCount % reactionDelay === 0) {
            const baseInaccuracy = isTop ? 15 : 20; // Top slightly more accurate
            const inaccuracy = (Math.random() - 0.5) * baseInaccuracy;
            const predictionError = Math.random() < 0.3 ? (Math.random() - 0.5) * 30 : 0;

            const targetX = Math.max(
              paddle.width / 2,
              Math.min(
                canvasSize.width - paddle.width / 2,
                ballCenterX - paddle.width / 2 + inaccuracy + predictionError
              )
            );
            paddle.targetX = targetX;
          }

          // Movement towards target with momentum
          const distance = paddle.targetX - paddle.x;

          if (Math.abs(distance) > 3) {
            const acceleration = Math.sign(distance) * 0.6;
            paddle.velocity += acceleration;
          } else {
            paddle.velocity *= 0.9; // Slight friction when close to target
          }

          // Apply speed limits and update position
          const maxSpeed = paddle.speed;
          paddle.velocity = Math.max(-maxSpeed, Math.min(maxSpeed, paddle.velocity));
          paddle.x += paddle.velocity;
          paddle.x = Math.max(0, Math.min(canvasSize.width - paddle.width, paddle.x));
        };

        if (newState.paddles.top) {
          updateHorizontalPaddleWithSpinner(newState.paddles.top, true, topFrameCountRef.current);
        }
        if (newState.paddles.bottom) {
          updateHorizontalPaddleWithSpinner(newState.paddles.bottom, false, bottomFrameCountRef.current);
        }

        // Add paddle trail points only when paddles are moving
        const now = Date.now();
        if (Math.abs(newState.paddles.left.velocity) > 0.01) {
          newState.trails.leftPaddle.push({
            x: 12 + newState.paddles.left.width / 2, // Left paddle center x position
            y: newState.paddles.left.y + newState.paddles.left.height / 2,
            timestamp: now,
            width: newState.paddles.left.width,
            height: newState.paddles.left.height
          });
        }
        if (Math.abs(newState.paddles.right.velocity) > 0.01) {
          newState.trails.rightPaddle.push({
            x: canvasSize.width - 12 - newState.paddles.right.width / 2, // Right paddle center x position
            y: newState.paddles.right.y + newState.paddles.right.height / 2,
            timestamp: now,
            width: newState.paddles.right.width,
            height: newState.paddles.right.height
          });
        }

        // Add trail tracking for top and bottom paddles when AI moves them
        if (newState.paddles.top && Math.abs(newState.paddles.top.velocity) > 0.01) {
          newState.trails.topPaddle.push({
            x: newState.paddles.top.x + newState.paddles.top.width / 2,
            y: 30 + newState.paddles.top.height / 2, // 30px spacing from top wall
            timestamp: now,
            width: newState.paddles.top.width,
            height: newState.paddles.top.height
          });
        }
        if (newState.paddles.bottom && Math.abs(newState.paddles.bottom.velocity) > 0.01) {
          newState.trails.bottomPaddle.push({
            x: newState.paddles.bottom.x + newState.paddles.bottom.width / 2,
            y: canvasSize.height - 30 - newState.paddles.bottom.height / 2, // 30px spacing from bottom wall
            timestamp: now,
            width: newState.paddles.bottom.width,
            height: newState.paddles.bottom.height
          });
        }
      }

      // Skip ball logic if game is paused, ended, or not playing (but allow paddle movement)
      if (!newState.isPaused && newState.isPlaying && !newState.gameEnded) {
        // Start info text fade when game actually begins (ball starts moving)
        if (!infoTextFadeStart && (Math.abs(newState.ball.dx) > 0 || Math.abs(newState.ball.dy) > 0)) {
          setInfoTextFadeStart(Date.now());
        }

        // Apply SUPER drunk ball effect - WAY more chaotic!
        if (newState.ball.isDrunk) {
          newState.ball.drunkAngle += 0.8 + Math.random() * 0.6; // Much faster and more random rotation

          // Multiple layers of chaos
          const chaosX = Math.sin(newState.ball.drunkAngle) * 4 + Math.cos(newState.ball.drunkAngle * 2.3) * 2;
          const chaosY = Math.cos(newState.ball.drunkAngle * 1.7) * 4 + Math.sin(newState.ball.drunkAngle * 3.1) * 2;

          // Random direction changes
          if (Math.random() < 0.08) { // 8% chance per frame to randomly change direction
            newState.ball.dx += (Math.random() - 0.5) * 8;
            newState.ball.dy += (Math.random() - 0.5) * 8;
          }

          // Chaotic velocity modulation
          newState.ball.dx += chaosX * 0.3 + (Math.random() - 0.5) * 2;
          newState.ball.dy += chaosY * 0.3 + (Math.random() - 0.5) * 2;

          // Random speed bursts and slowdowns
          if (Math.random() < 0.05) { // 5% chance for speed burst
            const speedMultiplier = 0.3 + Math.random() * 2; // Between 0.3x and 2.3x speed
            newState.ball.dx *= speedMultiplier;
            newState.ball.dy *= speedMultiplier;
          }

          // Occasional complete direction reversal
          if (Math.random() < 0.02) { // 2% chance to reverse direction
            newState.ball.dx *= -1;
            newState.ball.dy *= -1;
          }

          // Wobbly trajectory - make it zigzag wildly
          const wobble = Math.sin(newState.ball.drunkAngle * 4) * 3;
          newState.ball.dx += wobble * 0.2;
          newState.ball.dy += Math.cos(newState.ball.drunkAngle * 5) * 3 * 0.2;
        }

        // Apply teleporting ball effect - random position changes
        const currentTime = Date.now();
        if (newState.ball.isTeleporting) {
          const timeSinceLastTeleport = currentTime - newState.ball.lastTeleportTime;

          // Teleport every 800-1500ms for strategic challenge
          if (timeSinceLastTeleport > 800 + Math.random() * 700) {
            // Keep ball in bounds with some padding
            const padding = 50;
            newState.ball.x = padding + Math.random() * (canvasSize.width - padding * 2);
            newState.ball.y = padding + Math.random() * (canvasSize.height - padding * 2);

            // Also randomize direction and speed slightly on teleport
            const speedVariation = 0.8 + Math.random() * 0.4; // 0.8x to 1.2x speed
            newState.ball.dx *= speedVariation;
            newState.ball.dy *= speedVariation;

            // Sometimes reverse direction
            if (Math.random() < 0.3) {
              newState.ball.dx *= -1;
            }
            if (Math.random() < 0.3) {
              newState.ball.dy *= -1;
            }

            newState.ball.lastTeleportTime = currentTime;
          }
        }

        // Check if ball is stuck bouncing vertically and give it a sideways push
        const horizontalSpeed = Math.abs(newState.ball.dx);
        const verticalSpeed = Math.abs(newState.ball.dy);

        // If ball is moving much more vertically than horizontally, it might be stuck
        if (verticalSpeed > horizontalSpeed * 3) {
          // Start tracking if we haven't already
          if (newState.ball.stuckCheckStartTime === 0) {
            newState.ball.stuckCheckStartTime = currentTime;
            newState.ball.stuckCheckStartX = newState.ball.x;
          } else {
            // Check if ball hasn't moved much horizontally in 2 seconds
            const timeSinceCheck = currentTime - newState.ball.stuckCheckStartTime;
            const horizontalDistance = Math.abs(newState.ball.x - newState.ball.stuckCheckStartX);

            if (timeSinceCheck > 2000 && horizontalDistance < 100) {
              // Ball is stuck! Give it a sideways push
              const pushDirection = Math.random() > 0.5 ? 1 : -1; // Random left or right
              const pushStrength = 8 + Math.random() * 4; // 8-12 speed units
              newState.ball.dx = pushDirection * pushStrength;

              // Reset stuck tracking
              newState.ball.stuckCheckStartTime = 0;
              newState.ball.stuckCheckStartX = 0;
            }
          }
        } else {
          // Ball is moving well horizontally, reset stuck tracking
          newState.ball.stuckCheckStartTime = 0;
          newState.ball.stuckCheckStartX = 0;
        }

        // 🌪️ Apply physics forces to ball
        (newState.physicsForces || []).forEach(force => {
          const ballCenterX = newState.ball.x + newState.ball.size / 2;
          const ballCenterY = newState.ball.y + newState.ball.size / 2;

          const distanceX = force.x - ballCenterX;
          const distanceY = force.y - ballCenterY;
          const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

          if (distance < force.radius && distance > 0.1) {
            // Calculate force based on inverse square law, clamped
            const forceStrength = Math.min(force.strength / (distance * distance) * 1000, 0.8);
            const normalizedX = distanceX / distance;
            const normalizedY = distanceY / distance;

            if (force.type === 'attractor') {
              // Pull towards attractor
              newState.ball.dx += normalizedX * forceStrength * 0.4;
              newState.ball.dy += normalizedY * forceStrength * 0.4;
            } else {
              // Push away from repulsor
              newState.ball.dx -= normalizedX * forceStrength * 0.4;
              newState.ball.dy -= normalizedY * forceStrength * 0.4;
            }

            // Play interaction sound effect
            if (playMelodyNoteRef.current && Math.random() < 0.1) { // 10% chance per frame
              const frequency = force.type === 'attractor' ? 600 : 300;
              playMelodyNoteRef.current(frequency, 0.1, 'sine', 50);
            }
          }
        });

        // Apply same forces to extra balls
        (newState.extraBalls || []).forEach(extraBall => {
          (newState.attractors || []).forEach(attractor => {
            const ballCenterX = extraBall.x + extraBall.size / 2;
            const ballCenterY = extraBall.y + extraBall.size / 2;

            const distanceX = attractor.x - ballCenterX;
            const distanceY = attractor.y - ballCenterY;
            const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);

            if (distance < attractor.radius && distance > 0.1) {
              const force = Math.min(attractor.strength / (distance * distance) * 1000, 0.5);
              const normalizedX = distanceX / distance;
              const normalizedY = distanceY / distance;

              if (attractor.type === 'attractor') {
                extraBall.dx += normalizedX * force * 0.3;
                extraBall.dy += normalizedY * force * 0.3;
              } else {
                extraBall.dx -= normalizedX * force * 0.3;
                extraBall.dy -= normalizedY * force * 0.3;
              }
            }
          });
        });

        // 🕒 Smooth ball movement at consistent speed
        newState.ball.x += newState.ball.dx;
        newState.ball.y += newState.ball.dy;

        // Add ball trail point
        const now = Date.now();
        newState.trails.ball.push({
          x: newState.ball.x + newState.ball.size / 2,
          y: newState.ball.y + newState.ball.size / 2,
          timestamp: now
        });

        // Clean old trail points (keep last 500ms for ball, 400ms for paddles)
        newState.trails.ball = newState.trails.ball.filter(point => now - point.timestamp < 500);
        newState.trails.leftPaddle = newState.trails.leftPaddle.filter(point => now - point.timestamp < 400);
        newState.trails.rightPaddle = newState.trails.rightPaddle.filter(point => now - point.timestamp < 400);
        newState.trails.topPaddle = newState.trails.topPaddle.filter(point => now - point.timestamp < 400);
        newState.trails.bottomPaddle = newState.trails.bottomPaddle.filter(point => now - point.timestamp < 400);

        // 🟠 Move extra balls (for multi-ball effect)
        (newState.extraBalls || []).forEach(extraBall => {
          extraBall.x += extraBall.dx;
          extraBall.y += extraBall.dy;

          // Extra ball collision with top/bottom walls
          if (extraBall.y <= 0 || extraBall.y >= canvasSize.height - extraBall.size) {
            extraBall.dy = -extraBall.dy;
            extraBall.y = extraBall.y <= 0 ? 0 : canvasSize.height - extraBall.size;
          }

          // Extra ball collision with left/right walls (remove ball if it goes off screen)
          if (extraBall.x <= 0 || extraBall.x >= canvasSize.width - extraBall.size) {
            // Mark for removal by setting a flag
            extraBall.shouldRemove = true;
          }
        });

        // Remove extra balls that went off screen
        newState.extraBalls = (newState.extraBalls || []).filter(ball => !ball.shouldRemove);

        // Old attractor system removed - now using new physicsForces system

        // 🏓 Extra ball paddle collisions
        (newState.extraBalls || []).forEach(extraBall => {
          const ballLeft = extraBall.x;
          const ballRight = extraBall.x + extraBall.size;
          const ballTop = extraBall.y;
          const ballBottom = extraBall.y + extraBall.size;

          // Left paddle collision
          const leftPaddleX = 30;
          const leftPaddleRight = leftPaddleX + newState.paddles.left.width;
          if (ballLeft <= leftPaddleRight && ballRight >= leftPaddleX &&
              ballBottom >= newState.paddles.left.y && ballTop <= newState.paddles.left.y + newState.paddles.left.height &&
              extraBall.dx < 0) {
            extraBall.dx = -extraBall.dx;
            extraBall.x = leftPaddleRight + 1;
          }

          // Right paddle collision
          const rightPaddleX = canvasSize.width - 30 - newState.paddles.right.width;
          if (ballRight >= rightPaddleX && ballLeft <= rightPaddleX + newState.paddles.right.width &&
              ballBottom >= newState.paddles.right.y && ballTop <= newState.paddles.right.y + newState.paddles.right.height &&
              extraBall.dx > 0) {
            extraBall.dx = -extraBall.dx;
            extraBall.x = rightPaddleX - extraBall.size - 1;
          }

          // Top paddle collision (if exists)
          if (newState.paddles.top) {
            const topPaddleY = 30;
            const topPaddleBottom = topPaddleY + newState.paddles.top.height;
            if (ballTop <= topPaddleBottom && ballBottom >= topPaddleY &&
                ballRight >= newState.paddles.top.x && ballLeft <= newState.paddles.top.x + newState.paddles.top.width &&
                extraBall.dy < 0) {
              extraBall.dy = -extraBall.dy;
              extraBall.y = topPaddleBottom + 1;
            }
          }

          // Bottom paddle collision (if exists)
          if (newState.paddles.bottom) {
            const bottomPaddleY = canvasSize.height - 30 - newState.paddles.bottom.height;
            if (ballBottom >= bottomPaddleY && ballTop <= bottomPaddleY + newState.paddles.bottom.height &&
                ballRight >= newState.paddles.bottom.x && ballLeft <= newState.paddles.bottom.x + newState.paddles.bottom.width &&
                extraBall.dy > 0) {
              extraBall.dy = -extraBall.dy;
              extraBall.y = bottomPaddleY - extraBall.size - 1;
            }
          }
        });

        // Handle pickup spawning (max 3 simultaneous pickups)
        // Only game master spawns pickups in multiplayer to avoid duplicates
        const canSpawnPickups = (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer');
        const timeToSpawn = Date.now() >= newState.nextPickupTime;
        const hasSpace = newState.pickups && newState.pickups.length < 3;

        // EMERGENCY FIX: nextPickupTime is corrupted, fix it immediately
        if (isNaN(newState.nextPickupTime) || newState.nextPickupTime < Date.now() - 86400000) {
          console.log('🚨 FIXING CORRUPTED nextPickupTime!');
          newState.nextPickupTime = Date.now() + Math.random() * 5000 + 2000; // 2-7 seconds
        }

        // EMERGENCY FIX: Always allow game master OR single player to spawn pickups
        const emergencyCanSpawn = (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer' || multiplayerState.playerId === Object.keys(multiplayerState.players || {})[0]);

        if (Math.floor(Date.now() / 3000) !== Math.floor((Date.now() - 16) / 3000)) { // Debug every 3 seconds
          console.log('🚨 EMERGENCY DEBUG:', {
            nextPickupTime: new Date(newState.nextPickupTime).toLocaleTimeString(),
            currentTime: new Date().toLocaleTimeString(),
            timeDiff: newState.nextPickupTime - Date.now(),
            isGameMaster: multiplayerState.isGameMaster,
            emergencyCanSpawn: emergencyCanSpawn,
            timeToSpawn: timeToSpawn,
            playerId: multiplayerState.playerId,
            players: Object.keys(multiplayerState.players || {})
          });
        }

        if (hasSpace && timeToSpawn && emergencyCanSpawn && createPickupRef.current) {
          const newPickup = createPickupRef.current();
          if (newPickup) {
            newState.pickups.push(newPickup);
            // Progressive pickup frequency - starts slow, intensifies as game progresses
            const totalScore = newState.score.left + newState.score.right + newState.score.top + newState.score.bottom;
            const progressionFactor = Math.min(totalScore / 10, 1); // Max intensity at 10 total points
            const baseDelay = 15000; // 15 seconds initially
            const minDelay = 3000;   // 3 seconds minimum (intense late game)
            const randomRange = 8000; // 8 second random variation

            const delay = Math.max(minDelay, baseDelay * (1 - progressionFactor * 0.8)) + Math.random() * randomRange;
            newState.nextPickupTime = Date.now() + delay;

            console.log('🎁 Pickup spawned:', newPickup.type, `at ${newPickup.x},${newPickup.y}. Next in ${Math.round(delay/1000)}s (score: ${totalScore})`);
          }
        } else if (Math.floor(Date.now() / 10000) !== Math.floor((Date.now() - 16) / 10000)) { // Debug every 10 seconds
          console.log('🔍 Pickup spawn check:', {
            hasSpace,
            timeToSpawn,
            canSpawnPickups,
            isGameMaster: multiplayerState.isGameMaster,
            gameMode: newState.gameMode,
            createPickupRef: !!createPickupRef.current,
            pickupsCount: newState.pickups?.length || 0,
            nextPickupTime: new Date(newState.nextPickupTime).toLocaleTimeString(),
            currentTime: new Date().toLocaleTimeString(),
            isPlaying: newState.isPlaying,
            nextPickupTimeMs: newState.nextPickupTime,
            currentTimeMs: Date.now(),
            timeDiff: newState.nextPickupTime - Date.now()
          });
        }

        // 🌪️ Handle attractor/repulsor spawning (max 2 simultaneous, less frequent than pickups)
        // Only game master spawns attractors/repulsors in multiplayer to avoid duplicates
        if (newState.attractors && newState.attractors.length < 2 && Date.now() >= newState.nextAttractorTime &&
            (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer')) {
          const isAttractor = Math.random() > 0.5; // 50% chance for attractor vs repulsor
          const centerX = canvasSize.width / 2;
          const centerY = canvasSize.height / 2;

          // Spawn away from center and paddles
          const x = Math.random() > 0.5
            ? centerX + 100 + Math.random() * (centerX - 200)  // Right side
            : 100 + Math.random() * (centerX - 200);           // Left side
          const y = 100 + Math.random() * (canvasSize.height - 200);

          const attractor = {
            x,
            y,
            type: isAttractor ? 'attractor' : 'repulsor',
            strength: 0.3 + Math.random() * 0.4, // 0.3-0.7 strength
            radius: 40 + Math.random() * 30, // 40-70 pixel influence radius
            size: 24, // Visual size
            spawnTime: Date.now(),
            lifetime: 8000 + Math.random() * 7000, // 8-15 seconds
            animationPhase: 0,
            pulseSpeed: 0.05 + Math.random() * 0.1, // Animation speed
            id: `attractor_${Date.now()}_${Math.random()}`,
          };

          newState.attractors.push(attractor);
          newState.nextAttractorTime = Date.now() + Math.random() * 20000 + 15000; // 15-35 seconds

          // Play spawn sound
          setTimeout(() => {
            if (isAttractor) {
              playMelodyNote('beep', null, 'both'); // Attractor sound
            } else {
              playMelodyNote('beep', null, 'both'); // Repulsor sound
            }
          }, 50);
        }

        // Check pickup collisions
        const ballCenterX = newState.ball.x + newState.ball.size / 2;
        const ballCenterY = newState.ball.y + newState.ball.size / 2;

        for (let i = newState.pickups.length - 1; i >= 0; i--) {
          const pickup = newState.pickups[i];
          const pickupCenterX = pickup.x + pickup.size / 2;
          const pickupCenterY = pickup.y + pickup.size / 2;

          const distance = Math.sqrt(
            Math.pow(ballCenterX - pickupCenterX, 2) +
            Math.pow(ballCenterY - pickupCenterY, 2)
          );

          if (distance < (newState.ball.size / 2 + pickup.size / 2)) {
            applyPickupEffectRef.current?.(pickup, newState);

            // Announce the pickup with speech synthesis
            const pickupData = PICKUP_TYPES.find(p => p.type === pickup.type);
            if (pickupData) {
              setTimeout(() => speakRobotic(pickupData.description), 100);
              // Track when this announcement was made to delay countdown
              setPickupAnnouncementTimes(prev => ({
                ...prev,
                [pickup.type]: Date.now()
              }));
            }

            newState.pickups.splice(i, 1); // Remove this pickup

            // Change colors on pickup!
            newState.colorIndex = (newState.colorIndex + 1) % COLOR_PALETTE.length;
          }
        }

        // 🟠 Check extra ball pickup collisions
        for (let i = newState.pickups.length - 1; i >= 0; i--) {
          const pickup = newState.pickups[i];
          const pickupCenterX = pickup.x + pickup.size / 2;
          const pickupCenterY = pickup.y + pickup.size / 2;

          // Check collision with each extra ball
          for (const extraBall of newState.extraBalls) {
            const ballCenterX = extraBall.x + extraBall.size / 2;
            const ballCenterY = extraBall.y + extraBall.size / 2;

            const distance = Math.sqrt(
              Math.pow(ballCenterX - pickupCenterX, 2) +
              Math.pow(ballCenterY - pickupCenterY, 2)
            );

            if (distance < (extraBall.size / 2 + pickup.size / 2)) {
              applyPickupEffectRef.current?.(pickup, newState);

              // Announce the pickup with speech synthesis
              const pickupData = PICKUP_TYPES.find(p => p.type === pickup.type);
              if (pickupData) {
                setTimeout(() => speakRobotic(pickupData.description), 100);
                setPickupAnnouncementTimes(prev => ({
                  ...prev,
                  [pickup.type]: Date.now()
                }));
              }

              newState.pickups.splice(i, 1); // Remove this pickup
              newState.colorIndex = (newState.colorIndex + 1) % COLOR_PALETTE.length;
              break; // Exit inner loop since pickup is consumed
            }
          }
        }

        // Check coin collisions
        for (let i = newState.coins.length - 1; i >= 0; i--) {
          const coin = newState.coins[i];
          const coinCenterX = coin.x + coin.size / 2;
          const coinCenterY = coin.y + coin.size / 2;

          const distance = Math.sqrt(
            Math.pow(ballCenterX - coinCenterX, 2) +
            Math.pow(ballCenterY - coinCenterY, 2)
          );

          if (distance < (newState.ball.size / 2 + coin.size / 2)) {
            // Coin collected! Award point to nearest paddle
            const distanceToLeft = Math.abs(ballCenterX - newState.paddles.left.x);
            const distanceToRight = Math.abs(ballCenterX - newState.paddles.right.x);

            if (distanceToLeft < distanceToRight) {
              newState.score.left += 1;
            } else {
              newState.score.right += 1;
            }

            newState.coins.splice(i, 1); // Remove coin
            playMelodyNoteRef.current?.('score', null, 'both'); // Play collection sound
          }
        }

        } // End of game master paddle collision check

        // Update active effects
        updateEffectsRef.current?.(newState);

        // NOTE: Top and bottom walls are now scoring boundaries (like left/right walls)
        // The ball should pass through them to trigger scoring, not bounce off them.

        // Ball collision with paddles
        // CRITICAL FIX: Allow collision detection for responsive gameplay
        // - Game master detects ALL paddle collisions (authoritative)
        // - Non-game-master players detect collisions with their own paddle only (local feedback)
        // - Network sync ensures consistency while maintaining responsiveness
        const isGameMaster = multiplayerState.isGameMaster;
        const shouldDetectCollisions = newState.gameMode !== 'multiplayer' || isGameMaster;

        if (shouldDetectCollisions) { // Game master or single player - detect all collisions
          const ballLeft = newState.ball.x;
          const ballRight = newState.ball.x + newState.ball.size;
          const ballTop = newState.ball.y;
          const ballBottom = newState.ball.y + newState.ball.size;

        // Advanced paddle collision with speed variation based on hit position
        // Store previous ball position for better collision detection
        const prevBallX = newState.ball.x - newState.ball.dx;
        const prevBallY = newState.ball.y - newState.ball.dy;

        // Left paddle collision (30px spacing from left wall only)
        const leftPaddleX = 30; // 30px spacing from left wall
        const leftPaddleRight = leftPaddleX + newState.paddles.left.width;

        // ENHANCED COLLISION DETECTION: Check both overlap and continuous collision
        // Traditional overlap detection (with increased buffer)
        const ballIntersectsLeftPaddle =
          ballLeft <= leftPaddleRight + COLLISION_BUFFER &&
          ballRight >= leftPaddleX - COLLISION_BUFFER &&
          ballBottom >= newState.paddles.left.y - COLLISION_BUFFER &&
          ballTop <= newState.paddles.left.y + newState.paddles.left.height + COLLISION_BUFFER;

        // Continuous collision detection - check if ball trajectory crossed paddle
        const ballCenterX = newState.ball.x + newState.ball.size / 2;
        const ballCenterY = newState.ball.y + newState.ball.size / 2;
        const prevBallCenterX = prevBallX + newState.ball.size / 2;
        const prevBallCenterY = prevBallY + newState.ball.size / 2;

        const ballTrajectoryIntersectsLeftPaddle = lineIntersectsRect(
          prevBallCenterX, prevBallCenterY,
          ballCenterX, ballCenterY,
          leftPaddleX, newState.paddles.left.y,
          newState.paddles.left.width, newState.paddles.left.height
        );

        // Check if ball came from the right side (proper collision direction)
        const ballCameFromRight = prevBallX > leftPaddleRight || prevBallCenterX > leftPaddleRight;

        // Collision detected if EITHER overlap OR trajectory intersection occurs (and ball moving toward paddle)
        const leftPaddleCollisionDetected = (ballIntersectsLeftPaddle || ballTrajectoryIntersectsLeftPaddle) &&
                                           ballCameFromRight && newState.ball.dx < 0;

        if (leftPaddleCollisionDetected) {
          // Calculate where on the paddle the ball hit (0 = top edge, 1 = bottom edge, 0.5 = center)
          const ballCenterY = newState.ball.y + newState.ball.size / 2;
          const paddleCenterY = newState.paddles.left.y + newState.paddles.left.height / 2;
          const hitPosition = (ballCenterY - newState.paddles.left.y) / newState.paddles.left.height;

          // Calculate distance from center (0 = center, 1 = edge)
          const distanceFromCenter = Math.abs(hitPosition - 0.5) * 2;

          // Calculate new speed based on hit position (edge hits = faster, center hits = slower)
          const speedMultiplier = MIN_BALL_SPEED + (MAX_BALL_SPEED - MIN_BALL_SPEED) * distanceFromCenter;

          // Calculate current ball speed magnitude
          const currentSpeed = Math.sqrt(newState.ball.dx * newState.ball.dx + newState.ball.dy * newState.ball.dy);

          // Preserve direction but apply new speed
          newState.ball.dx = -newState.ball.dx * (speedMultiplier / currentSpeed);
          newState.ball.dy = newState.ball.dy * (speedMultiplier / currentSpeed);

          // Add slight angle variation based on hit position (like real Pong)
          const angleVariation = (hitPosition - 0.5) * 2; // -1 to 1
          newState.ball.dy += angleVariation * 2;

          // Change colors on paddle hit!
          newState.colorIndex = (newState.colorIndex + 1) % COLOR_PALETTE.length;

          // Track ball touch for scoring system
          console.log(`🏓 BALL TOUCHED BY LEFT PADDLE:`, {
            previous: newState.ball.lastTouchedBy,
            new: 'left',
            isGameMaster: multiplayerState.isGameMaster,
            gameMode: newState.gameMode,
            ballPosition: { x: newState.ball.x, y: newState.ball.y }
          });
          newState.ball.previousTouchedBy = newState.ball.lastTouchedBy;
          newState.ball.lastTouchedBy = 'left';

          // DEFENSIVE: Position ball exactly at paddle edge to prevent pass-through
          newState.ball.x = leftPaddleRight;

          // Trigger rumble effect on left paddle hit
          newState.rumbleEffect.isActive = true;
          newState.rumbleEffect.startTime = Date.now();
          newState.rumbleEffect.intensity = 8; // Strong rumble for paddle hits

          // Different beep pitch based on hit position (edge hits = higher pitch)
          // Only play beep sound if we're the game master to avoid duplicate sounds
          if (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer') {
            playMelodyNoteRef.current?.('paddle', null, 'both'); // Paddle hit with space melody
          }

          // Track rally and potentially taunt
          rallyCountRef.current++;
          if (rallyCountRef.current >= LONG_RALLY_THRESHOLD) {
            attemptRobotTauntRef.current?.('long_rally');
            rallyCountRef.current = 0; // Reset counter after taunt attempt
          }
        }

        // Right paddle collision (30px spacing from right wall only)
        const rightPaddleX = canvasSize.width - 30 - newState.paddles.right.width; // 30px spacing from right wall
        const rightPaddleLeft = rightPaddleX;

        // ENHANCED COLLISION DETECTION: Check both overlap and continuous collision
        // Traditional overlap detection (with increased buffer)
        const ballIntersectsRightPaddle =
          ballRight >= rightPaddleLeft - COLLISION_BUFFER &&
          ballLeft <= rightPaddleX + newState.paddles.right.width + COLLISION_BUFFER &&
          ballBottom >= newState.paddles.right.y - COLLISION_BUFFER &&
          ballTop <= newState.paddles.right.y + newState.paddles.right.height + COLLISION_BUFFER;

        // Continuous collision detection - check if ball trajectory crossed paddle
        const ballTrajectoryIntersectsRightPaddle = lineIntersectsRect(
          prevBallCenterX, prevBallCenterY,
          ballCenterX, ballCenterY,
          rightPaddleX, newState.paddles.right.y,
          newState.paddles.right.width, newState.paddles.right.height
        );

        // Check if ball came from the left side (proper collision direction)
        const ballCameFromLeft = prevBallX < rightPaddleLeft || prevBallCenterX < rightPaddleLeft;

        // Collision detected if EITHER overlap OR trajectory intersection occurs (and ball moving toward paddle)
        const rightPaddleCollisionDetected = (ballIntersectsRightPaddle || ballTrajectoryIntersectsRightPaddle) &&
                                            ballCameFromLeft && newState.ball.dx > 0;

        if (rightPaddleCollisionDetected) {
          // Calculate where on the paddle the ball hit (0 = top edge, 1 = bottom edge, 0.5 = center)
          const ballCenterY = newState.ball.y + newState.ball.size / 2;
          const paddleCenterY = newState.paddles.right.y + newState.paddles.right.height / 2;
          const hitPosition = (ballCenterY - newState.paddles.right.y) / newState.paddles.right.height;

          // Calculate distance from center (0 = center, 1 = edge)
          const distanceFromCenter = Math.abs(hitPosition - 0.5) * 2;

          // Calculate new speed based on hit position (edge hits = faster, center hits = slower)
          const speedMultiplier = MIN_BALL_SPEED + (MAX_BALL_SPEED - MIN_BALL_SPEED) * distanceFromCenter;

          // Calculate current ball speed magnitude
          const currentSpeed = Math.sqrt(newState.ball.dx * newState.ball.dx + newState.ball.dy * newState.ball.dy);

          // Preserve direction but apply new speed
          newState.ball.dx = -newState.ball.dx * (speedMultiplier / currentSpeed);
          newState.ball.dy = newState.ball.dy * (speedMultiplier / currentSpeed);

          // Add slight angle variation based on hit position (like real Pong)
          const angleVariation = (hitPosition - 0.5) * 2; // -1 to 1
          newState.ball.dy += angleVariation * 2;

          // Change colors on paddle hit!
          newState.colorIndex = (newState.colorIndex + 1) % COLOR_PALETTE.length;

          // Track ball touch for scoring system
          console.log(`🏓 BALL TOUCHED BY RIGHT PADDLE:`, {
            previous: newState.ball.lastTouchedBy,
            new: 'right',
            isGameMaster: multiplayerState.isGameMaster,
            gameMode: newState.gameMode,
            ballPosition: { x: newState.ball.x, y: newState.ball.y }
          });
          newState.ball.previousTouchedBy = newState.ball.lastTouchedBy;
          newState.ball.lastTouchedBy = 'right';

          // DEFENSIVE: Position ball safely outside paddle to prevent pass-through
          newState.ball.x = rightPaddleX - newState.ball.size;

          // Trigger rumble effect on right paddle hit
          newState.rumbleEffect.isActive = true;
          newState.rumbleEffect.startTime = Date.now();
          newState.rumbleEffect.intensity = 8; // Strong rumble for paddle hits

          // Different beep pitch based on hit position (edge hits = higher pitch)
          // Only play beep sound if we're the game master to avoid duplicate sounds
          if (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer') {
            playMelodyNoteRef.current?.('paddle', null, 'both'); // Paddle hit with space melody
          }

          // Track rally and potentially taunt
          rallyCountRef.current++;
          if (rallyCountRef.current >= LONG_RALLY_THRESHOLD) {
            attemptRobotTauntRef.current?.('long_rally');
            rallyCountRef.current = 0; // Reset counter after taunt attempt
          }
        }

        // Top paddle collision (with spacing from wall) - only if top paddle exists
        if (newState.paddles.top) {
          const topPaddleY = 30; // 30px spacing from top wall only
          const topPaddleBottom = topPaddleY + newState.paddles.top.height;

        // ENHANCED COLLISION DETECTION: Check both overlap and continuous collision
        // Traditional overlap detection (with increased buffer)
        const ballIntersectsTopPaddle =
          ballTop <= topPaddleBottom + COLLISION_BUFFER &&
          ballBottom >= topPaddleY - COLLISION_BUFFER &&
          ballRight >= newState.paddles.top.x - COLLISION_BUFFER &&
          ballLeft <= newState.paddles.top.x + newState.paddles.top.width + COLLISION_BUFFER;

        // Continuous collision detection - check if ball trajectory crossed paddle
        const ballTrajectoryIntersectsTopPaddle = lineIntersectsRect(
          prevBallCenterX, prevBallCenterY,
          ballCenterX, ballCenterY,
          newState.paddles.top.x, topPaddleY,
          newState.paddles.top.width, newState.paddles.top.height
        );

        // Check if ball came from below (proper collision direction)
        const ballCameFromBelow = prevBallY > topPaddleBottom || prevBallCenterY > topPaddleBottom;

        // Collision detected if EITHER overlap OR trajectory intersection occurs (and ball moving toward paddle)
        const topPaddleCollisionDetected = (ballIntersectsTopPaddle || ballTrajectoryIntersectsTopPaddle) &&
                                          ballCameFromBelow && newState.ball.dy < 0;

        if (topPaddleCollisionDetected) {
          // Calculate where on the paddle the ball hit (0 = left edge, 1 = right edge, 0.5 = center)
          const ballCenterX = newState.ball.x + newState.ball.size / 2;
          const paddleCenterX = newState.paddles.top.x + newState.paddles.top.width / 2;
          const hitPosition = (ballCenterX - newState.paddles.top.x) / newState.paddles.top.width;

          // Calculate distance from center (0 = center, 1 = edge)
          const distanceFromCenter = Math.abs(hitPosition - 0.5) * 2;

          // Calculate new speed based on hit position (edge hits = faster, center hits = slower)
          const speedMultiplier = MIN_BALL_SPEED + (MAX_BALL_SPEED - MIN_BALL_SPEED) * distanceFromCenter;

          // Calculate current ball speed magnitude
          const currentSpeed = Math.sqrt(newState.ball.dx * newState.ball.dx + newState.ball.dy * newState.ball.dy);

          // Preserve direction but apply new speed
          newState.ball.dx = newState.ball.dx * (speedMultiplier / currentSpeed);
          newState.ball.dy = -newState.ball.dy * (speedMultiplier / currentSpeed);

          // Add slight angle variation based on hit position (like real Pong)
          const angleVariation = (hitPosition - 0.5) * 2; // -1 to 1
          newState.ball.dx += angleVariation * 2;

          // Change colors on paddle hit!
          newState.colorIndex = (newState.colorIndex + 1) % COLOR_PALETTE.length;

          // Track ball touch for scoring system
          console.log(`🏓 BALL TOUCHED BY TOP PADDLE:`, {
            previous: newState.ball.lastTouchedBy,
            new: 'top',
            isGameMaster: multiplayerState.isGameMaster,
            gameMode: newState.gameMode,
            ballPosition: { x: newState.ball.x, y: newState.ball.y }
          });
          newState.ball.previousTouchedBy = newState.ball.lastTouchedBy;
          newState.ball.lastTouchedBy = 'top';

          // DEFENSIVE: Position ball safely outside paddle to prevent pass-through
          newState.ball.y = topPaddleBottom;

          // Trigger rumble effect on top paddle hit
          newState.rumbleEffect.isActive = true;
          newState.rumbleEffect.startTime = Date.now();
          newState.rumbleEffect.intensity = 8; // Strong rumble for paddle hits

          // Only play beep sound if we're the game master to avoid duplicate sounds
          if (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer') {
            playMelodyNoteRef.current?.('paddle', null, 'both'); // Paddle hit with space melody
          }

          // Track rally and potentially taunt
          rallyCountRef.current++;
          if (rallyCountRef.current >= LONG_RALLY_THRESHOLD) {
            attemptRobotTauntRef.current?.('long_rally');
            rallyCountRef.current = 0; // Reset counter after taunt attempt
          }
        }
        } // End top paddle collision check

        // Bottom paddle collision (with spacing from wall) - only if bottom paddle exists
        if (newState.paddles.bottom) {
        const bottomPaddleY = canvasSize.height - 30 - newState.paddles.bottom.height; // 30px spacing from bottom wall only
        const bottomPaddleTop = bottomPaddleY;

        // ENHANCED COLLISION DETECTION: Check both overlap and continuous collision
        // Traditional overlap detection (with increased buffer)
        const ballIntersectsBottomPaddle =
          ballBottom >= bottomPaddleTop - COLLISION_BUFFER &&
          ballTop <= bottomPaddleY + newState.paddles.bottom.height + COLLISION_BUFFER &&
          ballRight >= newState.paddles.bottom.x - COLLISION_BUFFER &&
          ballLeft <= newState.paddles.bottom.x + newState.paddles.bottom.width + COLLISION_BUFFER;

        // Continuous collision detection - check if ball trajectory crossed paddle
        const ballTrajectoryIntersectsBottomPaddle = lineIntersectsRect(
          prevBallCenterX, prevBallCenterY,
          ballCenterX, ballCenterY,
          newState.paddles.bottom.x, bottomPaddleY,
          newState.paddles.bottom.width, newState.paddles.bottom.height
        );

        // Check if ball came from above (proper collision direction)
        const ballCameFromAbove = prevBallY < bottomPaddleTop || prevBallCenterY < bottomPaddleTop;

        // Collision detected if EITHER overlap OR trajectory intersection occurs (and ball moving toward paddle)
        const bottomPaddleCollisionDetected = (ballIntersectsBottomPaddle || ballTrajectoryIntersectsBottomPaddle) &&
                                             ballCameFromAbove && newState.ball.dy > 0;

        if (bottomPaddleCollisionDetected) {
          // Calculate where on the paddle the ball hit (0 = left edge, 1 = right edge, 0.5 = center)
          const ballCenterX = newState.ball.x + newState.ball.size / 2;
          const paddleCenterX = newState.paddles.bottom.x + newState.paddles.bottom.width / 2;
          const hitPosition = (ballCenterX - newState.paddles.bottom.x) / newState.paddles.bottom.width;

          // Calculate distance from center (0 = center, 1 = edge)
          const distanceFromCenter = Math.abs(hitPosition - 0.5) * 2;

          // Calculate new speed based on hit position (edge hits = faster, center hits = slower)
          const speedMultiplier = MIN_BALL_SPEED + (MAX_BALL_SPEED - MIN_BALL_SPEED) * distanceFromCenter;

          // Calculate current ball speed magnitude
          const currentSpeed = Math.sqrt(newState.ball.dx * newState.ball.dx + newState.ball.dy * newState.ball.dy);

          // Preserve direction but apply new speed
          newState.ball.dx = newState.ball.dx * (speedMultiplier / currentSpeed);
          newState.ball.dy = -newState.ball.dy * (speedMultiplier / currentSpeed);

          // Add slight angle variation based on hit position (like real Pong)
          const angleVariation = (hitPosition - 0.5) * 2; // -1 to 1
          newState.ball.dx += angleVariation * 2;

          // Change colors on paddle hit!
          newState.colorIndex = (newState.colorIndex + 1) % COLOR_PALETTE.length;

          // Track ball touch for scoring system
          console.log(`🏓 BALL TOUCHED BY BOTTOM PADDLE:`, {
            previous: newState.ball.lastTouchedBy,
            new: 'bottom',
            isGameMaster: multiplayerState.isGameMaster,
            gameMode: newState.gameMode,
            ballPosition: { x: newState.ball.x, y: newState.ball.y }
          });
          newState.ball.previousTouchedBy = newState.ball.lastTouchedBy;
          newState.ball.lastTouchedBy = 'bottom';

          // DEFENSIVE: Position ball safely outside paddle to prevent pass-through
          newState.ball.y = bottomPaddleY - newState.ball.size;

          // Trigger rumble effect on bottom paddle hit
          newState.rumbleEffect.isActive = true;
          newState.rumbleEffect.startTime = Date.now();
          newState.rumbleEffect.intensity = 8; // Strong rumble for paddle hits

          // Only play beep sound if we're the game master to avoid duplicate sounds
          if (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer') {
            playMelodyNoteRef.current?.('paddle', null, 'both'); // Paddle hit with space melody
          }

          // Track rally and potentially taunt
          rallyCountRef.current++;
          if (rallyCountRef.current >= LONG_RALLY_THRESHOLD) {
            attemptRobotTauntRef.current?.('long_rally');
            rallyCountRef.current = 0; // Reset counter after taunt attempt
          }
        }
        } // End bottom paddle collision check
        } // End game master collision detection

        // LOCAL COLLISION DETECTION for non-game-master players (their own paddle only)
        // This provides immediate visual/audio feedback while game master handles authoritative collisions
        else if (newState.gameMode === 'multiplayer' && !isGameMaster && multiplayerState.playerSide !== 'spectator') {
          const playerSide = multiplayerState.playerSide;
          const ballLeft = newState.ball.x;
          const ballRight = newState.ball.x + newState.ball.size;
          const ballTop = newState.ball.y;
          const ballBottom = newState.ball.y + newState.ball.size;
          const prevBallX = newState.ball.x - newState.ball.dx;
          const prevBallY = newState.ball.y - newState.ball.dy;
          const ballCenterX = newState.ball.x + newState.ball.size / 2;
          const ballCenterY = newState.ball.y + newState.ball.size / 2;
          const prevBallCenterX = prevBallX + newState.ball.size / 2;
          const prevBallCenterY = prevBallY + newState.ball.size / 2;

          // Only check collision with the player's own paddle for immediate feedback
          if (playerSide === 'left') {
            const leftPaddleX = 30;
            const leftPaddleRight = leftPaddleX + newState.paddles.left.width;
            const ballIntersectsLeftPaddle =
              ballLeft <= leftPaddleRight + COLLISION_BUFFER &&
              ballRight >= leftPaddleX - COLLISION_BUFFER &&
              ballBottom >= newState.paddles.left.y - COLLISION_BUFFER &&
              ballTop <= newState.paddles.left.y + newState.paddles.left.height + COLLISION_BUFFER;
            const ballTrajectoryIntersectsLeftPaddle = lineIntersectsRect(
              prevBallCenterX, prevBallCenterY, ballCenterX, ballCenterY,
              leftPaddleX, newState.paddles.left.y, newState.paddles.left.width, newState.paddles.left.height
            );
            const ballCameFromRight = prevBallX > leftPaddleRight || prevBallCenterX > leftPaddleRight;
            const leftPaddleCollisionDetected = (ballIntersectsLeftPaddle || ballTrajectoryIntersectsLeftPaddle) &&
                                               ballCameFromRight && newState.ball.dx < 0;
            if (leftPaddleCollisionDetected) {
              // LOCAL FEEDBACK ONLY - don't modify ball state (game master will handle that)
              playMelodyNoteRef.current?.('paddle', null, 'both'); // Immediate audio feedback
              newState.rumbleEffect.isActive = true;
              newState.rumbleEffect.startTime = Date.now();
              newState.rumbleEffect.intensity = 8;
            }
          } else if (playerSide === 'right') {
            const rightPaddleX = canvasSize.width - 30 - newState.paddles.right.width;
            const rightPaddleLeft = rightPaddleX;
            const ballIntersectsRightPaddle =
              ballRight >= rightPaddleLeft - COLLISION_BUFFER &&
              ballLeft <= rightPaddleX + newState.paddles.right.width + COLLISION_BUFFER &&
              ballBottom >= newState.paddles.right.y - COLLISION_BUFFER &&
              ballTop <= newState.paddles.right.y + newState.paddles.right.height + COLLISION_BUFFER;
            const ballTrajectoryIntersectsRightPaddle = lineIntersectsRect(
              prevBallCenterX, prevBallCenterY, ballCenterX, ballCenterY,
              rightPaddleX, newState.paddles.right.y, newState.paddles.right.width, newState.paddles.right.height
            );
            const ballCameFromLeft = prevBallX < rightPaddleLeft || prevBallCenterX < rightPaddleLeft;
            const rightPaddleCollisionDetected = (ballIntersectsRightPaddle || ballTrajectoryIntersectsRightPaddle) &&
                                                ballCameFromLeft && newState.ball.dx > 0;
            if (rightPaddleCollisionDetected) {
              // LOCAL FEEDBACK ONLY - don't modify ball state (game master will handle that)
              playMelodyNoteRef.current?.('paddle', null, 'both'); // Immediate audio feedback
              newState.rumbleEffect.isActive = true;
              newState.rumbleEffect.startTime = Date.now();
              newState.rumbleEffect.intensity = 8;
            }
          } else if (playerSide === 'top' && newState.paddles.top) {
            const topPaddleY = 30;
            const topPaddleBottom = topPaddleY + newState.paddles.top.height;
            const ballIntersectsTopPaddle =
              ballTop <= topPaddleBottom + COLLISION_BUFFER &&
              ballBottom >= topPaddleY - COLLISION_BUFFER &&
              ballRight >= newState.paddles.top.x - COLLISION_BUFFER &&
              ballLeft <= newState.paddles.top.x + newState.paddles.top.width + COLLISION_BUFFER;
            const ballTrajectoryIntersectsTopPaddle = lineIntersectsRect(
              prevBallCenterX, prevBallCenterY, ballCenterX, ballCenterY,
              newState.paddles.top.x, topPaddleY, newState.paddles.top.width, newState.paddles.top.height
            );
            const ballCameFromBelow = prevBallY > topPaddleBottom || prevBallCenterY > topPaddleBottom;
            const topPaddleCollisionDetected = (ballIntersectsTopPaddle || ballTrajectoryIntersectsTopPaddle) &&
                                              ballCameFromBelow && newState.ball.dy < 0;
            if (topPaddleCollisionDetected) {
              // LOCAL FEEDBACK ONLY - don't modify ball state (game master will handle that)
              playMelodyNoteRef.current?.('paddle', null, 'both'); // Immediate audio feedback
              newState.rumbleEffect.isActive = true;
              newState.rumbleEffect.startTime = Date.now();
              newState.rumbleEffect.intensity = 8;
            }
          } else if (playerSide === 'bottom' && newState.paddles.bottom) {
            const bottomPaddleY = canvasSize.height - 30 - newState.paddles.bottom.height;
            const bottomPaddleTop = bottomPaddleY;
            const ballIntersectsBottomPaddle =
              ballBottom >= bottomPaddleTop - COLLISION_BUFFER &&
              ballTop <= bottomPaddleY + newState.paddles.bottom.height + COLLISION_BUFFER &&
              ballRight >= newState.paddles.bottom.x - COLLISION_BUFFER &&
              ballLeft <= newState.paddles.bottom.x + newState.paddles.bottom.width + COLLISION_BUFFER;
            const ballTrajectoryIntersectsBottomPaddle = lineIntersectsRect(
              prevBallCenterX, prevBallCenterY, ballCenterX, ballCenterY,
              newState.paddles.bottom.x, bottomPaddleY, newState.paddles.bottom.width, newState.paddles.bottom.height
            );
            const ballCameFromAbove = prevBallY < bottomPaddleTop || prevBallCenterY < bottomPaddleTop;
            const bottomPaddleCollisionDetected = (ballIntersectsBottomPaddle || ballTrajectoryIntersectsBottomPaddle) &&
                                                 ballCameFromAbove && newState.ball.dy > 0;
            if (bottomPaddleCollisionDetected) {
              // LOCAL FEEDBACK ONLY - don't modify ball state (game master will handle that)
              playMelodyNoteRef.current?.('paddle', null, 'both'); // Immediate audio feedback
              newState.rumbleEffect.isActive = true;
              newState.rumbleEffect.startTime = Date.now();
              newState.rumbleEffect.intensity = 8;
            }
          }
        }

        // Helper function for last-touch scoring
        const handleLastTouchScoring = (boundaryHit: 'left' | 'right' | 'top' | 'bottom') => {
          let scoringPlayer: 'left' | 'right' | 'top' | 'bottom';

          // Determine who gets the score based on last touch
          if (newState.ball.lastTouchedBy) {
            // Check for self-goal (player hit ball into their own wall)
            const isSelfGoal = newState.ball.lastTouchedBy === boundaryHit;

            if (isSelfGoal && newState.ball.previousTouchedBy) {
              // Self-goal: previous player gets the score
              scoringPlayer = newState.ball.previousTouchedBy;
            } else if (!isSelfGoal) {
              // Normal goal: last toucher gets the score
              scoringPlayer = newState.ball.lastTouchedBy;
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
          console.log(`🏆 SCORING: ${scoringPlayer} scores! New scores:`, {
            before: JSON.stringify(newState.score),
            scoringPlayer,
            isGameMaster: multiplayerState.isGameMaster,
            gameMode: newState.gameMode
          });
          newState.score[scoringPlayer]++;
          console.log(`🏆 SCORE UPDATED: ${scoringPlayer} -> ${newState.score[scoringPlayer]}`, newState.score);
          clearAllPickupEffects(newState);

          // Robot taunt chance when someone scores - with player context
          attemptRobotTauntRef.current?.('scoring', scoringPlayer);

          // Reset rally counter when someone scores
          rallyCountRef.current = 0;

          // Removed score announcements to reduce audio spam

          // Check for winner (first to 11)
          if (newState.score[scoringPlayer] >= 11) {
            // Winner detected
            newState.winner = scoringPlayer;
            newState.gameEnded = true;
            newState.isPlaying = false;
            // Game state updated for winner

            // Classic Berzerk-style victory announcement
            setTimeout(() => speakRobotic(`${scoringPlayer.toUpperCase()} PLAYER WINS THE GAME`), 800);

            // Epic victory rumble effect!
            newState.rumbleEffect.isActive = true;
            newState.rumbleEffect.startTime = Date.now();
            newState.rumbleEffect.intensity = 50; // Maximum rumble for victory!

            // Victory sound
            if (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer') {
              // Play victory fanfare
              setTimeout(() => playMelodyNoteRef.current?.('score', null, 'both'), 0);
              setTimeout(() => playMelodyNoteRef.current?.('score', null, 'both'), 200);
              setTimeout(() => playMelodyNoteRef.current?.('score', null, 'both'), 400);
            }
          } else {
            // Regular scoring effects
            newState.rumbleEffect.isActive = true;
            newState.rumbleEffect.startTime = Date.now();
            newState.rumbleEffect.intensity = 25; // Much stronger rumble for scoring

            // Only play beep sound if we're the game master to avoid duplicate sounds
            if (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer') {
              playMelodyNoteRef.current?.('score', null, 'reverb'); // Score with dramatic dystopic chord
            }
          }

          // Reset ball to center
          newState.ball.x = canvasSize.width / 2;
          newState.ball.y = canvasSize.height / 2;
          newState.ball.dx = 0; // Stop ball movement during pause
          newState.ball.dy = 0;
          newState.ball.lastTouchedBy = null; // Reset tracking
          newState.ball.previousTouchedBy = null;

          // Start 2-second pause
          newState.isPaused = true;
          newState.pauseEndTime = Date.now() + 2000; // 2 seconds

          // Set ball direction for after pause (will be applied when pause ends)
          newState.ball.dx = boundaryHit === 'left' || boundaryHit === 'right'
              ? (boundaryHit === 'left' ? BALL_SPEED : -BALL_SPEED)
              : (Math.random() > 0.5 ? BALL_SPEED : -BALL_SPEED);
          newState.ball.dy = boundaryHit === 'top' || boundaryHit === 'bottom'
              ? (boundaryHit === 'top' ? -BALL_SPEED : BALL_SPEED)
              : (Math.random() > 0.5 ? BALL_SPEED : -BALL_SPEED);
        }

        // Handle scoring when ball goes off screen with last-touch system
        // MULTIPLAYER FIX: Only game master should calculate and apply scoring
        if (newState.gameMode !== 'multiplayer' || multiplayerState.isGameMaster) {
          if (newState.ball.x < -20) {
            handleLastTouchScoring('left');
          } else if (newState.ball.x > canvasSize.width + 20) {
            handleLastTouchScoring('right');
          } else if (newState.ball.y < -20) {
            handleLastTouchScoring('top');
          } else if (newState.ball.y > canvasSize.height + 20) {
            handleLastTouchScoring('bottom');
          }

          // In multiplayer mode, sync ball/score changes after calculating scores
          if (newState.gameMode === 'multiplayer' && multiplayerState.isGameMaster) {
            updateGameStateRef.current?.(newState);
          }
      } // End of ball logic check - only runs when game is active

      return newState;
    });
  }, [keys, canvasSize, localTestMode, mouseY, mouseX, touchY, controlSide]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore key repeat events
      if (e.repeat) return;

      console.log('🎮 KEY PRESSED:', {
        key: e.key,
        showAudioPrompt,
        showStartScreen: gameState.showStartScreen,
        isConnected: multiplayerState.isConnected,
        connectionStatus,
        audioPromptDismissed: audioPromptDismissedRef.current
      });

      // Handle audio prompt dismissal with spacebar - dismiss and show start screen
      if (showAudioPrompt && !audioPromptDismissedRef.current && e.key === ' ') {
        console.log('🎵 DISMISSING AUDIO PROMPT WITH SPACEBAR');
        audioPromptDismissedRef.current = true;
        setShowAudioPrompt(false);
        setGameState(prev => ({ ...prev, showStartScreen: true }));
        await initializeAudio();

        // Ensure canvas gets focus for keyboard events
        setTimeout(() => {
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.focus();
            console.log('🎯 CANVAS FOCUSED FOR START SCREEN');
          }
        }, 100);

        return;
      }

      // Handle non-spacebar audio prompt dismissal (other keys just dismiss, don't start game)
      if (showAudioPrompt && !audioPromptDismissedRef.current && e.key !== ' ') {
        audioPromptDismissedRef.current = true;
        setShowAudioPrompt(false);
        setGameState(prev => ({ ...prev, showStartScreen: true }));
        await initializeAudio();

        // Ensure canvas gets focus for keyboard events
        setTimeout(() => {
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.focus();
            console.log('🎯 CANVAS FOCUSED FOR START SCREEN');
          }
        }, 100);

        return;
      }


      // Initialize audio on first user interaction
      await initializeAudio();

      // Start ambient sounds immediately on first keyboard interaction (including title screen)
      if (!ambienceActiveRef.current && audioContextRef.current) {
        setTimeout(() => {
          // startAmbienceSound() // Disabled - now using global ambient music;
        }, 50); // Even shorter delay
      }

      switch (e.key.toLowerCase()) {
        case 'w':
          e.preventDefault();
          setKeys(prev => ({ ...prev, w: true }));
          break;
        case 's':
          e.preventDefault();
          setKeys(prev => ({ ...prev, s: true }));
          break;
        case 'arrowup':
          e.preventDefault();
          setKeys(prev => ({ ...prev, up: true }));
          break;
        case 'arrowdown':
          e.preventDefault();
          setKeys(prev => ({ ...prev, down: true }));
          break;
        case 'a':
          e.preventDefault();
          setKeys(prev => ({ ...prev, a: true }));
          break;
        case 'd':
          e.preventDefault();
          setKeys(prev => ({ ...prev, d: true }));
          break;
        case 'arrowleft':
          e.preventDefault();
          setKeys(prev => ({ ...prev, left: true }));
          break;
        case 'arrowright':
          e.preventDefault();
          setKeys(prev => ({ ...prev, right: true }));
          break;
        case 'l':
          e.preventDefault();
          setLocalTestMode(prev => !prev);
          break;
        case 'c':
          e.preventDefault();
          setCrtEffect(prev => !prev);
          break;
        case 'm':
          e.preventDefault();
          console.log('🎵 M key pressed! Audio context state:', {
            audioContext: !!audioContextRef.current,
            ambienceGain: !!ambienceMasterGainRef.current,
            speechGain: !!speechMasterGainRef.current,
            beepsGain: !!beepsMasterGainRef.current
          });

          // COMPREHENSIVE AUDIO INITIALIZATION AND MUTE TOGGLE
          console.log('🎵 M key pressed - initializing audio system...');

          // Initialize audio context if needed
          if (!audioContextRef.current) {
            try {
              audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
              console.log('🎵 Created new AudioContext');
            } catch (error) {
              console.error('❌ Failed to create AudioContext:', error);
              break;
            }
          }

          // Resume audio context if suspended (required by browser autoplay policies)
          if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().then(() => {
              console.log('🎵 Resumed AudioContext');
            }).catch((error) => {
              console.error('❌ Failed to resume AudioContext:', error);
            });
          }

          // Create gain nodes if they don't exist
          if (!ambienceMasterGainRef.current && audioContextRef.current) {
            ambienceMasterGainRef.current = audioContextRef.current.createGain();
            ambienceMasterGainRef.current.gain.setValueAtTime(0.15, audioContextRef.current.currentTime);
            ambienceMasterGainRef.current.connect(audioContextRef.current.destination);
            console.log('🎵 Created ambience gain node');
          }

          if (!speechMasterGainRef.current && audioContextRef.current) {
            speechMasterGainRef.current = audioContextRef.current.createGain();
            speechMasterGainRef.current.gain.setValueAtTime(0.15, audioContextRef.current.currentTime);
            speechMasterGainRef.current.connect(audioContextRef.current.destination);
            console.log('🎵 Created speech gain node');
          }

          if (!beepsMasterGainRef.current && audioContextRef.current) {
            beepsMasterGainRef.current = audioContextRef.current.createGain();
            beepsMasterGainRef.current.gain.setValueAtTime(0.15, audioContextRef.current.currentTime);
            beepsMasterGainRef.current.connect(audioContextRef.current.destination);
            console.log('🎵 Created beeps gain node');
          }

          // Now toggle mute with all gain nodes available
          if (ambienceMasterGainRef.current && speechMasterGainRef.current && beepsMasterGainRef.current && audioContextRef.current) {
            const isCurrentlyMuted = ambienceMasterGainRef.current.gain.value === 0;

            // Toggle logic: if muted (0), restore levels; if unmuted, set to 0
            const ambientLevel = isCurrentlyMuted ? 0.15 : 0;
            const speechLevel = isCurrentlyMuted ? 0.15 : 0;
            const beepsLevel = isCurrentlyMuted ? 0.15 : 0;

            const currentTime = audioContextRef.current.currentTime;
            ambienceMasterGainRef.current.gain.setValueAtTime(ambientLevel, currentTime);
            speechMasterGainRef.current.gain.setValueAtTime(speechLevel, currentTime);
            beepsMasterGainRef.current.gain.setValueAtTime(beepsLevel, currentTime);

            console.log(`🔊 Audio ${isCurrentlyMuted ? 'UNMUTED' : 'MUTED'} - Levels: ambient=${ambientLevel}, speech=${speechLevel}, beeps=${beepsLevel}`);

            // Visual feedback
            if (isCurrentlyMuted) {
              // Show unmuted message on screen briefly
              console.log('🔊 AUDIO ENABLED');
            } else {
              // Show muted message on screen briefly
              console.log('🔇 AUDIO MUTED');
            }
          } else {
            console.log('❌ Failed to create or access audio gain nodes');
          }
          break;
        case ' ':
          e.preventDefault();
          // Spacebar is handled like any other key now
          break;
      }

      // Check if showing start screen OR if audio prompt was just dismissed - start game with any key
      const audioJustDismissed = audioPromptDismissedRef.current && showAudioPrompt;
      const shouldStartGame = gameState.showStartScreen || audioJustDismissed;

      console.log('🚀 START SCREEN CHECK:', {
        showStartScreen: gameState.showStartScreen,
        audioJustDismissed,
        shouldStartGame,
        about_to_enter: shouldStartGame ? 'YES - ENTERING START LOGIC' : 'NO - SKIPPING START LOGIC'
      });

      if (shouldStartGame) {
        console.log('🚀 STARTING GAME FROM START SCREEN!');
        // Try to connect to multiplayer WebSocket
        if (!multiplayerState.isConnected && connectionStatus !== 'error') {
          try {
            connectWebSocket();
            setGameState(prev => ({
              ...prev,
              showStartScreen: false,
              gameMode: 'multiplayer',
              isPlaying: true,
                ball: {
                ...prev.ball,
                dx: Math.random() > 0.5 ? MIN_BALL_SPEED : -MIN_BALL_SPEED,
                dy: (Math.random() - 0.5) * MIN_BALL_SPEED * 0.8
              }
            }));
            setTimeout(() => speakRobotic('CONNECTING TO SERVER'), 100);
          } catch (error) {
            console.error('❌ Failed to connect to multiplayer:', error);
            // Fallback to single player if connection fails
            setGameState(prev => ({
              ...prev,
              showStartScreen: false,
              gameMode: 'player',
              isPlaying: true,
              ball: {
              ...prev.ball,
              dx: Math.random() > 0.5 ? MIN_BALL_SPEED : -MIN_BALL_SPEED,
              dy: (Math.random() - 0.5) * MIN_BALL_SPEED * 0.8
            }
            }));
            setTimeout(() => speakRobotic('CONNECTION FAILED, STARTING SINGLE PLAYER'), 100);
          }
        } else if (multiplayerState.isConnected) {
          // Already connected, just start the game
          setGameState(prev => ({
            ...prev,
            showStartScreen: false,
            gameMode: 'multiplayer',
            isPlaying: true,
              ball: {
              ...prev.ball,
              dx: Math.random() > 0.5 ? MIN_BALL_SPEED : -MIN_BALL_SPEED,
              dy: (Math.random() - 0.5) * MIN_BALL_SPEED * 0.8
            }
          }));
          setTimeout(() => speakRobotic('MULTIPLAYER GAME STARTING'), 100);
        } else {
          // Connection error, fallback to single player
          console.log('⚠️ Connection error, starting single player');
          setGameState(prev => ({
            ...prev,
            showStartScreen: false,
            gameMode: 'player',
            isPlaying: true,
              ball: {
              ...prev.ball,
              dx: Math.random() > 0.5 ? MIN_BALL_SPEED : -MIN_BALL_SPEED,
              dy: (Math.random() - 0.5) * MIN_BALL_SPEED * 0.8
            }
          }));
          setTimeout(() => speakRobotic('STARTING SINGLE PLAYER MODE'), 100);
        }
        return;
      }


    };

    const handleKeyUp = (e: KeyboardEvent) => {

      switch (e.key.toLowerCase()) {
        case 'w':
          e.preventDefault();
          setKeys(prev => ({ ...prev, w: false }));
          break;
        case 's':
          e.preventDefault();
          setKeys(prev => ({ ...prev, s: false }));
          break;
        case 'arrowup':
          e.preventDefault();
          setKeys(prev => ({ ...prev, up: false }));
          break;
        case 'arrowdown':
          e.preventDefault();
          setKeys(prev => ({ ...prev, down: false }));
          break;
        case 'a':
          e.preventDefault();
          setKeys(prev => ({ ...prev, a: false }));
          break;
        case 'd':
          e.preventDefault();
          setKeys(prev => ({ ...prev, d: false }));
          break;
        case 'arrowleft':
          e.preventDefault();
          setKeys(prev => ({ ...prev, left: false }));
          break;
        case 'arrowright':
          e.preventDefault();
          setKeys(prev => ({ ...prev, right: false }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [connectionStatus, multiplayerState.isConnected, gameState.gameMode, connectWebSocket, resetRoom, localTestMode, crtEffect]);

  // Helper function to convert hex to RGB
  const hexToRgb = useCallback((hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }, []);

  // 🚀 OPTIMIZED CRT Effect - uses cached time for better performance
  const applyCRTEffect = useCallback((ctx: CanvasRenderingContext2D, canvasSize: { width: number; height: number }) => {
    const time = cachedTimeRef.current * 0.001;
    const frameCount = Math.floor(time * 15); // Frame count for animation timing

    ctx.save();

    // 🚀 OPTIMIZED CRT Curvature Effect - Use cached gradient
    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;

    // Check if gradient cache needs update (canvas size changed)
    const cache = gradientCacheRef.current;
    const sizeChanged = !cache.lastCanvasSize ||
      cache.lastCanvasSize.width !== canvasSize.width ||
      cache.lastCanvasSize.height !== canvasSize.height;

    if (sizeChanged || !cache.curvature) {
      // Create and cache the curvature gradient
      cache.curvature = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, Math.max(canvasSize.width, canvasSize.height) * 0.7
      );
      cache.curvature.addColorStop(0, 'rgba(255, 255, 255, 1)');
      cache.curvature.addColorStop(0.6, 'rgba(255, 255, 255, 0.95)');
      cache.curvature.addColorStop(0.9, 'rgba(255, 255, 255, 0.8)');
      cache.curvature.addColorStop(1, 'rgba(255, 255, 255, 0.65)');
    }

    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = cache.curvature;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // 🚀 OPTIMIZED Scanlines - Use cached gradient
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 1;

    // Pre-calculate scanline pattern once per 4 frames for better performance
    const scanlineOffset = frameCount % 2;

    // Create scanline gradient once and cache it
    if (!cache.scanline) {
      cache.scanline = ctx.createLinearGradient(0, 0, 0, 4);
      cache.scanline.addColorStop(0, 'rgba(0, 0, 0, 0.2)');
      cache.scanline.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
      cache.scanline.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
    }

    ctx.fillStyle = cache.scanline;

    // Draw scanlines every 2 pixels with pattern offset
    for (let y = scanlineOffset; y < canvasSize.height; y += 4) {
      ctx.fillRect(0, y, canvasSize.width, 1);
    }


    // 🚀 OPTIMIZED Vignette - Use cached gradient
    ctx.globalCompositeOperation = 'multiply';

    if (sizeChanged || !cache.vignette) {
      // Create and cache the vignette gradient
      cache.vignette = ctx.createRadialGradient(
        canvasSize.width / 2, canvasSize.height / 2, 0,
        canvasSize.width / 2, canvasSize.height / 2, canvasSize.width * 0.7
      );
      cache.vignette.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      cache.vignette.addColorStop(0.8, 'rgba(255, 255, 255, 0.9)');
      cache.vignette.addColorStop(1, 'rgba(255, 255, 255, 0.7)');

      // Update cached canvas size
      cache.lastCanvasSize = { width: canvasSize.width, height: canvasSize.height };
    }

    ctx.fillStyle = cache.vignette;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // 🚀 OPTIMIZED Screen Flicker using precalculated values
    const flickerIndex = Math.floor((time * 47) % 60);
    const flicker = PRECALC_CONSTANTS.flickerValues[flickerIndex];
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgba(255, 255, 255, ${flicker})`;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // 6. Phosphor Glow - Only around key elements, very minimal
    if (frameCount % 3 === 0) { // Every 3rd frame only
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.08;
      const currentColors = COLOR_PALETTE[gameState.colorIndex];
      ctx.shadowColor = currentColors.foreground;
      ctx.shadowBlur = 2;
      ctx.fillStyle = currentColors.foreground;

      ctx.shadowBlur = 0;
    }

    // 6.5. Enhanced RGB Bleed Effect - More prominent chromatic aberration simulation
    // frameCount already declared above, reuse it
    if (frameCount % 1 === 0) { // Every frame for more visible effect
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.08; // More prominent effect

      const currentColors = COLOR_PALETTE[gameState.colorIndex];
      const rgbColor = hexToRgb(currentColors.foreground);

      // Create more noticeable horizontal red/blue shift for RGB bleed
      const bleedOffset = 2; // 2 pixel offset for more visible effect

      // Red channel shift (left) - more prominent
      ctx.fillStyle = `rgba(${rgbColor.r}, 0, 0, 0.5)`;
      ctx.fillRect(-bleedOffset, 0, canvasSize.width + bleedOffset, canvasSize.height);

      // Blue channel shift (right) - more prominent
      ctx.fillStyle = `rgba(0, 0, ${rgbColor.b}, 0.5)`;
      ctx.fillRect(bleedOffset, 0, canvasSize.width - bleedOffset, canvasSize.height);

      // Green stays in place but enhanced for better contrast
      ctx.fillStyle = `rgba(0, ${Math.min(255, rgbColor.g + 20)}, 0, 0.3)`;
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
    }

    // 7. Enhanced CRT Noise - Static and interference patterns
    if (Math.random() < 0.4) { // 40% chance per frame for static noise
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.025;

      // Random static noise (white noise)
      for (let i = 0; i < 15; i++) {
        const x = Math.random() * canvasSize.width;
        const y = Math.random() * canvasSize.height;
        const brightness = Math.random() * 255;
        ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
        ctx.fillRect(x, y, Math.random() < 0.3 ? 2 : 1, Math.random() < 0.2 ? 2 : 1);
      }

      // Colored noise (RGB static)
      for (let i = 0; i < 8; i++) {
        const x = Math.random() * canvasSize.width;
        const y = Math.random() * canvasSize.height;
        const r = Math.random() * 255;
        const g = Math.random() * 255;
        const b = Math.random() * 255;
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }


    // 8. Refresh Line - Very occasionally
    if (Math.random() < 0.008) { // 0.8% chance per frame
      const refreshY = (time * 300) % canvasSize.height;
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.05;
      const currentColors = COLOR_PALETTE[gameState.colorIndex];
      ctx.fillStyle = currentColors.foreground;
      ctx.fillRect(0, refreshY, canvasSize.width, 1);
    }

    ctx.restore();
  }, [gameState.colorIndex]);


  // High-performance render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // 📊 FPS Counter calculation (efficient)
    frameCountRef.current++;
    const now = Date.now();
    if (now - lastFpsUpdateRef.current >= 1000) { // Update every second
      fpsRef.current = Math.round((frameCountRef.current * 1000) / (now - lastFpsUpdateRef.current));
      frameCountRef.current = 0;
      lastFpsUpdateRef.current = now;
    }

    // Apply rumble effect by offsetting the entire canvas content
    let rumbleOffsetX = 0;
    let rumbleOffsetY = 0;
    if (gameState.rumbleEffect?.isActive) {
      const elapsed = Date.now() - gameState.rumbleEffect.startTime;
      const isScoreRumble = gameState.rumbleEffect.intensity > 20;
      const duration = isScoreRumble ? 800 : 300; // Longer for scores
      const progress = Math.min(elapsed / duration, 1);

      // Different rumble patterns for scores vs paddle hits
      let intensity;
      if (isScoreRumble) {
        // Score rumble: Start strong, decay slower, with occasional spikes
        const baseIntensity = gameState.rumbleEffect.intensity * (1 - progress * 0.7); // Slower decay
        const spike = Math.sin(elapsed * 0.02) * 0.3; // Oscillating spikes
        intensity = baseIntensity + spike * baseIntensity;
      } else {
        // Paddle hit rumble: Quick fade
        intensity = gameState.rumbleEffect.intensity * (1 - progress);
      }

      rumbleOffsetX = (Math.random() - 0.5) * intensity * 3; // Stronger multiplier
      rumbleOffsetY = (Math.random() - 0.5) * intensity * 3;
      ctx.translate(rumbleOffsetX, rumbleOffsetY);
    }

    // Optimize canvas for performance and pixel-perfect rendering
    ctx.imageSmoothingEnabled = false; // Disable anti-aliasing for pixel-perfect rendering

    // Disable text smoothing and antialiasing for pixelated text
    ctx.textRenderingOptimization = 'optimizeSpeed';
    ctx.fontKerning = 'none';
    (ctx as any).textRenderingOptimization = 'geometricPrecision';
    (ctx as any).fontSmooth = 'never';
    (ctx as any).webkitFontSmoothing = 'none';
    (ctx as any).mozOsxFontSmoothing = 'unset';

    // Get current color scheme
    const currentColors = COLOR_PALETTE[gameState.colorIndex];

    // Clear canvas with dynamic background color
    ctx.fillStyle = currentColors.background;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // 🔊 AUDIO INTERACTION PROMPT (first load only)
    if (showAudioPrompt) {
      // Draw playfield borders - same as gameplay area
      ctx.strokeStyle = currentColors.foreground;
      ctx.lineWidth = 12;
      ctx.setLineDash([]); // Solid lines for borders
      ctx.beginPath();
      const borderInset = 6; // Half of line width
      // Top border - full width
      ctx.moveTo(0, borderInset);
      ctx.lineTo(canvasSize.width, borderInset);
      // Bottom border - full width
      ctx.moveTo(0, canvasSize.height - borderInset);
      ctx.lineTo(canvasSize.width, canvasSize.height - borderInset);
      // Left border - full height
      ctx.moveTo(borderInset, 0);
      ctx.lineTo(borderInset, canvasSize.height);
      // Right border - full height
      ctx.moveTo(canvasSize.width - borderInset, 0);
      ctx.lineTo(canvasSize.width - borderInset, canvasSize.height);
      ctx.stroke();

      // Main prompt
      ctx.fillStyle = currentColors.foreground;
      ctx.font = 'bold 32px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('AUDIO REQUIRED', canvasSize.width / 2, canvasSize.height / 2 - 80);

      // Instructions
      ctx.font = 'bold 16px "Press Start 2P", monospace';
      ctx.fillText('This game uses sound effects', canvasSize.width / 2, canvasSize.height / 2 - 20);
      ctx.fillText('and speech synthesis', canvasSize.width / 2, canvasSize.height / 2 + 10);

      // Interaction prompt
      ctx.font = 'bold 20px "Press Start 2P", monospace';
      ctx.fillText('CLICK ANYWHERE TO CONTINUE', canvasSize.width / 2, canvasSize.height / 2 + 80);

      // Small footer
      ctx.font = 'bold 12px "Press Start 2P", monospace';
      ctx.fillText('Required for browser audio policy compliance', canvasSize.width / 2, canvasSize.height / 2 + 120);

      return; // Don't render anything else when showing audio prompt
    }

    // 🚀 START SCREEN
    if (gameState.showStartScreen) {
      // Draw playfield borders - same as gameplay area
      ctx.strokeStyle = currentColors.foreground;
      ctx.lineWidth = 12;
      ctx.setLineDash([]); // Solid lines for borders
      ctx.beginPath();
      const borderInset = 6; // Half of line width
      // Top border - full width
      ctx.moveTo(0, borderInset);
      ctx.lineTo(canvasSize.width, borderInset);
      // Bottom border - full width
      ctx.moveTo(0, canvasSize.height - borderInset);
      ctx.lineTo(canvasSize.width, canvasSize.height - borderInset);
      // Left border - full height
      ctx.moveTo(borderInset, 0);
      ctx.lineTo(borderInset, canvasSize.height);
      // Right border - full height
      ctx.moveTo(canvasSize.width - borderInset, 0);
      ctx.lineTo(canvasSize.width - borderInset, canvasSize.height);
      ctx.stroke();

      // Main title
      ctx.fillStyle = currentColors.foreground;
      ctx.font = 'bold 48px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('4-PLAYER PONG', canvasSize.width / 2, canvasSize.height / 2 - 200);

      // Controls section
      ctx.font = 'bold 24px "Press Start 2P", monospace';
      ctx.fillText('CONTROLS', canvasSize.width / 2, canvasSize.height / 2 - 120);

      ctx.font = '16px "Press Start 2P", monospace';
      const controlsY = canvasSize.height / 2 - 80;

      // Player controls
      ctx.textAlign = 'left';
      ctx.fillText('PLAYER 1 (LEFT): W/S KEYS', canvasSize.width / 2 - 300, controlsY);
      ctx.fillText('PLAYER 2 (RIGHT): ↑/↓ KEYS OR MOUSE/TOUCH', canvasSize.width / 2 - 300, controlsY + 30);
      ctx.fillText('PLAYER 3 (TOP): A/D KEYS', canvasSize.width / 2 - 300, controlsY + 60);
      ctx.fillText('PLAYER 4 (BOTTOM): ←/→ KEYS', canvasSize.width / 2 - 300, controlsY + 90);

      // Options
      ctx.fillText('OPTIONS:', canvasSize.width / 2 - 300, controlsY + 140);
      ctx.fillText('C - TOGGLE CRT EFFECT', canvasSize.width / 2 - 300, controlsY + 170);
      ctx.fillText('M - TOGGLE MUSIC', canvasSize.width / 2 - 300, controlsY + 200);

      // Start instructions with blinking effect
      ctx.font = 'bold 20px "Press Start 2P", monospace';
      ctx.textAlign = 'center';

      // Create blinking effect - visible for 0.8s, invisible for 0.4s (1.2s cycle)
      const blinkCycle = (Date.now() % 1200) / 1200; // 0 to 1
      const isVisible = blinkCycle < 0.67; // Visible for 67% of the cycle

      if (isVisible) {
        // Use a bright attention-grabbing color - cyan from the palette
        ctx.fillStyle = '#00f5ff'; // Cyan color for visibility
        ctx.fillText('PRESS ANY KEY TO START', canvasSize.width / 2, canvasSize.height / 2 + 150);
      }

      // Reset color back to normal for other elements
      ctx.fillStyle = currentColors.foreground;

      // Footer with CRT status
      ctx.font = '14px "Press Start 2P", monospace';
      ctx.fillText(`CRT EFFECT: ${crtEffect ? 'ON' : 'OFF'}`, canvasSize.width / 2, canvasSize.height / 2 + 200);

      return; // Don't render game elements when showing start screen
    }

    // Draw playfield borders - thick as paddles - using dynamic color
    // Inset borders by half the line width so they're fully visible
    ctx.strokeStyle = currentColors.foreground;
    ctx.lineWidth = 12;
    ctx.setLineDash([]); // Solid lines for borders
    ctx.beginPath();
    const borderInset = 6; // Half of line width
    // Top border - full width
    ctx.moveTo(0, borderInset);
    ctx.lineTo(canvasSize.width, borderInset);
    // Bottom border - full width
    ctx.moveTo(0, canvasSize.height - borderInset);
    ctx.lineTo(canvasSize.width, canvasSize.height - borderInset);
    // Left border - full height
    ctx.moveTo(borderInset, 0);
    ctx.lineTo(borderInset, canvasSize.height);
    // Right border - full height
    ctx.moveTo(canvasSize.width - borderInset, 0);
    ctx.lineTo(canvasSize.width - borderInset, canvasSize.height);
    ctx.stroke();


    // Draw comet trails first (behind everything) - enhanced in spectator mode
    const currentTime = Date.now();

    // Draw ball trail
    if (gameState.trails?.ball?.length > 1) {
      for (let i = 0; i < gameState.trails.ball.length - 1; i++) {
        const point = gameState.trails.ball[i];
        const age = currentTime - point.timestamp;
        const alpha = Math.max(0, 1 - (age / 500)); // Fade over 500ms

        if (alpha > 0) {
          // Ball trail visibility - hardly visible
          const ballTrailOpacity = 0.04;
          ctx.globalAlpha = alpha * ballTrailOpacity;
          ctx.fillStyle = currentColors.foreground;

          // Decrease size based on age for comet effect
          const trailSize = gameState.ball.size * (0.3 + alpha * 0.7);
          ctx.fillRect(
            point.x - trailSize / 2,
            point.y - trailSize / 2,
            trailSize,
            trailSize
          );
        }
      }
    }

    // Draw paddle trails
    const renderVerticalPaddleTrail = (trail: TrailPoint[], paddleX: number) => {
      if (trail.length > 1) {
        for (let i = 0; i < trail.length - 1; i++) {
          const point = trail[i];
          const age = currentTime - point.timestamp;
          const alpha = Math.max(0, 1 - (age / 1500)); // Fade over 1500ms


          if (alpha > 0 && point.width && point.height) {
            // Paddle trail visibility - hardly visible
            const paddleTrailOpacity = 0.03;
            ctx.globalAlpha = alpha * paddleTrailOpacity;
            ctx.fillStyle = currentColors.foreground;

            // Keep full thickness for newer trails, then gradually thin out
            const thicknessFactor = alpha > 0.7 ? 1.0 : (0.3 + alpha * 0.7);
            const trailWidth = point.width * thicknessFactor;
            const trailHeight = point.height * thicknessFactor;


            ctx.fillRect(
              paddleX - trailWidth / 2,
              point.y - trailHeight / 2,
              trailWidth,
              trailHeight
            );
          }
        }
      }
    };

    const renderHorizontalPaddleTrail = (trail: TrailPoint[], paddleY: number) => {
      if (trail.length > 1) {
        for (let i = 0; i < trail.length - 1; i++) {
          const point = trail[i];
          const age = currentTime - point.timestamp;
          const alpha = Math.max(0, 1 - (age / 1500)); // Fade over 1500ms

          if (alpha > 0 && point.width && point.height) {
            // Paddle trail visibility - hardly visible
            const paddleTrailOpacity = 0.03;
            ctx.globalAlpha = alpha * paddleTrailOpacity;
            ctx.fillStyle = currentColors.foreground;

            // Keep full thickness for newer trails, then gradually thin out
            const thicknessFactor = alpha > 0.7 ? 1.0 : (0.3 + alpha * 0.7);
            const trailWidth = point.width * thicknessFactor;
            const trailHeight = point.height * thicknessFactor;

            ctx.fillRect(
              point.x - trailWidth / 2,
              paddleY - trailHeight / 2,
              trailWidth,
              trailHeight
            );
          }
        }
      }
    };

    // Render left and right paddle trails (vertical paddles)
    if (gameState.trails?.leftPaddle?.length > 0) {
    }
    if (gameState.trails?.leftPaddle) {
      renderVerticalPaddleTrail(gameState.trails.leftPaddle, 30 + gameState.paddles.left.width / 2);
    }
    if (gameState.trails?.rightPaddle) {
      renderVerticalPaddleTrail(gameState.trails.rightPaddle, canvasSize.width - 30 - gameState.paddles.right.width / 2);
    }

    // Render top and bottom paddle trails (horizontal paddles)
    if (gameState.paddles.top && gameState.trails?.topPaddle) {
      renderHorizontalPaddleTrail(gameState.trails.topPaddle, 30 + gameState.paddles.top.height / 2);
    }
    if (gameState.paddles.bottom && gameState.trails?.bottomPaddle) {
      renderHorizontalPaddleTrail(gameState.trails.bottomPaddle, canvasSize.height - 30 - gameState.paddles.bottom.height / 2);
    }

    // Reset alpha for normal rendering
    ctx.globalAlpha = 1;

    // Draw paddles - using dynamic color (spacing only from own wall)
    const leftPaddleX = 30; // 30px spacing from left wall only
    const rightPaddleX = canvasSize.width - 30 - gameState.paddles.right.width; // 30px spacing from right wall only
    const topPaddleY = 30; // 30px spacing from top wall only
    const bottomPaddleY = gameState.paddles.bottom ?
      canvasSize.height - 30 - gameState.paddles.bottom.height :
      canvasSize.height - 30 - 12; // 30px spacing from bottom wall only, fallback to 12px height

    // Get player side for color determination
    const currentPlayerSide = multiplayerStateRef.current?.playerSide;
    const humanPlayerColor = getHumanPlayerColor(gameState.colorIndex);

    // Draw left paddle
    ctx.fillStyle = (gameState.gameMode === 'multiplayer' && currentPlayerSide === 'left')
      ? humanPlayerColor
      : currentColors.foreground;
    ctx.fillRect(leftPaddleX, gameState.paddles.left.y, gameState.paddles.left.width, gameState.paddles.left.height);

    // Draw right paddle - in player mode, right paddle is human-controlled
    ctx.fillStyle = ((gameState.gameMode === 'multiplayer' && currentPlayerSide === 'right') ||
                     (gameState.gameMode === 'player'))
      ? humanPlayerColor
      : currentColors.foreground;
    ctx.fillRect(rightPaddleX, gameState.paddles.right.y, gameState.paddles.right.width, gameState.paddles.right.height);

    // Draw top and bottom paddles (horizontal) - only if they exist
    if (gameState.paddles.top) {
      ctx.fillStyle = (gameState.gameMode === 'multiplayer' && currentPlayerSide === 'top')
        ? humanPlayerColor
        : currentColors.foreground;
      ctx.fillRect(gameState.paddles.top.x, topPaddleY, gameState.paddles.top.width, gameState.paddles.top.height);
    }
    if (gameState.paddles.bottom) {
      ctx.fillStyle = (gameState.gameMode === 'multiplayer' && currentPlayerSide === 'bottom')
        ? humanPlayerColor
        : currentColors.foreground;
      ctx.fillRect(gameState.paddles.bottom.x, bottomPaddleY, gameState.paddles.bottom.width, gameState.paddles.bottom.height);
    }

    // Draw ball - using dynamic color (hide during pause)
    if (!gameState.isPaused) {
      // Check if ball should be invisible
      const invisibleEffect = gameState.activeEffects?.find(e => e.type === 'invisible_ball');
      if (!invisibleEffect) {
        ctx.fillStyle = currentColors.foreground; // FIX: Set ball color before drawing
        ctx.fillRect(gameState.ball.x, gameState.ball.y, gameState.ball.size, gameState.ball.size);
      } else {
        // Draw faint outline for invisible ball
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = currentColors.foreground;
        ctx.lineWidth = 1;
        ctx.strokeRect(gameState.ball.x, gameState.ball.y, gameState.ball.size, gameState.ball.size);
        ctx.globalAlpha = 1;
      }
    }

    // 🟠 Draw extra balls (for multi-ball effect)
    if (!gameState.isPaused) {
      (gameState.extraBalls || []).forEach(extraBall => {
        ctx.fillStyle = currentColors.foreground;
        ctx.fillRect(extraBall.x, extraBall.y, extraBall.size, extraBall.size);
      });
    }

    // 🌪️ Draw physics forces (attractors and repulsors) with enhanced animations
    if (!gameState.isPaused) {
      (gameState.physicsForces || []).forEach(force => {
        const centerX = force.x;
        const centerY = force.y;
        const age = currentTime - force.spawnTime;
        const lifeProgress = age / force.lifespan;

        // Pulsing animation with more complex waves
        const pulse = Math.sin(force.animationPhase) * 0.4 + 1;
        const secondaryPulse = Math.cos(force.animationPhase * 1.3) * 0.2 + 1;
        const size = 25 * pulse * secondaryPulse;

        // Fade out near end of life with more dramatic effect
        const alpha = lifeProgress > 0.7 ? 1 - Math.pow((lifeProgress - 0.7) / 0.3, 2) : 1;

        // Spawn animation - grow from nothing
        const spawnProgress = Math.min(age / 500, 1); // 500ms spawn animation
        const spawnScale = Math.sin(spawnProgress * Math.PI * 0.5);

        ctx.globalAlpha = alpha * spawnScale;

        if (force.type === 'attractor') {
          // Attractor: Inward spiraling energy with cyan color
          ctx.strokeStyle = force.color;
          ctx.fillStyle = force.color;
          ctx.lineWidth = 3;

          // Draw multiple concentric rotating rings
          for (let ring = 0; ring < 4; ring++) {
            const ringRadius = (size * 0.3) + ring * 12;
            const rotation = force.animationPhase * (ring + 1) * 0.8;

            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
              const angle = (i / 6) * Math.PI * 2 + rotation;
              const x = centerX + Math.cos(angle) * ringRadius;
              const y = centerY + Math.sin(angle) * ringRadius;

              if (i === 0) {
                ctx.moveTo(x, y);
              } else {
                ctx.lineTo(x, y);
              }
            }
            ctx.closePath();
            ctx.stroke();
          }

          // Central glowing core with particles
          ctx.globalAlpha = alpha * spawnScale * 0.8;
          ctx.beginPath();
          ctx.arc(centerX, centerY, size * 0.2, 0, Math.PI * 2);
          ctx.fill();

          // Particle swirl effect
          ctx.globalAlpha = alpha * spawnScale * 0.6;
          for (let p = 0; p < 8; p++) {
            const particleAngle = (p / 8) * Math.PI * 2 + force.animationPhase * 2;
            const particleRadius = size * 0.6 + Math.sin(force.animationPhase * 3 + p) * 8;
            const px = centerX + Math.cos(particleAngle) * particleRadius;
            const py = centerY + Math.sin(particleAngle) * particleRadius;

            ctx.beginPath();
            ctx.arc(px, py, 2, 0, Math.PI * 2);
            ctx.fill();
          }

        } else {
          // Repulsor: Outward explosive energy with pink/red color
          ctx.strokeStyle = force.color;
          ctx.fillStyle = force.color;
          ctx.lineWidth = 3;

          // Draw explosive radiating spikes
          for (let spike = 0; spike < 16; spike++) {
            const angle = (spike / 16) * Math.PI * 2 + force.animationPhase;
            const innerRadius = size * 0.2;
            const outerRadius = size * 0.8 + Math.sin(force.animationPhase * 3 + spike * 0.5) * 15;

            const innerX = centerX + Math.cos(angle) * innerRadius;
            const innerY = centerY + Math.sin(angle) * innerRadius;
            const outerX = centerX + Math.cos(angle) * outerRadius;
            const outerY = centerY + Math.sin(angle) * outerRadius;

            ctx.beginPath();
            ctx.moveTo(innerX, innerY);
            ctx.lineTo(outerX, outerY);
            ctx.stroke();
          }

          // Central explosive diamond with energy
          ctx.globalAlpha = alpha * spawnScale * 0.9;
          ctx.beginPath();
          const diamondSize = size * 0.3;
          ctx.moveTo(centerX, centerY - diamondSize);
          ctx.lineTo(centerX + diamondSize, centerY);
          ctx.lineTo(centerX, centerY + diamondSize);
          ctx.lineTo(centerX - diamondSize, centerY);
          ctx.closePath();
          ctx.fill();

          // Energy burst particles
          ctx.globalAlpha = alpha * spawnScale * 0.5;
          for (let p = 0; p < 12; p++) {
            const burstAngle = (p / 12) * Math.PI * 2 + force.animationPhase * -1.5;
            const burstRadius = size * 0.9 + Math.cos(force.animationPhase * 2 + p * 0.7) * 10;
            const bx = centerX + Math.cos(burstAngle) * burstRadius;
            const by = centerY + Math.sin(burstAngle) * burstRadius;

            ctx.beginPath();
            ctx.arc(bx, by, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Draw influence radius with dynamic opacity
        ctx.globalAlpha = alpha * spawnScale * 0.15 * (pulse * 0.5 + 0.5);
        ctx.strokeStyle = force.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(centerX, centerY, force.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.globalAlpha = 1;
      });
    }

    // Draw pickups if they exist
    gameState.pickups?.forEach((pickup) => {
      const time = cachedTimeRef.current * 0.005;
      // 🚀 OPTIMIZED pulse using precalculated values
      const pulseIndex = Math.floor(time % 60);
      const pulse = PRECALC_CONSTANTS.pulseValues[pulseIndex];

      ctx.save();
      ctx.globalAlpha = pulse;

      // Draw pixelated pattern with NO gaps between pixels
      const drawPixelatedPattern = (pattern: string, x: number, y: number, size: number, color: string) => {
        const pixelSize = 8; // Smaller pixels for tighter detail
        const gridSize = Math.floor(size / pixelSize);

        ctx.fillStyle = color;

        // 🚀 OPTIMIZED pattern rendering using precalculated arrays
        const patternMap: { [key: string]: string } = {
          'zigzag': 'lightning',
          'waves': 'waves',
          'circle': 'circle',
          'dot': 'dot',
          'spiral': 'spiral',
          'arrow_up': 'arrow_up',
          'arrow_down': 'arrow_down',
          'double_arrow': 'double_arrow',
          'fence': 'stripes',
          'plus': 'plus',
          'cross': 'cross',
          'stripes': 'stripes',
          'diamond': 'diamond',
          'star': 'star'
        };

        const precalcPattern = PRECALC_PICKUP_PATTERNS[patternMap[pattern] as keyof typeof PRECALC_PICKUP_PATTERNS];
        if (precalcPattern) {
          // 🚀 INSTANT rendering using precalculated 2D boolean array (no nested calculations)
          for (let row = 0; row < 12; row++) {
            for (let col = 0; col < 12; col++) {
              if (precalcPattern[row][col]) {
                ctx.fillRect(x + col * pixelSize, y + row * pixelSize, pixelSize, pixelSize);
              }
            }
          }
          return; // Skip the old switch logic
        }

        // Fallback to old logic for unknown patterns
        switch (pattern) {
          case 'zigzag': // Speed up - lightning bolt
            for (let row = 0; row < gridSize; row++) {
              for (let col = 0; col < gridSize; col++) {
                if ((row < 4 && col >= 6 && col <= 8) ||
                    (row >= 4 && row < 8 && col >= 3 && col <= 5) ||
                    (row >= 8 && col >= 6 && col <= 8)) {
                  ctx.fillRect(x + col * pixelSize, y + row * pixelSize, pixelSize, pixelSize);
                }
              }
            }
            break;

          case 'waves': // Slow down - wavy lines
            for (let row = 0; row < gridSize; row++) {
              for (let col = 0; col < gridSize; col++) {
                if (row === 3 || row === 6 || row === 9) {
                  if (Math.sin(col * 0.8) > 0) {
                    ctx.fillRect(x + col * pixelSize, y + row * pixelSize, pixelSize, pixelSize);
                  }
                }
              }
            }
            break;

          case 'circle': // Big ball - circle
            const centerX = gridSize / 2;
            const centerY = gridSize / 2;
            const radius = gridSize / 3;
            for (let row = 0; row < gridSize; row++) {
              for (let col = 0; col < gridSize; col++) {
                const dist = Math.sqrt((col - centerX) ** 2 + (row - centerY) ** 2);
                if (dist <= radius && dist >= radius - 1.5) {
                  ctx.fillRect(x + col * pixelSize, y + row * pixelSize, pixelSize, pixelSize);
                }
              }
            }
            break;

          case 'dot': // Small ball - small dot
            const dotSize = 3;
            const startX = Math.floor((gridSize - dotSize) / 2);
            const startY = Math.floor((gridSize - dotSize) / 2);
            for (let row = 0; row < dotSize; row++) {
              for (let col = 0; col < dotSize; col++) {
                ctx.fillRect(x + (startX + col) * pixelSize, y + (startY + row) * pixelSize, pixelSize, pixelSize);
              }
            }
            break;

          case 'spiral': // Drunk ball - spiral
            for (let row = 0; row < gridSize; row++) {
              for (let col = 0; col < gridSize; col++) {
                const angle = Math.atan2(row - gridSize/2, col - gridSize/2);
                const dist = Math.sqrt((col - gridSize/2) ** 2 + (row - gridSize/2) ** 2);
                if (Math.sin(angle * 3 + dist * 0.5) > 0.5) {
                  ctx.fillRect(x + col * pixelSize, y + row * pixelSize, pixelSize, pixelSize);
                }
              }
            }
            break;

          case 'arrow_up': // Grow paddle - up arrow
            for (let row = 0; row < gridSize; row++) {
              for (let col = 0; col < gridSize; col++) {
                if ((row >= 2 && row <= 6 && col >= 5 && col <= 7) || // Stem
                    (row >= 0 && row <= 4 && Math.abs(col - 6) <= row)) { // Arrow head
                  ctx.fillRect(x + col * pixelSize, y + row * pixelSize, pixelSize, pixelSize);
                }
              }
            }
            break;

          case 'arrow_down': // Shrink paddle - down arrow
            for (let row = 0; row < gridSize; row++) {
              for (let col = 0; col < gridSize; col++) {
                if ((row >= 2 && row <= 8 && col >= 5 && col <= 7) || // Stem
                    (row >= 6 && row <= 10 && Math.abs(col - 6) <= (10 - row))) { // Arrow head
                  ctx.fillRect(x + col * pixelSize, y + row * pixelSize, pixelSize, pixelSize);
                }
              }
            }
            break;

          case 'arrows': // Reverse controls - left/right arrows
            for (let row = 0; row < gridSize; row++) {
              for (let col = 0; col < gridSize; col++) {
                if ((row >= 4 && row <= 6 && col >= 1 && col <= 4) || // Left arrow
                    (row >= 3 && row <= 7 && col === 1) ||
                    (row >= 4 && row <= 6 && col >= 8 && col <= 11) || // Right arrow
                    (row >= 3 && row <= 7 && col === 11)) {
                  ctx.fillRect(x + col * pixelSize, y + row * pixelSize, pixelSize, pixelSize);
                }
              }
            }
            break;

          case 'ghost': // Invisible ball - dotted outline
            for (let row = 0; row < gridSize; row++) {
              for (let col = 0; col < gridSize; col++) {
                if ((row + col) % 3 === 0 &&
                    ((row === 2 || row === gridSize - 3) && col >= 2 && col <= gridSize - 3) ||
                    ((col === 2 || col === gridSize - 3) && row >= 2 && row <= gridSize - 3)) {
                  ctx.fillRect(x + col * pixelSize, y + row * pixelSize, pixelSize, pixelSize);
                }
              }
            }
            break;

          case 'plus': // Multi ball - plus sign
            for (let row = 0; row < gridSize; row++) {
              for (let col = 0; col < gridSize; col++) {
                if ((row >= 4 && row <= 7 && col >= 1 && col <= 10) || // Horizontal
                    (col >= 4 && col <= 7 && row >= 1 && row <= 10)) { // Vertical
                  ctx.fillRect(x + col * pixelSize, y + row * pixelSize, pixelSize, pixelSize);
                }
              }
            }
            break;

          case 'cross': // Freeze - X pattern
            for (let row = 0; row < gridSize; row++) {
              for (let col = 0; col < gridSize; col++) {
                if (Math.abs(row - col) <= 1 || Math.abs(row - (gridSize - col - 1)) <= 1) {
                  ctx.fillRect(x + col * pixelSize, y + row * pixelSize, pixelSize, pixelSize);
                }
              }
            }
            break;

          case 'stripes': // Super speed - diagonal stripes
            for (let row = 0; row < gridSize; row++) {
              for (let col = 0; col < gridSize; col++) {
                if ((row + col) % 3 === 0) {
                  ctx.fillRect(x + col * pixelSize, y + row * pixelSize, pixelSize, pixelSize);
                }
              }
            }
            break;

          case 'diamond': // Coin shower - diamond shape
            for (let row = 0; row < gridSize; row++) {
              for (let col = 0; col < gridSize; col++) {
                const centerX = gridSize / 2;
                const centerY = gridSize / 2;
                const distanceFromCenter = Math.abs(row - centerY) + Math.abs(col - centerX);
                if (distanceFromCenter >= 3 && distanceFromCenter <= 4) {
                  ctx.fillRect(x + col * pixelSize, y + row * pixelSize, pixelSize, pixelSize);
                }
              }
            }
            break;

          case 'star': // Teleport ball - star shape
            for (let row = 0; row < gridSize; row++) {
              for (let col = 0; col < gridSize; col++) {
                const centerX = gridSize / 2;
                const centerY = gridSize / 2;
                const dx = col - centerX;
                const dy = row - centerY;

                // Create star shape with 5 points
                if ((Math.abs(dx) <= 1 && Math.abs(dy) <= 4) || // Vertical line
                    (Math.abs(dy) <= 1 && Math.abs(dx) <= 4) || // Horizontal line
                    (Math.abs(dx - dy) <= 1 && Math.abs(dx) <= 3) || // Diagonal 1
                    (Math.abs(dx + dy) <= 1 && Math.abs(dx) <= 3)) { // Diagonal 2
                  ctx.fillRect(x + col * pixelSize, y + row * pixelSize, pixelSize, pixelSize);
                }
              }
            }
            break;
        }
      };

      // Draw the pixelated pattern
      drawPixelatedPattern(pickup.pattern, pickup.x, pickup.y, pickup.size, currentColors.foreground);

      ctx.restore();
    });

    // Draw coins
    gameState.coins.forEach((coin) => {
      const time = cachedTimeRef.current * 0.008;
      const bounce = Math.sin(time + coin.x * 0.01) * 2; // Small bounce animation
      const pulse = 0.9 + Math.sin(time * 2) * 0.1; // Subtle pulsing

      ctx.save();
      ctx.globalAlpha = pulse;

      // Draw pixelated coin
      const pixelSize = 2; // Smaller pixels for coins since they're smaller than pickups
      const gridSize = Math.floor(coin.size / pixelSize);
      const coinCenterX = coin.x + coin.size / 2;
      const coinCenterY = coin.y + coin.size / 2 + bounce;

      ctx.fillStyle = currentColors.foreground;

      // Draw pixelated circular coin shape
      for (let row = 0; row < gridSize; row++) {
        for (let col = 0; col < gridSize; col++) {
          const pixelX = coin.x + col * pixelSize;
          const pixelY = coin.y + row * pixelSize + bounce;

          // Calculate distance from center to create circular shape
          const centerX = gridSize / 2;
          const centerY = gridSize / 2;
          const distance = Math.sqrt(Math.pow(col - centerX, 2) + Math.pow(row - centerY, 2));

          // Outer circle (coin border)
          if (distance <= gridSize * 0.45 && distance >= gridSize * 0.35) {
            ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize);
          }

          // Inner circle pattern (coin center with "$" pattern)
          else if (distance <= gridSize * 0.3) {
            // Create a simple "$" or cross pattern
            const relX = col - centerX;
            const relY = row - centerY;

            if (Math.abs(relX) <= 1 || // Vertical line of "$"
                (Math.abs(relY) <= 1 && Math.abs(relX) <= 2)) { // Horizontal lines of "$"
              ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize);
            }
          }
        }
      }

      ctx.restore();
    });

    // Draw pickup effect (explosion/sparkle when picked up)
    if (gameState.pickupEffect.isActive) {
      const elapsed = Date.now() - gameState.pickupEffect.startTime;
      const progress = elapsed / 1000; // 1 second duration
      const radius = progress * 50; // Expanding circle
      const alpha = 1 - progress; // Fading out

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = currentColors.foreground;
      ctx.lineWidth = 3;

      // Draw expanding circle
      ctx.beginPath();
      ctx.arc(gameState.pickupEffect.x + 12, gameState.pickupEffect.y + 12, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Draw sparkle effect
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const sparkleX = gameState.pickupEffect.x + 12 + Math.cos(angle) * radius * 0.7;
        const sparkleY = gameState.pickupEffect.y + 12 + Math.sin(angle) * radius * 0.7;
        ctx.fillStyle = currentColors.foreground;
        ctx.fillRect(sparkleX - 2, sparkleY - 2, 4, 4);
      }

      ctx.globalAlpha = 1;
    }

    // Draw scores (classic Pong font style) - using pixelated arcade font and dynamic color
    ctx.font = 'bold 32px "Press Start 2P", monospace'; // Smaller font for 4 players
    ctx.fillStyle = currentColors.foreground; // Use dynamic color for scores too
    ctx.textAlign = 'center';

    // 4-player score positions
    const leftScoreX = 80; // Left edge
    const rightScoreX = canvasSize.width - 80; // Right edge
    const topScoreY = 60; // Top edge
    const bottomScoreY = canvasSize.height - 30; // Bottom edge
    const centerScoreY = 50; // For top/bottom scores

    // Display all 4 player scores with padding
    const leftScore = gameState.score.left.toString().padStart(2, '0');
    const rightScore = gameState.score.right.toString().padStart(2, '0');
    const topScore = gameState.score.top.toString().padStart(2, '0');
    const bottomScore = gameState.score.bottom.toString().padStart(2, '0');

    // Left player score (left side, middle height)
    ctx.textAlign = 'center';
    ctx.fillText(leftScore, leftScoreX, canvasSize.height / 2);

    // Right player score (right side, middle height)
    ctx.fillText(rightScore, rightScoreX, canvasSize.height / 2);

    // Top player score (center, top)
    ctx.fillText(topScore, canvasSize.width / 2, topScoreY);

    // Bottom player score (center, bottom)
    ctx.fillText(bottomScore, canvasSize.width / 2, bottomScoreY);

    // 📊 FPS Counter (top-right corner) - should show 60 FPS consistently
    ctx.font = 'bold 12px "Press Start 2P", monospace';
    ctx.textAlign = 'right';
    const fpsDisplay = fpsRef.current === 0 ? 60 : fpsRef.current; // Show 60 during startup

    // Color code FPS - green for 60, yellow for 45-59, red for below 45
    if (fpsDisplay >= 60) {
      ctx.fillStyle = '#00ff00'; // Bright green for perfect 60 FPS
    } else if (fpsDisplay >= 45) {
      ctx.fillStyle = '#ffff00'; // Yellow for good FPS
    } else {
      ctx.fillStyle = '#ff0000'; // Red for poor FPS
    }

    ctx.fillText(`${fpsDisplay} FPS`, canvasSize.width - 20, 30);

    // Reset color back to foreground for other elements
    ctx.fillStyle = currentColors.foreground;

    // 🏆 WINNER ANNOUNCEMENT 🏆
    if (gameState.gameEnded && gameState.winner) {
      // Animated winner display with pulsing effects
      ctx.save();
      ctx.translate(canvasSize.width / 2, canvasSize.height / 2);

      // Smooth pulsing animation effect
      const time = cachedTimeRef.current * 0.001;
      const pulseScale = 1 + Math.sin(time * 2) * 0.05; // Gentle pulse between 0.95 and 1.05

      ctx.scale(pulseScale, pulseScale);

      // Winner announcement - animated white
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 64px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const winnerText = `${gameState.winner.toUpperCase()} WINS!`;
      ctx.fillText(winnerText, 0, -40);

      // Victory subtitle - monochrome white, no outline
      ctx.font = 'bold 32px "Press Start 2P", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('FIRST TO 11!', 0, 20);

      // Victory score display - monochrome white, no outline
      ctx.font = 'bold 24px "Press Start 2P", monospace';
      ctx.fillStyle = '#ffffff';
      const finalScore = gameState.score[gameState.winner];
      ctx.fillText(`FINAL SCORE: ${finalScore}`, 0, 60);

      ctx.restore();


      // Continue button prompt - monochrome
      ctx.font = 'bold 16px "Press Start 2P", monospace';
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('PRESS SPACEBAR TO PLAY AGAIN', canvasSize.width / 2, canvasSize.height - 50);
    }

    // Draw active effects status with live countdown and robot voice announcements
    if (gameState.activeEffects.length > 0) {
      ctx.font = 'bold 20px "Press Start 2P", monospace';
      ctx.fillStyle = currentColors.foreground;
      ctx.textAlign = 'center';

      // Track countdown changes for robot voice announcements
      const newCountdowns: {[effectType: string]: number} = {};

      gameState.activeEffects.forEach((effect, index) => {
        const remaining = Math.ceil((effect.duration - (Date.now() - effect.startTime)) / 1000);
        if (remaining > 0) {
          const pickupData = PICKUP_TYPES.find(p => p.type === effect.type);
          if (pickupData) {
            const yPos = 150 + (index * 30);
            ctx.fillText(`${pickupData.description} ${remaining}`, canvasSize.width / 2, yPos);

            // Track this countdown
            newCountdowns[effect.type] = remaining;

            // Initialize announced countdown tracking for this effect type if needed
            if (!announcedCountdowns[effect.type]) {
              setAnnouncedCountdowns(prev => ({
                ...prev,
                [effect.type]: new Set<number>()
              }));
            }

            // Check if countdown changed and announce it
            const previousValue = previousCountdowns[effect.type];
            const hasBeenAnnounced = announcedCountdowns[effect.type]?.has(remaining) || false;

            if (remaining <= 5 && remaining >= 0 && !hasBeenAnnounced) {
              // Check if enough time has passed since pickup announcement
              const announcementTime = pickupAnnouncementTimes[effect.type];
              const timeSinceAnnouncement = Date.now() - (announcementTime || 0);
              const minimumDelay = 3500; // Wait 3.5 seconds after pickup announcement

              if (!announcementTime || timeSinceAnnouncement >= minimumDelay) {
                // Mark this number as announced immediately to prevent duplicates
                setAnnouncedCountdowns(prev => ({
                  ...prev,
                  [effect.type]: new Set([...(prev[effect.type] || []), remaining])
                }));

                // Use force speech for countdown numbers to ensure they're always heard
                // Add unique delay based on effect type to prevent voice conflicts
                const delayOffset = index * 100; // Stagger announcements by effect index
                setTimeout(() => forceSpeak(remaining.toString()), 50 + delayOffset);
              } else {
                // If we can't announce due to delay, schedule it for later
                const remainingDelay = minimumDelay - timeSinceAnnouncement;
                setTimeout(() => {
                  // Double-check that this number wasn't already announced while we waited
                  if (!announcedCountdowns[effect.type]?.has(remaining)) {
                    const currentRemaining = Math.ceil((effect.duration - (Date.now() - effect.startTime)) / 1000);
                    if (currentRemaining === remaining && currentRemaining <= 5 && currentRemaining >= 0) {
                      // Mark as announced and speak it
                      setAnnouncedCountdowns(prev => ({
                        ...prev,
                        [effect.type]: new Set([...(prev[effect.type] || []), remaining])
                      }));
                      forceSpeak(remaining.toString());
                    }
                  }
                }, remainingDelay + 100);
              }
            }
          }
        }
      });

      // Update previous countdowns
      setPreviousCountdowns(newCountdowns);

      // Clean up announced countdowns for effects that no longer exist
      const activeEffectTypes = new Set(Object.keys(newCountdowns));
      setAnnouncedCountdowns(prev => {
        const cleaned: {[effectType: string]: Set<number>} = {};
        for (const effectType of activeEffectTypes) {
          cleaned[effectType] = prev[effectType] || new Set<number>();
        }
        return cleaned;
      });
    }

    // Add on-screen text overlays
    ctx.font = 'bold 16px "Press Start 2P", monospace';
    ctx.fillStyle = currentColors.foreground;
    ctx.globalAlpha = 1; // Full opacity for all text

    if (gameState.gameMode === 'auto') {
      // Show 404 text on left side and enjoy message on right side - vertically centered
      const centerY = canvasSize.height / 2;
      const leftX = canvasSize.width * 0.25; // Left quarter position
      const rightX = canvasSize.width * 0.75; // Right quarter position

      // Left side - 404 and PAGE NOT FOUND (centered vertically)
      ctx.font = 'bold 48px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('404', leftX, centerY - 20);

      ctx.font = 'bold 16px "Press Start 2P", monospace';
      ctx.fillText('PAGE NOT FOUND', leftX, centerY + 20);

      // Right side - Enjoy message (centered vertically)
      ctx.font = 'bold 12px "Press Start 2P", monospace';
      // Break the text into multiple lines, centered around centerY
      ctx.fillText('But hey,', rightX, centerY - 40);
      ctx.fillText('enjoy some', rightX, centerY - 15);
      ctx.fillText('classic Pong', rightX, centerY + 10);
      ctx.fillText('while you\'re here!', rightX, centerY + 35);

      // Spacebar instruction at bottom center with connection status
      ctx.textAlign = 'center';
      ctx.font = 'bold 10px "Press Start 2P", monospace';

      // Show connection status with visual indicators
      if (connectionStatus === 'connecting') {
        const dots = '.'.repeat((Math.floor(Date.now() / 500) % 3) + 1);
        ctx.fillText(`CONNECTING${dots}`, canvasSize.width / 2, canvasSize.height - 80);
        ctx.fillText(connectionMessage || 'Connecting to multiplayer server...', canvasSize.width / 2, canvasSize.height - 60);
        ctx.fillText('Press D for debug mode to see connection logs', canvasSize.width / 2, canvasSize.height - 40);
        ctx.fillText(`Press C to toggle CRT effect (${crtEffect ? 'ON' : 'OFF'})`, canvasSize.width / 2, canvasSize.height - 20);
      } else if (connectionStatus === 'warming') {
        // Animated fire emoji effect for server warming
        const fireFrames = ['🔥', '🔴', '🟠', '🟡'];
        const fireEmoji = fireFrames[Math.floor(Date.now() / 400) % fireFrames.length];
        ctx.fillText(`${fireEmoji} SERVER WARMING UP ${fireEmoji}`, canvasSize.width / 2, canvasSize.height - 80);
        ctx.fillText(connectionMessage, canvasSize.width / 2, canvasSize.height - 60);

        // Warming progress bar
        const progressWidth = 200;
        const progressHeight = 4;
        const progressX = canvasSize.width / 2 - progressWidth / 2;
        const progressY = canvasSize.height - 50;

        // Background bar
        ctx.fillStyle = '#333';
        ctx.fillRect(progressX, progressY, progressWidth, progressHeight);

        // Animated progress
        const progress = (Math.sin(Date.now() / 1000) + 1) / 2; // 0-1 sine wave
        ctx.fillStyle = '#ff6600';
        ctx.fillRect(progressX, progressY, progressWidth * progress, progressHeight);

        // Restore text color
        ctx.fillStyle = currentColors.foreground;
        ctx.fillText('Free servers take time to boot up - please be patient!', canvasSize.width / 2, canvasSize.height - 30);
        ctx.fillText(`Press C to toggle CRT effect (${crtEffect ? 'ON' : 'OFF'})`, canvasSize.width / 2, canvasSize.height - 10);
      } else if (connectionStatus === 'retrying') {
        const dots = '.'.repeat((Math.floor(Date.now() / 300) % 4) + 1);
        ctx.fillText(`RETRYING${dots}`, canvasSize.width / 2, canvasSize.height - 80);
        ctx.fillText(connectionMessage || `Retry attempt ${retryCount}/5...`, canvasSize.width / 2, canvasSize.height - 60);
        ctx.fillText('Connection timeout - automatically retrying', canvasSize.width / 2, canvasSize.height - 40);
        ctx.fillText(`Press C to toggle CRT effect (${crtEffect ? 'ON' : 'OFF'})`, canvasSize.width / 2, canvasSize.height - 20);
      } else if (connectionStatus === 'error') {
        ctx.fillText('❌ CONNECTION FAILED', canvasSize.width / 2, canvasSize.height - 80);
        ctx.fillText(connectionMessage || 'Server may be sleeping or unreachable', canvasSize.width / 2, canvasSize.height - 60);
        ctx.fillText('Press ANY KEY to retry connection', canvasSize.width / 2, canvasSize.height - 40);
        ctx.fillText(`Press C to toggle CRT effect (${crtEffect ? 'ON' : 'OFF'})`, canvasSize.width / 2, canvasSize.height - 20);
      } else {
        ctx.fillText('Press ANY KEY to join online multiplayer', canvasSize.width / 2, canvasSize.height - 80);
        ctx.fillText('Move your paddle: W/S keys OR hover mouse', canvasSize.width / 2, canvasSize.height - 60);
        ctx.fillText('Press D for debug mode, C for CRT effect', canvasSize.width / 2, canvasSize.height - 40);
        ctx.fillText(`CRT Effect: ${crtEffect ? 'ON' : 'OFF'}`, canvasSize.width / 2, canvasSize.height - 20);
      }
    } else if (gameState.gameMode === 'multiplayer') {
      // Calculate fade out for ALL multiplayer info text
      let infoTextAlpha = 1.0;
      if (infoTextFadeStart) {
        const elapsed = Date.now() - infoTextFadeStart;
        if (elapsed > 5000) {
          // Start fading after 5 seconds
          const fadeTime = elapsed - 5000;
          const fadeDuration = 2000; // 2 second fade
          infoTextAlpha = Math.max(0, 1 - (fadeTime / fadeDuration));
        }
      }

      // Only show info text if not completely faded
      if (infoTextAlpha > 0) {
        // Set white color with fade for ALL multiplayer text
        ctx.fillStyle = `rgba(255, 255, 255, ${infoTextAlpha})`;

        // Multiplayer mode display
        ctx.textAlign = 'center';
        ctx.font = 'bold 12px "Press Start 2P", monospace';

        // Show connection status and player info with visual indicators
        if (connectionStatus === 'connecting') {
          const dots = '.'.repeat((Math.floor(Date.now() / 500) % 3) + 1);
          ctx.fillText(`CONNECTING TO MULTIPLAYER${dots}`, canvasSize.width / 2, canvasSize.height - 80);
          ctx.fillText(connectionMessage || 'Establishing connection...', canvasSize.width / 2, canvasSize.height - 60);
        } else if (connectionStatus === 'warming') {
          const fireFrames = ['🔥', '🔴', '🟠', '🟡'];
          const fireEmoji = fireFrames[Math.floor(Date.now() / 400) % fireFrames.length];
          ctx.fillText(`${fireEmoji} SERVER WARMING UP ${fireEmoji}`, canvasSize.width / 2, canvasSize.height - 80);
          ctx.fillText(connectionMessage, canvasSize.width / 2, canvasSize.height - 60);
        } else if (connectionStatus === 'retrying') {
          const dots = '.'.repeat((Math.floor(Date.now() / 300) % 4) + 1);
          ctx.fillText(`RETRYING CONNECTION${dots}`, canvasSize.width / 2, canvasSize.height - 80);
          ctx.fillText(connectionMessage || `Attempt ${retryCount}/5...`, canvasSize.width / 2, canvasSize.height - 60);
        } else if (connectionStatus === 'error') {
          ctx.fillText('❌ CONNECTION FAILED', canvasSize.width / 2, canvasSize.height - 80);
          ctx.fillText('Press ANY KEY to retry', canvasSize.width / 2, canvasSize.height - 60);
        } else if (connectionStatus === 'connected' || multiplayerState.isConnected) {
          // Connection status display only
        } else {
          ctx.fillText('CONNECTING...', canvasSize.width / 2, canvasSize.height - 60);
        }

        // Restore color
        ctx.fillStyle = currentColors.foreground;
      }

      // Always show spectator/player status when connected (outside of fade)
      if (connectionStatus === 'connected' || multiplayerState.isConnected) {
        const currentMultiplayerState = latestMultiplayerStateRef.current;
        const playerSideText = currentMultiplayerState.playerSide === 'spectator'
          ? 'SPECTATING'
          : `YOU: ${currentMultiplayerState.playerSide.toUpperCase()} PADDLE`;

        ctx.fillStyle = currentColors.foreground;
        ctx.textAlign = 'center';
        ctx.font = 'bold 12px "Press Start 2P", monospace';
        ctx.fillText('MULTIPLAYER MODE', canvasSize.width / 2, canvasSize.height - 100);
        ctx.fillText(playerSideText, canvasSize.width / 2, canvasSize.height - 80);
      }

    }

    // Apply CRT shader effect (if enabled) - but only do expensive pixel distortion occasionally
    if (crtEffect) {
      applyCRTEffect(ctx, canvasSize);
    }


    // Reset canvas transformation after rumble effect
    if (gameState.rumbleEffect.isActive) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to identity matrix
    }

  }, [gameState, canvasSize, connectionStatus, multiplayerState.isConnected, multiplayerState.playerSide, infoTextFadeStart, localTestMode, crtEffect, applyCRTEffect, showAudioPrompt]);

  // High-performance 60fps game loop
  useEffect(() => {
    // Continue running if game is playing OR if there's a winner to display OR showing start screen OR showing audio prompt
    if (!gameState.isPlaying && !(gameState.gameEnded && gameState.winner) && !gameState.showStartScreen && !showAudioPrompt) return;

    let lastTime = 0;

    const gameLoop = (currentTime: number) => {
      // 🕒 Calculate delta time for frame-rate independent physics
      const deltaTime = currentTime - lastFrameTimeRef.current;
      lastFrameTimeRef.current = currentTime;
      deltaTimeRef.current = Math.min(deltaTime, targetFrameTime * 2); // Cap delta time to prevent large jumps

      // ⚡ PERFORMANCE: Update cached time only every 4th frame (reduces Date.now() calls)
      timeUpdateCountRef.current++;
      if (timeUpdateCountRef.current % 4 === 0) {
        cachedTimeRef.current = Date.now();
      }

      // Update game logic - optimized state updates
      updateGame();

      // Render immediately - optimized canvas operations
      render();

      // Schedule next frame - requestAnimationFrame naturally caps at display refresh rate
      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    // Initialize frame timing and start the game loop
    lastFrameTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState.isPlaying, gameState.showStartScreen, showAudioPrompt, updateGame, render]);


  // Prevent React strict mode from causing duplicate WebSocket connections
  const hasInitialized = useRef(false);

  // Listen for localStorage events from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pong-game-state' && e.newValue && !multiplayerState.isGameMaster) {
        try {
          const incomingGameState = JSON.parse(e.newValue);
          // LocalStorage received gameState with paddles
          setGameState(prevState => ({
            ...incomingGameState,
            // Preserve client-only paddles and trails like WebSocket handlers do
            paddles: {
              ...incomingGameState.paddles,
              top: incomingGameState.paddles?.top || prevState.paddles.top,
              bottom: incomingGameState.paddles?.bottom || prevState.paddles.bottom
            },
            trails: {
              ...incomingGameState.trails,
              topPaddle: prevState.trails.topPaddle,
              bottomPaddle: prevState.trails.bottomPaddle
            }
          }));
        } catch (error) {
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [multiplayerState.isGameMaster]);

  // Handle global clicks to show cursor when clicking outside canvas
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      if (canvasRef.current && !canvasRef.current.contains(e.target as Node)) {
        setCursorHidden(false);
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  // Universal input handler to initialize audio on any user interaction
  useEffect(() => {
    const handleAnyUserInput = async () => {
      await initializeAudio();
    };

    // Add listeners for all possible user input events
    const events = ['click', 'keydown', 'keyup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'wheel', 'scroll'];
    events.forEach(eventType => {
      document.addEventListener(eventType, handleAnyUserInput, { once: false, passive: true });
    });

    return () => {
      events.forEach(eventType => {
        document.removeEventListener(eventType, handleAnyUserInput);
      });
    };
  }, [initializeAudio]);

  // Global mouse move handler to track mouse outside canvas
  useEffect(() => {
    const handleGlobalMouseMove = async (e: MouseEvent) => {
      // Initialize audio on first mouse interaction
      await initializeAudio();

      // Start ambient sounds immediately on first interaction (including title screen)
      if (!ambienceActiveRef.current && audioContextRef.current) {
        // setTimeout(() => startAmbienceSound(), 50); // Disabled - now using global ambient music
      }


      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        // Calculate mouse position relative to canvas, clamping to canvas bounds
        const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        setMouseY(y);
        setMouseX(x);

        // Always enable mouse control for your assigned paddle
        if (gameState.gameMode === 'multiplayer') {
          setControlSide(multiplayerState.playerSide === 'spectator' ? null : multiplayerState.playerSide);
        } else {
          // In single player vs AI, always control right paddle (player)
          setControlSide('right');
        }

        // Always hide cursor when canvas is active (has focus or during gameplay)
        const isCanvasActive = document.activeElement === canvasRef.current || gameState.isPlaying;
        setCursorHidden(isCanvasActive);
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    return () => document.removeEventListener('mousemove', handleGlobalMouseMove);
  }, [gameState.gameMode, gameState.isPlaying, multiplayerState.playerSide, initializeAudio]);

  // Focus canvas on mount and cleanup on unmount
  useEffect(() => {
    // Prevent double initialization in React strict mode
    if (hasInitialized.current) {
      return;
    }
    hasInitialized.current = true;

    if (canvasRef.current) {
      canvasRef.current.focus();
    }

    // Clean up localStorage on unmount
    return () => {
      const players = JSON.parse(localStorage.getItem('pong-players') || '[]');
      const filteredPlayers = players.filter((p: any) => p.id !== multiplayerState.playerId);
      localStorage.setItem('pong-players', JSON.stringify(filteredPlayers));

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatTimeoutRef.current) {
        clearTimeout(heartbeatTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden bg-black flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="block"
        style={{
          background: COLOR_PALETTE[gameState.colorIndex].background,
          outline: 'none',
          width: `${canvasSize.width}px`,
          height: `${canvasSize.height}px`,
          maxWidth: `${canvasSize.width}px`,
          maxHeight: `${canvasSize.height}px`,
          minWidth: `${canvasSize.width}px`,
          minHeight: `${canvasSize.height}px`,
          aspectRatio: '1',
          objectFit: 'contain',
          cursor: cursorHidden ? 'none' : 'default',
          // Disable text smoothing and antialiasing for pixelated text
          fontSmooth: 'never',
          WebkitFontSmoothing: 'none',
          MozOsxFontSmoothing: 'unset',
          textRendering: 'geometricPrecision',
          imageRendering: 'pixelated',
          imageRendering: 'crisp-edges'
        } as React.CSSProperties}
        tabIndex={0}
        onClick={async () => {
          // Handle audio prompt dismissal
          if (showAudioPrompt) {
            audioPromptDismissedRef.current = true; // Set ref like keyboard handler
            setShowAudioPrompt(false);
            setGameState(prev => ({ ...prev, showStartScreen: true }));
            // Initialize audio context on user interaction
            await initializeAudio();
            return;
          }

          // Handle start screen - start game on click
          if (gameState.showStartScreen) {
            await initializeAudio();
            // Start ambient sounds immediately on first click interaction
            if (!ambienceActiveRef.current && audioContextRef.current) {
              setTimeout(() => {
                // startAmbienceSound() // Disabled - now using global ambient music;
              }, 50);
            }

            // Try to connect to multiplayer WebSocket
            if (!multiplayerState.isConnected && connectionStatus !== 'error') {
              try {
                connectWebSocket();
                setGameState(prev => ({
                  ...prev,
                  showStartScreen: false,
                  gameMode: 'multiplayer',
                  isPlaying: true,
              ball: {
              ...prev.ball,
              dx: Math.random() > 0.5 ? MIN_BALL_SPEED : -MIN_BALL_SPEED,
              dy: (Math.random() - 0.5) * MIN_BALL_SPEED * 0.8
            }
                }));
                setTimeout(() => speakRobotic('CONNECTING TO SERVER'), 100);
              } catch (error) {
                console.error('❌ Failed to connect to multiplayer:', error);
                // Fallback to single player if connection fails
                setGameState(prev => ({
                  ...prev,
                  showStartScreen: false,
                  gameMode: 'player',
                  isPlaying: true,
              ball: {
              ...prev.ball,
              dx: Math.random() > 0.5 ? MIN_BALL_SPEED : -MIN_BALL_SPEED,
              dy: (Math.random() - 0.5) * MIN_BALL_SPEED * 0.8
            }
                }));
                setTimeout(() => speakRobotic('CONNECTION FAILED, STARTING SINGLE PLAYER'), 100);
              }
            } else if (multiplayerState.isConnected) {
              // Already connected, just start the game
              setGameState(prev => ({
                ...prev,
                showStartScreen: false,
                gameMode: 'multiplayer',
                isPlaying: true,
              ball: {
              ...prev.ball,
              dx: Math.random() > 0.5 ? MIN_BALL_SPEED : -MIN_BALL_SPEED,
              dy: (Math.random() - 0.5) * MIN_BALL_SPEED * 0.8
            }
              }));
              setTimeout(() => speakRobotic('MULTIPLAYER GAME STARTING'), 100);
            } else {
              // Connection error, fallback to single player
              console.log('⚠️ Connection error, starting single player');
              setGameState(prev => ({
                ...prev,
                showStartScreen: false,
                gameMode: 'player',
                isPlaying: true,
              ball: {
              ...prev.ball,
              dx: Math.random() > 0.5 ? MIN_BALL_SPEED : -MIN_BALL_SPEED,
              dy: (Math.random() - 0.5) * MIN_BALL_SPEED * 0.8
            }
              }));
              setTimeout(() => speakRobotic('STARTING SINGLE PLAYER MODE'), 100);
            }
            return;
          }

          if (canvasRef.current) {
            canvasRef.current.focus();
          }
          setCursorHidden(true);
        }}
        onMouseEnter={() => {
          setCursorHidden(true);
        }}
        onMouseLeave={() => {
          // Disable mouse control when leaving canvas
          setMouseY(null);
          setMouseX(null);
          setControlSide(null);
          setCursorHidden(false);
        }}
        onTouchStart={async (e) => {
          e.preventDefault();
          // Initialize audio on first touch
          await initializeAudio();

          // Handle audio prompt dismissal
          if (showAudioPrompt) {
            audioPromptDismissedRef.current = true;
            setShowAudioPrompt(false);
            setGameState(prev => ({ ...prev, showStartScreen: true }));
            return;
          }

          // Handle start screen - start game on touch
          if (gameState.showStartScreen) {
            // Start ambient sounds immediately on first touch interaction
            if (!ambienceActiveRef.current && audioContextRef.current) {
              setTimeout(() => {
                // startAmbienceSound() // Disabled - now using global ambient music;
              }, 50);
            }

            // Try to connect to multiplayer WebSocket
            if (!multiplayerState.isConnected && connectionStatus !== 'error') {
              try {
                connectWebSocket();
                setGameState(prev => ({
                  ...prev,
                  showStartScreen: false,
                  gameMode: 'multiplayer',
                  isPlaying: true,
              ball: {
              ...prev.ball,
              dx: Math.random() > 0.5 ? MIN_BALL_SPEED : -MIN_BALL_SPEED,
              dy: (Math.random() - 0.5) * MIN_BALL_SPEED * 0.8
            }
                }));
                setTimeout(() => speakRobotic('CONNECTING TO SERVER'), 100);
              } catch (error) {
                console.error('❌ Failed to connect to multiplayer:', error);
                // Fallback to single player if connection fails
                setGameState(prev => ({
                  ...prev,
                  showStartScreen: false,
                  gameMode: 'player',
                  isPlaying: true,
              ball: {
              ...prev.ball,
              dx: Math.random() > 0.5 ? MIN_BALL_SPEED : -MIN_BALL_SPEED,
              dy: (Math.random() - 0.5) * MIN_BALL_SPEED * 0.8
            }
                }));
                setTimeout(() => speakRobotic('CONNECTION FAILED, STARTING SINGLE PLAYER'), 100);
              }
            } else if (multiplayerState.isConnected) {
              // Already connected, just start the game
              setGameState(prev => ({
                ...prev,
                showStartScreen: false,
                gameMode: 'multiplayer',
                isPlaying: true,
              ball: {
              ...prev.ball,
              dx: Math.random() > 0.5 ? MIN_BALL_SPEED : -MIN_BALL_SPEED,
              dy: (Math.random() - 0.5) * MIN_BALL_SPEED * 0.8
            }
              }));
              setTimeout(() => speakRobotic('MULTIPLAYER GAME STARTING'), 100);
            } else {
              // Connection error, fallback to single player
              console.log('⚠️ Connection error, starting single player');
              setGameState(prev => ({
                ...prev,
                showStartScreen: false,
                gameMode: 'player',
                isPlaying: true,
              ball: {
              ...prev.ball,
              dx: Math.random() > 0.5 ? MIN_BALL_SPEED : -MIN_BALL_SPEED,
              dy: (Math.random() - 0.5) * MIN_BALL_SPEED * 0.8
            }
              }));
              setTimeout(() => speakRobotic('STARTING SINGLE PLAYER MODE'), 100);
            }
            return;
          }

          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect && e.touches.length > 0) {
            const touch = e.touches[0];
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            setTouchY(y);

            // Determine which side of the screen was touched
            if (x < canvasSize.width / 2) {
              setControlSide('left');
            } else {
              setControlSide('right');
            }
          }
        }}
        onTouchMove={(e) => {
          e.preventDefault();

          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect && e.touches.length > 0) {
            const touch = e.touches[0];
            const y = touch.clientY - rect.top;
            setTouchY(y);
          }
        }}
        onTouchEnd={(e) => {
          e.preventDefault();

          setTouchY(null);
          setControlSide(null);
        }}
      />

      {/* Spectator Mode UI Overlay */}
      {isSpectatorMode && (
        <div className="fixed inset-0 pointer-events-none z-10">
          {/* Large Score Display for Big Screen */}
          <div
            className="absolute top-8 left-1/2 transform -translate-x-1/2 font-arcade text-6xl"
            style={{ color: COLOR_PALETTE[gameState.colorIndex].foreground }}
          >
            <div className="flex gap-12 items-center">
              <div className="text-center">
                <div>{gameState.score.left}</div>
              </div>
              <div className="text-center">
                <div>{gameState.score.right}</div>
              </div>
              <div className="text-center">
                <div>{gameState.score.top}</div>
              </div>
              <div className="text-center">
                <div>{gameState.score.bottom}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Space Blazers Logo - shown only on start screen */}
      {gameState.gameMode === 'auto' && (
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-20">
          <SpaceBlazersLogo className="scale-75 md:scale-100" />
        </div>
      )}

      {/* Hidden back link for navigation (accessible via keyboard) */}
      <Link
        to="/"
        className={`fixed top-4 left-4 ${isSpectatorMode ? 'opacity-100' : 'opacity-0 hover:opacity-100'} font-arcade text-xs z-10 transition-opacity`}
        style={{ color: COLOR_PALETTE[gameState.colorIndex].foreground }}
      >
        ← Home
      </Link>

    </div>
  );
};

export default Pong404;