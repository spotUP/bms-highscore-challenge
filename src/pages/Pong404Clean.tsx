import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import SamJs from 'sam-js';
import { getDynamicTauntSystem, GameContext, PlayerBehavior } from '../utils/browserTauntSystem';
import { CollisionManager, CollisionDetector, CollisionResult } from '../utils/CollisionDetection';
import GlobalAmbientMusic from '../components/GlobalAmbientMusic';

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
    hasWind: boolean;
    hasGravity: boolean;
    hasGreatWall: boolean;
    greatWallSide: 'left' | 'right' | 'top' | 'bottom' | null;
    isAiming: boolean;
    aimStartTime: number;
    aimX: number;
    aimY: number;
    aimTargetX: number;
    aimTargetY: number;
    spin: number; // 🌀 Curve ball spin rate
    isStuck: boolean;
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
  gravityStartTime: number;
  extraBalls: any[];
  machineGunBalls: any[];
  machineGunActive: boolean;
  machineGunStartTime: number;
  machineGunShooter: 'left' | 'right' | 'top' | 'bottom' | null;
  paddlesDrunk: boolean;
  drunkStartTime: number;
  timeWarpActive: boolean;
  timeWarpFactor: number;
  arkanoidBricks: any[];
  arkanoidActive: boolean;
  arkanoidMode: boolean;
  arkanoidBricksHit: number;
}

interface MultiplayerState {
  playerId: string;
  playerSide: 'left' | 'right' | 'top' | 'bottom' | 'spectator';
  isConnected: boolean;
  roomId: string;
  playerCount: number;
}

interface WebSocketMessage {
  type: string;
  playerId?: string;
  roomId?: string;
  data?: any;
}

// Reference size - all game constants are designed for this size
const REFERENCE_SIZE = 800;

// Base constants at reference size (800px)
const BASE_PADDLE_SPEED = 12;
const BASE_PADDLE_LENGTH = 140; // SERVER-AUTHORITATIVE: Fallback for initialization, server defines true value
const BASE_PADDLE_THICKNESS = 12; // SERVER-AUTHORITATIVE: Fallback for initialization, server defines true value
const BASE_BORDER_THICKNESS = 12;
const BASE_PADDLE_GAP = 21; // Gap between paddles and borders (in 800x800 reference) - halved from 42
const BASE_BALL_SPEED = 4;
const BASE_MIN_BALL_SPEED = 3;
const BASE_MAX_BALL_SPEED = 6;
const BASE_BALL_SIZE = 12;
const BASE_COLLISION_BUFFER = 2;
const BASE_PANIC_VELOCITY_MULTIPLIER = 8;
const BASE_EXTREME_PANIC_MULTIPLIER = 20;

// Non-scaled constants
const PADDLE_ACCELERATION = 0.2; // Acceleration ratio, doesn't scale
const PADDLE_FRICTION = 0.88; // Friction ratio, doesn't scale
const HUMAN_REACTION_DELAY = 8; // Frame-based, doesn't scale
const PANIC_MOVE_CHANCE = 0.08; // Probability, doesn't scale
const EXTREME_PANIC_CHANCE = 0.04; // Probability, doesn't scale

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

// Musical scales and melody state moved below (near line 327) to avoid duplication

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
  { type: 'gravity_in_space', pattern: 'gravity', color: '#6a0dad', description: 'Gravity in Space!', scale: 'phrygian', note: 2 },
  { type: 'super_striker', pattern: 'target', color: '#ff4500', description: 'Super Striker!', scale: 'wholetone', note: 7 },
  { type: 'sticky_paddles', pattern: 'sticky', color: '#ffb347', description: 'Sticky Paddles!', scale: 'phrygian', note: 3 },
  { type: 'machine_gun', pattern: 'bullets', color: '#ff1493', description: 'Machine Gun!', scale: 'diminished', note: 6 },
  { type: 'dynamic_playfield', pattern: 'expand', color: '#32cd32', description: 'Dynamic Playfield!', scale: 'wholetone', note: 4 },
  { type: 'switch_sides', pattern: 'swap', color: '#ff6347', description: 'Switch Sides!', scale: 'hungarian', note: 5 },
  { type: 'time_warp', pattern: 'clock', color: '#4169e1', description: 'Time Warp!', scale: 'diminished', note: 1 },
  { type: 'mirror_mode', pattern: 'mirror', color: '#dda0dd', description: 'Mirror Mode!', scale: 'phrygian', note: 7 },
  { type: 'black_hole', pattern: 'vortex', color: '#2f2f2f', description: 'Black Hole!', scale: 'locrian', note: 0 },
  { type: 'lightning_storm', pattern: 'lightning', color: '#ffff99', description: 'Lightning Storm!', scale: 'diminished', note: 3 },
  { type: 'invisible_paddles', pattern: 'fade', color: '#f0f8ff', description: 'Invisible Paddles!', scale: 'wholetone', note: 2 },
  { type: 'ball_trail_mine', pattern: 'mine', color: '#dc143c', description: 'Ball Trail Mine!', scale: 'hungarian', note: 1 },
  { type: 'detroit', pattern: 'detroit', color: '#ff1493', description: 'Detroit Techno!', scale: 'wholetone', note: 7 },
  { type: 'pac_man', pattern: 'pacman', color: '#ffff00', description: 'Pac-Man Hunt!', scale: 'diminished', note: 4 },
  { type: 'banana_peel', pattern: 'banana', color: '#ffff99', description: 'Banana Peel!', scale: 'wholetone', note: 2 },
  { type: 'rubber_ball', pattern: 'bounce', color: '#ff69b4', description: 'Super Bouncy!', scale: 'phrygian', note: 6 },
  { type: 'drunk_paddles', pattern: 'wobble', color: '#8b4513', description: 'Drunk Paddles!', scale: 'hungarian', note: 3 },
  { type: 'magnet_ball', pattern: 'magnet', color: '#dc143c', description: 'Magnet Ball!', scale: 'locrian', note: 5 },
  { type: 'balloon_ball', pattern: 'balloon', color: '#ff1493', description: 'Balloon Ball!', scale: 'diminished', note: 1 },
  { type: 'earthquake', pattern: 'shake', color: '#8b4513', description: 'Earthquake!', scale: 'wholetone', note: 0 },
  { type: 'confetti_cannon', pattern: 'confetti', color: '#ff6347', description: 'Confetti Cannon!', scale: 'phrygian', note: 7 },
  { type: 'hypno_ball', pattern: 'hypno', color: '#9932cc', description: 'Hypno Ball!', scale: 'hungarian', note: 2 },
  { type: 'conga_line', pattern: 'conga', color: '#ffa500', description: 'Conga Line!', scale: 'diminished', note: 6 },
  { type: 'arkanoid', pattern: 'bricks', color: '#ff4500', description: 'Arkanoid Mode!', scale: 'wholetone', note: 5 },
  { type: 'attractor', pattern: 'vortex', color: '#ff00ff', description: 'Ball Attractor!', scale: 'phrygian', note: 3 },
  { type: 'repulsor', pattern: 'target', color: '#00ffff', description: 'Ball Repulsor!', scale: 'diminished', note: 2 },
  { type: 'wind', pattern: 'wind', color: '#87ceeb', description: 'Wind Blow!', scale: 'wholetone', note: 3 },
  { type: 'great_wall', pattern: 'brick', color: '#00ccff', description: 'Great Wall Defense!', scale: 'c-phrygian', note: 1 },
  { type: 'labyrinth', pattern: 'maze', color: '#8b7355', description: 'Labyrinth Maze!', scale: 'hungarian', note: 4 },
];

// WebSocket server URL - using correct Render service
const WS_SERVER_URL = import.meta.env.DEV
  ? 'ws://localhost:3002'
  : 'wss://pong-websocket-server-z0nf.onrender.com';

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

// [ROCKET] PRECALCULATED PERFORMANCE OPTIMIZATIONS
// Precalculate all expensive operations to eliminate runtime calculations

// [MUSIC] MUSICAL SCALES FOR DYSTOPIAN OUTER SPACE ATMOSPHERE
const MUSICAL_SCALES = {
  // C minor pentatonic - matches C-based ambient pieces
  'c-minor-pentatonic': [130.81, 155.56, 174.61, 196.00, 233.08, 261.63, 311.13, 349.23], // C3 minor pentatonic
  // C minor (natural) - for C2/C3 drones and atmospheric pieces
  'c-minor': [130.81, 146.83, 155.56, 174.61, 196.00, 207.65, 233.08, 261.63], // C3 minor
  // C major - bright, for joyful pieces
  'c-major': [130.81, 146.83, 164.81, 174.61, 196.00, 220.00, 246.94, 261.63], // C3 major
  // C Phrygian - dark and mysterious
  'c-phrygian': [130.81, 138.59, 155.56, 174.61, 196.00, 207.65, 233.08, 261.63], // C3 Phrygian
  // C Locrian - most dissonant, perfect for lost in space feeling
  'c-locrian': [130.81, 138.59, 155.56, 164.81, 185.00, 207.65, 233.08, 261.63], // C3 Locrian
  // G minor - for G-based pieces
  'g-minor': [196.00, 220.00, 233.08, 261.63, 293.66, 311.13, 349.23, 392.00], // G3 minor
  // Whole tone - dreamy but alien
  'wholetone': [130.81, 146.83, 164.81, 185.00, 207.65, 233.08, 261.63], // C3 Whole tone
  // Diminished - tense and unstable
  'diminished': [130.81, 146.83, 155.56, 174.61, 185.00, 207.65, 220.00, 246.94], // C3 Diminished
};

// [MUSIC] LOOKUP TABLE: Match sound effects scale to each generative music piece
const MUSIC_SCALE_MAP: { [key: string]: keyof typeof MUSICAL_SCALES } = {
  'space-atmosphere': 'c-minor',           // Uses C2, Eb2, F2, Ab2
  'cosmic-chords': 'c-major',              // Uses C3-E3-G3-B3 chords (C major 7th)
  'crystal-cascade': 'c-major',            // Uses C6, D6, E6, G6, A6, C7 (C major pentatonic)
  'doom-drone': 'c-minor',                 // Heavy C power chords
  'space-drone': 'c-phrygian',             // Dark C-based atmosphere
  'homeward-bound': 'c-major',             // Warm, homeward feeling
  'distant-memories': 'c-minor-pentatonic',// Nostalgic C minor pentatonic
  'stellar-solitude': 'c-minor',           // Lonely C minor
  'earths-embrace': 'c-major',             // Warm C major
  'cosmic-longing': 'c-phrygian',          // Melancholic C phrygian
  'cosmic-whale': 'c-minor-pentatonic',    // Oceanic C minor pentatonic
  'earth-approach': 'c-major',             // Joyful C major
};

// Sound pattern sequences for different game events
let melodyState = {
  paddleHitIndex: 0,
  wallHitIndex: 0,
  scoreIndex: 0,
  pickupIndex: 0,
  currentScale: 'c-minor' as keyof typeof MUSICAL_SCALES, // Default scale
  lastScaleChange: 0,
  currentMusicPiece: '' as string, // Track current music piece
};

// [MUSIC] PRECALCULATED AUDIO CONFIGURATIONS
const PRECALC_AUDIO = {
  // Beep frequency table for instant lookup (fallback)
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

// [GAME] PRECALCULATED GAME CONSTANTS
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

  // CRT flicker values (precalculated for 60fps) - static value removes jitter
  flickerValues: Array.from({ length: 60 }, () => 0.98)
};

// [TARGET] PRECALCULATED PICKUP PATTERNS (eliminates nested loops during gameplay)
const PRECALC_PICKUP_PATTERNS = {
  lightning: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) =>
      (row < 2 && col >= 2 && col <= 3) ||
      (row >= 2 && col >= 1 && col <= 2)
    )
  ),

  waves: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) =>
      (row === 1 || row === 3) && Math.sin(col * 1.2) > 0
    )
  ),

  circle: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      const centerX = 1.5, centerY = 1.5, radius = 1.2;
      const dist = Math.sqrt((col - centerX) ** 2 + (row - centerY) ** 2);
      return dist <= radius && dist >= radius - 0.7;
    })
  ),

  dot: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      return row >= 1 && row <= 2 && col >= 1 && col <= 2;
    })
  ),

  spiral: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      const angle = Math.atan2(row - 1.5, col - 1.5);
      const dist = Math.sqrt((col - 1.5) ** 2 + (row - 1.5) ** 2);
      return Math.sin(angle * 2 + dist * 0.8) > 0.3;
    })
  ),

  arrow_up: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) =>
      (row >= 1 && row <= 3 && col >= 1 && col <= 2) || // Stem
      (row === 0 && col >= 1 && col <= 2) // Arrow head
    )
  ),

  arrow_down: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) =>
      (row >= 0 && row <= 2 && col >= 1 && col <= 2) || // Stem
      (row === 3 && col >= 1 && col <= 2) // Arrow head
    )
  ),

  double_arrow: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) =>
      (row >= 1 && row <= 2 && col === 0) || // Left arrow
      (row >= 1 && row <= 2 && col === 3) // Right arrow
    )
  ),

  plus: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) =>
      (row >= 1 && row <= 2 && col >= 0 && col <= 3) || // Horizontal
      (col >= 1 && col <= 2 && row >= 0 && row <= 3) // Vertical
    )
  ),

  cross: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) =>
      Math.abs(row - col) <= 0.5 || Math.abs(row - (3 - col)) <= 0.5
    )
  ),

  stripes: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) =>
      (row + col) % 2 === 0
    )
  ),

  diamond: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      const centerX = 1.5, centerY = 1.5;
      const distanceFromCenter = Math.abs(row - centerY) + Math.abs(col - centerX);
      return distanceFromCenter >= 1.5 && distanceFromCenter <= 2.5;
    })
  ),

  star: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      const centerX = 1.5, centerY = 1.5;
      const dx = col - centerX, dy = row - centerY;
      return (Math.abs(dx) <= 0.5 && Math.abs(dy) <= 1.5) || // Vertical line
             (Math.abs(dy) <= 0.5 && Math.abs(dx) <= 1.5) || // Horizontal line
             (Math.abs(dx - dy) <= 0.5 && Math.abs(dx) <= 1) || // Diagonal 1
             (Math.abs(dx + dy) <= 0.5 && Math.abs(dx) <= 1); // Diagonal 2
    })
  ),

  gravity: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Create a gravity well pattern - concentric circles getting denser towards center
      const centerX = 1.5, centerY = 1.5;
      const dist = Math.sqrt((col - centerX) ** 2 + (row - centerY) ** 2);
      return (dist <= 1.8 && ((Math.floor(dist * 2) + row + col) % 2 === 0)) ||
             (dist <= 0.8); // Dense center
    })
  ),

  target: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Create a target/crosshair pattern
      const centerX = 1.5, centerY = 1.5;
      const dist = Math.sqrt((col - centerX) ** 2 + (row - centerY) ** 2);
      return (Math.abs(row - centerY) <= 0.5 && Math.abs(col - centerX) <= 1.5) || // Horizontal crosshair
             (Math.abs(col - centerX) <= 0.5 && Math.abs(row - centerY) <= 1.5) || // Vertical crosshair
             (dist >= 1.2 && dist <= 1.6); // Ring
    })
  ),

  sticky: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Sticky drops pattern
      return (row === 0 && col >= 1 && col <= 2) || // Top drop
             (row === 1 && col >= 1 && col <= 2) ||
             (row === 2 && (col === 1 || col === 2)) || // Middle drops
             (row === 3 && col >= 1 && col <= 2); // Bottom drop
    })
  ),

  bullets: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Machine gun bullets pattern - scattered dots
      return (row === 0 && (col === 0 || col === 2)) ||
             (row === 1 && (col === 1 || col === 3)) ||
             (row === 2 && (col === 0 || col === 2)) ||
             (row === 3 && (col === 1 || col === 3));
    })
  ),

  expand: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Expanding arrows pattern - arrows pointing outward
      const centerX = 1.5, centerY = 1.5;
      return (row === 0 && col >= 1 && col <= 2) || // Top arrow
             (row === 3 && col >= 1 && col <= 2) || // Bottom arrow
             (col === 0 && row >= 1 && row <= 2) || // Left arrow
             (col === 3 && row >= 1 && row <= 2); // Right arrow
    })
  ),

  swap: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Swap arrows pattern - diagonal arrows
      return (row === 0 && col === 0) || (row === 1 && col === 1) || // Top-left to center
             (row === 2 && col === 2) || (row === 3 && col === 3); // Center to bottom-right
    })
  ),

  wall: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Brick wall pattern
      const isEvenRow = row % 2 === 0;
      return isEvenRow ? (col % 2 === 0) : (col % 2 === 1);
    })
  ),

  clock: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Clock pattern with hands
      const centerX = 1.5, centerY = 1.5;
      const dist = Math.sqrt((col - centerX) ** 2 + (row - centerY) ** 2);
      return (dist >= 1.2 && dist <= 1.5) || // Clock circle
             (row === 2 && col >= 2 && col <= 3) || // Hour hand (right)
             (col === 2 && row <= 1); // Minute hand (up)
    })
  ),

  portal: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Portal rings pattern
      const centerX = 1.5, centerY = 1.5;
      const dist = Math.sqrt((col - centerX) ** 2 + (row - centerY) ** 2);
      return (dist >= 0.5 && dist <= 0.8) || (dist >= 1.2 && dist <= 1.5);
    })
  ),

  mirror: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Mirror reflection pattern
      return col === row || col === (3 - row); // Diagonal mirrors
    })
  ),

  vortex: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Black hole vortex pattern
      const centerX = 1.5, centerY = 1.5;
      const angle = Math.atan2(row - centerY, col - centerX);
      const dist = Math.sqrt((col - centerX) ** 2 + (row - centerY) ** 2);
      return Math.sin(angle * 2 + dist * 1.2) > 0.2 && dist <= 1.8;
    })
  ),

  zigzag: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Zigzag lightning pattern
      const zigzag = Math.sin(col * 0.8) * 0.8;
      return Math.abs(row - 2 - zigzag) <= 0.7;
    })
  ),

  fade: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Fading pattern for invisible paddles
      const centerX = 1.5, centerY = 1.5;
      const dist = Math.sqrt((col - centerX) ** 2 + (row - centerY) ** 2);
      return (row + col) % 2 === 0 && dist <= 1.5;
    })
  ),

  mine: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Mine explosion pattern
      const centerX = 1.5, centerY = 1.5;
      return (Math.abs(row - centerY) <= 0.5 && Math.abs(col - centerX) <= 0.5) || // Center
             (row === 0 && col >= 1 && col <= 2) || // Top spike
             (row === 3 && col >= 1 && col <= 2) || // Bottom spike
             (col === 0 && row >= 1 && row <= 2) || // Left spike
             (col === 3 && row >= 1 && row <= 2); // Right spike
    })
  ),

  shuffle: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Shuffle pattern with moving elements
      return (row % 2 === 0 && col % 2 === 1) || (row % 2 === 1 && col % 2 === 0);
    })
  ),

  detroit: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Musical note pattern - eighth note
      if (row === 0 && col >= 2 && col <= 3) return true; // Note head
      if (row === 1 && col >= 2 && col <= 3) return true; // Note head
      if (row >= 2 && col === 3) return true; // Note stem
      return false;
    })
  ),

  pacman: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Pac-Man shape (circular with mouth opening)
      const centerX = 1.5, centerY = 1.5;
      const dist = Math.sqrt((col - centerX) ** 2 + (row - centerY) ** 2);
      const angle = Math.atan2(row - centerY, col - centerX);
      const mouthAngle = Math.PI / 4; // 45 degree mouth opening
      return dist <= 1.5 && !(dist >= 0.8 && Math.abs(angle) < mouthAngle);
    })
  ),

  banana: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Curved banana shape
      return (row >= 0 && row <= 3 && col >= 1 && col <= 2) &&
             !(row === 0 && col === 1);
    })
  ),

  bounce: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Bouncing ball with motion lines
      const centerX = 1.5, centerY = 1.5;
      const dist = Math.sqrt((col - centerX) ** 2 + (row - centerY) ** 2);
      const motionLines = (row === 1 && col === 0) || (row === 2 && col === 3);
      return (dist <= 0.8) || motionLines;
    })
  ),

  wobble: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Wobbly paddle pattern
      const wave = Math.sin((row * Math.PI) / 2) * 0.5;
      return col >= 1.5 + wave && col <= 2.5 + wave;
    })
  ),

  magnet: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Horseshoe magnet with N/S poles
      return (row >= 0 && row <= 2 && (col === 0 || col === 3)) || // Sides
             (row === 0 && col >= 0 && col <= 3); // Top bar
    })
  ),

  balloon: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Balloon with string
      const centerX = 1.5, centerY = 1;
      const dist = Math.sqrt((col - centerX) ** 2 + (row - centerY) ** 2);
      const string = col >= 1 && col <= 2 && row === 3;
      return (dist <= 1) || string;
    })
  ),

  shake: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Earthquake crack pattern
      return (row === 2 && col % 2 === 0) ||
             (row === 1 && col === 1) ||
             (row === 3 && col === 2);
    })
  ),

  confetti: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Random confetti pieces
      return ((row + col * 2) % 3 === 0) || ((row * 2 + col) % 4 === 0);
    })
  ),

  hypno: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Hypnotic spiral pattern
      const centerX = 1.5, centerY = 1.5;
      const dist = Math.sqrt((col - centerX) ** 2 + (row - centerY) ** 2);
      const angle = Math.atan2(row - centerY, col - centerX);
      return Math.floor(dist + angle * 1.5) % 2 === 0 && dist <= 1.8;
    })
  ),

  conga: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Dancing figures in a line
      return row === 2 && col >= 0 && col <= 3;
    })
  ),

  bricks: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Arkanoid brick pattern - classic brick layout
      return (row >= 1 && row <= 2) &&
             ((row % 2 === 0 && col % 2 === 0) || (row % 2 === 1 && col % 2 === 1));
    })
  ),

  labyrinth: Array.from({ length: 4 }, (_, row) =>
    Array.from({ length: 4 }, (_, col) => {
      // Maze/labyrinth pattern with paths and walls
      return (row === 0 && (col === 0 || col === 3)) || // Top corners
             (row === 1 && col === 1) ||                 // Inner wall piece
             (row === 2 && col === 2) ||                 // Inner wall piece
             (row === 3 && (col === 1 || col === 2));    // Bottom walls
    })
  )
};

const Pong404: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixiAppRef = useRef<Application | null>(null);
  const pixiContainerRef = useRef<HTMLDivElement>(null);
  const crtFilterRef = useRef<CRTFilter | null>(null);
  const animationFrameRef = useRef<number>(0);
  const coinSoundsPlayedRef = useRef<Set<string>>(new Set());
  const previousMachineGunBallCountRef = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);

  // Detect mobile device for performance optimizations
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // 📊 FPS Counter
  const fpsRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lastFpsUpdateRef = useRef<number>(Date.now());

  // [TARGET] Frame Rate Control - Always 60 FPS for smooth gameplay
  const lastFrameTimeRef = useRef<number>(0);
  const targetFPS = 60; // Always target 60 FPS for consistent gameplay
  const targetFrameTime = 1000 / targetFPS; // 16.67ms per frame

  // [BOLT] Performance: Cached time values to reduce Date.now() calls
  const cachedTimeRef = useRef<number>(Date.now());
  const timeUpdateCountRef = useRef<number>(0);

  // 🕒 Delta time for frame-rate independent physics
  const deltaTimeRef = useRef<number>(targetFrameTime);

  // [ROCKET] Fast time getter - use cached value instead of Date.now()
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
  const updateGameRef = useRef<any>(null);

  // 🔧 Reflection adjustment controls (all sides controlled together)
  const [reflectionParams, setReflectionParams] = useState({
    offset: 0.190,
    depth: 0.175,
  });
  const reflectionParamsRef = useRef(reflectionParams);

  // Sync reflectionParams state to ref whenever it changes
  useEffect(() => {
    reflectionParamsRef.current = reflectionParams;
  }, [reflectionParams]);

  const renderRef = useRef<any>(null);

  // Music analysis data for reactive visual effects
  const musicDataRef = useRef<{ volume: number; disharmonic: number; beat: number }>({ volume: 0, disharmonic: 0, beat: 0 });

  // 🎯 CENTRALIZED COLLISION DETECTION SYSTEM
  const collisionManagerRef = useRef<CollisionManager>(new CollisionManager());

  // Set up collision event handlers once on mount
  useEffect(() => {
    const collisionManager = collisionManagerRef.current;

    // Ball-Paddle Collision Handler - DISABLED in multiplayer (server handles all physics)
    collisionManager.on('ball-paddle', (result: CollisionResult) => {
      // Client does NOT handle collisions in multiplayer - server is authoritative
    });

    // 🏆 Ball-Wall Collision Handler (Scoring)
    collisionManager.on('ball-wall', (result: CollisionResult) => {
      if (!result.hit) return;

      const wallSide = result.side;
      console.log(`🏆 CENTRALIZED SCORING: Ball hit ${wallSide} boundary`);

      // Only handle scoring in single-player modes (server handles multiplayer scoring)
      setGameState(prev => {
        if (prev.gameMode === 'multiplayer') return prev; // Server handles multiplayer scoring

        const newState = { ...prev };
        // Use the existing handleLastTouchScoring function
        handleLastTouchScoring(newState, wallSide);
        return newState;
      });
    });

    // ⚔️ Paddle-Paddle Collision Handler (Corner cases)
    collisionManager.on('paddle-paddle', (result: CollisionResult) => {
      if (!result.hit) return;

      console.log('⚔️ PADDLE-PADDLE COLLISION DETECTED:', {
        paddle1: (result.object1 as any).side,
        paddle2: (result.object2 as any).side,
        penetration: result.penetration
      });

      // Handle paddle separation logic here if needed
    });

    // 🎯 Ball-Pickup Collision Handler
    collisionManager.on('ball-pickup', (result: CollisionResult) => {
      if (!result.hit) return;

      console.log('🎯 PICKUP COLLISION:', result.object2);
      // Handle pickup collection
    });

    // 🟠 Extra Ball Collision Handlers
    collisionManager.on('extra-ball-paddle', (result: CollisionResult) => {
      if (!result.hit) return;
      playMelodyNoteRef.current?.('paddle', null, 'both');
      // Add haptic feedback for extra ball paddle hit
      if (navigator.vibrate) {
        navigator.vibrate(15); // Lighter vibration for extra balls
      }
    });

    collisionManager.on('extra-ball-wall', (result: CollisionResult) => {
      if (!result.hit) return;
      console.log('🟠 Extra ball boundary hit:', result.side);
    });

  }, []); // Empty dependency array - run once on mount

  const createPickupRef = useRef<any>(null);
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



  // Responsive square canvas size for perfect square gameplay
  const [canvasSize, setCanvasSize] = useState(() => {
    const getOptimalCanvasSize = () => {
      if (typeof window === 'undefined') return 800;

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const minDimension = Math.min(viewportWidth, viewportHeight);

      // Use 95% of the smallest viewport dimension to maximize space
      // Minimum 400px for playability
      const size = Math.floor(minDimension * 0.95);
      return Math.max(size, 400);
    };

    const size = getOptimalCanvasSize();
    return { width: size, height: size };
  });
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'warming' | 'connected' | 'error' | 'retrying' | 'server_down' | 'server_starting'>('idle');
  const [retryCount, setRetryCount] = useState(0);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [connectionStartTime, setConnectionStartTime] = useState(0);
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
  const [debugPickupIndex, setDebugPickupIndex] = useState(0);
  const debugPickupIndexRef = useRef(0); // Ref to track current index in event handlers
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<'initializing' | 'warming' | 'booting' | 'finalizing'>('initializing');
  const [isCRTEnabled, setIsCRTEnabled] = useState(false);
  const [showFPS, setShowFPS] = useState(false);
  const [paddleAnimationProgress, setPaddleAnimationProgress] = useState(0); // 0 to 1
  const paddleAnimationStartTimeRef = useRef<number>(0);
  const [currentMusicTrack, setCurrentMusicTrack] = useState(0); // Current ambient music track index
  const [showTrackName, setShowTrackName] = useState(false); // Show track name for 4 seconds
  const trackNameTimeoutRef = useRef<number | null>(null);
  const trackNameShowTimeRef = useRef<number>(0); // When track name was shown
  const isSwitchingTrackRef = useRef(false); // Prevent rapid track switching

  // Paddle size animation tracking
  const previousPaddleSizesRef = useRef<{
    left: { height: number; width: number };
    right: { height: number; width: number };
    top: { height: number; width: number };
    bottom: { height: number; width: number };
  }>({
    left: { height: BASE_PADDLE_LENGTH, width: BASE_PADDLE_THICKNESS },
    right: { height: BASE_PADDLE_LENGTH, width: BASE_PADDLE_THICKNESS },
    top: { height: BASE_PADDLE_THICKNESS, width: BASE_PADDLE_LENGTH },
    bottom: { height: BASE_PADDLE_THICKNESS, width: BASE_PADDLE_LENGTH }
  });

  const paddleSizeAnimationsRef = useRef<{
    [key in 'left' | 'right' | 'top' | 'bottom']: {
      startTime: number;
      startSize: { height: number; width: number };
      targetSize: { height: number; width: number };
      startPosition: { x: number; y: number };
      duration: number;
    } | null;
  }>({
    left: null,
    right: null,
    top: null,
    bottom: null
  });

  // Calculate scale factor based on current canvas size
  const scaleFactor = canvasSize.width / REFERENCE_SIZE;

  // Use base constants directly since we're working in 800x800 coordinate space
  const PADDLE_SPEED = BASE_PADDLE_SPEED;
  const PADDLE_LENGTH = BASE_PADDLE_LENGTH;
  const PADDLE_THICKNESS = BASE_PADDLE_THICKNESS;
  const BORDER_THICKNESS = BASE_BORDER_THICKNESS;
  const PADDLE_GAP = BASE_PADDLE_GAP;
  const BALL_SPEED = BASE_BALL_SPEED;
  const MIN_BALL_SPEED = BASE_MIN_BALL_SPEED;
  const MAX_BALL_SPEED = BASE_MAX_BALL_SPEED;
  const BALL_SIZE = BASE_BALL_SIZE;
  const COLLISION_BUFFER = BASE_COLLISION_BUFFER;
  const PANIC_VELOCITY_MULTIPLIER = BASE_PANIC_VELOCITY_MULTIPLIER;
  const EXTREME_PANIC_MULTIPLIER = BASE_EXTREME_PANIC_MULTIPLIER;

  // Playfield size - same as canvas (border drawn at edges)
  // Simple scaling: everything is in 800x800 coordinate space
  const displaySize = Math.min(canvasSize.width, canvasSize.height);
  const scale = displaySize / REFERENCE_SIZE;
  const xOffset = (canvasSize.width - displaySize) / 2;
  const yOffset = (canvasSize.height - displaySize) / 2;

  // Keep using 800x800 coordinate system everywhere
  const playFieldWidth = REFERENCE_SIZE;
  const playFieldHeight = REFERENCE_SIZE;
  const gameAreaSize = REFERENCE_SIZE;

  // Helper to get centered ball position (relative to game area, not canvas)
  const getCenteredBallPosition = () => ({
    x: gameAreaSize / 2,
    y: gameAreaSize / 2
  });

  const [gameState, _setGameState] = useState<GameState>({
    ball: {
      x: 400,
      y: 400,
      dx: 0,
      dy: 0,
      size: BALL_SIZE,
      originalSize: BALL_SIZE,
      isDrunk: false,
      drunkAngle: 0,
      isTeleporting: false,
      lastTeleportTime: 0,
      stuckCheckStartTime: 0,
      stuckCheckStartX: 0,
      lastTouchedBy: null,
      previousTouchedBy: null,
      hasWind: false,
      hasGravity: false,
      hasGreatWall: false,
      greatWallSide: null,
      isAiming: false,
      aimStartTime: 0,
      aimX: 0,
      aimY: 0,
      aimTargetX: 0,
      aimTargetY: 0,
      spin: 0, // 🌀 Initial spin is 0
      isStuck: false,
      stuckToPaddle: null,
      stuckStartTime: 0,
      stuckTime: 0,
      stuckOffset: { x: 0, y: 0 },
      hasPortal: false,
      portalX: 0,
      portalY: 0,
      isMirror: false,
      mirrorBalls: [],
      hasTrailMines: false,
      trailMines: [],
      isSlippery: false,
      bounciness: 1.0,
      isMagnetic: false,
      isFloating: false,
      isHypnotic: false,
    },
    paddles: {
      left: { x: BASE_BORDER_THICKNESS + BASE_PADDLE_GAP, y: 400 - BASE_PADDLE_LENGTH/2, height: BASE_PADDLE_LENGTH, width: BASE_PADDLE_THICKNESS, speed: BASE_PADDLE_SPEED, velocity: 0, targetY: 400 - BASE_PADDLE_LENGTH/2, originalHeight: BASE_PADDLE_LENGTH },
      right: { x: 800 - BASE_BORDER_THICKNESS - BASE_PADDLE_GAP - BASE_PADDLE_THICKNESS, y: 400 - BASE_PADDLE_LENGTH/2, height: BASE_PADDLE_LENGTH, width: BASE_PADDLE_THICKNESS, speed: BASE_PADDLE_SPEED, velocity: 0, targetY: 400 - BASE_PADDLE_LENGTH/2, originalHeight: BASE_PADDLE_LENGTH },
      top: { x: 400 - BASE_PADDLE_LENGTH/2, y: BASE_BORDER_THICKNESS + BASE_PADDLE_GAP, height: BASE_PADDLE_THICKNESS, width: BASE_PADDLE_LENGTH, speed: BASE_PADDLE_SPEED, velocity: 0, targetX: 400 - BASE_PADDLE_LENGTH/2, originalWidth: BASE_PADDLE_LENGTH },
      bottom: { x: 400 - BASE_PADDLE_LENGTH/2, y: 800 - BASE_BORDER_THICKNESS - BASE_PADDLE_GAP - BASE_PADDLE_THICKNESS, height: BASE_PADDLE_THICKNESS, width: BASE_PADDLE_LENGTH, speed: BASE_PADDLE_SPEED, velocity: 0, targetX: 400 - BASE_PADDLE_LENGTH/2, originalWidth: BASE_PADDLE_LENGTH },
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
    gravityStartTime: 0,
    machineGunBalls: [],
    machineGunActive: false,
    machineGunStartTime: 0,
    machineGunShooter: null,
    stickyPaddlesActive: false,
    sidesSwitched: false,
    paddleVisibility: { left: 1.0, right: 1.0, top: 1.0, bottom: 1.0 },
    pacMans: [],
    detroitMode: false,
    detroitStartTime: 0,
    paddlesDrunk: false,
    drunkStartTime: 0,
    earthquakeActive: false,
    earthquakeStartTime: 0,
    confetti: [],
    hypnoStartTime: 0,
    playfieldScale: 1.0,
    playfieldScaleTarget: 1.0,
    playfieldScaleStart: 1.0,
    playfieldScaleTime: 0,
    walls: [],
    timeWarpActive: false,
    timeWarpFactor: 1.0,
    blackHoles: [],
    lightningStrikes: [],
    arkanoidBricks: [],
    arkanoidActive: false,
    arkanoidMode: false,
    arkanoidBricksHit: 0,
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
  const [crtEffect, setCrtEffect] = useState(false); // CRT shader DISABLED - using pure canvas
  const [lanMode, setLanMode] = useState(false); // LAN mode - mute all clients, only spectator plays audio
  const [showAudioPrompt, setShowAudioPrompt] = useState(!isSpectatorMode); // Show audio interaction prompt on first load (skip for spectators)
  const audioPromptDismissedRef = useRef(isSpectatorMode); // Track if audio prompt was dismissed (auto-dismiss for spectators)
  const [robotText, setRobotText] = useState<string>(''); // Current robot speech text to display
  const robotTextTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    // FIXED: Assign right paddle first (matches arrow key controls)
    if (!rightPlayer) {
      playerSide = 'right';
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
      isConnected: true,
      playerCount: updatedPlayers.length
    }));


    // Set game to multiplayer mode
    setGameState(prev => ({ ...prev, gameMode: 'multiplayer' }));
  }, [multiplayerState.playerId, multiplayerState.roomId]);

  // Check if WebSocket server is available
  const checkServerAvailability = useCallback(async (): Promise<boolean> => {
    try {
      const baseUrl = WS_SERVER_URL.replace('ws://', 'http://').replace('wss://', 'https://');
      const response = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        timeout: 5000,
        signal: AbortSignal.timeout?.(5000)
      } as any);
      return response.ok;
    } catch (error) {
      console.log('[SEARCH] Server health check failed:', error);
      return false;
    }
  }, []);

  // Auto-start server if running locally and server is down
  const startLocalServer = useCallback(async (): Promise<boolean> => {
    if (!WS_SERVER_URL.includes('localhost')) {
      return false; // Only auto-start for localhost
    }

    try {
      setConnectionStatus('server_starting');
      setConnectionMessage('[BOLT] Starting WebSocket server automatically...');

      // Note: In production, you'd implement actual server startup
      // For now, we'll just provide helpful feedback
      setTimeout(() => {
        setConnectionMessage('📋 Server should be started manually with: npx tsx scripts/pong-websocket-server.ts');
      }, 2000);

      // Wait a bit for manual startup
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Check if server is now available
      return await checkServerAvailability();
    } catch (error) {
      console.error('Failed to start local server:', error);
      return false;
    }
  }, [checkServerAvailability]);

  // Trigger Render.com server deploy/wake
  const triggerServerStart = useCallback(async () => {
    // Server should be always running - just log a message
    console.log('[SEARCH] Server should be running at:', WS_SERVER_URL);
    setConnectionMessage('[SEARCH] Connecting to server...');
    return true;
  }, []);

  // WebSocket connection management
  const connectWebSocket = useCallback(async () => {

    if (!WS_SERVER_URL) {
      setConnectionStatus('error');
      setConnectionMessage('WebSocket server URL not configured');
      return;
    }

    // For production servers (Render), skip health check and connect directly
    // The WebSocket connection itself will wake up the server
    const isProduction = !WS_SERVER_URL.includes('localhost');

    if (isProduction) {
      console.log('[FIRE] Connecting to production server (may need warmup)...');
      setConnectionStatus('warming');
      setConnectionMessage('[FIRE] Waking up server... This may take 30-60 seconds');
      setTimeout(() => speakRobotic('SERVER IS WAKING UP PLEASE WAIT'), 500);
      setCurrentPhase('warming');

      // Trigger server start/wake via Render deploy hook
      // This will either wake a sleeping server or trigger a fresh deploy
      await triggerServerStart();

      // Skip health check, go straight to WebSocket connection
    } else {
      // For localhost, check if server is running first
      console.log('[SEARCH] Checking server availability...');
      setConnectionStatus('connecting');
      setConnectionMessage('[SEARCH] Checking server availability...');

      const isServerAvailable = await checkServerAvailability();
      setServerAvailable(isServerAvailable);

      if (!isServerAvailable) {
        console.log('[BOLT] Local server not available, trying to start...');
        setConnectionStatus('warming');
        setCurrentPhase('warming');
        setConnectionMessage('[BOLT] Starting local WebSocket server...');
        const serverStarted = await startLocalServer();
        if (!serverStarted) {
          setConnectionStatus('error');
          setConnectionMessage('[ERROR] Please start the WebSocket server: npx tsx scripts/pong-websocket-server.ts');
          return;
        }
      }
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

    if (!isProduction) {
      setConnectionStatus('connecting');
      setConnectionMessage('Initializing connection to multiplayer server...');
      setCurrentPhase('initializing');
    }
    // For production, warming state was already set above
    setConnectionStartTime(Date.now());

    // Progressive timeout stages with enhanced feedback
    const warmingTimeout = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.CONNECTING) {
        setConnectionStatus('warming');
        setCurrentPhase('warming');
        setConnectionMessage('[FIRE] Server is warming up... Estimated 30-60 seconds');
        setTimeout(() => speakRobotic('SERVER IS WARMING UP PLEASE WAIT'), 500);
      }
    }, 8000); // Switch to warming state after 8 seconds

    const bootingTimeout = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.CONNECTING) {
        setCurrentPhase('booting');
        setConnectionMessage('[BOLT] Booting server processes... Almost ready!');
        setTimeout(() => speakRobotic('BOOTING SERVER PROCESSES ALMOST READY'), 500);
      }
    }, 20000); // Booting phase at 20 seconds

    const connectionTimeout = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.CONNECTING) {
        setCurrentPhase('finalizing');
        setConnectionMessage('[CLOCK] Finalizing startup... Just a few more seconds!');
        setTimeout(() => speakRobotic('FINALIZING STARTUP JUST A FEW MORE SECONDS'), 500);
      }
    }, 35000); // Finalizing phase at 35 seconds

    const encouragementTimeout = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.CONNECTING) {
        setConnectionMessage('[ROCKET] Almost there... Server is nearly ready!');
      }
    }, 50000); // Final encouragement at 50 seconds

    const finalTimeout = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.CONNECTING) {
        setConnectionMessage('[FIRE] Server still warming up, retrying...');
        wsRef.current.close();
        setConnectionStatus('retrying');
        setRetryCount(prev => prev + 1);
        // Longer delay for production server warmup
        const retryDelay = isProduction ? 8000 : 3000;
        setTimeout(() => {
          connectWebSocket();
        }, retryDelay);
      }
    }, isProduction ? 90000 : 45000); // 90 seconds for production, 45 for localhost

    const connectToWebSocket = () => {
      try {
        console.log('[GAME] Attempting to connect to WebSocket:', WS_SERVER_URL);
        setConnectionMessage('Establishing WebSocket connection...');
        const ws = new WebSocket(WS_SERVER_URL);
        (ws as any)._createTime = Date.now();
        wsRef.current = ws;
        console.log('[GAME] WebSocket instance created, readyState:', ws.readyState);


        ws.onopen = () => {
          console.log('[GAME] WebSocket connection opened successfully');
          const openTime = Date.now();
          (ws as any)._openTime = openTime;
          const connectionTime = openTime - (ws as any)._createTime;
          setConnectionStatus('connected');
          setConnectionMessage('Connected! Joining game room...');
          setMultiplayerState(prev => ({ ...prev, isConnected: true }));

          // DON'T start the game yet - wait for joined_room confirmation from server
          // The game will start when we receive the joined_room message

          console.log('[GAME] Connection status set to connected');
          console.log('[GAME] Game state updated to multiplayer mode');

          // Clear all connection timeouts since we connected successfully
          if (warmingTimeout) clearTimeout(warmingTimeout);
          if (bootingTimeout) clearTimeout(bootingTimeout);
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
              console.log('[GAME] Sending join message:', joinMessage);
              ws.send(JSON.stringify(joinMessage));
              setConnectionMessage('Sent join request - waiting for server response...');
            } catch (error) {
              console.error('[ALERT] Failed to send join message:', error);
              setConnectionMessage('Failed to send join request');
            }
          } else {
          }
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            // console.log('[GAME] Received WebSocket message:', message.type || message.t, message);
            handleWebSocketMessage(message);
          } catch (error) {
            console.error('[ALERT] Failed to parse WebSocket message:', error, event.data);
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
            setCurrentPhase('initializing'); // Reset phase for retry
            const retryDelay = Math.min(5000 + Math.random() * 5000, 15000); // 5-10 seconds, max 15s
            setConnectionMessage(`Reconnecting in ${Math.ceil(retryDelay/1000)} seconds... (attempt ${retryCount + 1})`);
            reconnectTimeoutRef.current = setTimeout(() => {
              connectWebSocket();
            }, retryDelay);
          }
        };

        ws.onerror = (error) => {
          console.error('[ALERT] WebSocket error:', error);
          // Clear all connection timeouts since we got an error
          if (warmingTimeout) clearTimeout(warmingTimeout);
          if (bootingTimeout) clearTimeout(bootingTimeout);
          if (connectionTimeout) clearTimeout(connectionTimeout);
          if (encouragementTimeout) clearTimeout(encouragementTimeout);
          if (finalTimeout) clearTimeout(finalTimeout);

          // For production, treat errors as "still warming up" and retry
          if (isProduction) {
            setConnectionStatus('warming');
            setConnectionMessage('[FIRE] Server warming up, retrying in 8 seconds...');
            setTimeout(() => {
              connectWebSocket();
            }, 8000);
          } else {
            setConnectionStatus('error');
            setConnectionMessage('Failed to connect to server - server may be sleeping or unreachable');
          }
        };

      } catch (error) {
        setConnectionStatus('error');
        setConnectionMessage('Failed to initialize connection - please check your network');
        console.error('[ALERT] Connection initialization error:', error);
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
          playerCount: message.data.playerCount,
          isConnected: true
        };
        updateMultiplayerState(newMultiplayerState);

        if (message.data.gameState) {
          // Server sent gameState with paddles - ensure correct paddle dimensions and positions
          setGameState(prevState => ({
            ...message.data.gameState,
            // Use server's paddles but enforce correct dimensions and positions
            paddles: {
              left: {
                ...message.data.gameState.paddles.left,
                x: message.data.gameState.paddles.left.x ?? (BORDER_THICKNESS + PADDLE_GAP),
                height: PADDLE_LENGTH,
                width: PADDLE_THICKNESS
              },
              right: {
                ...message.data.gameState.paddles.right,
                x: message.data.gameState.paddles.right.x ?? (gameAreaSize - BORDER_THICKNESS - PADDLE_GAP - PADDLE_THICKNESS),
                height: PADDLE_LENGTH,
                width: PADDLE_THICKNESS
              },
              top: message.data.gameState.paddles.top ? {
                ...message.data.gameState.paddles.top,
                y: message.data.gameState.paddles.top.y ?? (BORDER_THICKNESS + PADDLE_GAP),
                height: PADDLE_THICKNESS,
                width: PADDLE_LENGTH
              } : prevState.paddles.top,
              bottom: message.data.gameState.paddles.bottom ? {
                ...message.data.gameState.paddles.bottom,
                y: message.data.gameState.paddles.bottom.y ?? (gameAreaSize - BORDER_THICKNESS - PADDLE_GAP - PADDLE_THICKNESS),
                height: PADDLE_THICKNESS,
                width: PADDLE_LENGTH
              } : prevState.paddles.bottom
            },
            trails: {
              ...message.data.gameState.trails,
              ball: prevState.trails.ball || [], // Preserve client-side ball trails
              leftPaddle: prevState.trails.leftPaddle || [], // Preserve client-side left paddle trails
              rightPaddle: prevState.trails.rightPaddle || [], // Preserve client-side right paddle trails
              topPaddle: prevState.trails.topPaddle || [],
              bottomPaddle: prevState.trails.bottomPaddle || []
            }
          }));
        }

        // NOW start the game since we've successfully joined the room
        console.log('[GAME] Successfully joined room, starting multiplayer game');

        // Start paddle animation
        paddleAnimationStartTimeRef.current = Date.now();
        setPaddleAnimationProgress(0);

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
              ...getCenteredBallPosition(),
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

      case 'side_switched':
        // Player has switched sides due to switch_sides pickup
        const { newSide, oldSide } = message.data;
        console.log(`🔄 Side switched from ${oldSide} to ${newSide}`);

        // Update multiplayer state with new side
        setMultiplayerState(prev => ({
          ...prev,
          playerSide: newSide
        }));

        // Announce the switch
        setTimeout(() => speakRobotic(`SIDES SWITCHED! YOU ARE NOW ${newSide.toUpperCase()} PLAYER`), 100);
        break;

      case 'paddle_updated':
        setGameState(prev => {
          const newState = { ...prev };
          const now = Date.now();
          const data = message.data;

          // Don't update your own paddle - local prediction is authoritative for smoother gameplay
          if (data.side === multiplayerState.playerSide) {
            return prev; // Ignore updates for your own paddle
          }

          // Enhanced lag compensation with extrapolation
          let compensatedY = data.y;
          if (data.ts && data.velocity) {
            const networkDelay = now - data.ts;
            // Extrapolate position based on velocity and time elapsed
            // Add 50ms extra extrapolation for smoother opponent movement
            const extrapolationTime = (networkDelay + 50) / 1000;
            compensatedY = data.y + (data.velocity * extrapolationTime);
          }

          if (data.side === 'left') {
            // Smooth interpolation: blend current position with new position
            const currentY = prev.paddles.left.y;
            const smoothingFactor = 0.3; // Lower = smoother, higher = more responsive
            newState.paddles.left.y = currentY + (compensatedY - currentY) * smoothingFactor;
            newState.paddles.left.velocity = data.velocity || 0;
            newState.paddles.left.targetY = data.targetY || compensatedY;
            // Clamp to playfield bounds (0-based coordinates)
            newState.paddles.left.y = Math.max(0, Math.min(newState.paddles.left.y, playFieldHeight - newState.paddles.left.height));
          } else if (data.side === 'right') {
            // Smooth interpolation: blend current position with new position
            const currentY = prev.paddles.right.y;
            const smoothingFactor = 0.3; // Lower = smoother, higher = more responsive
            newState.paddles.right.y = currentY + (compensatedY - currentY) * smoothingFactor;
            newState.paddles.right.velocity = data.velocity || 0;
            newState.paddles.right.targetY = data.targetY || compensatedY;
            // Clamp to playfield bounds (0-based coordinates)
            newState.paddles.right.y = Math.max(0, Math.min(newState.paddles.right.y, playFieldHeight - newState.paddles.right.height));
          }
          return newState;
        });
        break;

      case 'game_state_updated':
        if (message.data) {
          console.log('[WEBSOCKET] game_state_updated received, detroitMode:', message.data.detroitMode);
          const prevGameState = networkGameStateRef.current;

          // Detect paddle collision by checking if lastTouchedBy changed
          if (prevGameState && message.data.ball?.lastTouchedBy &&
              message.data.ball.lastTouchedBy !== prevGameState.ball?.lastTouchedBy) {
            console.log('[GAME] Paddle collision detected in game_state_updated', {
              prev: prevGameState.ball?.lastTouchedBy,
              new: message.data.ball.lastTouchedBy,
              refExists: !!playMelodyNoteRef.current,
              refValue: playMelodyNoteRef.current
            });
            if (playMelodyNoteRef.current) {
              playMelodyNoteRef.current('paddle', null, 'both');
              // Add haptic feedback for paddle hit
              if (navigator.vibrate) {
                navigator.vibrate(20); // Short vibration for paddle hit
              }
            } else {
              console.error('[GAME] playMelodyNoteRef.current is null!');
            }
          }

          // Detect scoring by checking if any score increased
          if (prevGameState && message.data.score) {
            const prevTotal = (prevGameState.score?.left || 0) + (prevGameState.score?.right || 0) +
                            (prevGameState.score?.top || 0) + (prevGameState.score?.bottom || 0);
            const newTotal = message.data.score.left + message.data.score.right +
                           message.data.score.top + message.data.score.bottom;
            if (newTotal > prevTotal) {
              console.log('[GAME] Score detected in game_state_updated - playing score sound');
              playMelodyNoteRef.current?.('score', null, 'both');
              // Add haptic feedback for scoring
              if (navigator.vibrate) {
                navigator.vibrate([50, 30, 50]); // Double vibration pattern for score
              }
            }
          }

          // Handle wind sound effect
          const hadWind = prevGameState?.ball?.hasWind || false;
          const hasWind = message.data.ball?.hasWind || false;

          if (hasWind && !hadWind) {
            // Start wind sound effect
            if (Tone && !windNoiseRef.current) {
              const noise = new Tone.Noise('pink');
              const filter = new Tone.Filter({
                type: 'bandpass',
                frequency: 600,
                rolloff: -24,
                Q: 2
              });
              const autoFilter = new Tone.AutoFilter({
                frequency: 0.3,
                depth: 0.7
              }).start();
              const gain = new Tone.Gain(0.15).toDestination();

              noise.connect(filter);
              filter.connect(autoFilter);
              autoFilter.connect(gain);

              noise.start();
              windNoiseRef.current = { noise, filter, autoFilter, gain };
              console.log('Wind sound effect started');
            }
          } else if (!hasWind && hadWind) {
            // Stop wind sound effect
            if (windNoiseRef.current) {
              windNoiseRef.current.noise.stop();
              windNoiseRef.current.noise.dispose();
              windNoiseRef.current.filter.dispose();
              windNoiseRef.current.autoFilter.dispose();
              windNoiseRef.current.gain.dispose();
              windNoiseRef.current = null;
              console.log('Wind sound effect stopped');
            }
          }

          // Handle attractor/repulsor force field sounds
          const prevEffects = prevGameState?.activeEffects || [];
          const currentEffects = message.data.activeEffects || [];

          const hadAttractor = prevEffects.some(e => e.type === 'attractor');
          const hasAttractor = currentEffects.some(e => e.type === 'attractor');
          const hadRepulsor = prevEffects.some(e => e.type === 'repulsor');
          const hasRepulsor = currentEffects.some(e => e.type === 'repulsor');

          // Attractor sound (low pulsing hum)
          if (hasAttractor && !hadAttractor) {
            if (Tone && !attractorSoundRef.current) {
              const osc = new Tone.Oscillator({
                frequency: 80,
                type: 'sine'
              });
              const lfo = new Tone.LFO({
                frequency: 4,
                min: 0.3,
                max: 0.7
              }).start();
              const gain = new Tone.Gain(0.2).toDestination();

              osc.connect(gain);
              lfo.connect(gain.gain);
              osc.start();

              attractorSoundRef.current = { osc, lfo, gain };
              console.log('Attractor sound effect started');
            }
          } else if (!hasAttractor && hadAttractor) {
            if (attractorSoundRef.current) {
              attractorSoundRef.current.osc.stop();
              attractorSoundRef.current.osc.dispose();
              attractorSoundRef.current.lfo.stop();
              attractorSoundRef.current.lfo.dispose();
              attractorSoundRef.current.gain.dispose();
              attractorSoundRef.current = null;
              console.log('Attractor sound effect stopped');
            }
          }

          // Repulsor sound (high frequency warble)
          if (hasRepulsor && !hadRepulsor) {
            if (Tone && !repulsorSoundRef.current) {
              const osc = new Tone.Oscillator({
                frequency: 300,
                type: 'triangle'
              });
              const lfo = new Tone.LFO({
                frequency: 8,
                min: 0.2,
                max: 0.6
              }).start();
              const gain = new Tone.Gain(0.15).toDestination();

              osc.connect(gain);
              lfo.connect(gain.gain);
              osc.start();

              repulsorSoundRef.current = { osc, lfo, gain };
              console.log('Repulsor sound effect started');
            }
          } else if (!hasRepulsor && hadRepulsor) {
            if (repulsorSoundRef.current) {
              repulsorSoundRef.current.osc.stop();
              repulsorSoundRef.current.osc.dispose();
              repulsorSoundRef.current.lfo.stop();
              repulsorSoundRef.current.lfo.dispose();
              repulsorSoundRef.current.gain.dispose();
              repulsorSoundRef.current = null;
              console.log('Repulsor sound effect stopped');
            }
          }

          // Handle black hole sound (deep rumbling with filter sweep)
          const hadBlackHole = prevGameState?.blackHoles && prevGameState.blackHoles.length > 0;
          const hasBlackHole = message.data.blackHoles && message.data.blackHoles.length > 0;

          if (hasBlackHole && !hadBlackHole) {
            if (Tone && !blackHoleSoundRef.current) {
              const osc = new Tone.Oscillator({
                frequency: 40,
                type: 'sawtooth'
              });
              const filter = new Tone.Filter({
                type: 'lowpass',
                frequency: 200,
                rolloff: -24,
                Q: 5
              });
              const lfo = new Tone.LFO({
                frequency: 0.5,
                min: 100,
                max: 300
              }).start();
              const gain = new Tone.Gain(0.25).toDestination();

              osc.connect(filter);
              filter.connect(gain);
              lfo.connect(filter.frequency);
              osc.start();

              blackHoleSoundRef.current = { osc, filter, lfo, gain };
              console.log('Black hole sound effect started');
            }
          } else if (!hasBlackHole && hadBlackHole) {
            if (blackHoleSoundRef.current) {
              blackHoleSoundRef.current.osc.stop();
              blackHoleSoundRef.current.osc.dispose();
              blackHoleSoundRef.current.filter.dispose();
              blackHoleSoundRef.current.lfo.stop();
              blackHoleSoundRef.current.lfo.dispose();
              blackHoleSoundRef.current.gain.dispose();
              blackHoleSoundRef.current = null;
              console.log('Black hole sound effect stopped');
            }
          }

          // Handle great wall electric hum sound
          const hadGreatWall = prevGameState?.ball?.hasGreatWall || false;
          const hasGreatWall = message.data.ball?.hasGreatWall || false;

          if (hasGreatWall && !hadGreatWall) {
            // Start electric humming sound
            if (Tone && !electricHumRef.current) {
              const osc1 = new Tone.Oscillator(120, 'sawtooth');
              const osc2 = new Tone.Oscillator(180, 'sawtooth');
              const noise = new Tone.Noise('pink');

              const filter = new Tone.Filter({
                type: 'bandpass',
                frequency: 150,
                Q: 3
              });

              const lfo = new Tone.LFO(2, 0.3, 0.7);
              lfo.connect(filter.frequency);
              lfo.start();

              const gain = new Tone.Gain(0.15).toDestination();

              osc1.connect(filter);
              osc2.connect(filter);
              noise.connect(filter);
              filter.connect(gain);

              osc1.start();
              osc2.start();
              noise.start();

              electricHumRef.current = { osc1, osc2, noise, filter, lfo, gain };
              console.log('Electric hum started');
            }
          } else if (!hasGreatWall && hadGreatWall) {
            // Stop electric humming
            if (electricHumRef.current) {
              electricHumRef.current.osc1.stop();
              electricHumRef.current.osc2.stop();
              electricHumRef.current.noise.stop();
              electricHumRef.current.osc1.dispose();
              electricHumRef.current.osc2.dispose();
              electricHumRef.current.noise.dispose();
              electricHumRef.current.filter.dispose();
              electricHumRef.current.lfo.stop();
              electricHumRef.current.lfo.dispose();
              electricHumRef.current.gain.dispose();
              electricHumRef.current = null;
              console.log('Electric hum stopped');
            }
          }

          // Handle hypnotic ball sound effect
          const hadHypnotic = prevGameState?.ball?.isHypnotic || false;
          const hasHypnotic = message.data.ball?.isHypnotic || false;

          if (hasHypnotic && !hadHypnotic) {
            // Start hypnotic sound effect
            if (Tone && !hypnoSoundRef.current) {
              // Two oscillators at slightly detuned frequencies for beating effect
              const osc1 = new Tone.Oscillator(432, 'sine');
              const osc2 = new Tone.Oscillator(437, 'sine');

              // LFO 1 modulating osc1 frequency
              const lfo1 = new Tone.LFO({
                frequency: 0.3,
                min: 412,
                max: 452
              });
              lfo1.connect(osc1.frequency);
              lfo1.start();

              // LFO 2 modulating osc2 frequency (different rate for complex interaction)
              const lfo2 = new Tone.LFO({
                frequency: 0.4,
                min: 422,
                max: 452
              });
              lfo2.connect(osc2.frequency);
              lfo2.start();

              // Deep reverb for dreamy quality
              const reverb = new Tone.Reverb({
                decay: 8,
                wet: 0.7
              });

              // Master gain - subtle, hypnotic
              const gain = new Tone.Gain(0.2).toDestination();

              osc1.connect(reverb);
              osc2.connect(reverb);
              reverb.connect(gain);

              osc1.start();
              osc2.start();

              hypnoSoundRef.current = { osc1, osc2, lfo1, lfo2, reverb, gain };
              console.log('Hypnotic sound effect started');
            }
          } else if (!hasHypnotic && hadHypnotic) {
            // Stop hypnotic sound effect
            if (hypnoSoundRef.current) {
              hypnoSoundRef.current.osc1.stop();
              hypnoSoundRef.current.osc2.stop();
              hypnoSoundRef.current.osc1.dispose();
              hypnoSoundRef.current.osc2.dispose();
              hypnoSoundRef.current.lfo1.stop();
              hypnoSoundRef.current.lfo2.stop();
              hypnoSoundRef.current.lfo1.dispose();
              hypnoSoundRef.current.lfo2.dispose();
              hypnoSoundRef.current.reverb.dispose();
              hypnoSoundRef.current.gain.dispose();
              hypnoSoundRef.current = null;
              console.log('Hypnotic sound effect stopped');
            }
          }

          // HARD AUDIO RESET: Stop all audio effects when switching pickups in test mode
          // This ensures clean state when rapidly switching with 1/2 keys
          if (message.data.isDebugMode) {
            // Reset machine gun ball counter
            previousMachineGunBallCountRef.current = 0;

            // Stop hypnotic sound if active
            if (hypnoSoundRef.current) {
              console.log('🔊 HARD AUDIO RESET: Stopping hypnotic sound');
              hypnoSoundRef.current.osc1.stop();
              hypnoSoundRef.current.osc2.stop();
              hypnoSoundRef.current.osc1.dispose();
              hypnoSoundRef.current.osc2.dispose();
              hypnoSoundRef.current.lfo1.stop();
              hypnoSoundRef.current.lfo2.stop();
              hypnoSoundRef.current.lfo1.dispose();
              hypnoSoundRef.current.lfo2.dispose();
              hypnoSoundRef.current.reverb.dispose();
              hypnoSoundRef.current.gain.dispose();
              hypnoSoundRef.current = null;
            }

            // Stop detroit music ONLY if we're NOT activating Detroit mode
            // (Otherwise the Detroit detection below will handle it properly)
            if (!message.data.detroitMode && (window as any).generativeMusic?.currentState?.currentPieceId === 'detroit-techno') {
              console.log('🔊 HARD AUDIO RESET: Stopping Detroit techno');
              const pieces = (window as any).generativeMusic.availablePieces.filter((p: any) => p.id !== 'detroit-techno');
              const randomPiece = pieces[Math.floor(Math.random() * pieces.length)];
              (window as any).generativeMusic.startPiece(randomPiece.id);
            }
          }

          // Handle labyrinth mode
          const hadLabyrinth = prevGameState?.labyrinthActive || false;
          const hasLabyrinth = message.data.labyrinthActive || false;

          console.log('[LABYRINTH DEBUG] hadLabyrinth:', hadLabyrinth, 'hasLabyrinth:', hasLabyrinth, 'message.data.labyrinthActive:', message.data.labyrinthActive, 'mazeWalls:', message.data.mazeWalls?.length || 0, 'coins:', message.data.coins?.length || 0);

          if (hasLabyrinth && !hadLabyrinth) {
            console.log('[LABYRINTH] Activating labyrinth mode - maze walls:', message.data.mazeWalls?.length || 0, 'existing coins:', message.data.coins?.length || 0);
          } else if (!hasLabyrinth && hadLabyrinth) {
            console.log('[LABYRINTH] Deactivating labyrinth mode');
          } else if (hasLabyrinth && hadLabyrinth) {
            console.log('[LABYRINTH] Labyrinth mode still active - maze walls:', message.data.mazeWalls?.length || 0, 'coins:', message.data.coins?.length || 0);
          } else {
            console.log('[LABYRINTH] No labyrinth mode active');
          }

          // Handle Detroit techno mode
          const hadDetroit = prevGameState?.detroitMode || false;
          const hasDetroit = message.data.detroitMode || false;

          console.log('[DETROIT DEBUG] hadDetroit:', hadDetroit, 'hasDetroit:', hasDetroit, 'message.data.detroitMode:', message.data.detroitMode);

          if (hasDetroit && !hadDetroit) {
            // Start Detroit techno music
            console.log('[DETROIT] Starting Detroit techno mode');
            if ((window as any).generativeMusic) {
              (window as any).generativeMusic.startPiece('detroit-techno');
            } else {
              console.log('[DETROIT] ERROR: generativeMusic not available');
            }
          } else if (!hasDetroit && hadDetroit) {
            // Stop Detroit techno and restore previous ambient music
            console.log('[DETROIT] Stopping Detroit techno mode');
            if ((window as any).generativeMusic?.currentState?.currentPieceId === 'detroit-techno') {
              // Return to a random ambient piece
              const pieces = (window as any).generativeMusic.availablePieces.filter((p: any) => p.id !== 'detroit-techno');
              const randomPiece = pieces[Math.floor(Math.random() * pieces.length)];
              (window as any).generativeMusic.startPiece(randomPiece.id);
            }
          } else {
            console.log('[DETROIT] No state change detected');
          }

          // ONLY update the network state ref - let the game loop handle rendering
          // This prevents competing state updates that cause flickering
          // IMPORTANT: Preserve local player paddle from current game state
          const playerSide = multiplayerState.playerSide;
          const currentState = currentGameStateRef.current;

          // Scale network state from reference size (800px) to current canvas size
          // Calculate directly to avoid stale closure values
          const networkScaleFactor = 1; // Already using 800x800 coordinates

          networkGameStateRef.current = {
            ...message.data,
            // Scale ball position and dimensions
            ball: message.data.ball ? {
              ...message.data.ball,
              x: message.data.ball.x * networkScaleFactor,
              y: message.data.ball.y * networkScaleFactor,
              dx: message.data.ball.dx * networkScaleFactor,
              dy: message.data.ball.dy * networkScaleFactor,
              size: message.data.ball.size * networkScaleFactor,
              originalSize: message.data.ball.originalSize ? message.data.ball.originalSize * networkScaleFactor : BALL_SIZE
            } : message.data.ball,
            // Scale paddle positions and dimensions
            paddles: {
              left: message.data.paddles?.left ? {
                ...message.data.paddles.left,
                x: (message.data.paddles.left.x ?? (BASE_BORDER_THICKNESS + BASE_PADDLE_GAP)) * networkScaleFactor,
                y: message.data.paddles.left.y * networkScaleFactor,
                width: (message.data.paddles.left.width ?? BASE_PADDLE_THICKNESS) * networkScaleFactor,
                height: (message.data.paddles.left.height ?? BASE_PADDLE_LENGTH) * networkScaleFactor,
                speed: message.data.paddles.left.speed * networkScaleFactor,
                velocity: message.data.paddles.left.velocity * networkScaleFactor,
                targetY: message.data.paddles.left.targetY !== undefined ? message.data.paddles.left.targetY * networkScaleFactor : undefined,
                originalHeight: message.data.paddles.left.originalHeight !== undefined ? message.data.paddles.left.originalHeight * networkScaleFactor : undefined
              } : networkGameStateRef.current?.paddles.left,
              right: message.data.paddles?.right ? {
                ...message.data.paddles.right,
                x: (message.data.paddles.right.x ?? (REFERENCE_SIZE - BASE_BORDER_THICKNESS - BASE_PADDLE_GAP - BASE_PADDLE_THICKNESS)) * networkScaleFactor,
                y: message.data.paddles.right.y * networkScaleFactor,
                width: (message.data.paddles.right.width ?? BASE_PADDLE_THICKNESS) * networkScaleFactor,
                height: (message.data.paddles.right.height ?? BASE_PADDLE_LENGTH) * networkScaleFactor,
                speed: message.data.paddles.right.speed * networkScaleFactor,
                velocity: message.data.paddles.right.velocity * networkScaleFactor,
                targetY: message.data.paddles.right.targetY !== undefined ? message.data.paddles.right.targetY * networkScaleFactor : undefined,
                originalHeight: message.data.paddles.right.originalHeight !== undefined ? message.data.paddles.right.originalHeight * networkScaleFactor : undefined
              } : networkGameStateRef.current?.paddles.right,
              top: message.data.paddles?.top ? {
                ...message.data.paddles.top,
                x: message.data.paddles.top.x * networkScaleFactor,
                y: (message.data.paddles.top.y ?? (BASE_BORDER_THICKNESS + BASE_PADDLE_GAP)) * networkScaleFactor,
                width: (message.data.paddles.top.width ?? BASE_PADDLE_LENGTH) * networkScaleFactor,
                height: (message.data.paddles.top.height ?? BASE_PADDLE_THICKNESS) * networkScaleFactor,
                speed: message.data.paddles.top.speed * networkScaleFactor,
                velocity: message.data.paddles.top.velocity * networkScaleFactor,
                targetX: message.data.paddles.top.targetX !== undefined ? message.data.paddles.top.targetX * networkScaleFactor : undefined,
                originalWidth: message.data.paddles.top.originalWidth !== undefined ? message.data.paddles.top.originalWidth * networkScaleFactor : undefined
              } : networkGameStateRef.current?.paddles.top,
              bottom: message.data.paddles?.bottom ? {
                ...message.data.paddles.bottom,
                x: message.data.paddles.bottom.x * networkScaleFactor,
                y: (message.data.paddles.bottom.y ?? (REFERENCE_SIZE - BASE_BORDER_THICKNESS - BASE_PADDLE_GAP - BASE_PADDLE_THICKNESS)) * networkScaleFactor,
                width: (message.data.paddles.bottom.width ?? BASE_PADDLE_LENGTH) * networkScaleFactor,
                height: (message.data.paddles.bottom.height ?? BASE_PADDLE_THICKNESS) * networkScaleFactor,
                speed: message.data.paddles.bottom.speed * networkScaleFactor,
                velocity: message.data.paddles.bottom.velocity * networkScaleFactor,
                targetX: message.data.paddles.bottom.targetX !== undefined ? message.data.paddles.bottom.targetX * networkScaleFactor : undefined,
                originalWidth: message.data.paddles.bottom.originalWidth !== undefined ? message.data.paddles.bottom.originalWidth * networkScaleFactor : undefined
              } : networkGameStateRef.current?.paddles.bottom
            },
            // Scale pickups if present
            pickups: message.data.pickups ? message.data.pickups.map(pickup => ({
              ...pickup,
              x: pickup.x * networkScaleFactor,
              y: pickup.y * networkScaleFactor,
              size: pickup.size * networkScaleFactor
            })) : message.data.pickups,
            // Scale coins if present
            coins: message.data.coins ? message.data.coins.map(coin => ({
              ...coin,
              x: coin.x * networkScaleFactor,
              y: coin.y * networkScaleFactor,
              size: coin.size * networkScaleFactor
            })) : message.data.coins
          };
          lastNetworkReceiveTimeRef.current = Date.now();
        }
        break;

      case 'update_game_state_delta':
        if (messageData) {
          setGameState(prevState => {
            // Apply delta to create new authoritative network state
            const networkState = { ...prevState };

            // Scale network coordinates from reference size (800px) to current canvas size
            const networkScaleFactor = 1; // Already using 800x800 coordinates

            if (messageData.ball) {
              console.log(`[GAME] RECEIVING BALL UPDATE:`, {
                oldLastTouchedBy: prevState.ball.lastTouchedBy,
                newLastTouchedBy: messageData.ball.lastTouchedBy,
                ballPosition: messageData.ball.x + ',' + messageData.ball.y,
                serverAuth: true, // WebSocket server is authoritative
                gameMode: multiplayerState.gameMode
              });

              // Detect paddle collision by checking if lastTouchedBy changed
              if (messageData.ball.lastTouchedBy && messageData.ball.lastTouchedBy !== prevState.ball.lastTouchedBy) {
                console.log('[GAME] Paddle collision detected via lastTouchedBy change');
                playMelodyNoteRef.current?.('paddle', null, 'both');
              }

              // Scale ball coordinates from server (reference size) to client canvas size
              const scaledBall = { ...messageData.ball };
              if (scaledBall.x !== undefined) scaledBall.x *= networkScaleFactor;
              if (scaledBall.y !== undefined) scaledBall.y *= networkScaleFactor;
              if (scaledBall.dx !== undefined) scaledBall.dx *= networkScaleFactor;
              if (scaledBall.dy !== undefined) scaledBall.dy *= networkScaleFactor;
              if (scaledBall.size !== undefined) scaledBall.size *= networkScaleFactor;
              if (scaledBall.originalSize !== undefined) scaledBall.originalSize *= networkScaleFactor;

              networkState.ball = { ...prevState.ball, ...scaledBall };
            }

            if (messageData.score) {
              console.log(`[GAME] RECEIVING SCORE UPDATE:`, {
                oldScore: JSON.stringify(prevState.score),
                newScore: JSON.stringify(messageData.score),
                serverAuth: true, // WebSocket server is authoritative
                gameMode: multiplayerState.gameMode
              });

              // Detect scoring by checking if any score increased
              const prevTotal = prevState.score.left + prevState.score.right + prevState.score.top + prevState.score.bottom;
              const newTotal = messageData.score.left + messageData.score.right + messageData.score.top + messageData.score.bottom;
              if (newTotal > prevTotal) {
                console.log('[GAME] Score detected - playing score sound');
                playMelodyNoteRef.current?.('score', null, 'both');
              }

              networkState.score = messageData.score;
            }

            if (messageData.isPlaying !== undefined) networkState.isPlaying = messageData.isPlaying;
            if (messageData.showStartScreen !== undefined) networkState.showStartScreen = messageData.showStartScreen;
            if (messageData.isPaused !== undefined) networkState.isPaused = messageData.isPaused;
            if (messageData.winner !== undefined) networkState.winner = messageData.winner;
            if (messageData.gameEnded !== undefined) networkState.gameEnded = messageData.gameEnded;

            if (messageData.pickups) {
              // Scale pickup coordinates
              networkState.pickups = messageData.pickups.map(pickup => ({
                ...pickup,
                x: pickup.x * networkScaleFactor,
                y: pickup.y * networkScaleFactor,
                size: pickup.size * networkScaleFactor
              }));
            }
            if (messageData.coins) {
              // Scale coin coordinates
              networkState.coins = messageData.coins.map(coin => ({
                ...coin,
                x: coin.x * networkScaleFactor,
                y: coin.y * networkScaleFactor,
                size: coin.size * networkScaleFactor
              }));
            }
            // Sync nextPickupTime from server (server controls pickup timing in multiplayer)
            if (messageData.nextPickupTime !== undefined) {
              networkState.nextPickupTime = messageData.nextPickupTime;
            }

            if (messageData.activeEffects) networkState.activeEffects = messageData.activeEffects;

            if (messageData.pickupEffect) {
              // Scale pickup effect coordinates
              networkState.pickupEffect = {
                ...messageData.pickupEffect,
                x: messageData.pickupEffect.x * networkScaleFactor,
                y: messageData.pickupEffect.y * networkScaleFactor
              };
            }
            if (messageData.decrunchEffect) networkState.decrunchEffect = messageData.decrunchEffect;
            if (messageData.rumbleEffect) networkState.rumbleEffect = messageData.rumbleEffect;

            // Update color index from server
            if (messageData.colorIndex !== undefined) {
              networkState.colorIndex = messageData.colorIndex;
            }

            // 📐 Sync playfield scale from server
            if (messageData.playfieldScale !== undefined) {
              networkState.playfieldScale = messageData.playfieldScale;
            }

            // Store network state and timing - let the game loop handle rendering from the ref
            networkGameStateRef.current = networkState;
            lastNetworkReceiveTimeRef.current = Date.now();

            // Don't call setGameState here - the game loop will pick up changes from networkGameStateRef
            // This prevents competing state updates that cause flickering
            return prevState; // Keep current state, game loop will use networkGameStateRef
          });
        }
        break;

      case 'game_reset':
        if (message.data) {
          setGameState(prevState => ({
            ...message.data,
            // Preserve client-only paddles and trails, enforce positions/dimensions
            paddles: {
              left: {
                ...message.data.paddles.left,
                x: message.data.paddles.left?.x ?? BORDER_THICKNESS,
                width: PADDLE_THICKNESS,
                height: PADDLE_LENGTH
              },
              right: {
                ...message.data.paddles.right,
                x: message.data.paddles.right?.x ?? (playFieldWidth - BORDER_THICKNESS - PADDLE_THICKNESS),
                width: PADDLE_THICKNESS,
                height: PADDLE_LENGTH
              },
              top: prevState.paddles.top,
              bottom: prevState.paddles.bottom
            },
            trails: {
              ...message.data.trails,
              ball: prevState.trails.ball || [], // Preserve client-side ball trails
              leftPaddle: prevState.trails.leftPaddle || [], // Preserve client-side left paddle trails
              rightPaddle: prevState.trails.rightPaddle || [], // Preserve client-side right paddle trails
              topPaddle: prevState.trails.topPaddle || [],
              bottomPaddle: prevState.trails.bottomPaddle || []
            }
          }));
        }
        break;

      // Removed gamemaster_assigned - WebSocket server is now the authoritative game master

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
        // Process updates even if isConnected is false (it might not be set yet)
        if (message.data) {

          setGameState(prevState => {
            // Apply delta to create new authoritative network state
            const networkState = { ...prevState };

            // Scale network coordinates from reference size (800px) to current canvas size
            const networkScaleFactor = 1; // Already using 800x800 coordinates

            if (message.data.ball) {
              // Detect paddle collision by checking if lastTouchedBy changed
              if (message.data.ball.lastTouchedBy &&
                  message.data.ball.lastTouchedBy !== prevState.ball.lastTouchedBy) {
                playMelodyNoteRef.current?.('paddle', null, 'both');
              }

              // Detect super striker auto-fire (isAiming changed from true to false)
              if (prevState.ball.isAiming && message.data.ball.isAiming === false) {
                console.log('[GAME] Super striker fired (auto or manual)');
                playMelodyNoteRef.current?.('powerup', null, 'both');
              }

              // Scale ball coordinates from server (reference size) to client canvas size
              const scaledBall = { ...message.data.ball };
              if (scaledBall.x !== undefined) scaledBall.x *= networkScaleFactor;
              if (scaledBall.y !== undefined) scaledBall.y *= networkScaleFactor;
              if (scaledBall.dx !== undefined) scaledBall.dx *= networkScaleFactor;
              if (scaledBall.dy !== undefined) scaledBall.dy *= networkScaleFactor;
              if (scaledBall.size !== undefined) scaledBall.size *= networkScaleFactor;
              if (scaledBall.originalSize !== undefined) scaledBall.originalSize *= networkScaleFactor;
              if (scaledBall.aimX !== undefined) scaledBall.aimX *= networkScaleFactor;
              if (scaledBall.aimY !== undefined) scaledBall.aimY *= networkScaleFactor;
              if (scaledBall.aimTargetX !== undefined) scaledBall.aimTargetX *= networkScaleFactor;
              if (scaledBall.aimTargetY !== undefined) scaledBall.aimTargetY *= networkScaleFactor;

              networkState.ball = { ...prevState.ball, ...scaledBall };
            }

            if (message.data.score) {
              // Detect scoring by checking if any score increased
              const prevTotal = prevState.score.left + prevState.score.right +
                               prevState.score.top + prevState.score.bottom;
              const newTotal = message.data.score.left + message.data.score.right +
                             message.data.score.top + message.data.score.bottom;
              if (newTotal > prevTotal) {
                playMelodyNoteRef.current?.('score', null, 'both');
              }

              networkState.score = message.data.score;
            }

            if (message.data.isPlaying !== undefined) networkState.isPlaying = message.data.isPlaying;
            if (message.data.showStartScreen !== undefined) networkState.showStartScreen = message.data.showStartScreen;
            if (message.data.isPaused !== undefined) networkState.isPaused = message.data.isPaused;
            if (message.data.winner !== undefined) networkState.winner = message.data.winner;
            if (message.data.gameEnded !== undefined) networkState.gameEnded = message.data.gameEnded;

            if (message.data.pickups) {
              // Scale pickup coordinates
              networkState.pickups = message.data.pickups.map(pickup => ({
                ...pickup,
                x: pickup.x * networkScaleFactor,
                y: pickup.y * networkScaleFactor,
                size: pickup.size * networkScaleFactor
              }));
            }
            if (message.data.coins) {
              // Scale coin coordinates
              networkState.coins = message.data.coins.map(coin => ({
                ...coin,
                x: coin.x * networkScaleFactor,
                y: coin.y * networkScaleFactor,
                size: coin.size * networkScaleFactor
              }));
              // Clear coin sound tracking when new coins arrive
              if (message.data.coins.length === 0) {
                coinSoundsPlayedRef.current.clear();
              }
            }
            if (message.data.activeEffects) networkState.activeEffects = message.data.activeEffects;
            if (message.data.extraBalls) {
              // Scale extra ball coordinates
              networkState.extraBalls = message.data.extraBalls.map(ball => ({
                ...ball,
                x: ball.x * networkScaleFactor,
                y: ball.y * networkScaleFactor,
                dx: ball.dx * networkScaleFactor,
                dy: ball.dy * networkScaleFactor,
                size: ball.size * networkScaleFactor
              }));
            }
            if (message.data.machineGunBalls !== undefined) {
              // Detect when new machine gun balls are fired and play laser sound
              const previousCount = previousMachineGunBallCountRef.current;
              const newCount = message.data.machineGunBalls.length;

              if (newCount > previousCount) {
                // New balls were fired - play laser sound for each new ball
                const ballsAdded = newCount - previousCount;
                for (let i = 0; i < ballsAdded; i++) {
                  playLaserSound();
                }
              }

              // Update tracked count
              previousMachineGunBallCountRef.current = newCount;
              // Scale machine gun ball coordinates
              networkState.machineGunBalls = message.data.machineGunBalls.map(ball => ({
                ...ball,
                x: ball.x * networkScaleFactor,
                y: ball.y * networkScaleFactor,
                dx: ball.dx * networkScaleFactor,
                dy: ball.dy * networkScaleFactor,
                size: ball.size * networkScaleFactor
              }));
            }
            if (message.data.machineGunActive !== undefined) networkState.machineGunActive = message.data.machineGunActive;

            if (message.data.pickupEffect) {
              // Scale pickup effect coordinates
              networkState.pickupEffect = {
                ...message.data.pickupEffect,
                x: message.data.pickupEffect.x * networkScaleFactor,
                y: message.data.pickupEffect.y * networkScaleFactor
              };
            }
            if (message.data.rumbleEffect) networkState.rumbleEffect = message.data.rumbleEffect;

            // Update color index from server
            if (message.data.colorIndex !== undefined) {
              networkState.colorIndex = message.data.colorIndex;
            }

            // Update paddles from server - for player's paddle, keep position but accept size changes
            if (message.data.paddles) {
              const playerSide = multiplayerStateRef.current?.playerSide;

              // Helper to scale paddle properties
              const scalePaddle = (paddle: any) => {
                if (!paddle) return paddle;
                return {
                  ...paddle,
                  x: paddle.x * networkScaleFactor,
                  y: paddle.y * networkScaleFactor,
                  width: paddle.width * networkScaleFactor,
                  height: paddle.height * networkScaleFactor,
                  speed: paddle.speed * networkScaleFactor,
                  velocity: paddle.velocity * networkScaleFactor,
                  targetX: paddle.targetX !== undefined ? paddle.targetX * networkScaleFactor : undefined,
                  targetY: paddle.targetY !== undefined ? paddle.targetY * networkScaleFactor : undefined,
                  originalWidth: paddle.originalWidth !== undefined ? paddle.originalWidth * networkScaleFactor : undefined,
                  originalHeight: paddle.originalHeight !== undefined ? paddle.originalHeight * networkScaleFactor : undefined
                };
              };

              networkState.paddles = {
                left: message.data.paddles.left ? (playerSide === 'left' ? {
                  ...scalePaddle(message.data.paddles.left),
                  x: prevState.paddles.left.x,
                  y: prevState.paddles.left.y
                } : scalePaddle(message.data.paddles.left)) : prevState.paddles.left,
                right: message.data.paddles.right ? (playerSide === 'right' ? {
                  ...scalePaddle(message.data.paddles.right),
                  x: prevState.paddles.right.x,
                  y: prevState.paddles.right.y
                } : scalePaddle(message.data.paddles.right)) : prevState.paddles.right,
                top: message.data.paddles.top ? (playerSide === 'top' ? {
                  ...scalePaddle(message.data.paddles.top),
                  x: prevState.paddles.top.x,
                  y: prevState.paddles.top.y
                } : scalePaddle(message.data.paddles.top)) : prevState.paddles.top,
                bottom: message.data.paddles.bottom ? (playerSide === 'bottom' ? {
                  ...scalePaddle(message.data.paddles.bottom),
                  x: prevState.paddles.bottom.x,
                  y: prevState.paddles.bottom.y
                } : scalePaddle(message.data.paddles.bottom)) : prevState.paddles.bottom
              };
            }

            // 📐 Sync playfield scale from server
            if (message.data.playfieldScale !== undefined) {
              networkState.playfieldScale = message.data.playfieldScale;
            }

            // ⏱️ Sync time warp state from server
            if (message.data.timeWarpActive !== undefined) {
              networkState.timeWarpActive = message.data.timeWarpActive;
            }
            if (message.data.timeWarpFactor !== undefined) {
              networkState.timeWarpFactor = message.data.timeWarpFactor;
            }

            // 🕳️ Sync black holes from server
            if (message.data.blackHoles !== undefined) {
              // Scale black hole coordinates
              networkState.blackHoles = message.data.blackHoles.map(hole => ({
                ...hole,
                x: hole.x * networkScaleFactor,
                y: hole.y * networkScaleFactor,
                radius: hole.radius * networkScaleFactor
              }));
            }

            // 🎵 Sync detroit mode from server
            const hadDetroit = networkState.detroitMode || false;
            if (message.data.detroitMode !== undefined) {
              networkState.detroitMode = message.data.detroitMode;
              console.log('[DETROIT] Synced detroitMode from server:', message.data.detroitMode);

              // Handle music activation/deactivation
              const hasDetroit = message.data.detroitMode;
              if (hasDetroit && !hadDetroit) {
                console.log('[DETROIT] Starting Detroit techno mode (delta)');
                if ((window as any).generativeMusic) {
                  (window as any).generativeMusic.startPiece('detroit-techno');
                }
              } else if (!hasDetroit && hadDetroit) {
                console.log('[DETROIT] Stopping Detroit techno mode (delta)');
                if ((window as any).generativeMusic?.currentState?.currentPieceId === 'detroit-techno') {
                  const pieces = (window as any).generativeMusic.availablePieces.filter((p: any) => p.id !== 'detroit-techno');
                  const randomPiece = pieces[Math.floor(Math.random() * pieces.length)];
                  (window as any).generativeMusic.startPiece(randomPiece.id);
                }
              }
            }
            if (message.data.detroitStartTime !== undefined) {
              networkState.detroitStartTime = message.data.detroitStartTime;
              console.log('[DETROIT] Synced detroitStartTime from server:', message.data.detroitStartTime);
            }

            // Store network state and timing for interpolation
            networkGameStateRef.current = networkState;
            lastNetworkReceiveTimeRef.current = Date.now();

            return networkState;
          });
        }
        break;

      case 'lan_mode_updated':
        if (message.data) {
          console.log('[LAN MODE] LAN mode updated:', message.data.lanMode);
          setLanMode(message.data.lanMode);
        }
        break;

      case 'brick_break':
        if (message.data) {
          // Create particle explosion effect
          const particleCount = 12;
          const newParticles: any[] = [];

          for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = 2 + Math.random() * 3;
            newParticles.push({
              x: message.data.x,
              y: message.data.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              color: message.data.color,
              life: 1.0,
              size: 3 + Math.random() * 3
            });
          }

          // Add particles to confetti array for rendering
          setGameState(prev => ({
            ...prev,
            confetti: [...(prev.confetti || []), ...newParticles]
          }));

          // Play brick break sound
          if (playMelodyNoteRef.current) {
            playMelodyNoteRef.current('pickup', { type: 'brick_break' }, 'both');
          }
        }
        break;

      default:
        break;
    }
  }, [multiplayerState.playerId, multiplayerState.roomId, canvasSize.width]);

  // Send paddle updates immediately for zero-latency feel
  const lastPaddlePositionRef = useRef<number>(0);
  const lastPaddleUpdateTimeRef = useRef<number>(0);
  const paddleUpdateSequenceRef = useRef<number>(0);

  // Send paddle update via WebSocket - NO THROTTLING for instant response
  const updatePaddlePosition = useCallback((y: number, velocity = 0, targetY?: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && multiplayerState.isConnected) {
      const now = Date.now();

      // Only send if position actually changed (no threshold - send every pixel)
      if (y !== lastPaddlePositionRef.current) {
        paddleUpdateSequenceRef.current++;

        // Scale back to reference size (800px) before sending to server
        const invScaleFactor = REFERENCE_SIZE / canvasSize.width;

        // Send unreliable message for paddle updates (order doesn't matter, latest wins)
        wsRef.current.send(JSON.stringify({
          t: 'up', // update_paddle
          p: multiplayerState.playerId,
          d: {
            y: y * invScaleFactor, // Scale back to reference size
            v: velocity * invScaleFactor, // Scale velocity
            tY: (targetY || y) * invScaleFactor, // Scale target
            ts: now, // timestamp for lag compensation
            seq: paddleUpdateSequenceRef.current // sequence to ignore out-of-order
          }
        }));

        lastPaddlePositionRef.current = y;
        lastPaddleUpdateTimeRef.current = now;
      }
    }
  }, [multiplayerState.playerId, multiplayerState.isConnected, multiplayerState.playerSide, canvasSize.width]);

  // Update horizontal paddle position (top/bottom paddles use X coordinate)
  const updateHorizontalPaddlePosition = useCallback((x: number, velocity = 0, targetX?: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && multiplayerState.isConnected) {
      const now = Date.now();

      // Only send if position actually changed
      if (x !== lastPaddlePositionRef.current) {
        paddleUpdateSequenceRef.current++;

        // Scale back to reference size (800px) before sending to server
        const invScaleFactor = REFERENCE_SIZE / canvasSize.width;

        // Send paddle update with X coordinate instead of Y
        wsRef.current.send(JSON.stringify({
          t: 'up', // update_paddle
          p: multiplayerState.playerId,
          d: {
            x: x * invScaleFactor, // Scale back to reference size
            v: velocity * invScaleFactor, // Scale velocity
            tX: (targetX || x) * invScaleFactor, // Scale target
            ts: now,
            seq: paddleUpdateSequenceRef.current
          }
        }));

        lastPaddlePositionRef.current = x;
        lastPaddleUpdateTimeRef.current = now;
      }
    }
  }, [multiplayerState.playerId, multiplayerState.isConnected, multiplayerState.playerSide, canvasSize.width]);

  // Toggle LAN mode - sends message to server
  const toggleLanMode = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'toggle_lan_mode',
        playerId: multiplayerState.playerId,
        roomId: multiplayerState.roomId
      }));
      console.log('[LAN MODE] Toggling LAN mode');
    }
  }, [multiplayerState.playerId, multiplayerState.roomId]);

  // Track previous game state for delta compression
  const previousGameStateRef = useRef<GameState | null>(null);

  // Track current game state for accessing in WebSocket handlers
  const currentGameStateRef = useRef<GameState>(gameState);

  // Keep ref updated with latest game state
  useEffect(() => {
    currentGameStateRef.current = gameState;
  }, [gameState]);

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

      // REMOVED CLIENT-SIDE WALL BOUNCING: Ball should reach server-side scoring boundaries
      // Server handles all scoring when ball reaches boundaries (-20, +820) beyond canvas edges
      // Client prediction should not prevent ball from reaching scoring areas
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

    // Use server paddle positions directly without interpolation to prevent jitter
    // Interpolation can cause visual jitter when AI paddles move slowly
    if (multiplayerState.playerSide !== 'left' && targetState.paddles.left) {
      interpolated.paddles.left = { ...targetState.paddles.left };
    }

    if (multiplayerState.playerSide !== 'right' && targetState.paddles.right) {
      interpolated.paddles.right = { ...targetState.paddles.right };
    }

    if (multiplayerState.playerSide !== 'top' && targetState.paddles.top) {
      interpolated.paddles.top = { ...targetState.paddles.top };
    }

    if (multiplayerState.playerSide !== 'bottom' && targetState.paddles.bottom) {
      interpolated.paddles.bottom = { ...targetState.paddles.bottom };
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
  const windNoiseRef = useRef<{ noise: any; filter: any; autoFilter: any; gain: any } | null>(null);
  const attractorSoundRef = useRef<{ osc: any; lfo: any; gain: any } | null>(null);
  const repulsorSoundRef = useRef<{ osc: any; lfo: any; gain: any } | null>(null);
  const blackHoleSoundRef = useRef<{ osc: any; filter: any; lfo: any; gain: any } | null>(null);
  const electricHumRef = useRef<any>(null);
  const masterLimiterRef = useRef<any>(null);
  const hypnoSoundRef = useRef<{ osc1: any; osc2: any; lfo1: any; lfo2: any; reverb: any; gain: any } | null>(null);
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


  // WebSocket communication - clients receive updates from authoritative server
  // Removed updateGameState - WebSocket server is now the authoritative game master
  // Clients only send input and receive game state updates from the server
  const updateGameState = useCallback((newGameState: GameState) => {
    // No-op: Clients don't send game state in server-authoritative model
    // Server handles all game logic and sends updates to clients
  }, []);

  // Reset game room - removed since clients don't control room resets in server-authoritative model
  const resetRoom = useCallback(() => {
    // No-op: Server controls room resets
    console.log('Room reset requests handled by WebSocket server');
  }, []);

  // Handle window resize - responsive canvas sizing
  useEffect(() => {
    const updateCanvasSize = () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const minDimension = Math.min(viewportWidth, viewportHeight);

      // Use 95% of the smallest viewport dimension to maximize space
      const newSize = Math.max(Math.floor(minDimension * 0.95), 400);
      const oldSize = canvasSize.width;

      // Only update if size actually changed
      if (newSize === oldSize) return;

      // Calculate scaling ratio for existing game elements
      const scaleRatio = newSize / oldSize;

      console.log('Canvas size update:', {
        viewport: { width: viewportWidth, height: viewportHeight },
        oldSize,
        newSize,
        scaleRatio
      });

      setCanvasSize({ width: newSize, height: newSize });

      // In multiplayer mode, don't rescale network state - it will be updated on next server message
      // Server always sends coordinates in 800x800 reference space, which will be scaled to new canvas size
      if (gameState.gameMode === 'multiplayer') {
        console.log('Canvas resized in multiplayer mode - waiting for next server update');
        return; // Don't rescale - next server update will have correct coordinates
      }

      // Scale all game state proportionally (single player/auto mode only)
      setGameState(prev => ({
        ...prev,
        ball: {
          ...prev.ball,
          x: prev.ball.x * scaleRatio,
          y: prev.ball.y * scaleRatio,
          dx: prev.ball.dx * scaleRatio,
          dy: prev.ball.dy * scaleRatio,
          size: prev.ball.size * scaleRatio,
          originalSize: prev.ball.originalSize * scaleRatio
        },
        paddles: {
          left: {
            ...prev.paddles.left,
            x: prev.paddles.left.x * scaleRatio,
            y: prev.paddles.left.y * scaleRatio,
            height: prev.paddles.left.height * scaleRatio,
            width: prev.paddles.left.width * scaleRatio,
            speed: prev.paddles.left.speed * scaleRatio,
            velocity: prev.paddles.left.velocity * scaleRatio,
            targetY: prev.paddles.left.targetY !== undefined ? prev.paddles.left.targetY * scaleRatio : undefined,
            originalHeight: prev.paddles.left.originalHeight !== undefined ? prev.paddles.left.originalHeight * scaleRatio : undefined
          },
          right: {
            ...prev.paddles.right,
            x: prev.paddles.right.x * scaleRatio,
            y: prev.paddles.right.y * scaleRatio,
            height: prev.paddles.right.height * scaleRatio,
            width: prev.paddles.right.width * scaleRatio,
            speed: prev.paddles.right.speed * scaleRatio,
            velocity: prev.paddles.right.velocity * scaleRatio,
            targetY: prev.paddles.right.targetY !== undefined ? prev.paddles.right.targetY * scaleRatio : undefined,
            originalHeight: prev.paddles.right.originalHeight !== undefined ? prev.paddles.right.originalHeight * scaleRatio : undefined
          },
          top: {
            ...prev.paddles.top,
            x: prev.paddles.top.x * scaleRatio,
            y: prev.paddles.top.y * scaleRatio,
            height: prev.paddles.top.height * scaleRatio,
            width: prev.paddles.top.width * scaleRatio,
            speed: prev.paddles.top.speed * scaleRatio,
            velocity: prev.paddles.top.velocity * scaleRatio,
            targetX: prev.paddles.top.targetX !== undefined ? prev.paddles.top.targetX * scaleRatio : undefined,
            originalWidth: prev.paddles.top.originalWidth !== undefined ? prev.paddles.top.originalWidth * scaleRatio : undefined
          },
          bottom: {
            ...prev.paddles.bottom,
            x: prev.paddles.bottom.x * scaleRatio,
            y: prev.paddles.bottom.y * scaleRatio,
            height: prev.paddles.bottom.height * scaleRatio,
            width: prev.paddles.bottom.width * scaleRatio,
            speed: prev.paddles.bottom.speed * scaleRatio,
            velocity: prev.paddles.bottom.velocity * scaleRatio,
            targetX: prev.paddles.bottom.targetX !== undefined ? prev.paddles.bottom.targetX * scaleRatio : undefined,
            originalWidth: prev.paddles.bottom.originalWidth !== undefined ? prev.paddles.bottom.originalWidth * scaleRatio : undefined
          }
        },
        pickups: prev.pickups.map(pickup => ({
          ...pickup,
          x: pickup.x * scaleRatio,
          y: pickup.y * scaleRatio,
          size: pickup.size * scaleRatio
        })),
        coins: prev.coins.map(coin => ({
          ...coin,
          x: coin.x * scaleRatio,
          y: coin.y * scaleRatio,
          size: coin.size * scaleRatio
        }))
      }));
    };

    // Initial setup is already done, this only handles resize
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [canvasSize.width, gameState.gameMode]);

  // Initialize Web Audio API with reverb effects (only after user gesture)
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioInitAttempted = useRef<boolean>(false);
  const reverbNodeRef = useRef<ConvolverNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const echoGainRef = useRef<GainNode | null>(null);

  // Audio visualizer
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const frequencyDataRef = useRef<Uint8Array | null>(null);

  // ===== GLOBAL AUDIO MIXER ARCHITECTURE =====
  // All audio routes through this mixer to prevent crackling and distortion

  // Master channels (16 channels total for maximum distribution)
  const audioChannel1Ref = useRef<GainNode | null>(null);
  const audioChannel2Ref = useRef<GainNode | null>(null);
  const audioChannel3Ref = useRef<GainNode | null>(null);
  const audioChannel4Ref = useRef<GainNode | null>(null);
  const audioChannel5Ref = useRef<GainNode | null>(null);
  const audioChannel6Ref = useRef<GainNode | null>(null);
  const audioChannel7Ref = useRef<GainNode | null>(null);
  const audioChannel8Ref = useRef<GainNode | null>(null);
  const audioChannel9Ref = useRef<GainNode | null>(null);
  const audioChannel10Ref = useRef<GainNode | null>(null);
  const audioChannel11Ref = useRef<GainNode | null>(null);
  const audioChannel12Ref = useRef<GainNode | null>(null);
  const audioChannel13Ref = useRef<GainNode | null>(null);
  const audioChannel14Ref = useRef<GainNode | null>(null);
  const audioChannel15Ref = useRef<GainNode | null>(null);
  const audioChannel16Ref = useRef<GainNode | null>(null);

  // Round-robin channel selector
  const currentChannelIndexRef = useRef<number>(0);

  // Track active sounds for dynamic volume adjustment
  const activeSoundsCountRef = useRef<number>(0);

  // Master compressor/limiter to prevent clipping
  const masterCompressorRef = useRef<DynamicsCompressorNode | null>(null);

  // Hard limiter (final safety net before destination)
  const masterLimiterGainRef = useRef<GainNode | null>(null);

  // Speech has dedicated channel (channel 1)
  const speechMasterGainRef = useRef<GainNode | null>(null);

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

  // ===== GLOBAL AUDIO MIXER INITIALIZATION =====
  const initializeGlobalMixer = useCallback((audioContext: AudioContext) => {
    console.log('🎚️ Initializing Global Audio Mixer');

    // Create master compressor for smooth dynamics control
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-24, audioContext.currentTime); // Even lower threshold
    compressor.knee.setValueAtTime(20, audioContext.currentTime); // Very smooth compression
    compressor.ratio.setValueAtTime(12, audioContext.currentTime); // Moderate compression (not extreme)
    compressor.attack.setValueAtTime(0.001, audioContext.currentTime); // Very fast attack
    compressor.release.setValueAtTime(0.1, audioContext.currentTime); // Fast release
    masterCompressorRef.current = compressor;

    // Create HARD LIMITER (brick wall at -0.3dB to prevent any clipping)
    const limiter = audioContext.createDynamicsCompressor();
    limiter.threshold.setValueAtTime(-0.3, audioContext.currentTime); // Just below 0dB
    limiter.knee.setValueAtTime(0, audioContext.currentTime); // Hard knee = brick wall
    limiter.ratio.setValueAtTime(20, audioContext.currentTime); // Infinity ratio for true limiting
    limiter.attack.setValueAtTime(0.0001, audioContext.currentTime); // Instant attack
    limiter.release.setValueAtTime(0.05, audioContext.currentTime); // Very fast release

    // Create safety gain before limiter (reduces everything by 20% as final safety)
    const safetyGain = audioContext.createGain();
    safetyGain.gain.setValueAtTime(0.8, audioContext.currentTime);
    masterLimiterGainRef.current = safetyGain;

    // Create audio analyzer
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.8;
    analyserNodeRef.current = analyser;
    frequencyDataRef.current = new Uint8Array(analyser.frequencyBinCount);

    // Routing: Compressor → Safety Gain → Hard Limiter → Analyser → Destination
    compressor.connect(safetyGain);
    safetyGain.connect(limiter);
    limiter.connect(analyser);
    analyser.connect(audioContext.destination);

    // Create 16 mixer channels with REDUCED volume to prevent overload
    const channelVolume = 0.08; // Reduced from 0.15 to 0.08
    const channels = [
      audioChannel1Ref, audioChannel2Ref, audioChannel3Ref, audioChannel4Ref,
      audioChannel5Ref, audioChannel6Ref, audioChannel7Ref, audioChannel8Ref,
      audioChannel9Ref, audioChannel10Ref, audioChannel11Ref, audioChannel12Ref,
      audioChannel13Ref, audioChannel14Ref, audioChannel15Ref, audioChannel16Ref
    ];

    channels.forEach((channelRef) => {
      const gain = audioContext.createGain();
      gain.gain.setValueAtTime(channelVolume, audioContext.currentTime);
      gain.connect(compressor);
      channelRef.current = gain;
    });

    // Speech uses channel 1
    speechMasterGainRef.current = audioChannel1Ref.current;

    console.log('  ✓ 16 channels, compressor, hard limiter, safety gain, analyser initialized');
    console.log(`  ✓ Audio chain: Channels(${channelVolume}) → Compressor(-24dB) → Safety(0.8) → Limiter(-0.3dB) → Analyser → Out`);

    // Global refs
    (window as any).pongAudioAnalyzer = analyser;
    (window as any).pongAudioContext = audioContext;
    (window as any).pongMasterCompressor = compressor;
    (window as any).pongMasterLimiter = limiter;
  }, []);

  // Initialize audio effects (reverb/delay)
  const initializeAudioEffects = useCallback((audioContext: AudioContext) => {
    const convolver = audioContext.createConvolver();
    convolver.buffer = createImpulseResponse(audioContext);
    reverbNodeRef.current = convolver;

    const delay = audioContext.createDelay(1.0);
    delay.delayTime.setValueAtTime(0.15, audioContext.currentTime);
    delayNodeRef.current = delay;

    const echoGain = audioContext.createGain();
    echoGain.gain.setValueAtTime(0.4, audioContext.currentTime);
    echoGainRef.current = echoGain;

    delay.connect(echoGain);
    echoGain.connect(delay);
  }, [createImpulseResponse]);

  // Get next available audio channel (round-robin, skips channel 1 for speech)
  const getNextAudioChannel = useCallback((): GainNode | null => {
    const channels = [
      audioChannel2Ref, audioChannel3Ref, audioChannel4Ref, audioChannel5Ref,
      audioChannel6Ref, audioChannel7Ref, audioChannel8Ref, audioChannel9Ref,
      audioChannel10Ref, audioChannel11Ref, audioChannel12Ref, audioChannel13Ref,
      audioChannel14Ref, audioChannel15Ref, audioChannel16Ref
    ];

    currentChannelIndexRef.current = (currentChannelIndexRef.current + 1) % channels.length;
    return channels[currentChannelIndexRef.current].current;
  }, []);

  // Initialize audio on user interaction
  const initializeAudio = useCallback(async () => {
    if (!audioContextRef.current && !audioInitAttempted.current) {
      audioInitAttempted.current = true;
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        initializeGlobalMixer(audioContextRef.current); // ← Initialize mixer FIRST
        initializeAudioEffects(audioContextRef.current);
        // Resume context if suspended
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
      } catch (error) {
        // Audio not supported - fail silently
      }
    }
  }, [initializeGlobalMixer, initializeAudioEffects]);

  // Simple speech function with overlap prevention and effects
  const speakRobotic = useCallback((text: string) => {
    // LAN mode check - mute all clients, only spectator plays audio
    if (lanMode && !isSpectatorMode) {
      console.log('[LAN MODE] Robot voice muted - LAN mode is active and this is not spectator view');
      return;
    }

    // Validate text input
    if (!text || typeof text !== 'string' || text.trim() === '') {
      console.error('[ROBOT] SAM speech error: Invalid text input:', text);
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

      // Display the text on screen (but skip countdown numbers 0-9)
      if (!/^[0-9]$/.test(cleanText)) {
        setRobotText(cleanText);

        // Clear any existing text timeout
        if (robotTextTimeoutRef.current) {
          clearTimeout(robotTextTimeoutRef.current);
        }
      }

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
          speechMasterGainRef.current.gain.setValueAtTime(0.08, audioContextRef.current!.currentTime); // Lower robot voice volume to prevent distortion
          // Connect to analyzer for visualizer, then to destination
          if (analyserNodeRef.current) {
            speechMasterGainRef.current.connect(analyserNodeRef.current);
          } else {
            speechMasterGainRef.current.connect(audioContextRef.current!.destination);
          }
        } else {
          // Reset volume level to prevent distortion buildup
          speechMasterGainRef.current.gain.setValueAtTime(0.08, audioContextRef.current!.currentTime);
        }

        // Connect to speech master gain instead of direct destination
        outputGain.connect(speechMasterGainRef.current);

        // Play the processed audio
        source.start();

        // Clean up when finished
        source.onended = () => {
          isSpeakingRef.current = false;
          // Clear text display after a brief delay
          robotTextTimeoutRef.current = setTimeout(() => {
            setRobotText('');
          }, 500);
        };
      } catch (error) {
        console.error('[ROBOT] SAM Web Audio error:', error);
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
      console.error('[ROBOT] SAM speech error:', error);
      isSpeakingRef.current = false;
    }
  }, [lanMode, isSpectatorMode, initializeAudio]);

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
  const playTone = useCallback(async (frequency: number, duration: number, effectType: 'normal' | 'echo' | 'reverb' | 'both' = 'both', volume: number = 0.5) => {
    // console.log(`[SOUND] playTone called: freq=${frequency}, dur=${duration}, vol=${volume}`);

    // Only create AudioContext when actually trying to play a sound (user gesture)
    if (!audioContextRef.current && !audioInitAttempted.current) {
      // console.log('[SOUND] Creating new AudioContext');
      audioInitAttempted.current = true;
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        initializeAudioEffects(audioContextRef.current);
      } catch (error) {
        console.error('[SOUND] Failed to create AudioContext:', error);
        // Audio not supported - fail silently
        return;
      }
    }

    // Exit early if no audio context
    if (!audioContextRef.current) {
      // console.warn('[SOUND] No audio context available');
      return;
    }

    // console.log(`[SOUND] Audio context state: ${audioContextRef.current.state}`);

    // Resume audio context if suspended (required for production builds)
    if (audioContextRef.current.state === 'suspended') {
      // console.log('[SOUND] Resuming suspended audio context');
      try {
        await audioContextRef.current.resume();
        // console.log('[SOUND] Audio context resumed successfully, state:', audioContextRef.current?.state);
      } catch (error) {
        console.error('[SOUND] Failed to resume audio context:', error);
        return;
      }
    }

    // console.log('[SOUND] About to create oscillator and play sound');

    const ctx = audioContextRef.current;
    const now = ctx.currentTime;

    // Get next mixer channel (global round-robin distribution)
    const selectedChannel = getNextAudioChannel();
    if (!selectedChannel) {
      console.warn('⚠️ No audio channel available');
      return;
    }

    // Track active sounds for automatic volume adjustment
    activeSoundsCountRef.current += 1;
    const currentActiveSounds = activeSoundsCountRef.current;

    // Dynamic volume scaling: reduce volume when multiple sounds play simultaneously
    // Formula: baseVolume / sqrt(activeSounds) prevents clipping while maintaining clarity
    const volumeScale = Math.min(1.0, 1.5 / Math.sqrt(currentActiveSounds));
    const adjustedVolume = volume * volumeScale;

    // console.log(`[SOUND] Active sounds: ${currentActiveSounds}, volume scale: ${volumeScale.toFixed(2)}, adjusted volume: ${adjustedVolume.toFixed(2)}`);

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

    // Configure main envelope with dynamically adjusted volume
    mainGain.gain.setValueAtTime(adjustedVolume, now); // Dynamic volume based on active sounds
    mainGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Configure mix levels based on effect type (restored advanced effects)
    const dryLevel = effectType === 'reverb' || effectType === 'both' ? 0.6 : 1.0;
    const reverbLevel = effectType === 'reverb' || effectType === 'both' ? 0.3 : 0.0;
    const echoLevel = effectType === 'echo' || effectType === 'both' ? 0.25 : 0.0;

    dryGain.gain.setValueAtTime(dryLevel, now);
    wetGain.gain.setValueAtTime(reverbLevel, now);
    echoWetGain.gain.setValueAtTime(echoLevel, now);

    // Connect the audio graph through selected beep channel (round-robin distribution)
    oscillator.connect(mainGain);

    // Dry signal (through selected channel)
    mainGain.connect(dryGain);
    dryGain.connect(selectedChannel);

    // Wet signal (through reverb to selected channel)
    if ((effectType === 'reverb' || effectType === 'both') && reverbNodeRef.current) {
      mainGain.connect(reverbNodeRef.current);
      reverbNodeRef.current.connect(wetGain);
      wetGain.connect(selectedChannel);
    }

    // Echo signal (through delay to selected channel)
    if ((effectType === 'echo' || effectType === 'both') && delayNodeRef.current) {
      mainGain.connect(delayNodeRef.current);
      delayNodeRef.current.connect(echoWetGain);
      echoWetGain.connect(selectedChannel);
    }

    // Start and stop
    // console.log('[SOUND] Starting oscillator:', {
    //   frequency,
    //   duration,
    //   volume,
    //   effectType,
    //   beepsMasterGainExists: !!beepsMasterGainRef.current,
    //   beepsMasterGainValue: beepsMasterGainRef.current?.gain.value,
    //   contextState: ctx.state
    // });
    oscillator.start(now);
    oscillator.stop(now + duration);
    // console.log('[SOUND] Oscillator started and scheduled to stop');

    // Clean up nodes after oscillator stops to prevent accumulation
    setTimeout(() => {
      try {
        mainGain.disconnect();
        dryGain.disconnect();
        wetGain.disconnect();
        echoWetGain.disconnect();
        // Decrement active sounds counter
        activeSoundsCountRef.current = Math.max(0, activeSoundsCountRef.current - 1);
      } catch (e) {
        // Nodes may already be disconnected
      }
    }, (duration * 1000) + 100); // Add small buffer
  }, [initializeAudioEffects, getNextAudioChannel]);


  // Legacy beep function for compatibility
  const playBeep = useCallback((frequency: number, duration: number, effectType: 'normal' | 'echo' | 'reverb' | 'both' = 'both') => {
    playTone(frequency, duration, effectType);
  }, [playTone]);

  // [ROCKET] OPTIMIZED melody system using Tone.js
  const playMelodyNote = useCallback(async (eventType: 'paddle' | 'wall' | 'score' | 'pickup', pickupData?: any, effectType: 'normal' | 'echo' | 'reverb' | 'both' = 'both') => {
    // console.log(`[SOUND] Playing sound for event: ${eventType}`);

    // LAN mode check - mute all clients, only spectator plays audio
    if (lanMode && !isSpectatorMode) {
      console.log('[LAN MODE] Audio muted - LAN mode is active and this is not spectator view');
      return;
    }

    // Dynamically import Tone.js if not available
    let Tone = (window as any).Tone;

    if (!Tone) {
      // console.log('[SOUND] Tone.js not available yet, trying to import...');
      try {
        const ToneModule = await import('tone');
        Tone = ToneModule.default || ToneModule;
        (window as any).Tone = Tone;
        // console.log('[SOUND] Tone.js imported successfully');
      } catch (error) {
        console.error('[SOUND] Failed to import Tone.js:', error);
        return;
      }
    }

    const now = Date.now();

    // Check if music piece changed and update scale to match
    const currentMusicPiece = (window as any).generativeMusic?.currentState?.currentPieceId || '';
    if (currentMusicPiece && currentMusicPiece !== melodyState.currentMusicPiece) {
      const newScale = MUSIC_SCALE_MAP[currentMusicPiece] || 'c-minor';
      melodyState.currentScale = newScale;
      melodyState.currentMusicPiece = currentMusicPiece;
      melodyState.lastScaleChange = now;
      console.log(`🎵 Music piece changed to '${currentMusicPiece}' - sound effects now use scale: ${newScale}`);
    }

    let frequency: number;
    let duration: number;
    let harmony: number[] = []; // Additional notes for richer sound

    const currentScale = MUSICAL_SCALES[melodyState.currentScale];

    switch (eventType) {
      case 'paddle':
        // Ascending melody pattern for paddle hits
        const paddleNote = currentScale[melodyState.paddleHitIndex % currentScale.length];
        frequency = paddleNote;
        duration = 0.15;
        // Add harmony (fifth interval for space-like resonance)
        const fifthIndex = (melodyState.paddleHitIndex + 2) % currentScale.length;
        harmony = [currentScale[fifthIndex] * 0.7]; // Lower octave fifth
        melodyState.paddleHitIndex = (melodyState.paddleHitIndex + 1) % currentScale.length;
        break;

      case 'wall':
        // Descending pattern for wall hits (more ominous)
        const wallNoteIndex = (currentScale.length - 1) - (melodyState.wallHitIndex % currentScale.length);
        frequency = currentScale[wallNoteIndex];
        duration = 0.12;
        // Add dissonant harmony (minor second)
        const dissonantIndex = (wallNoteIndex + 1) % currentScale.length;
        harmony = [currentScale[dissonantIndex] * 1.1]; // Slightly higher for tension
        melodyState.wallHitIndex = (melodyState.wallHitIndex + 1) % currentScale.length;
        break;

      case 'score':
        // Dramatic chord progression for scoring
        const scoreBase = currentScale[melodyState.scoreIndex % currentScale.length];
        frequency = scoreBase;
        duration = 0.8; // Much longer for impact
        // Rich chord with multiple harmonies
        harmony = [
          scoreBase * 0.5,  // Octave below
          scoreBase * 1.25, // Minor third
          scoreBase * 1.5,  // Fifth
          scoreBase * 2.0   // Octave above
        ];
        melodyState.scoreIndex = (melodyState.scoreIndex + 2) % currentScale.length; // Jump by 2 for variety
        break;

      case 'pickup':
        // Special sound for brick break
        if (pickupData?.type === 'brick_break') {
          // Satisfying "crunch" sound - descending pitch with harmonics
          frequency = 1200; // High initial pitch
          duration = 0.15;
          harmony = [
            800,  // Lower harmonic
            600,  // Even lower
            400   // Bass thump
          ];
        } else {
          frequency = currentScale[melodyState.pickupIndex % currentScale.length];
          duration = 0.3;
          // Ethereal harmony for pickups
          harmony = [
            frequency * 0.75, // Minor seventh
            frequency * 1.33, // Fourth
            frequency * 2.25  // Ninth
          ];
          melodyState.pickupIndex = (melodyState.pickupIndex + 3) % currentScale.length; // Jump by 3
        }
        break;

      case 'coin_spawn':
        // Short, simple "plopp" sound - no harmonies to avoid clashing
        frequency = 900 + Math.random() * 100; // Random pitch variation (900-1000Hz)
        duration = 0.05; // Very short
        harmony = []; // No harmonies - single clean tone
        break;

      default:
        frequency = 440;
        duration = 0.1;
    }

    // Apply time warp pitch factor to all frequencies
    const pitchFactor = currentGameStateRef.current?.timeWarpFactor || 1.0;
    frequency = frequency * pitchFactor;
    harmony = harmony.map(h => h * pitchFactor);

    if (pitchFactor !== 1.0) {
      console.log(`[SOUND] ${eventType}: freq=${frequency.toFixed(0)}Hz (pitched ${pitchFactor.toFixed(2)}x)`);
    }

    try {
      // Create master limiter if it doesn't exist
      if (!masterLimiterRef.current) {
        const limiter = new Tone.Limiter(-3).toDestination(); // -3dB threshold
        const compressor = new Tone.Compressor({
          threshold: -20,
          ratio: 4,
          attack: 0.003,
          release: 0.1
        });
        compressor.connect(limiter);
        masterLimiterRef.current = { compressor, limiter };
        // console.log('[SOUND] Master limiter initialized');
      }

      // Create multi-layered reverb for depth and space
      const reverb = new Tone.Reverb({
        decay: 3.5,      // Longer 3.5s tail for epic space
        preDelay: 0.02,  // Slight pre-delay for dimension
        wet: 1.0
      });

      // Add convolver for realistic room/hall simulation
      const convolver = new Tone.Convolver().connect(masterLimiterRef.current.compressor);

      // Ping-pong delay for stereo width
      const pingPongDelay = new Tone.PingPongDelay({
        delayTime: '8n',  // Musical timing (eighth note)
        feedback: 0.5,     // More feedback for rhythmic repeats
        wet: 1.0
      });

      // Additional tape-style delay for warmth
      const feedbackDelay = new Tone.FeedbackDelay({
        delayTime: 0.15,   // 150ms delay
        feedback: 0.45,    // Increased feedback
        wet: 1.0
      });

      // Freeverb for shimmer and air
      const freeverb = new Tone.Freeverb({
        roomSize: 0.8,     // Large room
        dampening: 2000,   // Warm damping
        wet: 1.0
      });

      // MUST wait for reverb to generate impulse response
      await reverb.generate();
      // console.log('[SOUND] Reverb generated, decay:', reverb.decay);

      // Add filter for warmth and movement
      const filter = new Tone.Filter({
        type: 'lowpass',
        frequency: 2000,
        rolloff: -12,
        Q: 2
      });

      // Add chorus for width and depth
      const chorus = new Tone.Chorus({
        frequency: 1.5,
        delayTime: 3.5,
        depth: 0.3,
        spread: 180
      }).start();

      // Create rich multi-oscillator synth for depth and texture
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
          type: 'fatsquare',  // Fatter square wave with detuned oscillators
          spread: 20,          // Detune amount for width
          count: 3             // 3 oscillators for thickness
        },
        envelope: {
          attack: 0.005,       // Slightly slower attack for warmth
          decay: duration * 0.4,
          sustain: 0.4,
          release: duration * 0.8
        }
      });

      synth.volume.value = -8; // Reduced from -2 to prevent distortion when multiple sounds play

      // Create gain nodes for multi-layered wet/dry mixing
      const dryGain = new Tone.Gain(0.3).connect(masterLimiterRef.current.compressor);           // 30% dry (reduced from 0.5)
      const reverbGain = new Tone.Gain(0.12).connect(masterLimiterRef.current.compressor);        // 12% reverb (reduced from 0.2)
      const freeverbGain = new Tone.Gain(0.1).connect(masterLimiterRef.current.compressor);     // 10% freeverb shimmer (reduced from 0.15)
      const pingPongGain = new Tone.Gain(0.12).connect(masterLimiterRef.current.compressor);      // 12% ping-pong (reduced from 0.2)
      const echoGain = new Tone.Gain(0.1).connect(masterLimiterRef.current.compressor);         // 10% tape delay (reduced from 0.15)

      // Connect effects based on effectType with rich multi-layered processing
      if (effectType === 'normal') {
        // Even "normal" gets filter and chorus for texture
        synth.chain(filter, chorus, dryGain);
        synth.chain(filter, freeverb, freeverbGain);  // Add shimmer
      } else if (effectType === 'echo') {
        // Dry + multiple delay types for rich rhythmic texture
        synth.chain(filter, chorus, dryGain);
        synth.chain(filter, pingPongDelay, pingPongGain);  // Stereo ping-pong
        synth.chain(filter, feedbackDelay, echoGain);      // Warm tape delay
      } else if (effectType === 'reverb') {
        // Dry + multiple reverb layers for epic space
        synth.chain(filter, chorus, dryGain);
        synth.chain(filter, reverb, reverbGain);          // Main reverb
        synth.chain(filter, freeverb, freeverbGain);      // Shimmer layer
      } else if (effectType === 'both') {
        // Full multi-layered epic soundscape
        synth.chain(filter, chorus, dryGain);              // 50% dry with texture
        synth.chain(filter, reverb, reverbGain);           // 20% main reverb
        synth.chain(filter, freeverb, freeverbGain);       // 15% shimmer
        synth.chain(filter, pingPongDelay, pingPongGain);  // 20% stereo delay
        synth.chain(filter, feedbackDelay, echoGain);      // 15% tape delay
      }

      // Play the main note
      synth.triggerAttackRelease(frequency, duration);

      // Play harmony notes with slight delay for richness (like the old system)
      harmony.forEach((harmonyFreq, index) => {
        setTimeout(async () => {
          try {
            // Create separate reverb/delay for each harmony note with same epic settings
            const harmonyReverb = new Tone.Reverb({
              decay: 2.0,
              preDelay: 0.01,
              wet: 1.0
            });
            const harmonyDelay = new Tone.FeedbackDelay({
              delayTime: 0.15,
              feedback: 0.4,
              wet: 1.0
            });
            await harmonyReverb.generate();

            // Create harmony synth
            const harmonySynth = new Tone.Synth({
              oscillator: { type: 'square' },
              envelope: {
                attack: 0.001,
                decay: duration * 0.3,
                sustain: 0.3,
                release: duration * 0.7
              }
            });

            harmonySynth.volume.value = -12; // Lower volume for harmony

            // Create gain nodes for harmony
            const harmonyDryGain = new Tone.Gain(0.4).connect(masterLimiterRef.current.compressor);
            const harmonyReverbGain = new Tone.Gain(0.2).connect(masterLimiterRef.current.compressor);
            const harmonyEchoGain = new Tone.Gain(0.15).connect(masterLimiterRef.current.compressor);

            // Connect with same effect routing
            if (effectType === 'normal') {
              harmonySynth.connect(masterLimiterRef.current.compressor);
            } else if (effectType === 'echo') {
              harmonySynth.connect(harmonyDryGain);
              harmonySynth.chain(harmonyDelay, harmonyEchoGain);
            } else if (effectType === 'reverb') {
              harmonySynth.connect(harmonyDryGain);
              harmonySynth.chain(harmonyReverb, harmonyReverbGain);
            } else if (effectType === 'both') {
              harmonySynth.connect(harmonyDryGain);
              harmonySynth.chain(harmonyDelay, harmonyEchoGain);
              harmonySynth.chain(harmonyReverb, harmonyReverbGain);
            }

            // Play harmony note
            harmonySynth.triggerAttackRelease(harmonyFreq, duration * 0.8);

            // Clean up harmony synth and gain nodes
            setTimeout(() => {
              harmonySynth.dispose();
              harmonyReverb.dispose();
              harmonyDelay.dispose();
              harmonyDryGain.dispose();
              harmonyReverbGain.dispose();
              harmonyEchoGain.dispose();
            }, (duration + 2.5) * 1000); // Extended cleanup for 2s reverb tail
          } catch (err) {
            console.error('[SOUND] Error playing harmony note:', err);
          }
        }, index * 20); // 20ms delay between harmony notes for richness
      });

      // Clean up main synth and all effects after playing
      setTimeout(() => {
        synth.dispose();
        reverb.dispose();
        convolver.dispose();
        pingPongDelay.dispose();
        feedbackDelay.dispose();
        freeverb.dispose();
        filter.dispose();
        chorus.dispose();
        dryGain.dispose();
        reverbGain.dispose();
        freeverbGain.dispose();
        pingPongGain.dispose();
        echoGain.dispose();
      }, (duration + 4.0) * 1000); // Extended cleanup for 3.5s reverb tail

      // console.log('[SOUND] Tone.js dystopian melody with harmonies played successfully');
    } catch (error) {
      console.error('[SOUND] Error playing Tone.js melody:', error);
    }

  }, [lanMode, isSpectatorMode]);

  // CA-CHING coin collection sound (routed through global mixer)
  const playCoinSound = useCallback(() => {
    // Get next available mixer channel (round-robin distribution)
    const channel = getNextAudioChannel();
    if (!channel) return;

    try {
      // Convert Tone.js gain node to native Web Audio gain for mixer routing
      const mixerGain = new Tone.Gain(1.0);

      // Connect Tone.js → Native Web Audio mixer channel
      if ((window as any).pongAudioContext) {
        const nativeGain = (window as any).pongAudioContext.createGain();
        nativeGain.gain.value = 1.0;
        nativeGain.connect(channel);

        // Bridge Tone.js to native audio
        mixerGain.connect(new Tone.Gain().toDestination().context.rawContext.createMediaStreamDestination());
        const toneDestination = mixerGain.context.rawContext.createGain();
        toneDestination.connect(nativeGain);
        mixerGain.connect(toneDestination as any);
      }

      // Create metallic "ca-ching" sound
      const synth = new Tone.MetalSynth({
        frequency: 800,
        envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.2 },
        harmonicity: 3,
        modulationIndex: 20,
        resonance: 3000,
        octaves: 1.5
      });

      const reverb = new Tone.Reverb({ decay: 0.5, wet: 0.3 }).connect(mixerGain);
      synth.connect(reverb);
      synth.volume.value = -10;

      // Ca-ching notes
      synth.triggerAttackRelease('E5', '0.08', Tone.now());
      synth.triggerAttackRelease('A5', '0.12', Tone.now() + 0.05);

      // Sparkle
      const sparkle = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.3 }
      }).connect(reverb);
      sparkle.volume.value = -15;
      sparkle.triggerAttackRelease('C6', '0.15', Tone.now() + 0.08);

      // Cleanup
      setTimeout(() => {
        synth.dispose();
        sparkle.dispose();
        reverb.dispose();
        mixerGain.dispose();
      }, 1000);
    } catch (error) {
      console.error('[SOUND] Error playing coin sound:', error);
    }
  }, [getNextAudioChannel]);

  // Play space laser sound for machine gun balls (routes through global mixer)
  const playLaserSound = useCallback(() => {
    // Get next available mixer channel (round-robin distribution)
    const channel = getNextAudioChannel();
    if (!channel) return;

    try {
      // Convert Tone.js gain node to native Web Audio gain for mixer routing
      const mixerGain = new Tone.Gain(1.0);

      // Connect Tone.js → Native Web Audio mixer channel
      if ((window as any).pongAudioContext) {
        const nativeGain = (window as any).pongAudioContext.createGain();
        nativeGain.gain.value = 1.0;
        nativeGain.connect(channel);

        // Bridge Tone.js to native audio
        const toneDestination = mixerGain.context.rawContext.createGain();
        toneDestination.connect(nativeGain);
        mixerGain.connect(toneDestination as any);
      }

      // Create space laser "pew pew" sound
      const synth = new Tone.Synth({
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.12 }
      });

      // Frequency sweep for laser effect (high to low)
      const filter = new Tone.Filter({
        type: 'lowpass',
        frequency: 3000,
        Q: 5
      }).connect(mixerGain);

      synth.connect(filter);
      synth.volume.value = -24; // Very quiet to prevent distortion when multiple lasers fire

      // Fast pitch sweep: 800Hz → 200Hz for laser "pew" effect
      synth.triggerAttackRelease('800', '0.12', Tone.now());
      synth.frequency.exponentialRampTo('200', 0.1, Tone.now());

      // Filter sweep for extra laser character
      filter.frequency.exponentialRampTo(500, 0.12, Tone.now());

      // Cleanup
      setTimeout(() => {
        synth.dispose();
        filter.dispose();
        mixerGain.dispose();
      }, 500);
    } catch (error) {
      console.error('[SOUND] Error playing laser sound:', error);
    }
  }, [getNextAudioChannel]);

  // Process speech queue to prevent overlapping speech

  // Force speech function for countdown numbers that bypasses speaking check with effects
  const forceSpeak = useCallback((text: string) => {
    // Validate text input
    if (!text || typeof text !== 'string' || text.trim() === '') {
      console.error('[ROBOT] SAM force speech error: Invalid text input:', text);
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
          speechMasterGainRef.current.gain.setValueAtTime(0.08, audioContextRef.current!.currentTime); // Lower robot voice volume to prevent distortion
          // Connect to analyzer for visualizer, then to destination
          if (analyserNodeRef.current) {
            speechMasterGainRef.current.connect(analyserNodeRef.current);
          } else {
            speechMasterGainRef.current.connect(audioContextRef.current!.destination);
          }
        } else {
          // Reset volume level to prevent distortion buildup
          speechMasterGainRef.current.gain.setValueAtTime(0.08, audioContextRef.current!.currentTime);
        }

        // Connect to speech master gain instead of direct destination
        outputGain.connect(speechMasterGainRef.current);

        // Play the processed audio (force speech)
        source.start();
      } catch (error) {
        console.error('[ROBOT] SAM force Web Audio error:', error);
        // Fallback to basic SAM without effects if Web Audio fails
        sam.speak(cleanText);
      }

    } catch (error) {
      console.error('[ROBOT] SAM force speech error:', error);
    }
  }, [initializeAudio]);

  // Welcome message and ambient sound on start screen
  useEffect(() => {
    if (gameState.showStartScreen) {
      // Ambient music now handled by GlobalAmbientMusic component
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
  }, [gameState.showStartScreen, speakRobotic]);

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
        // Cleanup hypnotic sound on unmount
        if (hypnoSoundRef.current) {
          try {
            hypnoSoundRef.current.osc1.stop();
            hypnoSoundRef.current.osc2.stop();
            hypnoSoundRef.current.osc1.dispose();
            hypnoSoundRef.current.osc2.dispose();
            hypnoSoundRef.current.lfo1.stop();
            hypnoSoundRef.current.lfo2.stop();
            hypnoSoundRef.current.lfo1.dispose();
            hypnoSoundRef.current.lfo2.dispose();
            hypnoSoundRef.current.reverb.dispose();
            hypnoSoundRef.current.gain.dispose();
            hypnoSoundRef.current = null;
          } catch (e) {
            console.error('[HYPNO] Error cleaning up hypnotic sound:', e);
          }
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
  const [touchX, setTouchX] = useState<number | null>(null);
  const [controlSide, setControlSide] = useState<'left' | 'right' | 'top' | 'bottom' | null>(null);
  const [cursorHidden, setCursorHidden] = useState(true);
  const [accumulatedMouseY, setAccumulatedMouseY] = useState<number>(400);
  const [accumulatedMouseX, setAccumulatedMouseX] = useState<number>(400);

  const [infoTextFadeStart, setInfoTextFadeStart] = useState<number | null>(null);

  // Track previous countdown values for robot voice announcements
  const [previousCountdowns, setPreviousCountdowns] = useState<{[effectType: string]: number}>({});
  // Track when pickup announcements were made to delay countdown
  const [pickupAnnouncementTimes, setPickupAnnouncementTimes] = useState<{[effectType: string]: number}>({});
  // Track which countdown numbers have been announced to ensure none are missed
  const [announcedCountdowns, setAnnouncedCountdowns] = useState<{[effectType: string]: Set<number>}>({});
  // Synchronous ref to prevent duplicate announcements during state updates
  const announcedCountdownsRef = useRef<{[effectType: string]: Set<number>}>({});

  const leftFrameCountRef = useRef<number>(0);
  const rightFrameCountRef = useRef<number>(0);
  const topFrameCountRef = useRef<number>(0);
  const bottomFrameCountRef = useRef<number>(0);

  // Pickup system functions
  const createPickup = useCallback(() => {
    const pickupType = PICKUP_TYPES[Math.floor(Math.random() * PICKUP_TYPES.length)];
    // Stay well away from paddle zones and edges
    const gameAreaSize = Math.min(canvasSize.width, canvasSize.height);
    const horizontalPadding = 150; // Keep away from left/right paddles
    const verticalPadding = 120;   // Keep away from top/bottom paddles
    return {
      x: horizontalPadding + Math.random() * (gameAreaSize - horizontalPadding * 2),
      y: verticalPadding + Math.random() * (gameAreaSize - verticalPadding * 2),
      size: 144, // Much bigger to accommodate 12x12 pixel size (12x12 grid)
      type: pickupType.type,
      pattern: pickupType.pattern,
      color: pickupType.color,
      description: pickupType.description,
      spawnTime: Date.now(),
    };
  }, [canvasSize]);

  // Keep function refs updated for performance optimization
  useEffect(() => {
    playMelodyNoteRef.current = playMelodyNote;
    updateGameStateRef.current = updateGameState;
    updatePaddlePositionRef.current = updatePaddlePosition;
    createPickupRef.current = createPickup;
    initializeAudioRef.current = initializeAudio;
    speakRoboticRef.current = speakRobotic;
    predictGameStateRef.current = predictGameState;
    interpolateGameStateRef.current = interpolateGameState;
    attemptRobotTauntRef.current = attemptRobotTaunt;
    checkRandomTauntRef.current = checkRandomTaunt;
    multiplayerStateRef.current = multiplayerState;
  }, [playMelodyNote, updateGameState, updatePaddlePosition, createPickup, initializeAudio, speakRobotic, predictGameState, interpolateGameState, attemptRobotTaunt, checkRandomTaunt, multiplayerState]);


  // Helper function for last-touch scoring
  const handleLastTouchScoring = useCallback((newState: GameState, boundaryHit: 'left' | 'right' | 'top' | 'bottom') => {

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
    console.log(`[TROPHY] SCORING: ${scoringPlayer} scores! New scores:`, {
      before: JSON.stringify(newState.score),
      scoringPlayer,
      serverAuth: true, // WebSocket server is authoritative
      gameMode: newState.gameMode
    });
    newState.score[scoringPlayer]++;
    console.log(`[TROPHY] SCORE UPDATED: ${scoringPlayer} -> ${newState.score[scoringPlayer]}`, newState.score);

    // End reverse controls effect when a score occurs
    const reverseControlsIndex = newState.activeEffects.findIndex(e => e.type === 'reverse_controls');
    if (reverseControlsIndex !== -1) {
      console.log(`[REFRESH] REVERSE CONTROLS ended due to score by ${scoringPlayer}`);
      newState.activeEffects.splice(reverseControlsIndex, 1);
    }

    // Reset gravity challenge tracking if ball was lost during gravity
    if (newState.ball.hasGravity && newState.gravityStartTime > 0) {
      newState.gravityStartTime = 0; // Forfeit gravity bonus - ball was lost
    }

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
      if (newState.gameMode !== 'multiplayer') {
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

      // Only play beep sound in single player to avoid duplicate sounds (server handles multiplayer audio)
      if (newState.gameMode !== 'multiplayer') {
        playMelodyNoteRef.current?.('score', null, 'reverb'); // Score with dramatic dystopic chord
      }
    }

    // Reset ball to center (relative to game area, not canvas)
    const gameAreaSize = Math.min(canvasSize.width, canvasSize.height);
    newState.ball.x = gameAreaSize / 2;
    newState.ball.y = gameAreaSize / 2;
    newState.ball.lastTouchedBy = null; // Reset tracking
    newState.ball.previousTouchedBy = null;

    // Start 2-second pause
    newState.isPaused = true;
    newState.pauseEndTime = Date.now() + 2000; // 2 seconds

    // Set ball direction for after pause - don't set to 0 during pause as this works
    newState.ball.dx = boundaryHit === 'left' || boundaryHit === 'right'
        ? (boundaryHit === 'left' ? BALL_SPEED : -BALL_SPEED)
        : (Math.random() > 0.5 ? BALL_SPEED : -BALL_SPEED);
    newState.ball.dy = boundaryHit === 'top' || boundaryHit === 'bottom'
        ? (boundaryHit === 'top' ? -BALL_SPEED : BALL_SPEED)
        : (Math.random() > 0.5 ? BALL_SPEED : -BALL_SPEED);
  }, [canvasSize.width, canvasSize.height, speakRobotic]);

  // Game logic
  const updateGame = useCallback(() => {
    setGameState(prevState => {
      let newState = { ...prevState };
      const now = Date.now();

      // [TIME] Frame-rate independent physics multiplier
      const deltaTimeMultiplier = deltaTimeRef.current / targetFrameTime;

      // Server-side physics mode will be added in future update

      // Use network state directly without interpolation/prediction to prevent flicker
      if (prevState.gameMode === 'multiplayer' &&
          networkGameStateRef.current &&
          lastNetworkReceiveTimeRef.current > 0) {

        // MULTIPLAYER SERVER-AUTHORITATIVE MODE
        // Server handles all physics, AI, and collision detection
        // Client only renders and handles local player input

        // Use network state directly - no interpolation or prediction to prevent jitter
        const playerSide = multiplayerStateRef.current?.playerSide;

        // Use server state for everything
        newState = { ...networkGameStateRef.current };

        // Override paddles: keep local player paddle from previous frame to avoid network jitter
        // Server paddles for AI, local paddle for smooth player control
        // IMPORTANT: Use server's x position for player paddle to ensure it's at correct scaled position after resize
        newState.paddles = {
          left: playerSide === 'left'
            ? { ...networkGameStateRef.current.paddles.left, y: prevState.paddles.left.y, velocity: prevState.paddles.left.velocity } // Use server scale but keep local Y position
            : networkGameStateRef.current.paddles.left, // Use server paddle entirely
          right: playerSide === 'right'
            ? { ...networkGameStateRef.current.paddles.right, y: prevState.paddles.right.y, velocity: prevState.paddles.right.velocity } // Use server scale but keep local Y position
            : networkGameStateRef.current.paddles.right, // Use server paddle entirely
          top: playerSide === 'top'
            ? { ...networkGameStateRef.current.paddles.top, x: prevState.paddles.top.x, velocity: prevState.paddles.top.velocity } // Use server scale but keep local X position
            : networkGameStateRef.current.paddles.top, // Use server paddle entirely
          bottom: playerSide === 'bottom'
            ? { ...networkGameStateRef.current.paddles.bottom, x: prevState.paddles.bottom.x, velocity: prevState.paddles.bottom.velocity } // Use server scale but keep local X position
            : networkGameStateRef.current.paddles.bottom // Use server paddle entirely
        };

        // Preserve client-side trails (trails are visual-only and managed locally)
        // Always carry over previous trail points from prevState
        newState.trails = {
          ball: prevState.trails?.ball || [],
          leftPaddle: prevState.trails?.leftPaddle || [],
          rightPaddle: prevState.trails?.rightPaddle || [],
          topPaddle: prevState.trails?.topPaddle || [],
          bottomPaddle: prevState.trails?.bottomPaddle || []
        };

        // Ensure machine gun balls and extra balls are properly copied (prevent race conditions)
        if (networkGameStateRef.current.machineGunBalls && Array.isArray(networkGameStateRef.current.machineGunBalls)) {
          newState.machineGunBalls = [...networkGameStateRef.current.machineGunBalls];
        } else {
          newState.machineGunBalls = [];
        }

        if (networkGameStateRef.current.extraBalls && Array.isArray(networkGameStateRef.current.extraBalls)) {
          newState.extraBalls = [...networkGameStateRef.current.extraBalls];
        } else {
          newState.extraBalls = [];
        }

        // 📐 Sync playfield scale from network
        if (networkGameStateRef.current.playfieldScale !== undefined) {
          newState.playfieldScale = networkGameStateRef.current.playfieldScale;
        }

        // Handle super striker aiming (auto-fires after 3 seconds, no manual control)
        const strikerEffect = newState.activeEffects.find(e => e.type === 'super_striker');
        if (strikerEffect && newState.ball.isAiming && strikerEffect.activator === playerSide) {
          // Skip normal paddle controls while ball is frozen for super striker
          return newState;
        }

        // Handle local player input and send to server
        // playerSide already declared above for paddle preservation

        if (playerSide === 'left' || localTestMode) {
          const freezeEffect = newState.activeEffects.find(e => e.type === 'freeze_opponent');
          const isLeftFrozen = freezeEffect && freezeEffect.excludePaddle !== 'left';

          if (!isLeftFrozen) {
            const oldY = newState.paddles.left.y;
            let newY = oldY;

            // Handle mouse control for left paddle
            if (mouseY !== null) {
              const targetY = mouseY - newState.paddles.left.height / 2;
              // Clamp to keep paddle within playfield bounds (inside border)
              newY = Math.max(BORDER_THICKNESS, Math.min(playFieldHeight - BORDER_THICKNESS - newState.paddles.left.height, targetY));
            }

            // Check if reverse controls is active
            const reverseControlsEffect = newState.activeEffects.find(e => e.type === 'reverse_controls');
            const shouldReverseLeftControls = reverseControlsEffect && reverseControlsEffect.activator !== 'left';

            let wPressed = keys.w;
            let sPressed = keys.s;

            if (shouldReverseLeftControls) {
              wPressed = keys.s;
              sPressed = keys.w;
            }

            if (wPressed) {
              newState.paddles.left.velocity -= 1.2;
              newState.paddles.left.velocity = Math.max(-newState.paddles.left.speed * 1.5, newState.paddles.left.velocity);
              newY += newState.paddles.left.velocity;
            } else if (sPressed) {
              newState.paddles.left.velocity += 1.2;
              newState.paddles.left.velocity = Math.min(newState.paddles.left.speed * 1.5, newState.paddles.left.velocity);
              newY += newState.paddles.left.velocity;
            } else if (mouseY === null) {
              newState.paddles.left.velocity *= 0.8;
              if (Math.abs(newState.paddles.left.velocity) < 0.1) {
                newState.paddles.left.velocity = 0;
              }
              newY += newState.paddles.left.velocity;
            }

            newY = Math.max(0, Math.min(canvasSize.height - newState.paddles.left.height, newY));
            newState.paddles.left.y = newY;

            if (newY !== oldY && !localTestMode) { // Send every pixel change
              updatePaddlePosition(newY, newState.paddles.left.velocity, newY);
            }
          }
        }

        if (playerSide === 'right' || localTestMode) {
          const freezeEffect = newState.activeEffects.find(e => e.type === 'freeze_opponent');
          const isRightFrozen = freezeEffect && freezeEffect.excludePaddle !== 'right';

          if (!isRightFrozen) {
            const oldY = newState.paddles.right.y;
            let newY = oldY;

            // Handle mouse control for right paddle
            if (mouseY !== null) {
              const targetY = mouseY - newState.paddles.right.height / 2;
              // Clamp to keep paddle within playfield bounds (inside border)
              newY = Math.max(BORDER_THICKNESS, Math.min(playFieldHeight - BORDER_THICKNESS - newState.paddles.right.height, targetY));
            }

            const reverseControlsEffect = newState.activeEffects.find(e => e.type === 'reverse_controls');
            const shouldReverseRightControls = reverseControlsEffect && reverseControlsEffect.activator !== 'right';

            let upPressed = keys.ArrowUp;
            let downPressed = keys.ArrowDown;

            if (shouldReverseRightControls) {
              upPressed = keys.ArrowDown;
              downPressed = keys.ArrowUp;
            }

            if (upPressed) {
              newState.paddles.right.velocity -= 1.2;
              newState.paddles.right.velocity = Math.max(-newState.paddles.right.speed * 1.5, newState.paddles.right.velocity);
              newY += newState.paddles.right.velocity;
            } else if (downPressed) {
              newState.paddles.right.velocity += 1.2;
              newState.paddles.right.velocity = Math.min(newState.paddles.right.speed * 1.5, newState.paddles.right.velocity);
              newY += newState.paddles.right.velocity;
            } else if (mouseY === null) {
              newState.paddles.right.velocity *= 0.8;
              if (Math.abs(newState.paddles.right.velocity) < 0.1) {
                newState.paddles.right.velocity = 0;
              }
              newY += newState.paddles.right.velocity;
            }

            newY = Math.max(0, Math.min(canvasSize.height - newState.paddles.right.height, newY));
            newState.paddles.right.y = newY;

            if (newY !== oldY && !localTestMode) { // Send every pixel change
              updatePaddlePositionRef.current?.(newY, newState.paddles.right.velocity, newY);
            }
          }
        }

        // Add client-side trail tracking in multiplayer (add every frame like ball trail)
        const now = Date.now();

        // Track left paddle trails - add every frame
        newState.trails.leftPaddle.push({
          x: newState.paddles.left.x + newState.paddles.left.width / 2,
          y: newState.paddles.left.y + newState.paddles.left.height / 2,
          timestamp: now,
          width: newState.paddles.left.width,
          height: newState.paddles.left.height
        });

        // Track right paddle trails - add every frame
        newState.trails.rightPaddle.push({
          x: newState.paddles.right.x + newState.paddles.right.width / 2,
          y: newState.paddles.right.y + newState.paddles.right.height / 2,
          timestamp: now,
          width: newState.paddles.right.width,
          height: newState.paddles.right.height
        });

        // Track top paddle trails - add every frame
        if (newState.paddles.top) {
          newState.trails.topPaddle.push({
            x: newState.paddles.top.x + newState.paddles.top.width / 2,
            y: newState.paddles.top.y + newState.paddles.top.height / 2,
            timestamp: now,
            width: newState.paddles.top.width,
            height: newState.paddles.top.height
          });
        }

        // Track bottom paddle trails - add every frame
        if (newState.paddles.bottom) {
          newState.trails.bottomPaddle.push({
            x: newState.paddles.bottom.x + newState.paddles.bottom.width / 2,
            y: newState.paddles.bottom.y + newState.paddles.bottom.height / 2,
            timestamp: now,
            width: newState.paddles.bottom.width,
            height: newState.paddles.bottom.height
          });
        }

        // Track ball trail - add every frame (matches single-player)
        newState.trails.ball.push({
          x: newState.ball.x + newState.ball.size / 2,
          y: newState.ball.y + newState.ball.size / 2,
          timestamp: now
        });

        // Clean up old trail points (750ms for ball, 200ms for paddles)
        newState.trails.ball = newState.trails.ball.filter(p => now - p.timestamp < 750);
        newState.trails.leftPaddle = newState.trails.leftPaddle.filter(p => now - p.timestamp < 200);
        newState.trails.rightPaddle = newState.trails.rightPaddle.filter(p => now - p.timestamp < 200);
        newState.trails.topPaddle = newState.trails.topPaddle.filter(p => now - p.timestamp < 200);
        newState.trails.bottomPaddle = newState.trails.bottomPaddle.filter(p => now - p.timestamp < 200);

        // Return immediately - skip all client-side AI physics and collision detection
        // Server is authoritative for everything except local player input
        return newState;
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

      // Physics forces removed - now only available as pickups, not random events

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
          }
        } else {
          // Still paused - allow paddle movement but skip ball logic
          // Don't return early, just skip ball/collision logic later
        }
      }

      // SIMPLIFIED: Always allow paddle control regardless of mode
      // Auto-switch to player vs AI mode when any input is detected (if not in multiplayer)
      const hasInput = keys.w || keys.s || keys.up || keys.down || keys.a || keys.d || keys.left || keys.right || mouseY !== null || touchY !== null || mouseX !== null || touchX !== null;

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
          // Clamp to keep paddle within playfield bounds (inside border)
          let clampedY = Math.max(BORDER_THICKNESS, Math.min(playFieldHeight - BORDER_THICKNESS - newState.paddles.right.height, targetY));

          // Check collision with top paddle (right paddle can't move into top-right corner)
          const topPaddle = newState.paddles.top;
          const topPaddleBottom = topPaddle.y + topPaddle.height;
          const topPaddleRight = topPaddle.x + topPaddle.width;

          // Check if right paddle overlaps with top paddle horizontally
          const rightPaddleLeft = newState.paddles.right.x;
          const rightPaddleRight = newState.paddles.right.x + newState.paddles.right.width;

          if (rightPaddleLeft < topPaddleRight && rightPaddleRight > topPaddle.x) {
            // Paddles overlap horizontally, check vertical collision
            if (clampedY < topPaddleBottom) {
              console.log(`🚧 RIGHT PADDLE BLOCKED BY TOP: clampedY=${clampedY} -> ${topPaddleBottom}`);
              clampedY = topPaddleBottom; // Stop at bottom edge of top paddle
            }
          }

          // Check collision with bottom paddle (right paddle can't move into bottom-right corner)
          const bottomPaddle = newState.paddles.bottom;
          if (newState.paddles.right.x < bottomPaddle.x + bottomPaddle.width &&
              newState.paddles.right.x + newState.paddles.right.width > bottomPaddle.x) {
            // Paddles overlap horizontally, check vertical collision
            const maxY = bottomPaddle.y - newState.paddles.right.height;
            if (clampedY + newState.paddles.right.height > bottomPaddle.y) {
              clampedY = maxY; // Stop at top edge of bottom paddle
            }
          }

          // Calculate velocity based on movement delta for trail effects
          const deltaY = clampedY - newState.paddles.right.y;
          newState.paddles.right.velocity = deltaY;

          newState.paddles.right.y = clampedY;

          // Add trail for mouse/touch controlled right paddle movement (reduced on mobile)
          if (Math.abs(newState.paddles.right.velocity) > 0.01 && (!isMobile || Math.random() < 0.5)) {
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
              x: newState.paddles.right.x + newState.paddles.right.width / 2,
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
              x: newState.paddles.right.x + newState.paddles.right.width / 2,
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
              x: newState.paddles.right.x + newState.paddles.right.width / 2,
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

        // Clamp right paddle position (accounting for border)
        newState.paddles.right.y = Math.max(BORDER_THICKNESS, Math.min(playFieldHeight - BORDER_THICKNESS - newState.paddles.right.height, newState.paddles.right.y));

        // In player mode, make the left paddle AI-controlled (always, since player controls right)
        if (newState.gameMode === 'player') {
          const now = Date.now();
          leftFrameCountRef.current++;
          const ballCenterY = newState.ball.y + newState.ball.size / 2;

          // Use the same spinner AI as auto mode for consistency
          const updatePaddleWithSpinner = (paddle: any, isLeft: boolean, frameCount: number) => {
            // Same reaction delay for both paddles
            const reactionDelay = HUMAN_REACTION_DELAY + 3;

            // Add reaction delay - only update target every few frames
            if (frameCount % reactionDelay === 0) {
              // Same inaccuracy level for both paddles
              const baseInaccuracy = 18;
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
              // Emergency panic - smooth but fast movement toward ball
              const extremePanicDirection = Math.sign(ballCenterY - currentPaddleCenter);
              const panicMultiplier = isEmergencyPanic ? 3.0 : 4.0; // Reduced from extreme values

              // Smooth acceleration instead of violent velocity changes
              paddle.velocity += extremePanicDirection * paddle.speed * panicMultiplier * 0.3;
              // Cap velocity to prevent jitter
              paddle.velocity = Math.max(-paddle.speed * 2, Math.min(paddle.speed * 2, paddle.velocity));
              // Continue with normal physics processing
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

            // Same friction rate for both paddles
            const friction = PADDLE_FRICTION * 0.95;
            paddle.velocity *= friction;

            // Same max speed for both paddles
            const maxSpeed = paddle.speed * 0.9;
            paddle.velocity = Math.max(-maxSpeed, Math.min(maxSpeed, paddle.velocity));

            // Update position
            paddle.y += paddle.velocity;

            // Keep paddle within bounds (accounting for border)
            const gameAreaSize = Math.min(canvasSize.width, canvasSize.height);
            paddle.y = Math.max(BORDER_THICKNESS, Math.min(gameAreaSize - BORDER_THICKNESS - paddle.height, paddle.y));
          };

          // Check if left paddle is frozen (all paddles except the one who last touched)
          const freezeEffect = newState.activeEffects.find(e => e.type === 'freeze_opponent');
          const isLeftFrozen = freezeEffect && freezeEffect.excludePaddle !== 'left';

          if (!isLeftFrozen) {
            updatePaddleWithSpinner(newState.paddles.left, true, leftFrameCountRef.current);
          } else {
            // Paddle is frozen - stop all movement
            newState.paddles.left.velocity = 0;
          }

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
              x: newState.paddles.left.x + newState.paddles.left.width / 2, // Paddle center X
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
        const updateHorizontalPaddleWithSpinner = (paddle: any, isTop: boolean, frameCount: number) => {
          // Different reaction delays for each paddle to make them feel like different humans
          const reactionDelay = isTop ? HUMAN_REACTION_DELAY : HUMAN_REACTION_DELAY + 3;

          // Add reaction delay - only update target every few frames
          if (frameCount % reactionDelay === 0) {
            // Different inaccuracy levels for each paddle
            const baseInaccuracy = isTop ? 12 : 18; // Top player slightly more accurate
            const inaccuracy = (Math.random() - 0.5) * baseInaccuracy;

            // Add prediction error - sometimes aim where ball was, not where it's going
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

          const distance = paddle.targetX - paddle.x;
          const direction = Math.sign(distance);

          // Check for panic moves - sudden fast movements when ball is close or moving fast
          const ballDistance = Math.abs(newState.ball.y - (isTop ? 0 : canvasSize.height));
          const ballSpeed = Math.abs(newState.ball.dy);
          const isPanicSituation = ballDistance < 300; // Much more lenient distance
          const currentPaddleCenter = paddle.x + paddle.width / 2;
          const ballPaddleDistance = Math.abs(ballCenterX - currentPaddleCenter);

          // Check if ball is heading towards this paddle
          const ballHeadingTowardsPaddle = isTop ? newState.ball.dy < 0 : newState.ball.dy > 0;

          // Emergency panic mode - NEVER MISS THE BALL
          const isEmergencyPanic = ballHeadingTowardsPaddle && ballDistance < 150 && ballPaddleDistance > 30;

          // Much more frequent panic moves - any time ball is coming and paddle isn't perfectly positioned
          const panicChance = isPanicSituation ? 0.15 : 0.08; // Higher panic chance when ball is close
          const isPanicMove = Math.random() < panicChance;
          const isExtremePanicMove = Math.random() < 0.05; // 5% chance for extreme panic

          if (isEmergencyPanic || isExtremePanicMove) {
            // Emergency panic - smooth but fast movement toward ball
            const extremePanicDirection = Math.sign(ballCenterX - currentPaddleCenter);
            const panicMultiplier = isEmergencyPanic ? 3.0 : 4.0; // Reduced from extreme values

            // Smooth acceleration instead of violent velocity changes
            paddle.velocity += extremePanicDirection * paddle.speed * panicMultiplier * 0.3;
            // Cap velocity to prevent jitter
            paddle.velocity = Math.max(-paddle.speed * 2, Math.min(paddle.speed * 2, paddle.velocity));
            // Continue with normal physics processing
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
          const friction = isTop ? PADDLE_FRICTION : PADDLE_FRICTION * 0.95;
          paddle.velocity *= friction;

          // Slightly different max speeds for each paddle
          const maxSpeed = isTop ? paddle.speed : paddle.speed * 0.9;
          paddle.velocity = Math.max(-maxSpeed, Math.min(maxSpeed, paddle.velocity));

          // Update position
          paddle.x += paddle.velocity;

          // Keep paddle within bounds (accounting for border)
          const gameAreaSize = Math.min(canvasSize.width, canvasSize.height);
          paddle.x = Math.max(BORDER_THICKNESS, Math.min(gameAreaSize - BORDER_THICKNESS - paddle.width, paddle.x));
        };

        if (newState.paddles.top) {
          updateHorizontalPaddleWithSpinner(newState.paddles.top, true, topFrameCountRef.current);

          // Add trail tracking for top paddle AI movement
          if (Math.abs(newState.paddles.top.velocity) > 0.01) {
            newState.trails.topPaddle.push({
              x: newState.paddles.top.x + newState.paddles.top.width / 2,
              y: newState.paddles.top.y + newState.paddles.top.height / 2,
              timestamp: now,
              width: newState.paddles.top.width,
              height: newState.paddles.top.height
            });
          }
        }
        if (newState.paddles.bottom) {
          updateHorizontalPaddleWithSpinner(newState.paddles.bottom, false, bottomFrameCountRef.current);

          // Add trail tracking for bottom paddle AI movement
          if (Math.abs(newState.paddles.bottom.velocity) > 0.01) {
            newState.trails.bottomPaddle.push({
              x: newState.paddles.bottom.x + newState.paddles.bottom.width / 2,
              y: newState.paddles.bottom.y + newState.paddles.bottom.height / 2, // 32px spacing from bottom wall
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
          // Check if left paddle is frozen
          const freezeEffect = newState.activeEffects.find(e => e.type === 'freeze_opponent');
          const isLeftFrozen = freezeEffect && freezeEffect.excludePaddle !== 'left';

          if (!isLeftFrozen) {
            const oldY = newState.paddles.left.y;

          // Check if reverse controls is active and this player is affected
          const reverseControlsEffect = newState.activeEffects.find(e => e.type === 'reverse_controls');
          const shouldReverseLeftControls = reverseControlsEffect && reverseControlsEffect.activator !== 'left';

          // Left paddle - W/S keys (W = UP, S = DOWN) - with acceleration
          // Prioritize keyboard input over mouse
          let wPressed = keys.w;
          let sPressed = keys.s;

          // Reverse controls if effect is active and this player is affected
          if (shouldReverseLeftControls) {
            wPressed = keys.s;
            sPressed = keys.w;
          }

          if (wPressed) {
            // W key moves UP (decrease Y) - with acceleration
            newState.paddles.left.velocity -= 1.2; // Reduced acceleration
            newState.paddles.left.velocity = Math.max(-newState.paddles.left.speed * 1.5, newState.paddles.left.velocity);
            newState.paddles.left.y += newState.paddles.left.velocity;
          } else if (sPressed) {
            // S key moves DOWN (increase Y) - with acceleration
            newState.paddles.left.velocity += 1.2; // Reduced acceleration
            newState.paddles.left.velocity = Math.min(newState.paddles.left.speed * 1.5, newState.paddles.left.velocity);
            newState.paddles.left.y += newState.paddles.left.velocity;
          } else if (controlSide === 'left' && mouseY !== null) {
            // Use mouse control only when keyboard is not active
            const targetY = mouseY - newState.paddles.left.height / 2;
            // Clamp to keep paddle within playfield bounds (inside border)
            const clampedY = Math.max(BORDER_THICKNESS, Math.min(playFieldHeight - BORDER_THICKNESS - newState.paddles.left.height, targetY));
            newState.paddles.left.velocity = clampedY - newState.paddles.left.y;
            newState.paddles.left.y = clampedY;
          } else {
            // No input - apply friction
            newState.paddles.left.velocity *= 0.8; // Friction
            if (Math.abs(newState.paddles.left.velocity) < 0.1) {
              newState.paddles.left.velocity = 0; // Stop when very slow
            }
            newState.paddles.left.y += newState.paddles.left.velocity;
          }

          // Clamp left paddle position (accounting for border)
          newState.paddles.left.y = Math.max(BORDER_THICKNESS, Math.min(playFieldHeight - BORDER_THICKNESS - newState.paddles.left.height, newState.paddles.left.y));

          // Check collision with top paddle
          const topPaddle = newState.paddles.top;
          if (newState.paddles.left.x < topPaddle.x + topPaddle.width &&
              newState.paddles.left.x + newState.paddles.left.width > topPaddle.x) {
            const topPaddleBottom = topPaddle.y + topPaddle.height;
            if (newState.paddles.left.y < topPaddleBottom) {
              newState.paddles.left.y = topPaddleBottom;
            }
          }

          // Check collision with bottom paddle
          const bottomPaddle = newState.paddles.bottom;
          if (newState.paddles.left.x < bottomPaddle.x + bottomPaddle.width &&
              newState.paddles.left.x + newState.paddles.left.width > bottomPaddle.x) {
            const maxY = bottomPaddle.y - newState.paddles.left.height;
            if (newState.paddles.left.y + newState.paddles.left.height > bottomPaddle.y) {
              newState.paddles.left.y = maxY;
            }
          }

          // Add left paddle trail point
          if (Math.abs(newState.paddles.left.velocity) > 0.01) {
            newState.trails.leftPaddle.push({
              x: newState.paddles.left.x + newState.paddles.left.width / 2, // Paddle center X
              y: newState.paddles.left.y + newState.paddles.left.height / 2,
              width: newState.paddles.left.width,
              height: newState.paddles.left.height,
              timestamp: now
            });
          }

            if (newState.paddles.left.y !== oldY && !localTestMode) { // Send every pixel change
              updatePaddlePosition(newState.paddles.left.y, newState.paddles.left.velocity, newState.paddles.left.y);
            }
          } else {
            // Paddle is frozen - stop all movement
            newState.paddles.left.velocity = 0;
          }
        }
        if (multiplayerStateRef.current?.playerSide === 'right' || localTestMode) {
          // Check if right paddle is frozen
          const freezeEffect = newState.activeEffects.find(e => e.type === 'freeze_opponent');
          const isRightFrozen = freezeEffect && freezeEffect.excludePaddle !== 'right';

          if (!isRightFrozen) {
            const oldY = newState.paddles.right.y;

          // Check if reverse controls is active and this player is affected
          const reverseControlsEffect = newState.activeEffects.find(e => e.type === 'reverse_controls');
          const shouldReverseControls = reverseControlsEffect && reverseControlsEffect.activator !== 'right';

          // Right paddle - Arrow keys (UP = UP, DOWN = DOWN) - with acceleration
          // Prioritize keyboard input over mouse
          let upPressed = keys.up;
          let downPressed = keys.down;

          // Reverse controls if effect is active and this player is affected
          if (shouldReverseControls) {
            upPressed = keys.down;
            downPressed = keys.up;
          }

          if (upPressed) {
            // UP arrow moves UP (decrease Y) - with acceleration
            newState.paddles.right.velocity -= 1.2; // Reduced acceleration
            newState.paddles.right.velocity = Math.max(-newState.paddles.right.speed * 1.5, newState.paddles.right.velocity);
            newState.paddles.right.y += newState.paddles.right.velocity;
          } else if (downPressed) {
            // DOWN arrow moves DOWN (increase Y) - with acceleration
            newState.paddles.right.velocity += 1.2; // Reduced acceleration
            newState.paddles.right.velocity = Math.min(newState.paddles.right.speed * 1.5, newState.paddles.right.velocity);
            newState.paddles.right.y += newState.paddles.right.velocity;
          } else if (controlSide === 'right' && mouseY !== null) {
            // Use mouse control only when keyboard is not active
            const targetY = mouseY - newState.paddles.right.height / 2;
            // Clamp to keep paddle within playfield bounds (inside border)
            const clampedY = Math.max(BORDER_THICKNESS, Math.min(playFieldHeight - BORDER_THICKNESS - newState.paddles.right.height, targetY));
            newState.paddles.right.velocity = clampedY - newState.paddles.right.y;
            newState.paddles.right.y = clampedY;
          } else {
            // No input - apply friction
            newState.paddles.right.velocity *= 0.8; // Friction
            if (Math.abs(newState.paddles.right.velocity) < 0.1) {
              newState.paddles.right.velocity = 0; // Stop when very slow
            }
            newState.paddles.right.y += newState.paddles.right.velocity;
          }

          // Clamp right paddle position (accounting for border)
          newState.paddles.right.y = Math.max(BORDER_THICKNESS, Math.min(playFieldHeight - BORDER_THICKNESS - newState.paddles.right.height, newState.paddles.right.y));

          // Check collision with top paddle
          const topPaddleRight = newState.paddles.top;
          if (newState.paddles.right.x < topPaddleRight.x + topPaddleRight.width &&
              newState.paddles.right.x + newState.paddles.right.width > topPaddleRight.x) {
            const topPaddleBottom = topPaddleRight.y + topPaddleRight.height;
            if (newState.paddles.right.y < topPaddleBottom) {
              newState.paddles.right.y = topPaddleBottom;
            }
          }

          // Check collision with bottom paddle
          const bottomPaddleRight = newState.paddles.bottom;
          if (newState.paddles.right.x < bottomPaddleRight.x + bottomPaddleRight.width &&
              newState.paddles.right.x + newState.paddles.right.width > bottomPaddleRight.x) {
            const maxY = bottomPaddleRight.y - newState.paddles.right.height;
            if (newState.paddles.right.y + newState.paddles.right.height > bottomPaddleRight.y) {
              newState.paddles.right.y = maxY;
            }
          }

          // Add right paddle trail point
          if (Math.abs(newState.paddles.right.velocity) > 0.01) {
            newState.trails.rightPaddle.push({
              x: newState.paddles.right.x + newState.paddles.right.width / 2, // Paddle center X
              y: newState.paddles.right.y + newState.paddles.right.height / 2,
              width: newState.paddles.right.width,
              height: newState.paddles.right.height,
              timestamp: now
            });
          }

          if (newState.paddles.right.y !== oldY && !localTestMode) { // Send every pixel change
            updatePaddlePositionRef.current?.(newState.paddles.right.y, newState.paddles.right.velocity, newState.paddles.right.y);
            }
          } else {
            // Paddle is frozen - stop all movement
            newState.paddles.right.velocity = 0;
          }
        }

        // Top paddle controls - A/D keys (A = LEFT, D = RIGHT)
        if ((multiplayerStateRef.current?.playerSide === 'top' || localTestMode) && newState.paddles.top) {
          const oldX = newState.paddles.top.x;

          // Check if reverse controls affects top paddle
          const reverseControlsEffect = newState.activeEffects.find(e => e.type === 'reverse_controls');
          const shouldReverseTopControls = reverseControlsEffect && reverseControlsEffect.activator !== 'top';

          // Top paddle - A/D keys (A = LEFT, D = RIGHT) - with acceleration
          // Prioritize keyboard input over mouse
          let aPressed = keys.a;
          let dPressed = keys.d;

          // Reverse controls if effect is active and this player is affected
          if (shouldReverseTopControls) {
            aPressed = keys.d;
            dPressed = keys.a;
          }

          if (aPressed) {
            // A key moves LEFT (decrease X) - with acceleration
            newState.paddles.top.velocity -= 1.2; // Reduced acceleration
            newState.paddles.top.velocity = Math.max(-newState.paddles.top.speed * 1.5, newState.paddles.top.velocity);
            newState.paddles.top.x += newState.paddles.top.velocity;
          } else if (dPressed) {
            // D key moves RIGHT (increase X) - with acceleration
            newState.paddles.top.velocity += 1.2; // Reduced acceleration
            newState.paddles.top.velocity = Math.min(newState.paddles.top.speed * 1.5, newState.paddles.top.velocity);
            newState.paddles.top.x += newState.paddles.top.velocity;
          } else if (controlSide === 'top' && (mouseX !== null || touchX !== null)) {
            // Use mouse/touch control only when keyboard is not active
            const targetX = (touchX !== null ? touchX : mouseX!) - newState.paddles.top.width / 2;
            // Clamp to keep paddle within playfield bounds
            const clampedX = Math.max(0, Math.min(playFieldWidth - newState.paddles.top.width, targetX));
            newState.paddles.top.velocity = clampedX - newState.paddles.top.x;
            newState.paddles.top.x = clampedX;
          } else {
            // No input - apply friction
            newState.paddles.top.velocity *= 0.8; // Friction
            if (Math.abs(newState.paddles.top.velocity) < 0.1) {
              newState.paddles.top.velocity = 0; // Stop when very slow
            }
            newState.paddles.top.x += newState.paddles.top.velocity;
          }

          // Clamp top paddle position (accounting for border)
          newState.paddles.top.x = Math.max(BORDER_THICKNESS, Math.min(playFieldWidth - BORDER_THICKNESS - newState.paddles.top.width, newState.paddles.top.x));

          // Add top paddle trail point
          const now = Date.now();
          if (Math.abs(newState.paddles.top.velocity) > 0.01) {
            newState.trails.topPaddle.push({
              x: newState.paddles.top.x + newState.paddles.top.width / 2,
              y: newState.paddles.top.y + newState.paddles.top.height / 2, // Paddle spacing from top wall
              width: newState.paddles.top.width,
              height: newState.paddles.top.height,
              timestamp: now
            });
          }

          if (Math.abs(newState.paddles.top.x - oldX) > 0.5 && !localTestMode) {
            updateHorizontalPaddlePosition(newState.paddles.top.x, newState.paddles.top.velocity, newState.paddles.top.x);
          }
        }

        // Bottom paddle controls - Left/Right arrow keys
        if ((multiplayerStateRef.current?.playerSide === 'bottom' || localTestMode) && newState.paddles.bottom) {
          const oldX = newState.paddles.bottom.x;

          // Check if reverse controls affects bottom paddle
          const reverseControlsEffect = newState.activeEffects.find(e => e.type === 'reverse_controls');
          const shouldReverseBottomControls = reverseControlsEffect && reverseControlsEffect.activator !== 'bottom';

          // Bottom paddle - Left/Right arrow keys - with acceleration
          // Prioritize keyboard input over mouse
          let leftPressed = keys.left;
          let rightPressed = keys.right;

          // Reverse controls if effect is active and this player is affected
          if (shouldReverseBottomControls) {
            leftPressed = keys.right;
            rightPressed = keys.left;
          }

          if (leftPressed) {
            // Left arrow moves LEFT (decrease X) - with acceleration
            newState.paddles.bottom.velocity -= 1.2; // Reduced acceleration
            newState.paddles.bottom.velocity = Math.max(-newState.paddles.bottom.speed * 1.5, newState.paddles.bottom.velocity);
            newState.paddles.bottom.x += newState.paddles.bottom.velocity;
          } else if (rightPressed) {
            // Right arrow moves RIGHT (increase X) - with acceleration
            newState.paddles.bottom.velocity += 1.2; // Reduced acceleration
            newState.paddles.bottom.velocity = Math.min(newState.paddles.bottom.speed * 1.5, newState.paddles.bottom.velocity);
            newState.paddles.bottom.x += newState.paddles.bottom.velocity;
          } else if (controlSide === 'bottom' && (mouseX !== null || touchX !== null)) {
            // Use mouse/touch control only when keyboard is not active
            const targetX = (touchX !== null ? touchX : mouseX!) - newState.paddles.bottom.width / 2;
            // Clamp to keep paddle within playfield bounds
            const clampedX = Math.max(0, Math.min(playFieldWidth - newState.paddles.bottom.width, targetX));
            newState.paddles.bottom.velocity = clampedX - newState.paddles.bottom.x;
            newState.paddles.bottom.x = clampedX;
          } else {
            // No input - apply friction
            newState.paddles.bottom.velocity *= 0.8; // Friction
            if (Math.abs(newState.paddles.bottom.velocity) < 0.1) {
              newState.paddles.bottom.velocity = 0; // Stop when very slow
            }
            newState.paddles.bottom.x += newState.paddles.bottom.velocity;
          }

          // Clamp bottom paddle position (accounting for border)
          newState.paddles.bottom.x = Math.max(BORDER_THICKNESS, Math.min(playFieldWidth - BORDER_THICKNESS - newState.paddles.bottom.width, newState.paddles.bottom.x));

          // Add bottom paddle trail point
          const now = Date.now();
          if (Math.abs(newState.paddles.bottom.velocity) > 0.01) {
            newState.trails.bottomPaddle.push({
              x: newState.paddles.bottom.x + newState.paddles.bottom.width / 2,
              y: newState.paddles.bottom.y + newState.paddles.bottom.height / 2, // 32px spacing from bottom wall
              width: newState.paddles.bottom.width,
              height: newState.paddles.bottom.height,
              timestamp: now
            });
          }

          if (Math.abs(newState.paddles.bottom.x - oldX) > 0.5 && !localTestMode) {
            updateHorizontalPaddlePosition(newState.paddles.bottom.x, newState.paddles.bottom.velocity, newState.paddles.bottom.x);
          }
        }

        // PADDLE-TO-PADDLE COLLISION DETECTION - Prevent paddles from overlapping
        // Check corner collisions between vertical and horizontal paddles
        // Paddles can now move to edges (0px) but still collide with each other

        // Left paddle vs Top paddle (left side, top corner)
        if (newState.paddles.left.y <= newState.paddles.top.height &&
            newState.paddles.left.x <= newState.paddles.top.x + newState.paddles.top.width) {
          // Push left paddle down to avoid overlap
          newState.paddles.left.y = Math.max(newState.paddles.left.y, newState.paddles.top.height);
        }

        // Left paddle vs Bottom paddle (left side, bottom corner)
        const gameAreaSize = Math.min(canvasSize.width, canvasSize.height);
        if (newState.paddles.left.y + newState.paddles.left.height >= gameAreaSize - newState.paddles.bottom.height &&
            newState.paddles.left.x <= newState.paddles.bottom.x + newState.paddles.bottom.width) {
          // Push left paddle up to avoid overlap
          newState.paddles.left.y = Math.min(newState.paddles.left.y, gameAreaSize - newState.paddles.bottom.height - newState.paddles.left.height);
        }

        // Right paddle vs Top paddle (right side, top corner)
        if (newState.paddles.right.y <= newState.paddles.top.height &&
            newState.paddles.right.x + newState.paddles.right.width >= newState.paddles.top.x) {
          // Push right paddle down to avoid overlap
          newState.paddles.right.y = Math.max(newState.paddles.right.y, newState.paddles.top.height);
        }

        // Right paddle vs Bottom paddle (right side, bottom corner)
        if (newState.paddles.right.y + newState.paddles.right.height >= gameAreaSize - newState.paddles.bottom.height &&
            newState.paddles.right.x + newState.paddles.right.width >= newState.paddles.bottom.x) {
          // Push right paddle up to avoid overlap
          newState.paddles.right.y = Math.min(newState.paddles.right.y, gameAreaSize - newState.paddles.bottom.height - newState.paddles.right.height);
        }

        // Top paddle vs Left paddle (already handled above)

        // Top paddle vs Right paddle (already handled above)

        // Bottom paddle vs Left paddle (already handled above)

        // Bottom paddle vs Right paddle (already handled above)

        // Re-clamp all paddles after collision resolution to ensure they stay in bounds (accounting for border)
        // gameAreaSize already declared above
        newState.paddles.left.y = Math.max(BORDER_THICKNESS, Math.min(gameAreaSize - BORDER_THICKNESS - newState.paddles.left.height, newState.paddles.left.y));
        newState.paddles.right.y = Math.max(BORDER_THICKNESS, Math.min(gameAreaSize - BORDER_THICKNESS - newState.paddles.right.height, newState.paddles.right.y));
        newState.paddles.top.x = Math.max(BORDER_THICKNESS, Math.min(gameAreaSize - BORDER_THICKNESS - newState.paddles.top.width, newState.paddles.top.x));
        newState.paddles.bottom.x = Math.max(BORDER_THICKNESS, Math.min(gameAreaSize - BORDER_THICKNESS - newState.paddles.bottom.width, newState.paddles.bottom.x));

        // AI CONTROL FOR NON-HUMAN PADDLES IN MULTIPLAYER
        const currentPlayerSide = multiplayerStateRef.current?.playerSide;

        // If player controls right paddle, make left paddle AI-controlled
        if (currentPlayerSide === 'right' && !localTestMode) {
          // Check if left paddle is frozen (all paddles except the one who last touched)
          const freezeEffect = newState.activeEffects.find(e => e.type === 'freeze_opponent');
          const isLeftFrozen = freezeEffect && freezeEffect.excludePaddle !== 'left';

          if (!isLeftFrozen) {
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

            // Keep within bounds (accounting for border)
            const gameAreaSize = Math.min(canvasSize.width, canvasSize.height);
            paddle.y = Math.max(BORDER_THICKNESS, Math.min(gameAreaSize - BORDER_THICKNESS - paddle.height, paddle.y));
          } else {
            // Paddle is frozen - stop all movement
            newState.paddles.left.velocity = 0;
          }

          // Add trail for AI left paddle
          if (Math.abs(newState.paddles.left.velocity) > 0.01) {
            newState.trails.leftPaddle.push({
              x: newState.paddles.left.x + newState.paddles.left.width / 2,
              y: newState.paddles.left.y + newState.paddles.left.height / 2,
              width: newState.paddles.left.width,
              height: newState.paddles.left.height,
              timestamp: now
            });
          }
        }

        // If player controls left paddle, make right paddle AI-controlled
        if (currentPlayerSide === 'left' && !localTestMode) {
          // Check if right paddle is frozen (all paddles except the one who last touched)
          const freezeEffect = newState.activeEffects.find(e => e.type === 'freeze_opponent');
          const isRightFrozen = freezeEffect && freezeEffect.excludePaddle !== 'right';

          if (!isRightFrozen) {
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

            // Keep within bounds (accounting for border)
            const gameAreaSize = Math.min(canvasSize.width, canvasSize.height);
            paddle.y = Math.max(BORDER_THICKNESS, Math.min(gameAreaSize - BORDER_THICKNESS - paddle.height, paddle.y));
          } else {
            // Paddle is frozen - stop all movement
            newState.paddles.right.velocity = 0;
          }

          // Add trail for AI right paddle
          if (Math.abs(newState.paddles.right.velocity) > 0.01) {
            newState.trails.rightPaddle.push({
              x: newState.paddles.right.x + newState.paddles.right.width / 2,
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

        // Human-like horizontal paddle AI with improved physics
        const updateHorizontalPaddleWithSpinner = (paddle: any, isTop: boolean, frameCount: number) => {
          // Different reaction delays for each paddle to make them feel like different humans
          const reactionDelay = isTop ? HUMAN_REACTION_DELAY : HUMAN_REACTION_DELAY + 3;

          // Add reaction delay - only update target every few frames
          if (frameCount % reactionDelay === 0) {
            // Calculate where ball will be when it reaches paddle's X position
            const paddleX = isTop ? paddle.x + paddle.width / 2 : paddle.x + paddle.width / 2;
            const ballToleranceX = isTop ? 100 : -100; // Give more prediction range
            const targetX = paddleX + ballToleranceX;

            // Calculate time for ball to reach paddle X position
            let predictedX = ballCenterX;

            if (Math.abs(newState.ball.dx) > 0.1) {
              const timeToReachPaddle = Math.abs((targetX - newState.ball.x) / newState.ball.dx);
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

            const targetPosition = Math.max(
              paddle.width / 2,
              Math.min(
                canvasSize.width - paddle.width / 2,
                predictedX - paddle.width / 2 + inaccuracy + predictionError
              )
            );
            paddle.targetX = targetPosition;
          }

          // Smart AI logic adapted for horizontal movement
          const distance = paddle.targetX - paddle.x;
          const direction = Math.sign(distance);
          const ballDistance = Math.abs(newState.ball.x - (isTop ? 0 : canvasSize.width)); // Distance from edge
          const isPanicSituation = ballDistance < 300;
          const currentPaddleCenter = paddle.x + paddle.width / 2;
          const ballPaddleDistance = Math.abs(ballCenterX - currentPaddleCenter);
          const ballHeadingTowardsPaddle = isTop ? newState.ball.dx < 0 : newState.ball.dx > 0; // Ball heading toward paddle
          const isEmergencyPanic = ballHeadingTowardsPaddle && ballDistance < 150 && ballPaddleDistance > 30;

          if (isEmergencyPanic) {
            // Smooth emergency movement without jitter
            const extremePanicDirection = Math.sign(ballCenterX - currentPaddleCenter);
            paddle.velocity += extremePanicDirection * paddle.speed * 2.5; // Smooth acceleration
          } else if (Math.abs(distance) > 25) {
            paddle.velocity += direction * PADDLE_ACCELERATION * 2.0; // Reduced from 3.0
          } else if (Math.abs(distance) > 8) {
            paddle.velocity += direction * PADDLE_ACCELERATION * 1.0; // Reduced from 1.2
          } else {
            paddle.velocity *= 0.7; // Improved from 0.5
          }

          paddle.velocity *= PADDLE_FRICTION * 0.95;
          const maxSpeed = paddle.speed * 0.9;
          paddle.velocity = Math.max(-maxSpeed, Math.min(maxSpeed, paddle.velocity));
          paddle.x += paddle.velocity;
          const gameAreaSize = Math.min(canvasSize.width, canvasSize.height);
          paddle.x = Math.max(BORDER_THICKNESS, Math.min(gameAreaSize - BORDER_THICKNESS - paddle.width, paddle.x));
        };

        // Apply AI to top paddle (only if no player is controlling it)
        if (newState.paddles.top && multiplayerState.playerSide !== 'top') {
          updateHorizontalPaddleWithSpinner(newState.paddles.top, true, topFrameCountRef.current);

          // Add trail tracking for top paddle AI movement
          if (Math.abs(newState.paddles.top.velocity) > 0.01) {
            newState.trails.topPaddle.push({
              x: newState.paddles.top.x + newState.paddles.top.width / 2,
              y: newState.paddles.top.y + newState.paddles.top.height / 2,
              timestamp: now,
              width: newState.paddles.top.width,
              height: newState.paddles.top.height
            });
          }
        }

        // Apply AI to bottom paddle (only if no player is controlling it)
        if (newState.paddles.bottom && multiplayerState.playerSide !== 'bottom') {
          updateHorizontalPaddleWithSpinner(newState.paddles.bottom, false, bottomFrameCountRef.current);

          // Add trail tracking for bottom paddle AI movement
          if (Math.abs(newState.paddles.bottom.velocity) > 0.01) {
            newState.trails.bottomPaddle.push({
              x: newState.paddles.bottom.x + newState.paddles.bottom.width / 2,
              y: newState.paddles.bottom.y + newState.paddles.bottom.height / 2, // 32px spacing from bottom wall
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

          // Update position with time warp factor
          const timeWarpFactor = newState.timeWarpFactor || 1.0;
          paddle.y += paddle.velocity * timeWarpFactor;

          // Keep paddle within bounds
          // Paddle Y unclamped - allow free movement
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

          // Apply speed limits and update position with time warp factor
          const maxSpeed = paddle.speed;
          paddle.velocity = Math.max(-maxSpeed, Math.min(maxSpeed, paddle.velocity));
          const timeWarpFactor = newState.timeWarpFactor || 1.0;
          paddle.x += paddle.velocity * timeWarpFactor;
          const gameAreaSize = Math.min(canvasSize.width, canvasSize.height);
          paddle.x = Math.max(BORDER_THICKNESS, Math.min(gameAreaSize - BORDER_THICKNESS - paddle.width, paddle.x));
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
            x: newState.paddles.left.x + newState.paddles.left.width / 2, // Left paddle center x position
            y: newState.paddles.left.y + newState.paddles.left.height / 2,
            timestamp: now,
            width: newState.paddles.left.width,
            height: newState.paddles.left.height
          });
        }
        if (Math.abs(newState.paddles.right.velocity) > 0.01) {
          newState.trails.rightPaddle.push({
            x: newState.paddles.right.x + newState.paddles.right.width / 2, // Right paddle center x position
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
            y: 32 + newState.paddles.top.height / 2, // 32px spacing from top wall
            timestamp: now,
            width: newState.paddles.top.width,
            height: newState.paddles.top.height
          });
        }
        if (newState.paddles.bottom && Math.abs(newState.paddles.bottom.velocity) > 0.01) {
          newState.trails.bottomPaddle.push({
            x: newState.paddles.bottom.x + newState.paddles.bottom.width / 2,
            y: newState.paddles.bottom.y + newState.paddles.bottom.height / 2, // 32px spacing from bottom wall
            timestamp: now,
            width: newState.paddles.bottom.width,
            height: newState.paddles.bottom.height
          });
        }
      }

      // Game state debug removed for cleaner console

      // Skip ball logic if game is paused, ended, or not playing (but allow paddle movement)
      if (!newState.isPaused && newState.isPlaying && !newState.gameEnded) {
        // Start info text fade when game actually begins (ball starts moving)
        if (!infoTextFadeStart && (Math.abs(newState.ball.dx) > 0 || Math.abs(newState.ball.dy) > 0)) {
          setInfoTextFadeStart(Date.now());
        }

        // ========================================
        // SINGLE-PLAYER PHYSICS ENGINE
        // ========================================
        // BALL PHYSICS - SERVER AUTHORITATIVE
        // ========================================
        // All ball physics are handled by the WebSocket server in multiplayer mode
        // Server applies: drunk, teleporting, wind, gravity, floating, magnetic,
        // slippery, hypnotic, stuck detection, and all other ball modifiers
        // Client only renders the game state received from the server
      }

      return newState;
    });
  }, [gameState, canvasSize, keys, localTestMode, mouseY, mouseX, touchY, controlSide, handleLastTouchScoring, multiplayerState.isConnected, playMelodyNote, checkRandomTaunt, speakRobotic]);

  // Game loop is handled by requestAnimationFrame in the rendering useEffect below
  // Removed direct updateGame() call that was causing infinite re-renders

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Log ALL key presses for debugging
      console.log(`[KEY] Key pressed: "${e.key}" code: "${e.code}" repeat: ${e.repeat}`);

      // Ignore key repeat events
      if (e.repeat) return;

      // Handle connection retry when in error state
      if (connectionStatus === 'error') {
        e.preventDefault();
        console.log('[GAME] Retrying connection...');
        setRetryCount(prev => prev + 1);
        setConnectionStatus('retrying');
        setConnectionMessage(`Retrying connection (attempt ${retryCount + 1})...`);

        // Close existing connection if any
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }

        // Retry connection after short delay
        setTimeout(() => {
          connectWebSocket();
        }, 500);
        return;
      }

      // 🔧 Reflection adjustment controls (all sides together)
      // 5/6 for offset, 7/8 for depth, 9 to save current values
      const step = e.shiftKey ? 0.001 : 0.01; // Fine adjustment with Shift

      if (e.key === '9') {
        e.preventDefault();
        console.log('💾 SAVE THESE REFLECTION VALUES:');
        console.log(`offset: ${reflectionParams.offset.toFixed(3)}`);
        console.log(`depth: ${reflectionParams.depth.toFixed(3)}`);
        console.log('\nPaste into code:');
        console.log(`const [reflectionParams, setReflectionParams] = useState({`);
        console.log(`  offset: ${reflectionParams.offset.toFixed(3)},`);
        console.log(`  depth: ${reflectionParams.depth.toFixed(3)},`);
        console.log(`});`);
        return;
      }

      if (e.key === '5' || e.key === '6' || e.key === '7' || e.key === '8') {
        e.preventDefault();
        setReflectionParams(prev => {
          let newParams = { ...prev };

          if (e.key === '5') {
            newParams.offset = Math.max(0, prev.offset - step);
            console.log(`🔧 All sides offset: ${newParams.offset.toFixed(3)}`);
          } else if (e.key === '6') {
            newParams.offset = Math.min(1, prev.offset + step);
            console.log(`🔧 All sides offset: ${newParams.offset.toFixed(3)}`);
          } else if (e.key === '7') {
            newParams.depth = Math.max(0, prev.depth - step);
            console.log(`🔧 All sides depth: ${newParams.depth.toFixed(3)}`);
          } else if (e.key === '8') {
            newParams.depth = Math.min(1, prev.depth + step);
            console.log(`🔧 All sides depth: ${newParams.depth.toFixed(3)}`);
          }

          return newParams;
        });
        return;
      }

      // Handle pickup testing with keys 0, 1, and 2
      if (e.key === '0') {
        e.preventDefault();
        // Reset all paddle sizes to original
        if (multiplayerState.isConnected && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'reset_paddle_sizes',
            playerId: multiplayerState.playerId,
            roomId: multiplayerState.roomId
          }));
          console.log('🔧 Reset paddle sizes to original');
        }
        return;
      }

      if (e.key === '1' || e.key === '2') {
        console.log(`🔧 DEBUG KEY PRESSED: ${e.key}`);
        e.preventDefault();

        // Enable debug mode if not already enabled
        if (!isDebugMode) {
          setIsDebugMode(true);
          console.log('🔧 Pickup test mode enabled');
        }

        // Calculate new index using ref for immediate updates
        let newIndex = debugPickupIndexRef.current;
        if (e.key === '1') {
          // Previous pickup
          newIndex = (newIndex - 1 + PICKUP_TYPES.length) % PICKUP_TYPES.length;
        } else if (e.key === '2') {
          // Next pickup
          newIndex = (newIndex + 1) % PICKUP_TYPES.length;
        }

        // Update both ref and state
        debugPickupIndexRef.current = newIndex;
        setDebugPickupIndex(newIndex);

        const pickup = PICKUP_TYPES[newIndex];
        console.log(`🔧 Testing pickup [${newIndex + 1}/${PICKUP_TYPES.length}]: ${pickup.type} - ${pickup.description}`);

        // Send pickup activation to server if multiplayer
        if (multiplayerState.isConnected && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'test_pickup',
            playerId: multiplayerState.playerId,
            roomId: multiplayerState.roomId,
            pickupType: pickup.type
          }));
          console.log(`🔧 Sent test_pickup message to server: ${pickup.type}`);
        } else {
          console.log(`🔧 Not connected to multiplayer - cannot test pickup`);
        }

        return;
      }

      // Handle 'L' key FIRST before any early returns (for local test mode)
      if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        console.log('🔧 L KEY PRESSED (EARLY CHECK):', {
          currentLocalTestMode: localTestMode,
          currentGameMode: gameState.gameMode,
          isPlaying: gameState.isPlaying,
          showStartScreen: gameState.showStartScreen,
          showAudioPrompt: showAudioPrompt
        });

        // Initialize audio if needed
        await initializeAudio();

        // Toggle local test mode
        const newLocalTestMode = !localTestMode;
        setLocalTestMode(newLocalTestMode);

        // Dismiss audio prompt FIRST if shown
        if (showAudioPrompt) {
          console.log('🔧 Dismissing audio prompt for local test mode');
          audioPromptDismissedRef.current = true;
          setShowAudioPrompt(false);
        }

        // If enabling local test mode, switch to player mode for local physics
        if (newLocalTestMode) {
          console.log('🔧 Enabling local test mode - switching to player mode');
          // Use setTimeout to ensure state updates happen after audio prompt dismissal
          setTimeout(() => {
            // Start paddle animation
            paddleAnimationStartTimeRef.current = Date.now();
            setPaddleAnimationProgress(0);

            setGameState(prevState => ({
              ...prevState,
              gameMode: 'player',
              isPlaying: true,
              showStartScreen: false,
              ball: {
                ...prevState.ball,
                dx: Math.random() > 0.5 ? MIN_BALL_SPEED : -MIN_BALL_SPEED,
                dy: Math.random() > 0.5 ? MIN_BALL_SPEED : -MIN_BALL_SPEED,
                ...getCenteredBallPosition()
              },
              score: { left: 0, right: 0, top: 0, bottom: 0 },
              winner: null,
              gameEnded: false
            }));
          }, 50); // Small delay to ensure audio prompt state update completes first
        } else {
          console.log('🔧 Disabling local test mode');
          // When disabling, go back to the start screen
          setGameState(prevState => ({
            ...prevState,
            showStartScreen: true,
            isPlaying: false,
            gameMode: 'auto'
          }));
        }

        return; // Exit early to prevent any other key handling
      }

      // Handle audio prompt dismissal with spacebar - in spectator mode, go directly to multiplayer
      if (showAudioPrompt && !audioPromptDismissedRef.current && e.key === ' ') {
        // console.log('[MUSIC] DISMISSING AUDIO PROMPT WITH SPACEBAR');
        audioPromptDismissedRef.current = true;
        setShowAudioPrompt(false);

        if (isSpectatorMode) {
          // Skip start screen for spectator mode - go directly to multiplayer
          // Start paddle animation
          paddleAnimationStartTimeRef.current = Date.now();
          setPaddleAnimationProgress(0);

          connectWebSocket();
          setGameState(prev => ({
            ...prev,
            showStartScreen: false,
            gameMode: 'multiplayer',
            isPlaying: true,
            ball: {
              ...prev.ball,
              ...getCenteredBallPosition(),
              dx: 6,
              dy: 6,
            }
          }));
        } else {
          setGameState(prev => ({ ...prev, showStartScreen: true }));
        }
        await initializeAudio();

        // Ensure canvas gets focus for keyboard events
        setTimeout(() => {
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.focus();
            console.log('[TARGET] CANVAS FOCUSED FOR START SCREEN');
          }
        }, 100);

        return;
      }

      // Handle non-spacebar audio prompt dismissal (other keys just dismiss, don't start game)
      // Exclude 'c', 'm', and 'f' keys from starting the game (they toggle CRT/music/fullscreen)
      if (showAudioPrompt && !audioPromptDismissedRef.current && e.key !== ' ' && e.key.toLowerCase() !== 'c' && e.key.toLowerCase() !== 'm' && e.key.toLowerCase() !== 'f') {
        audioPromptDismissedRef.current = true;
        setShowAudioPrompt(false);

        if (isSpectatorMode) {
          // Skip start screen for spectator mode - go directly to multiplayer
          // Start paddle animation
          paddleAnimationStartTimeRef.current = Date.now();
          setPaddleAnimationProgress(0);

          connectWebSocket();
          setGameState(prev => ({
            ...prev,
            showStartScreen: false,
            gameMode: 'multiplayer',
            isPlaying: true,
            ball: {
              ...prev.ball,
              ...getCenteredBallPosition(),
              dx: 6,
              dy: 6,
            }
          }));
        } else {
          setGameState(prev => ({ ...prev, showStartScreen: true }));
        }
        await initializeAudio();

        // Ensure canvas gets focus for keyboard events
        setTimeout(() => {
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.focus();
            console.log('[TARGET] CANVAS FOCUSED FOR START SCREEN');
          }
        }, 100);

        return;
      }

      // Handle CRT toggle - should work at any time, even on audio prompt
      if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setCrtEffect(prev => !prev);
        return; // Don't process any other logic
      }

      // Handle LAN mode toggle (M key) - only in spectator mode
      if (e.key.toLowerCase() === 'm' && isSpectatorMode) {
        e.preventDefault();
        toggleLanMode();
        return; // Don't process any other logic
      }

      // Initialize audio on first user interaction
      await initializeAudio();

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
        case 'm':
          e.preventDefault();
          // console.log('[MUSIC] M key pressed! Audio context state:', {
          //   audioContext: !!audioContextRef.current,
          //   speechGain: !!speechMasterGainRef.current,
          //   beepsGain: !!beepsMasterGainRef.current
          // });

          // COMPREHENSIVE AUDIO INITIALIZATION AND MUTE TOGGLE
          // console.log('[MUSIC] M key pressed - initializing audio system...');

          // Initialize audio context if needed
          if (!audioContextRef.current) {
            try {
              audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
              // console.log('[MUSIC] Created new AudioContext');
            } catch (error) {
              console.error('[ERROR] Failed to create AudioContext:', error);
              break;
            }
          }

          // Resume audio context if suspended (required by browser autoplay policies)
          if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume().then(() => {
              // console.log('[MUSIC] Resumed AudioContext');
            }).catch((error) => {
              console.error('[ERROR] Failed to resume AudioContext:', error);
            });
          }

          // Create gain nodes if they don't exist
          if (!speechMasterGainRef.current && audioContextRef.current) {
            speechMasterGainRef.current = audioContextRef.current.createGain();
            speechMasterGainRef.current.gain.setValueAtTime(0.08, audioContextRef.current.currentTime);
            speechMasterGainRef.current.connect(audioContextRef.current.destination);
          }

          // Create all 4 beep channels if they don't exist
          const channelVolume = 0.25;
          if (!beepsChannel1Ref.current && audioContextRef.current) {
            beepsChannel1Ref.current = audioContextRef.current.createGain();
            beepsChannel1Ref.current.gain.setValueAtTime(channelVolume, audioContextRef.current.currentTime);
            beepsChannel1Ref.current.connect(audioContextRef.current.destination);
          }
          if (!beepsChannel2Ref.current && audioContextRef.current) {
            beepsChannel2Ref.current = audioContextRef.current.createGain();
            beepsChannel2Ref.current.gain.setValueAtTime(channelVolume, audioContextRef.current.currentTime);
            beepsChannel2Ref.current.connect(audioContextRef.current.destination);
          }
          if (!beepsChannel3Ref.current && audioContextRef.current) {
            beepsChannel3Ref.current = audioContextRef.current.createGain();
            beepsChannel3Ref.current.gain.setValueAtTime(channelVolume, audioContextRef.current.currentTime);
            beepsChannel3Ref.current.connect(audioContextRef.current.destination);
          }
          if (!beepsChannel4Ref.current && audioContextRef.current) {
            beepsChannel4Ref.current = audioContextRef.current.createGain();
            beepsChannel4Ref.current.gain.setValueAtTime(channelVolume, audioContextRef.current.currentTime);
            beepsChannel4Ref.current.connect(audioContextRef.current.destination);
          }

          // Now toggle mute with all gain nodes available
          if (speechMasterGainRef.current && beepsChannel1Ref.current && audioContextRef.current) {
            const isCurrentlyMuted = speechMasterGainRef.current.gain.value === 0;

            // Toggle logic: if muted (0), restore levels; if unmuted, set to 0
            const speechLevel = isCurrentlyMuted ? 0.08 : 0;
            const beepsLevel = isCurrentlyMuted ? channelVolume : 0;

            const currentTime = audioContextRef.current.currentTime;
            speechMasterGainRef.current.gain.setValueAtTime(speechLevel, currentTime);
            beepsChannel1Ref.current.gain.setValueAtTime(beepsLevel, currentTime);
            beepsChannel2Ref.current?.gain.setValueAtTime(beepsLevel, currentTime);
            beepsChannel3Ref.current?.gain.setValueAtTime(beepsLevel, currentTime);
            beepsChannel4Ref.current?.gain.setValueAtTime(beepsLevel, currentTime);

            // Also mute/unmute Tone.js music
            if ((window as any).generativeMusic?.setVolume) {
              (window as any).generativeMusic.setVolume(isCurrentlyMuted ? 0.6 : 0);
            }

            // console.log(`[AUDIO] Audio ${isCurrentlyMuted ? 'UNMUTED' : 'MUTED'} - Levels: speech=${speechLevel}, beeps=${beepsLevel}`);

            // Visual feedback
            if (isCurrentlyMuted) {
              // Show unmuted message on screen briefly
              // console.log('[AUDIO] AUDIO ENABLED');
            } else {
              // Show muted message on screen briefly
              // console.log('🔇 AUDIO MUTED');
            }
          } else {
            console.log('[ERROR] Failed to create or access audio gain nodes');
          }
          break;
        case 'f':
          e.preventDefault();
          // Toggle fullscreen
          if (!document.fullscreenElement) {
            // Enter fullscreen
            document.documentElement.requestFullscreen().catch(err => {
              console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
          } else {
            // Exit fullscreen
            document.exitFullscreen();
          }
          break;
        case 'p':
          e.preventDefault();
          // Toggle FPS display
          setShowFPS(prev => !prev);
          break;
        case '2':
          e.preventDefault();
          console.log('[TARGET] 2 KEY PRESSED (FORWARD):', {
            isPlaying: gameState.isPlaying,
            gameMode: gameState.gameMode,
            debugPickupIndex,
            localTestMode
          });

          console.log('[DISABLED] Debug pickup controls disabled - server handles all pickups');
          break;
        case '1':
          e.preventDefault();
          console.log('[DISABLED] Debug pickup controls disabled - server handles all pickups');
          break;
        case '3':
          e.preventDefault();
          // Previous track
          if ((window as any).generativeMusic && !isSwitchingTrackRef.current) {
            isSwitchingTrackRef.current = true;

            const pieces = (window as any).generativeMusic.availablePieces;
            const currentState = (window as any).generativeMusic.currentState;
            const currentIndex = pieces.findIndex((p: any) => p.id === currentState.currentPieceId);
            const newIndex = currentIndex === 0 ? pieces.length - 1 : currentIndex - 1;
            const newPiece = pieces[newIndex];

            console.log('[MUSIC] Switching to previous track:', newPiece.title);

            // Await the track switch to ensure cleanup completes
            (window as any).generativeMusic.startPiece(newPiece.id).then(() => {
              console.log('[MUSIC] Successfully switched to:', newPiece.title);
              isSwitchingTrackRef.current = false;
            }).catch((err: any) => {
              console.error('[MUSIC] Failed to switch track:', err);
              isSwitchingTrackRef.current = false;
            });

            setCurrentMusicTrack(newIndex);

            // Show track name for 4 seconds
            trackNameShowTimeRef.current = Date.now();
            setShowTrackName(true);
            if (trackNameTimeoutRef.current) {
              clearTimeout(trackNameTimeoutRef.current);
            }
            trackNameTimeoutRef.current = window.setTimeout(() => {
              setShowTrackName(false);
            }, 4000);
          }
          break;
        case '4':
          e.preventDefault();
          // Next track
          if ((window as any).generativeMusic && !isSwitchingTrackRef.current) {
            isSwitchingTrackRef.current = true;

            const pieces = (window as any).generativeMusic.availablePieces;
            const currentState = (window as any).generativeMusic.currentState;
            const currentIndex = pieces.findIndex((p: any) => p.id === currentState.currentPieceId);
            const newIndex = (currentIndex + 1) % pieces.length;
            const newPiece = pieces[newIndex];

            console.log('[MUSIC] Switching to next track:', newPiece.title);

            // Await the track switch to ensure cleanup completes
            (window as any).generativeMusic.startPiece(newPiece.id).then(() => {
              console.log('[MUSIC] Successfully switched to:', newPiece.title);
              isSwitchingTrackRef.current = false;
            }).catch((err: any) => {
              console.error('[MUSIC] Failed to switch track:', err);
              isSwitchingTrackRef.current = false;
            });

            setCurrentMusicTrack(newIndex);

            // Show track name for 4 seconds
            trackNameShowTimeRef.current = Date.now();
            setShowTrackName(true);
            if (trackNameTimeoutRef.current) {
              clearTimeout(trackNameTimeoutRef.current);
            }
            trackNameTimeoutRef.current = window.setTimeout(() => {
              setShowTrackName(false);
            }, 4000);
          }
          break;
        case 'r':
          e.preventDefault();
          // Reset game completely
          // Start paddle animation
          paddleAnimationStartTimeRef.current = Date.now();
          setPaddleAnimationProgress(0);

          setGameState(prev => ({
            ...prev,
            winner: null,
            gameEnded: false,
            isPlaying: true,
            showStartScreen: false,
            activeEffects: [],
            extraBalls: [],
            coins: [],
            ball: {
              ...prev.ball,
              size: prev.ball.originalSize,
              isDrunk: false,
              drunkAngle: 0,
              isTeleporting: false,
              hasWind: false,
              hasGravity: false,
              isAiming: false,
              isStuck: false,
              hasPortal: false,
              isMirror: false,
              mirrorBalls: [],
              hasTrailMines: false,
              trailMines: [],
              isSlippery: false,
              bounciness: 1.0,
              isMagnetic: false,
              isFloating: false,
              isHypnotic: false,
            },
            paddles: {
              ...prev.paddles,
              left: { ...prev.paddles.left, height: PADDLE_LENGTH, width: PADDLE_THICKNESS },
              right: { ...prev.paddles.right, height: PADDLE_LENGTH, width: PADDLE_THICKNESS },
              top: { ...prev.paddles.top, height: PADDLE_THICKNESS, width: PADDLE_LENGTH },
              bottom: { ...prev.paddles.bottom, height: PADDLE_THICKNESS, width: PADDLE_LENGTH },
            }
          }));
          // Also disable debug mode when resetting
          setIsDebugMode(false);
          break;
        case ' ':
          e.preventDefault();
          // Spacebar is handled like any other key now
          break;
      }

      // Check if showing start screen OR if audio prompt was just dismissed - start game with any key
      // EXCLUDE L key from "any key" logic to prevent race condition with local test mode
      const audioJustDismissed = audioPromptDismissedRef.current && showAudioPrompt;
      const shouldStartGame = (gameState.showStartScreen || audioJustDismissed) && e.key !== 'l';

      console.log('[ROCKET] START SCREEN CHECK:', {
        showStartScreen: gameState.showStartScreen,
        audioJustDismissed,
        shouldStartGame,
        about_to_enter: shouldStartGame ? 'YES - ENTERING START LOGIC' : 'NO - SKIPPING START LOGIC'
      });

      if (shouldStartGame) {
        console.log('[ROCKET] STARTING GAME FROM START SCREEN!');
        // Start paddle animation
        paddleAnimationStartTimeRef.current = Date.now();
        setPaddleAnimationProgress(0);

        // Try to connect to multiplayer WebSocket (allow retry even if connectionStatus is 'error')
        if (!multiplayerState.isConnected) {
          try {
            connectWebSocket();
            // Reset game state when reconnecting
            setGameState(prev => ({
              ...prev,
              showStartScreen: false,
              gameMode: 'multiplayer',
              isPlaying: true,
              score: { left: 0, right: 0, top: 0, bottom: 0 },
              winner: null,
              gameEnded: false,
              ball: {
                ...prev.ball,
                ...getCenteredBallPosition(),
                dx: Math.random() > 0.5 ? MIN_BALL_SPEED : -MIN_BALL_SPEED,
                dy: (Math.random() - 0.5) * MIN_BALL_SPEED * 0.8
              }
            }));
            setTimeout(() => speakRobotic('CONNECTING TO SERVER'), 100);
          } catch (error) {
            console.error('[ERROR] Failed to connect to multiplayer:', error);
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
          console.log('[WARNING] Connection error, starting single player');
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

  // Auto-initialize spectator mode
  useEffect(() => {
    if (isSpectatorMode) {
      console.log('[SPECTATOR] Auto-initializing spectator mode');
      // Start paddle animation
      paddleAnimationStartTimeRef.current = Date.now();
      setPaddleAnimationProgress(0);

      // Skip all prompts and directly connect to multiplayer WebSocket
      setGameState(prev => ({
        ...prev,
        showStartScreen: false,
        gameMode: 'multiplayer',
        isPlaying: true
      }));
      // Connect to WebSocket immediately
      setTimeout(() => {
        console.log('[SPECTATOR] Connecting to WebSocket server...');
        connectWebSocket();
      }, 100); // Small delay to ensure state is set
    }
  }, [isSpectatorMode, connectWebSocket]);

  // Helper function to convert hex to RGB
  const hexToRgb = useCallback((hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }, []);

  // Helper function to wrap text into multiple lines
  const wrapText = useCallback((ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }, []);

  // [ROCKET] OPTIMIZED CRT Effect - uses cached time for better performance
  const applyCRTEffect = useCallback((ctx: CanvasRenderingContext2D, canvasSize: { width: number; height: number }) => {
    const time = cachedTimeRef.current * 0.001;
    const frameCount = Math.floor(time * 15); // Frame count for animation timing

    ctx.save();

    // [ROCKET] OPTIMIZED CRT Curvature Effect - Use cached gradient
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

    // [ROCKET] OPTIMIZED Scanlines - Enhanced during Detroit mode
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 1;

    // Detroit mode: Animated rainbow scanlines synced to beat
    let scanlineOffset = 0;
    let scanlineGradient = cache.scanline;

    if (gameState.detroitMode) {
      const timeSinceStart = Date.now() - (gameState.detroitStartTime || 0);
      const beatDuration = 461; // 130 BPM
      const beatPhase = (timeSinceStart % beatDuration) / beatDuration;
      const beat = Math.floor(timeSinceStart / beatDuration);
      const hue = (beat * 45) % 360;

      // Animate scanline position
      scanlineOffset = Math.floor(beatPhase * 4) % 4;

      // Rainbow scanlines
      scanlineGradient = ctx.createLinearGradient(0, 0, 0, 4);
      scanlineGradient.addColorStop(0, `hsla(${hue}, 100%, 50%, 0.3)`);
      scanlineGradient.addColorStop(0.5, `hsla(${(hue + 60) % 360}, 100%, 50%, 0.4)`);
      scanlineGradient.addColorStop(1, `hsla(${(hue + 120) % 360}, 100%, 50%, 0.3)`);
    } else {
      // Static scanline pattern - no animation to prevent flickering
      if (!cache.scanline) {
        cache.scanline = ctx.createLinearGradient(0, 0, 0, 4);
        cache.scanline.addColorStop(0, 'rgba(0, 0, 0, 0.2)');
        cache.scanline.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
        cache.scanline.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
      }
      scanlineGradient = cache.scanline;
    }

    ctx.fillStyle = scanlineGradient;

    // Draw scanlines every 2 pixels
    for (let y = scanlineOffset; y < canvasSize.height; y += 4) {
      ctx.fillRect(0, y, canvasSize.width, 1);
    }


    // [ROCKET] OPTIMIZED Vignette - Use cached gradient
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

    // Screen flicker disabled - no animation

    // Phosphor Glow disabled - no frame-based flickering
    // RGB Bleed Effect disabled - no frame-based flickering

    // CRT Noise disabled - no flickering static


    // Refresh Line disabled - no flickering line animation

    ctx.restore();
  }, [gameState.colorIndex]);


  // Time warp effect - pitch shifting now handled by Tone.js GlobalAmbientMusic component

  // High-performance render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // DEBUG: Check if there's a transform or clip active
    if (!window.__ctxDebugLogged) {
      window.__ctxDebugLogged = true;
      const transform = ctx.getTransform();
      console.log('[CTX DEBUG] Canvas context state:', {
        transformA: transform.a,
        transformD: transform.d,
        transformE: transform.e,
        transformF: transform.f,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height
      });
    }

    // Reset transform to identity to ensure clean slate (fixes Retina/scaling issues)
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Disable anti-aliasing to prevent sub-pixel rendering flicker
    ctx.imageSmoothingEnabled = false;

    // 📊 FPS Counter calculation (efficient)
    frameCountRef.current++;
    const now = Date.now();
    if (now - lastFpsUpdateRef.current >= 1000) { // Update every second
      fpsRef.current = Math.round((frameCountRef.current * 1000) / (now - lastFpsUpdateRef.current));
      frameCountRef.current = 0;
      lastFpsUpdateRef.current = now;
    }

    // Rumble effect disabled - using only disharmonic music shake

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

    // Clear canvas with color scheme background
    ctx.fillStyle = currentColors.background;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // 🎵 DETROIT TECHNO VISUAL EFFECTS - Synced to 130 BPM (461ms per beat)
    if (gameState.detroitMode) {
      const timeSinceStart = Date.now() - (gameState.detroitStartTime || 0);
      const beatDuration = 461; // 130 BPM = 461ms per beat
      const beatPhase = (timeSinceStart % beatDuration) / beatDuration;
      const beat = Math.floor(timeSinceStart / beatDuration);
      const step16th = Math.floor(timeSinceStart / (beatDuration / 4)) % 16;

      // 1. Rainbow color cycling synced to beats
      const hue = (beat * 45) % 360; // Change hue every beat
      const rainbowColor = `hsl(${hue}, 100%, 50%)`;

      // 2. Kick drum flash (every 4 steps = every beat)
      if (step16th % 4 === 0 && beatPhase < 0.15) {
        const kickFlash = 1 - (beatPhase / 0.15);
        ctx.globalAlpha = kickFlash * 0.3;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
        ctx.globalAlpha = 1;
      }

      // 3. Strobing borders on synth stabs (steps 0 and 4)
      if ((step16th === 0 || step16th === 4) && beatPhase < 0.2) {
        const borderSize = 20 + beatPhase * 40;
        const strobeBrightness = 1 - (beatPhase / 0.2);
        ctx.globalAlpha = strobeBrightness * 0.8;
        ctx.strokeStyle = rainbowColor;
        ctx.lineWidth = borderSize;
        ctx.strokeRect(borderSize / 2, borderSize / 2, canvasSize.width - borderSize, canvasSize.height - borderSize);
        ctx.globalAlpha = 1;
      }

      // 4. Rotating corner particles
      const particleCount = 8;
      for (let i = 0; i < particleCount; i++) {
        const angle = (timeSinceStart / 1000) + (i * Math.PI * 2 / particleCount);
        const radius = 150 + Math.sin(timeSinceStart / 200 + i) * 50;
        const corners = [
          { x: canvasSize.width / 2, y: canvasSize.height / 2 },
        ];

        corners.forEach(corner => {
          const px = corner.x + Math.cos(angle) * radius;
          const py = corner.y + Math.sin(angle) * radius;
          const particleHue = (hue + i * 45) % 360;
          ctx.fillStyle = `hsl(${particleHue}, 100%, 50%)`;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          ctx.arc(px, py, 8, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      ctx.globalAlpha = 1;

      // 5. (REMOVED - Detroit text logo)

      // 6. Scanline intensity pulse on kick
      if (step16th % 4 === 0 && beatPhase < 0.2) {
        const scanlineIntensity = (1 - beatPhase / 0.2) * 0.3;
        ctx.globalAlpha = scanlineIntensity;
        for (let y = 0; y < canvasSize.height; y += 4) {
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, y, canvasSize.width, 2);
        }
        ctx.globalAlpha = 1;
      }

      // 7. Grid overlay pulsing with hi-hats (every 2 steps)
      if (beatPhase < 0.08) {
        const gridAlpha = (1 - beatPhase / 0.08) * 0.15;
        ctx.globalAlpha = gridAlpha;
        ctx.strokeStyle = rainbowColor;
        ctx.lineWidth = 1;

        // Vertical lines
        for (let x = 0; x < playFieldWidth; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, playFieldHeight);
          ctx.stroke();
        }

        // Horizontal lines
        for (let y = 0; y < playFieldHeight; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(playFieldWidth, y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }

    // [VISUALIZER] Audio visualizer - frequency bars (drawn BEHIND scaled content)
    if (analyserNodeRef.current && frequencyDataRef.current) {
      analyserNodeRef.current.getByteFrequencyData(frequencyDataRef.current);

      const barCount = 32; // Number of frequency bars
      const barWidth = canvasSize.width / barCount;
      const dataStep = Math.floor(frequencyDataRef.current.length / barCount);

      // Helper function to lighten a hex color
      const lightenColor = (hex: string, percent: number) => {
        const num = parseInt(hex.replace('#', ''), 16);
        const r = Math.min(255, Math.floor((num >> 16) + ((255 - (num >> 16)) * percent)));
        const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + ((255 - ((num >> 8) & 0x00FF)) * percent)));
        const b = Math.min(255, Math.floor((num & 0x0000FF) + ((255 - (num & 0x0000FF)) * percent)));
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
      };

      // Use lighter shade of background for visualizer
      const visualizerColor = lightenColor(currentColors.background, 0.25);

      // Frequency bars centered horizontally (mirrored from center)
      ctx.fillStyle = visualizerColor;
      ctx.globalAlpha = 0.4;

      const centerX = canvasSize.width / 2;
      const maxBarHeight = 300;

      for (let i = 0; i < barCount / 2; i++) {
        const dataIndex = i * dataStep;
        const value = frequencyDataRef.current[dataIndex] / 255;
        const barHeight = Math.pow(value, 0.5) * maxBarHeight;

        const x = i * barWidth;

        // Left half - bars extending upward from center
        ctx.fillRect(x, centerX - barHeight, barWidth - 1, barHeight);

        // Left half - bars extending downward from center
        ctx.fillRect(x, centerX, barWidth - 1, barHeight);

        // Right half - mirrored bars extending upward from center
        ctx.fillRect(canvasSize.width - x - barWidth + 1, centerX - barHeight, barWidth - 1, barHeight);

        // Right half - mirrored bars extending downward from center
        ctx.fillRect(canvasSize.width - x - barWidth + 1, centerX, barWidth - 1, barHeight);
      }

      ctx.globalAlpha = 1.0; // Reset alpha
    }

    // [AUDIO] AUDIO INTERACTION PROMPT (first load only)
    if (showAudioPrompt) {
      // Draw playfield borders - same as gameplay area
      ctx.strokeStyle = currentColors.foreground;
      const audioBorderWidth = 12 * scaleFactor;
      ctx.lineWidth = audioBorderWidth;
      ctx.setLineDash([]); // Solid lines for borders
      ctx.beginPath();
      const borderInset = audioBorderWidth / 2; // Half of line width
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
      const audioPromptSize = Math.round(32 * scaleFactor);
      ctx.font = `bold ${audioPromptSize}px "Press Start 2P", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 4 * scaleFactor;
      ctx.shadowColor = currentColors.foreground;
      ctx.fillText('AUDIO REQUIRED', canvasSize.width / 2, canvasSize.height / 2 - (80 * scaleFactor));

      // Instructions
      const audioInstructionSize = Math.round(16 * scaleFactor);
      ctx.font = `bold ${audioInstructionSize}px "Press Start 2P", monospace`;
      ctx.fillText('This game uses sound effects', canvasSize.width / 2, canvasSize.height / 2 - (20 * scaleFactor));
      ctx.fillText('and speech synthesis', canvasSize.width / 2, canvasSize.height / 2 + (10 * scaleFactor));

      // Interaction prompt
      const audioInteractionSize = Math.round(20 * scaleFactor);
      ctx.font = `bold ${audioInteractionSize}px "Press Start 2P", monospace`;
      ctx.fillText('CLICK ANYWHERE TO CONTINUE', canvasSize.width / 2, canvasSize.height / 2 + (80 * scaleFactor));

      // Small footer
      const audioFooterSize = Math.round(12 * scaleFactor);
      ctx.font = `bold ${audioFooterSize}px "Press Start 2P", monospace`;
      ctx.fillText('Required for browser audio policy compliance', canvasSize.width / 2, canvasSize.height / 2 + (120 * scaleFactor));
      ctx.shadowBlur = 0;

      return; // Don't render anything else when showing audio prompt
    }

    // [ROCKET] START SCREEN
    if (gameState.showStartScreen) {
      // Draw playfield borders - same as gameplay area
      ctx.strokeStyle = currentColors.foreground;
      const startBorderWidth = 12 * scaleFactor;
      ctx.lineWidth = startBorderWidth;
      ctx.setLineDash([]); // Solid lines for borders
      ctx.beginPath();
      const borderInset = startBorderWidth / 2; // Half of line width
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
      const titleSize = Math.round(48 * scaleFactor);
      ctx.font = `bold ${titleSize}px "Press Start 2P", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 4 * scaleFactor;
      ctx.shadowColor = currentColors.foreground;
      ctx.fillText('SPACE BLAZERS', canvasSize.width / 2, canvasSize.height / 2 - (200 * scaleFactor));

      // Controls section
      const controlsTitleSize = Math.round(24 * scaleFactor);
      ctx.font = `bold ${controlsTitleSize}px "Press Start 2P", monospace`;
      ctx.fillText('CONTROLS', canvasSize.width / 2, canvasSize.height / 2 - (120 * scaleFactor));

      const controlsTextSize = Math.round(16 * scaleFactor);
      ctx.font = `${controlsTextSize}px "Press Start 2P", monospace`;
      const controlsY = canvasSize.height / 2 - (80 * scaleFactor);
      const controlsLineHeight = 30 * scaleFactor;

      // Player controls
      ctx.textAlign = 'left';
      const controlsX = canvasSize.width / 2 - (300 * scaleFactor);
      ctx.fillText('PLAYER 1 (LEFT): W/S KEYS', controlsX, controlsY);
      ctx.fillText('PLAYER 2 (RIGHT): ↑/↓ KEYS OR MOUSE/TOUCH', controlsX, controlsY + controlsLineHeight);
      ctx.fillText('PLAYER 3 (TOP): A/D KEYS', controlsX, controlsY + (controlsLineHeight * 2));
      ctx.fillText('PLAYER 4 (BOTTOM): ←/→ KEYS', controlsX, controlsY + (controlsLineHeight * 3));

      // Options
      ctx.fillText('OPTIONS:', controlsX, controlsY + (controlsLineHeight * 4.67));
      ctx.fillText('C - TOGGLE CRT EFFECT', controlsX, controlsY + (controlsLineHeight * 5.67));
      ctx.fillText('M - TOGGLE MUSIC', controlsX, controlsY + (controlsLineHeight * 6.67));
      ctx.fillText('F - TOGGLE FULLSCREEN', controlsX, controlsY + (controlsLineHeight * 7.67));

      // Start instructions with blinking effect
      const startPromptSize = Math.round(20 * scaleFactor);
      ctx.font = `bold ${startPromptSize}px "Press Start 2P", monospace`;
      ctx.textAlign = 'center';

      // Create blinking effect - visible for 0.8s, invisible for 0.4s (1.2s cycle)
      const blinkCycle = (Date.now() % 1200) / 1200; // 0 to 1
      const isVisible = blinkCycle < 0.67; // Visible for 67% of the cycle

      if (isVisible) {
        // Use a bright attention-grabbing color - cyan from the palette
        ctx.fillStyle = '#00f5ff'; // Cyan color for visibility
        ctx.shadowColor = '#00f5ff';
        ctx.fillText('PRESS ANY KEY TO START', canvasSize.width / 2, canvasSize.height / 2 + (260 * scaleFactor));
      }

      // Reset color back to normal for other elements
      ctx.fillStyle = currentColors.foreground;
      ctx.shadowColor = currentColors.foreground;

      // Footer with CRT status
      const footerSize = Math.round(14 * scaleFactor);
      ctx.font = `${footerSize}px "Press Start 2P", monospace`;
      ctx.fillText(`CRT EFFECT: ${crtEffect ? 'ON' : 'OFF'}`, canvasSize.width / 2, canvasSize.height / 2 + (200 * scaleFactor));
      ctx.shadowBlur = 0;

      return; // Don't render game elements when showing start screen
    }

    // 📐 Dynamic playfield scaling transformation
    ctx.save(); // Save canvas state before transformation

    // Calculate game area centering
    const gameAreaSize = Math.min(canvasSize.width, canvasSize.height);
    const xOffset = (canvasSize.width - gameAreaSize) / 2;
    const yOffset = (canvasSize.height - gameAreaSize) / 2;

    // Apply transformation once: translate and scale to fit the canvas
    ctx.save();
    ctx.translate(xOffset, yOffset);
    ctx.scale(scale, scale);

    // Apply dynamic playfield scaling transformation ONLY for dynamic_playfield pickup
    const hasDynamicPlayfieldEffect = gameState.activeEffects?.some(effect => effect.type === 'dynamic_playfield') || false;
    const playfieldScale = gameState.playfieldScale || 1.0;

    if (hasDynamicPlayfieldEffect && playfieldScale !== 1.0) {
      // Transform from center of GAME AREA for symmetric scaling
      const centerX = gameAreaSize / 2;
      const centerY = gameAreaSize / 2;

      ctx.translate(centerX, centerY); // Move origin to center
      ctx.scale(playfieldScale, playfieldScale); // Apply scale
      ctx.translate(-centerX, -centerY); // Move origin back
    }

    // Draw playfield borders at the edge of the canvas with music-reactive glow
    const musicData = musicDataRef.current;

    // Ensure we always have some glow even if music data is not available
    const baseGlow = 8; // Minimum glow even without music
    const musicVolume = Math.max(0.2, musicData.volume); // Use at least 20% volume for visibility

    // Music data logging moved to GlobalAmbientMusic.tsx for better debugging

    // Disharmonic RGB bleed effect active in CRT shader

    // DISABLED - Border drawing removed for cleaner bezel reflections
    // Check if Great Wall is active and draw individual borders with color highlight
    if (false && gameState.ball.hasGreatWall && gameState.ball.greatWallSide) {
      const protectedSide = gameState.ball.greatWallSide;

      // Electric pulsing effect - use time for animation
      const pulseTime = Date.now() / 200; // Faster pulse
      const pulseIntensity = 0.5 + Math.sin(pulseTime) * 0.5; // 0 to 1
      const glowIntensity = 10 + pulseIntensity * 20; // 10-30px blur (reduced from 20-60)

      // Electric blue color with pulsing opacity
      const electricBlue = `rgba(0, 204, 255, ${0.7 + pulseIntensity * 0.3})`;

      ctx.setLineDash([]); // Solid lines for borders

      // Draw borders with centered stroke at BORDER_THICKNESS/2 from edges
      // Music-reactive glow for non-protected sides
      const musicGlow = baseGlow + musicVolume * 12; // 8-20px based on music

      // Left border
      ctx.strokeStyle = protectedSide === 'left' ? electricBlue : currentColors.foreground;
      ctx.shadowBlur = protectedSide === 'left' ? glowIntensity : musicGlow;
      ctx.shadowColor = protectedSide === 'left' ? electricBlue : currentColors.foreground;
      ctx.lineWidth = protectedSide === 'left' ? (4 + pulseIntensity * 4) : BORDER_THICKNESS;
      ctx.beginPath();
      ctx.moveTo(BORDER_THICKNESS/2, BORDER_THICKNESS/2);
      ctx.lineTo(BORDER_THICKNESS/2, gameAreaSize - BORDER_THICKNESS/2);
      ctx.stroke();

      // Right border
      ctx.strokeStyle = protectedSide === 'right' ? electricBlue : currentColors.foreground;
      ctx.shadowBlur = protectedSide === 'right' ? glowIntensity : musicGlow;
      ctx.shadowColor = protectedSide === 'right' ? electricBlue : currentColors.foreground;
      ctx.lineWidth = protectedSide === 'right' ? (4 + pulseIntensity * 4) : BORDER_THICKNESS;
      ctx.beginPath();
      ctx.moveTo(gameAreaSize - BORDER_THICKNESS/2, BORDER_THICKNESS/2);
      ctx.lineTo(gameAreaSize - BORDER_THICKNESS/2, gameAreaSize - BORDER_THICKNESS/2);
      ctx.stroke();

      // Top border
      ctx.strokeStyle = protectedSide === 'top' ? electricBlue : currentColors.foreground;
      ctx.shadowBlur = protectedSide === 'top' ? glowIntensity : musicGlow;
      ctx.shadowColor = protectedSide === 'top' ? electricBlue : currentColors.foreground;
      ctx.lineWidth = protectedSide === 'top' ? (4 + pulseIntensity * 4) : BORDER_THICKNESS;
      ctx.beginPath();
      ctx.moveTo(BORDER_THICKNESS/2, BORDER_THICKNESS/2);
      ctx.lineTo(gameAreaSize - BORDER_THICKNESS/2, BORDER_THICKNESS/2);
      ctx.stroke();

      // Bottom border
      ctx.strokeStyle = protectedSide === 'bottom' ? electricBlue : currentColors.foreground;
      ctx.shadowBlur = protectedSide === 'bottom' ? glowIntensity : musicGlow;
      ctx.shadowColor = protectedSide === 'bottom' ? electricBlue : currentColors.foreground;
      ctx.lineWidth = protectedSide === 'bottom' ? (4 + pulseIntensity * 4) : BORDER_THICKNESS;
      ctx.beginPath();
      ctx.moveTo(BORDER_THICKNESS/2, gameAreaSize - BORDER_THICKNESS/2);
      ctx.lineTo(gameAreaSize - BORDER_THICKNESS/2, gameAreaSize - BORDER_THICKNESS/2);
      ctx.stroke();
    } else {
      // Normal border drawing with dramatic music-reactive inner glow
      ctx.setLineDash([]);

      // Music-reactive glow intensity (use musicVolume which has minimum baseline)
      const glowIntensity = musicVolume; // 0.2 minimum, 1 at peak

      // Main border with dramatic inner glow
      const mainGlowSize = 15 + glowIntensity * 25; // 15-40px based on music (much more visible)

      ctx.strokeStyle = currentColors.foreground;
      ctx.lineWidth = BORDER_THICKNESS;
      ctx.shadowBlur = mainGlowSize;
      ctx.shadowColor = currentColors.foreground;
      // Draw border centered at BORDER_THICKNESS/2 from edges so full width is visible
      ctx.strokeRect(BASE_BORDER_THICKNESS/2, BASE_BORDER_THICKNESS/2, 800 - BASE_BORDER_THICKNESS, 800 - BASE_BORDER_THICKNESS);
    }

    // Clear shadow for other elements
    ctx.shadowBlur = 0;


    // Draw comet trails first (behind everything) - enhanced in spectator mode
    const currentTime = Date.now();

    // Draw ball trail
    if (gameState.trails?.ball?.length > 1) {
      for (let i = 0; i < gameState.trails.ball.length - 1; i++) {
        const point = gameState.trails.ball[i];
        const age = currentTime - point.timestamp;
        const alpha = Math.max(0, 1 - (age / 750)); // Fade over 750ms (half length)

        if (alpha > 0) {
          // Ball trail visibility - barely visible
          const ballTrailOpacity = 0.02;
          ctx.globalAlpha = alpha * ballTrailOpacity;
          ctx.fillStyle = currentColors.foreground;

          // Keep full thickness for longer, then gradually thin out
          const thicknessFactor = alpha > 0.4 ? 1.0 : (0.3 + alpha * 0.7);
          const trailSize = gameState.ball.size * thicknessFactor;
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
    const renderVerticalPaddleTrail = (trail: TrailPoint[], paddleX: number, color: string) => {
      if (trail.length > 1) {
        const maxAge = 200; // Match filtering time - quick fade
        for (let i = 0; i < trail.length - 1; i++) {
          const point = trail[i];
          const age = currentTime - point.timestamp;
          // Skip very recent points (last 50ms) to avoid drawing on top of the paddle itself
          if (age < 50) continue;
          const alpha = Math.max(0, 1 - (age / maxAge)); // Fade over 200ms to match trail retention


          if (alpha > 0 && point.width && point.height && point.width > 0 && point.height > 0) {
            // Paddle trail visibility - subtle but visible
            const paddleTrailOpacity = 0.04;
            ctx.globalAlpha = alpha * paddleTrailOpacity;
            ctx.fillStyle = color;

            // Keep same width as paddle throughout the trail (no thinning)
            ctx.fillRect(
              paddleX - point.width / 2,
              point.y - point.height / 2,
              point.width,
              point.height
            );
          }
        }
      }
    };

    const renderHorizontalPaddleTrail = (trail: TrailPoint[], paddleY: number, color: string) => {
      if (trail.length > 1) {
        const maxAge = 200; // Match filtering time - quick fade
        for (let i = 0; i < trail.length - 1; i++) {
          const point = trail[i];
          const age = currentTime - point.timestamp;
          // Skip very recent points (last 50ms) to avoid drawing on top of the paddle itself
          if (age < 50) continue;
          const alpha = Math.max(0, 1 - (age / maxAge)); // Fade over 200ms to match trail retention

          if (alpha > 0 && point.width && point.height && point.width > 0 && point.height > 0) {
            // Paddle trail visibility - subtle but visible
            const paddleTrailOpacity = 0.04;
            ctx.globalAlpha = alpha * paddleTrailOpacity;
            ctx.fillStyle = color;

            // Keep same width as paddle throughout the trail (no thinning)
            ctx.fillRect(
              point.x - point.width / 2,
              paddleY - point.height / 2,
              point.width,
              point.height
            );
          }
        }
      }
    };

    // Draw all paddles - simple and clean
    // Get player side and color FIRST before using them
    const currentPlayerSide = multiplayerStateRef.current?.playerSide;
    const humanPlayerColor = getHumanPlayerColor(gameState.colorIndex);

    // Determine paddle colors for trails (must be after currentPlayerSide and humanPlayerColor)
    const getColorForSide = (side: string) => {
      const isHumanControlled = (gameState.gameMode === 'multiplayer' && currentPlayerSide === side) ||
                                (gameState.gameMode === 'player' && side === 'right');
      return isHumanControlled ? humanPlayerColor : currentColors.foreground;
    };

    // Helper function to draw a paddle
    const drawPaddle = (paddle: any, side: string, x: number, y: number) => {
      // Don't draw paddles on start screen or connection screens
      if (gameState.showStartScreen) {
        return;
      }

      // Use fallback dimensions if paddle dimensions are invalid (multiplayer server may not send them)
      const width = paddle.width || (side === 'left' || side === 'right' ? PADDLE_THICKNESS : PADDLE_LENGTH);
      const height = paddle.height || (side === 'left' || side === 'right' ? PADDLE_LENGTH : PADDLE_THICKNESS);

      // Detect size changes and start animation for this specific paddle
      const prevSize = previousPaddleSizesRef.current[side as 'left' | 'right' | 'top' | 'bottom'];
      const sizeChanged = prevSize.height !== height || prevSize.width !== width;

      if (sizeChanged) {
        console.log(`[PADDLE ANIM] ${side} paddle size changed: ${prevSize.height}x${prevSize.width} -> ${height}x${width}`);
        const anim = paddleSizeAnimationsRef.current[side as 'left' | 'right' | 'top' | 'bottom'];
        if (!anim || anim.startTime < Date.now() - 500) {
          // Start new animation for this paddle
          paddleSizeAnimationsRef.current[side as 'left' | 'right' | 'top' | 'bottom'] = {
            startTime: Date.now(),
            startSize: { ...prevSize },
            targetSize: { height, width },
            startPosition: { x, y },
            duration: 400 // 400ms bouncy animation
          };
          console.log(`[PADDLE ANIM] Started animation for ${side} paddle`);
        }
        // Update previous size
        previousPaddleSizesRef.current[side as 'left' | 'right' | 'top' | 'bottom'] = { height, width };
      }

      // Calculate animation progress for this specific paddle
      let animatedWidth = width;
      let animatedHeight = height;
      const anim = paddleSizeAnimationsRef.current[side as 'left' | 'right' | 'top' | 'bottom'];

      if (anim && anim.startTime > 0) {
        const elapsed = Date.now() - anim.startTime;
        const progress = Math.min(elapsed / anim.duration, 1);

        if (progress < 1) {
          // Bouncy easing with overshoot (elasticOut)
          const eased = progress < 0.5
            ? 0.5 * Math.pow(2 * progress, 3)
            : 0.5 * (Math.pow(2 * progress - 2, 3) + 2);

          // Add bounce overshoot
          const bounce = Math.sin(progress * Math.PI * 1.5) * 0.15 * (1 - progress);
          const finalProgress = eased + bounce;

          // Interpolate size
          animatedWidth = anim.startSize.width + (anim.targetSize.width - anim.startSize.width) * finalProgress;
          animatedHeight = anim.startSize.height + (anim.targetSize.height - anim.startSize.height) * finalProgress;
        } else {
          // Animation complete
          paddleSizeAnimationsRef.current[side as 'left' | 'right' | 'top' | 'bottom'] = null;
        }
      }

      const isHumanControlled = (gameState.gameMode === 'multiplayer' && currentPlayerSide === side) ||
                                (gameState.gameMode === 'player' && side === 'right');
      const paddleColor = isHumanControlled ? humanPlayerColor : currentColors.foreground;

      // Calculate center point and grow from center
      const centerX = x + width / 2;
      const centerY = y + height / 2;

      // Use animated dimensions and grow from center
      const scaledX = centerX - animatedWidth / 2;
      const scaledY = centerY - animatedHeight / 2;

      // Draw music-reactive glow effect
      ctx.shadowBlur = 3 + musicData.volume * 7; // Subtle glow 3-10px
      ctx.shadowColor = paddleColor;

      ctx.globalAlpha = 1; // Ensure paddles are fully opaque
      ctx.fillStyle = paddleColor;
      // Round to whole pixels to prevent sub-pixel anti-aliasing flicker
      ctx.fillRect(Math.round(scaledX), Math.round(scaledY), Math.round(animatedWidth), Math.round(animatedHeight));

      // Reset shadow
      ctx.shadowBlur = 0;
    };

    // Draw all four paddles FIRST
    drawPaddle(gameState.paddles.left, 'left', gameState.paddles.left.x, gameState.paddles.left.y);
    drawPaddle(gameState.paddles.right, 'right', gameState.paddles.right.x, gameState.paddles.right.y);
    if (gameState.paddles.top) {
      drawPaddle(gameState.paddles.top, 'top', gameState.paddles.top.x, gameState.paddles.top.y);
    }
    if (gameState.paddles.bottom) {
      drawPaddle(gameState.paddles.bottom, 'bottom', gameState.paddles.bottom.x, gameState.paddles.bottom.y);
    }

    // Render paddle trails AFTER paddles (so they appear on top)
    // Render left and right paddle trails (vertical paddles) - use actual paddle center positions
    if (gameState.trails?.leftPaddle) {
      renderVerticalPaddleTrail(gameState.trails.leftPaddle, gameState.paddles.left.x + gameState.paddles.left.width / 2, getColorForSide('left'));
    }
    if (gameState.trails?.rightPaddle) {
      renderVerticalPaddleTrail(gameState.trails.rightPaddle, gameState.paddles.right.x + gameState.paddles.right.width / 2, getColorForSide('right'));
    }

    // Render top and bottom paddle trails (horizontal paddles) - use actual paddle center positions
    if (gameState.paddles.top && gameState.trails?.topPaddle) {
      renderHorizontalPaddleTrail(gameState.trails.topPaddle, gameState.paddles.top.y + gameState.paddles.top.height / 2, getColorForSide('top'));
    }
    if (gameState.paddles.bottom && gameState.trails?.bottomPaddle) {
      renderHorizontalPaddleTrail(gameState.trails.bottomPaddle, gameState.paddles.bottom.y + gameState.paddles.bottom.height / 2, getColorForSide('bottom'));
    }

    // Reset alpha for normal rendering
    ctx.globalAlpha = 1;

    // Draw ball - using dynamic color (hide during pause)
    if (!gameState.isPaused) {
      // Check if ball should be invisible
      const invisibleEffect = gameState.activeEffects?.find(e => e.type === 'invisible_ball');
      if (!invisibleEffect) {
        // 🌀 Check if ball is curved (spinning)
        const isCurved = gameState.ball.spin && Math.abs(gameState.ball.spin) > 2.5;

        // Draw music-reactive glow effect for ball
        ctx.shadowBlur = 3 + musicData.volume * 7; // Subtle glow 3-10px
        ctx.shadowColor = isCurved ? '#ff0000' : currentColors.foreground;

        ctx.fillStyle = isCurved ? '#ff0000' : currentColors.foreground; // 🌀 Red when curved
        ctx.fillRect(gameState.ball.x, gameState.ball.y, gameState.ball.size, gameState.ball.size);

        // Reset shadow
        ctx.shadowBlur = 0;
      } else {
        // Draw faint outline for invisible ball
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = currentColors.foreground;
        ctx.lineWidth = 1 * scaleFactor;
        ctx.strokeRect(gameState.ball.x, gameState.ball.y, gameState.ball.size, gameState.ball.size);
        ctx.globalAlpha = 1;
      }


      // [TARGET] Draw Super Striker aiming line
      if (gameState.ball.isAiming) {
        const ballCenterX = gameState.ball.x + gameState.ball.size / 2;
        const ballCenterY = gameState.ball.y + gameState.ball.size / 2;
        const aimTargetX = gameState.ball.aimTargetX || ballCenterX + (100 * scaleFactor);
        const aimTargetY = gameState.ball.aimTargetY || ballCenterY;

        // Draw aiming line with pulsing effect
        const aimElapsed = Date.now() - gameState.ball.aimStartTime;
        const pulse = Math.sin(aimElapsed * 0.01) * 0.3 + 0.7; // Pulsing alpha

        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#ff4500'; // Orange aim line
        ctx.lineWidth = 3 * scaleFactor;
        const dashPattern = [10 * scaleFactor, 5 * scaleFactor];
        ctx.setLineDash(dashPattern); // Dashed line
        ctx.beginPath();
        ctx.moveTo(ballCenterX, ballCenterY);
        ctx.lineTo(aimTargetX, aimTargetY);
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash

        // Draw target crosshair (vertical line only)
        ctx.strokeStyle = '#ff4500';
        ctx.lineWidth = 2 * scaleFactor;
        ctx.beginPath();
        ctx.moveTo(aimTargetX, aimTargetY - (10 * scaleFactor));
        ctx.lineTo(aimTargetX, aimTargetY + (10 * scaleFactor));
        ctx.stroke();

        ctx.globalAlpha = 1; // Reset alpha
      }
    }

    // 🟠 Draw extra balls (for multi-ball effect)
    if (!gameState.isPaused) {
      (gameState.extraBalls || []).forEach((extraBall, index) => {
        if (index === 0 && gameState.extraBalls.length > 0) {
          console.log(`[MULTIBALL] Rendering ${gameState.extraBalls.length} extra balls`);
        }
        ctx.fillStyle = currentColors.foreground;
        ctx.fillRect(extraBall.x, extraBall.y, extraBall.size, extraBall.size);
      });
    }

    // 🪞 Draw mirror balls (for mirror mode effect)
    if (!gameState.isPaused && gameState.ball.isMirror && gameState.ball.mirrorBalls && gameState.ball.mirrorBalls.length > 0) {
      gameState.ball.mirrorBalls.forEach((mirrorBall: any) => {
        // Draw mirror ball with semi-transparent effect
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = currentColors.foreground;
        ctx.fillRect(mirrorBall.x, mirrorBall.y, gameState.ball.size, gameState.ball.size);

        // Draw subtle glow to distinguish from main ball
        ctx.shadowColor = currentColors.foreground;
        ctx.shadowBlur = 8;
        ctx.fillRect(mirrorBall.x, mirrorBall.y, gameState.ball.size, gameState.ball.size);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
      });
    }

    // 🧱 Draw Arkanoid bricks
    if (!gameState.isPaused && gameState.arkanoidActive && gameState.arkanoidBricks && Array.isArray(gameState.arkanoidBricks)) {
      gameState.arkanoidBricks.forEach((brick: any) => {
        if (brick && typeof brick.x === 'number' && typeof brick.y === 'number' &&
            typeof brick.width === 'number' && typeof brick.height === 'number') {
          // Draw brick with color
          ctx.fillStyle = brick.color || '#ff4500';
          ctx.fillRect(brick.x, brick.y, brick.width, brick.height);

          // Draw brick border/outline
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1 * scaleFactor;
          ctx.strokeRect(brick.x, brick.y, brick.width, brick.height);
        }
      });
    }

    // 🔫 Draw machine gun balls
    if (!gameState.isPaused && gameState.machineGunBalls && Array.isArray(gameState.machineGunBalls)) {
      const mgBalls = gameState.machineGunBalls;
      if (mgBalls.length > 0) {
        mgBalls.forEach((mgBall: any, index: number) => {
          if (mgBall && typeof mgBall.x === 'number' && typeof mgBall.y === 'number' && typeof mgBall.size === 'number') {
            ctx.fillStyle = '#ff8800'; // Orange machine gun balls
            ctx.fillRect(mgBall.x, mgBall.y, mgBall.size, mgBall.size);
          }
        });
      }
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
        const size = Math.max(1 * scaleFactor, 25 * scaleFactor * pulse * secondaryPulse); // Ensure positive size

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
          ctx.lineWidth = 3 * scaleFactor;

          // Draw multiple concentric rotating rings
          for (let ring = 0; ring < 4; ring++) {
            const ringRadius = (size * 0.3) + ring * (12 * scaleFactor);
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
            const particleRadius = size * 0.6 + Math.sin(force.animationPhase * 3 + p) * (8 * scaleFactor);
            const px = centerX + Math.cos(particleAngle) * particleRadius;
            const py = centerY + Math.sin(particleAngle) * particleRadius;

            ctx.beginPath();
            ctx.arc(px, py, 2 * scaleFactor, 0, Math.PI * 2);
            ctx.fill();
          }

        } else {
          // Repulsor: Outward explosive energy with pink/red color
          ctx.strokeStyle = force.color;
          ctx.fillStyle = force.color;
          ctx.lineWidth = 3 * scaleFactor;

          // Draw explosive radiating spikes
          for (let spike = 0; spike < 16; spike++) {
            const angle = (spike / 16) * Math.PI * 2 + force.animationPhase;
            const innerRadius = size * 0.2;
            const outerRadius = size * 0.8 + Math.sin(force.animationPhase * 3 + spike * 0.5) * (15 * scaleFactor);

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
            const burstRadius = size * 0.9 + Math.cos(force.animationPhase * 2 + p * 0.7) * (10 * scaleFactor);
            const bx = centerX + Math.cos(burstAngle) * burstRadius;
            const by = centerY + Math.sin(burstAngle) * burstRadius;

            ctx.beginPath();
            ctx.arc(bx, by, 3 * scaleFactor, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Draw influence radius with dynamic opacity
        ctx.globalAlpha = alpha * spawnScale * 0.15 * (pulse * 0.5 + 0.5);
        ctx.strokeStyle = force.color;
        ctx.lineWidth = 2 * scaleFactor;
        const influenceDash = [5 * scaleFactor, 5 * scaleFactor];
        ctx.setLineDash(influenceDash);
        ctx.beginPath();
        ctx.arc(centerX, centerY, force.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.globalAlpha = 1;
      });
    }

    // Draw labyrinth maze walls if active
    if (gameState.labyrinthActive && gameState.mazeWalls) {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.8;

      gameState.mazeWalls.forEach((wall: any) => {
        ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
      });

      ctx.globalAlpha = 1;
    }

    // Draw labyrinth coins if active
    if (gameState.labyrinthActive && gameState.labyrinthCoins) {
      const time = cachedTimeRef.current * 0.005;
      const pulseIndex = Math.floor(time % 60);
      const pulse = PRECALC_CONSTANTS.pulseValues[pulseIndex];
      const now = Date.now();

      gameState.labyrinthCoins.forEach((coin: any) => {
        ctx.save();

        const centerX = coin.x + 8;
        const centerY = coin.y + 8;

        if (coin.collected && coin.collectedAt) {
          // Spin animation: 3 full rotations over 800ms with ease-out
          const elapsed = now - coin.collectedAt;
          const duration = 800; // 800ms total animation
          const maxRotations = 3 * Math.PI * 2; // 3 full spins

          if (elapsed < duration) {
            // Ease-out cubic curve: 1 - (1-t)^3
            const t = elapsed / duration;
            const easeOut = 1 - Math.pow(1 - t, 3);
            const rotation = easeOut * maxRotations;

            // Calculate scale for 3D effect (cos gives width, simulating rotation around Y-axis)
            const scaleX = Math.abs(Math.cos(rotation));

            // Fade out during last 200ms
            const fadeStart = duration - 200;
            const alpha = elapsed > fadeStart ? 1 - ((elapsed - fadeStart) / 200) : 1;

            ctx.globalAlpha = alpha;
            ctx.translate(centerX, centerY);
            ctx.scale(scaleX, 1);
            ctx.translate(-centerX, -centerY);

            // Draw coin
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
            ctx.fill();

            // Draw shine (only visible when facing forward)
            if (scaleX > 0.3) {
              ctx.fillStyle = '#ffff00';
              ctx.beginPath();
              ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          // Don't render after animation completes
        } else if (!coin.collected) {
          // Normal static coin rendering
          ctx.globalAlpha = pulse;

          // Draw coin as a circle
          ctx.fillStyle = '#ffd700'; // Gold color
          ctx.beginPath();
          ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
          ctx.fill();

          // Draw inner shine
          ctx.fillStyle = '#ffff00';
          ctx.beginPath();
          ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });
    }

    // Draw black holes if active
    if (gameState.blackHoles && gameState.blackHoles.length > 0) {
      const time = cachedTimeRef.current * 0.01;

      gameState.blackHoles.forEach((hole: any) => {
        ctx.save();

        // Draw event horizon (outer dark circle with pulsing)
        const pulse = 0.9 + Math.sin(time * 2) * 0.1;
        const gradient = ctx.createRadialGradient(hole.x, hole.y, 0, hole.x, hole.y, hole.radius * pulse);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
        gradient.addColorStop(0.6, 'rgba(30, 0, 60, 0.8)');
        gradient.addColorStop(0.85, 'rgba(138, 43, 226, 0.4)');
        gradient.addColorStop(1, 'rgba(138, 43, 226, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(hole.x, hole.y, hole.radius * pulse, 0, Math.PI * 2);
        ctx.fill();

        // Draw accretion disk (swirling rings)
        ctx.globalAlpha = 0.6;
        for (let i = 0; i < 3; i++) {
          const ringRadius = hole.radius * 0.7 + i * 8;
          const ringOffset = (time * (i + 1) * 0.5) % (Math.PI * 2);

          ctx.strokeStyle = `rgba(138, 43, 226, ${0.5 - i * 0.15})`;
          ctx.lineWidth = 2;
          ctx.beginPath();

          // Draw spiral segments
          for (let angle = 0; angle < Math.PI * 2; angle += 0.3) {
            const totalAngle = angle + ringOffset;
            const x = hole.x + Math.cos(totalAngle) * ringRadius;
            const y = hole.y + Math.sin(totalAngle) * ringRadius;

            if (angle === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
          ctx.stroke();
        }

        // Draw singularity (center black core)
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(hole.x, hole.y, hole.radius * 0.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });
    }

    // Draw pickups if they exist
    gameState.pickups?.forEach((pickup) => {
      const time = cachedTimeRef.current * 0.005;
      // [ROCKET] OPTIMIZED pulse using precalculated values
      const pulseIndex = Math.floor(time % 60);
      const pulse = PRECALC_CONSTANTS.pulseValues[pulseIndex];

      ctx.save();

      // Add disharmonic shake effect - increased multiplier for more visible shake
      let shakeX = (Math.random() - 0.5) * musicData.disharmonic * 25;
      let shakeY = (Math.random() - 0.5) * musicData.disharmonic * 25;

      // Detroit mode: Enhanced shake on kick drum
      if (gameState.detroitMode) {
        const timeSinceStart = Date.now() - (gameState.detroitStartTime || 0);
        const beatDuration = 461; // 130 BPM
        const beatPhase = (timeSinceStart % beatDuration) / beatDuration;
        const step16th = Math.floor(timeSinceStart / (beatDuration / 4)) % 16;

        // Kick drum shake (every 4 steps)
        if (step16th % 4 === 0 && beatPhase < 0.1) {
          const kickShakeIntensity = (1 - beatPhase / 0.1) * 15;
          shakeX += (Math.random() - 0.5) * kickShakeIntensity;
          shakeY += (Math.random() - 0.5) * kickShakeIntensity;
        }
      }

      ctx.translate(shakeX, shakeY);

      ctx.globalAlpha = pulse;

      // Draw pixelated pattern with NO gaps between pixels
      const drawPixelatedPattern = (pattern: string, x: number, y: number, size: number, color: string) => {
        // Use 8x8 grid for patterns with 2x2 pixel size (16x16 total) - allows for more detail
        const gridSize = 8;
        const pixelSize = 2; // 2x2 pixel size for more detail

        // Round coordinates to prevent sub-pixel rendering gaps
        const roundedX = Math.round(x);
        const roundedY = Math.round(y);

        ctx.fillStyle = color;

        // [ROCKET] OPTIMIZED pattern rendering using precalculated arrays
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
          'star': 'star',
          'gravity': 'gravity',
          'target': 'target',
          'sticky': 'sticky',
          'bullets': 'bullets',
          'expand': 'expand',
          'swap': 'swap',
          'wall': 'wall',
          'clock': 'clock',
          'portal': 'portal',
          'mirror': 'mirror',
          'quantum': 'quantum',
          'vortex': 'vortex',
          'lightning': 'lightning',
          'fade': 'fade',
          'mine': 'mine',
          'shuffle': 'shuffle',
          'detroit': 'detroit',
          'pacman': 'pacman',
          'banana': 'banana',
          'bounce': 'bounce',
          'wobble': 'wobble',
          'magnet': 'magnet',
          'balloon': 'balloon',
          'shake': 'shake',
          'confetti': 'confetti',
          'hypno': 'hypno',
          'conga': 'conga',
          'bricks': 'bricks',
          'maze': 'labyrinth'
        };

        const precalcPattern = PRECALC_PICKUP_PATTERNS[patternMap[pattern] as keyof typeof PRECALC_PICKUP_PATTERNS];
        if (precalcPattern) {
          // [ROCKET] INSTANT rendering using precalculated 2D boolean array (no nested calculations)
          // Scale 4x4 pattern to 8x8 by doubling each pixel
          for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
              if (precalcPattern[row][col]) {
                // Draw 2x2 block for each original pixel (scaling from 4x4 to 8x8)
                ctx.fillRect(roundedX + col * 2 * pixelSize, roundedY + row * 2 * pixelSize, pixelSize * 2, pixelSize * 2);
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
                  ctx.fillRect(roundedX + col * pixelSize, roundedY + row * pixelSize, pixelSize, pixelSize);
                }
              }
            }
            break;

          case 'waves': // Slow down - wavy lines
            for (let row = 0; row < gridSize; row++) {
              for (let col = 0; col < gridSize; col++) {
                if (row === 3 || row === 6 || row === 9) {
                  if (Math.sin(col * 0.8) > 0) {
                    ctx.fillRect(roundedX + col * pixelSize, roundedY + row * pixelSize, pixelSize, pixelSize);
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
                  ctx.fillRect(roundedX + col * pixelSize, roundedY + row * pixelSize, pixelSize, pixelSize);
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
                  ctx.fillRect(roundedX + col * pixelSize, roundedY + row * pixelSize, pixelSize, pixelSize);
                }
              }
            }
            break;

          case 'arrow_up': // Grow paddle - up arrow
            for (let row = 0; row < gridSize; row++) {
              for (let col = 0; col < gridSize; col++) {
                if ((row >= 2 && row <= 6 && col >= 5 && col <= 7) || // Stem
                    (row >= 0 && row <= 4 && Math.abs(col - 6) <= row)) { // Arrow head
                  ctx.fillRect(roundedX + col * pixelSize, roundedY + row * pixelSize, pixelSize, pixelSize);
                }
              }
            }
            break;

          case 'arrow_down': // Shrink paddle - down arrow
            for (let row = 0; row < gridSize; row++) {
              for (let col = 0; col < gridSize; col++) {
                if ((row >= 2 && row <= 8 && col >= 5 && col <= 7) || // Stem
                    (row >= 6 && row <= 10 && Math.abs(col - 6) <= (10 - row))) { // Arrow head
                  ctx.fillRect(roundedX + col * pixelSize, roundedY + row * pixelSize, pixelSize, pixelSize);
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
                  ctx.fillRect(roundedX + col * pixelSize, roundedY + row * pixelSize, pixelSize, pixelSize);
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
                  ctx.fillRect(roundedX + col * pixelSize, roundedY + row * pixelSize, pixelSize, pixelSize);
                }
              }
            }
            break;

          case 'plus': // Multi ball - plus sign
            for (let row = 0; row < gridSize; row++) {
              for (let col = 0; col < gridSize; col++) {
                if ((row >= 4 && row <= 7 && col >= 1 && col <= 10) || // Horizontal
                    (col >= 4 && col <= 7 && row >= 1 && row <= 10)) { // Vertical
                  ctx.fillRect(roundedX + col * pixelSize, roundedY + row * pixelSize, pixelSize, pixelSize);
                }
              }
            }
            break;

          case 'cross': // Freeze - X pattern
            for (let row = 0; row < gridSize; row++) {
              for (let col = 0; col < gridSize; col++) {
                if (Math.abs(row - col) <= 1 || Math.abs(row - (gridSize - col - 1)) <= 1) {
                  ctx.fillRect(roundedX + col * pixelSize, roundedY + row * pixelSize, pixelSize, pixelSize);
                }
              }
            }
            break;

          case 'stripes': // Super speed - diagonal stripes
            for (let row = 0; row < gridSize; row++) {
              for (let col = 0; col < gridSize; col++) {
                if ((row + col) % 3 === 0) {
                  ctx.fillRect(roundedX + col * pixelSize, roundedY + row * pixelSize, pixelSize, pixelSize);
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
                  ctx.fillRect(roundedX + col * pixelSize, roundedY + row * pixelSize, pixelSize, pixelSize);
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
                  ctx.fillRect(roundedX + col * pixelSize, roundedY + row * pixelSize, pixelSize, pixelSize);
                }
              }
            }
            break;

          case 'wind': // Wind - curved lines representing wind flow
            for (let row = 0; row < gridSize; row++) {
              for (let col = 0; col < gridSize; col++) {
                // Create flowing wind lines
                if ((row === 2 || row === 5 || row === 8) && col >= 1 && col <= 10) {
                  // Wavy horizontal lines
                  const wave = Math.sin(col * 0.8 + row * 0.5) * 1.5;
                  const adjustedRow = row + Math.round(wave);
                  if (adjustedRow >= 0 && adjustedRow < gridSize) {
                    ctx.fillRect(x + col * pixelSize, y + adjustedRow * pixelSize, pixelSize, pixelSize);
                  }
                }
                // Add small particles/dots to represent wind
                if ((col === 2 || col === 5 || col === 8 || col === 11) &&
                    (row === 3 || row === 6 || row === 9)) {
                  ctx.fillRect(roundedX + col * pixelSize, roundedY + row * pixelSize, pixelSize, pixelSize);
                }
              }
            }
            break;
        }
      };

      // Draw the pixelated pattern with music-reactive glow
      // Map pickup type to pattern from PICKUP_TYPES
      const pickupTypeData = PICKUP_TYPES.find(p => p.type === pickup.type);
      const pattern = pickupTypeData?.pattern || 'circle'; // Default to circle if type not found

      // Add music-reactive glow to pickups
      ctx.shadowBlur = 3 + musicData.volume * 7; // Subtle glow 3-10px
      ctx.shadowColor = currentColors.foreground;

      drawPixelatedPattern(pattern, pickup.x, pickup.y, pickup.size, currentColors.foreground);

      // Clear shadow
      ctx.shadowBlur = 0;

      ctx.restore();
    });

    // Draw coins (reuse 'now' from labyrinth coins above)
    if (gameState.coins && gameState.coins.length > 0) {
      console.log(`[COINS] Rendering ${gameState.coins.length} coins:`, gameState.coins.slice(0, 2));
    }
    (gameState.coins || []).forEach((coin: any) => {
      const time = cachedTimeRef.current * 0.008;

      // Check if coin should be visible yet (sequential spawn)
      const timeSinceCreated = now - coin.createdAt;
      const spawnDelay = coin.spawnDelay || 0;
      if (timeSinceCreated < spawnDelay) {
        return; // Don't render yet
      }

      // Play plopp sound once when coin becomes visible
      if (!coinSoundsPlayedRef.current.has(coin.id) && timeSinceCreated >= spawnDelay && timeSinceCreated < spawnDelay + 50) {
        coinSoundsPlayedRef.current.add(coin.id);
        // Use simple beep for clean sound - no effects
        const pitch = 950 + Math.random() * 100; // Random 950-1050Hz
        playBeep(pitch, 0.04, 'normal');
      }

      ctx.save();

      const coinCenterX = coin.x + coin.size / 2;
      const coinCenterY = coin.y + coin.size / 2;

      // Scale-in animation when spawning
      const spawnDuration = 400; // 400ms spawn animation
      const timeSinceSpawn = timeSinceCreated - spawnDelay;
      let spawnScale = 1;
      if (timeSinceSpawn < spawnDuration) {
        const t = timeSinceSpawn / spawnDuration;
        // Elastic bounce: overshoots then settles
        const bounce = Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
        spawnScale = bounce;
      }

      if (coin.collected && coin.collectedAt) {
        // Spin animation: 3 full rotations over 800ms with ease-out
        const elapsed = now - coin.collectedAt;
        const duration = 800; // 800ms total animation
        const maxRotations = 3 * Math.PI * 2; // 3 full spins

        if (elapsed < duration) {
          // Ease-out cubic curve: 1 - (1-t)^3
          const t = elapsed / duration;
          const easeOut = 1 - Math.pow(1 - t, 3);
          const rotation = easeOut * maxRotations;

          // Calculate scale for 3D effect (cos gives width, simulating rotation around Y-axis)
          const scaleX = Math.abs(Math.cos(rotation));

          // Fade out during last 200ms
          const fadeStart = duration - 200;
          const alpha = elapsed > fadeStart ? 1 - ((elapsed - fadeStart) / 200) : 1;

          ctx.globalAlpha = alpha;
          ctx.translate(coinCenterX, coinCenterY);
          ctx.scale(scaleX * spawnScale, 1 * spawnScale);
          ctx.translate(-coinCenterX, -coinCenterY);

          // Draw pixelated coin
          const pixelSize = 4; // Match pong404 pixel size
          const gridSize = Math.floor(coin.size / pixelSize);
          ctx.fillStyle = '#FFD700'; // Always gold color for coins

          for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
              const pixelX = coin.x + col * pixelSize;
              const pixelY = coin.y + row * pixelSize;

              const centerX = gridSize / 2;
              const centerY = gridSize / 2;
              const distance = Math.sqrt(Math.pow(col - centerX, 2) + Math.pow(row - centerY, 2));

              // Outer circle (coin border)
              if (distance <= gridSize * 0.45 && distance >= gridSize * 0.35) {
                ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize);
              }
              // Inner pattern (only visible when facing forward)
              else if (distance <= gridSize * 0.3 && scaleX > 0.3) {
                const relX = col - centerX;
                const relY = row - centerY;
                if (Math.abs(relX) <= 1 || (Math.abs(relY) <= 1 && Math.abs(relX) <= 2)) {
                  ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize);
                }
              }
            }
          }
        }
        // Don't render after animation completes
      } else if (!coin.collected) {
        // Normal coin rendering with bounce
        const bounce = Math.sin(time + coin.x * 0.01) * 2;
        const pulse = 0.9 + Math.sin(time * 2) * 0.1;

        ctx.globalAlpha = pulse;

        // Apply spawn scale
        ctx.translate(coinCenterX, coinCenterY);
        ctx.scale(spawnScale, spawnScale);
        ctx.translate(-coinCenterX, -coinCenterY);

        const pixelSize = 4; // Match pong404 pixel size
        const gridSize = Math.floor(coin.size / pixelSize);
        ctx.fillStyle = '#FFD700'; // Always gold color for coins

        for (let row = 0; row < gridSize; row++) {
          for (let col = 0; col < gridSize; col++) {
            const pixelX = coin.x + col * pixelSize;
            const pixelY = coin.y + row * pixelSize + bounce;

            const centerX = gridSize / 2;
            const centerY = gridSize / 2;
            const distance = Math.sqrt(Math.pow(col - centerX, 2) + Math.pow(row - centerY, 2));

            // Outer circle (coin border)
            if (distance <= gridSize * 0.45 && distance >= gridSize * 0.35) {
              ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize);
            }
            // Inner circle pattern (coin center with "$" pattern)
            else if (distance <= gridSize * 0.3) {
              const relX = col - centerX;
              const relY = row - centerY;
              if (Math.abs(relX) <= 1 || (Math.abs(relY) <= 1 && Math.abs(relX) <= 2)) {
                ctx.fillRect(pixelX, pixelY, pixelSize, pixelSize);
              }
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
      const radius = Math.max(0, progress * (50 * scaleFactor)); // Expanding circle (prevent negative)
      const alpha = Math.max(0, 1 - progress); // Fading out
      const pickupCenter = 12 * scaleFactor;

      ctx.globalAlpha = alpha;
      ctx.strokeStyle = currentColors.foreground;
      ctx.lineWidth = 3 * scaleFactor;

      // Draw expanding circle
      ctx.beginPath();
      ctx.arc(gameState.pickupEffect.x + pickupCenter, gameState.pickupEffect.y + pickupCenter, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Draw sparkle effect
      const sparkleSize = 4 * scaleFactor;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const sparkleX = gameState.pickupEffect.x + pickupCenter + Math.cos(angle) * radius * 0.7;
        const sparkleY = gameState.pickupEffect.y + pickupCenter + Math.sin(angle) * radius * 0.7;
        ctx.fillStyle = currentColors.foreground;
        ctx.fillRect(sparkleX - (sparkleSize / 2), sparkleY - (sparkleSize / 2), sparkleSize, sparkleSize);
      }

      ctx.globalAlpha = 1;
    }

    // Draw scores (classic Pong font style) - using pixelated arcade font and dynamic color
    const scoreFontSize = Math.round(32 * scaleFactor);
    ctx.font = `bold ${scoreFontSize}px "Press Start 2P", monospace`; // Scaled font for 4 players
    ctx.fillStyle = currentColors.foreground; // Use dynamic color for scores too
    ctx.textAlign = 'center';

    // 4-player score positions - 48px (scaled) from paddle edge towards center
    const scoreOffset = 48 * scaleFactor;
    const leftPaddleRight = gameState.paddles.left.x + gameState.paddles.left.width;
    const leftScoreX = leftPaddleRight + scoreOffset; // Scaled offset from left paddle's right edge
    const rightPaddleLeft = gameState.paddles.right.x;
    const rightScoreX = rightPaddleLeft - scoreOffset; // Scaled offset from right paddle's left edge
    const topPaddleBottom = gameState.paddles.top.y + gameState.paddles.top.height;
    const topScoreY = topPaddleBottom + scoreOffset; // Scaled offset below top paddle
    const bottomPaddleTop = gameState.paddles.bottom.y;
    const bottomScoreY = bottomPaddleTop - scoreOffset; // Scaled offset above bottom paddle

    // Display all 4 player scores with padding
    const leftScore = gameState.score.left.toString().padStart(2, '0');
    const rightScore = gameState.score.right.toString().padStart(2, '0');
    const topScore = gameState.score.top.toString().padStart(2, '0');
    const bottomScore = gameState.score.bottom.toString().padStart(2, '0');

    // Left player score (left side, middle height)
    ctx.textAlign = 'center';
    ctx.shadowBlur = 2 * scaleFactor; // Scaled glow on scores
    ctx.shadowColor = currentColors.foreground;
    ctx.fillText(leftScore, leftScoreX, playFieldHeight / 2);

    // Right player score (right side, middle height)
    ctx.fillText(rightScore, rightScoreX, playFieldHeight / 2);

    // Top player score (center, top)
    ctx.fillText(topScore, playFieldWidth / 2, topScoreY);

    // Bottom player score (center, bottom)
    ctx.fillText(bottomScore, playFieldWidth / 2, bottomScoreY);
    ctx.shadowBlur = 0;

    // 📊 FPS Counter (top-right corner) - should show 60 FPS consistently
    const fpsFontSize = Math.round(12 * scaleFactor);
    ctx.font = `bold ${fpsFontSize}px "Press Start 2P", monospace`;
    ctx.textAlign = 'right';
    const fpsDisplay = fpsRef.current === 0 ? 60 : fpsRef.current; // Show 60 during startup

    // Draw FPS counter (only if enabled with 'P' key)
    if (showFPS) {
      // Color code FPS - green for 60, yellow for 45-59, red for below 45
      ctx.shadowBlur = 4 * scaleFactor; // Scaled glow
      if (fpsDisplay >= 60) {
        ctx.fillStyle = '#00ff00'; // Bright green for perfect 60 FPS
        ctx.shadowColor = '#00ff00';
      } else if (fpsDisplay >= 45) {
        ctx.fillStyle = '#ffff00'; // Yellow for good FPS
        ctx.shadowColor = '#ffff00';
      } else {
        ctx.fillStyle = '#ff0000'; // Red for poor FPS
        ctx.shadowColor = '#ff0000';
      }

      ctx.fillText(`${fpsDisplay} FPS`, playFieldWidth - (20 * scaleFactor), 30 * scaleFactor);
      ctx.shadowBlur = 0;
    }

    // Reset color back to foreground for other elements
    ctx.fillStyle = currentColors.foreground;

    // [TROPHY] WINNER ANNOUNCEMENT [TROPHY]
    if (gameState.gameEnded && gameState.winner) {
      // Animated winner display with pulsing effects
      ctx.save();
      ctx.translate(playFieldWidth / 2, playFieldHeight / 2);

      // Smooth pulsing animation effect
      const time = cachedTimeRef.current * 0.001;
      const pulseScale = 1 + Math.sin(time * 4) * 0.05; // Faster pulse between 0.95 and 1.05

      ctx.scale(pulseScale, pulseScale);

      // Winner announcement - animated white
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 8 * scaleFactor;
      ctx.shadowColor = '#ffffff';
      const winnerFontSize = Math.round(64 * scaleFactor);
      ctx.font = `bold ${winnerFontSize}px "Press Start 2P", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const winnerText = `${gameState.winner.toUpperCase()} WINS!`;
      ctx.fillText(winnerText, 0, -40 * scaleFactor);

      // Victory subtitle - monochrome white, no outline
      const subtitleFontSize = Math.round(32 * scaleFactor);
      ctx.font = `bold ${subtitleFontSize}px "Press Start 2P", monospace`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText('FIRST TO 11!', 0, 20 * scaleFactor);

      // Victory score display - monochrome white, no outline
      const scoreFinalFontSize = Math.round(24 * scaleFactor);
      ctx.font = `bold ${scoreFinalFontSize}px "Press Start 2P", monospace`;
      ctx.fillStyle = '#ffffff';
      const finalScore = gameState.score[gameState.winner];
      ctx.fillText(`FINAL SCORE: ${finalScore}`, 0, 60 * scaleFactor);

      ctx.restore();


      // Continue button prompt - monochrome
      const continuePromptFontSize = Math.round(16 * scaleFactor);
      ctx.font = `bold ${continuePromptFontSize}px "Press Start 2P", monospace`;
      ctx.fillStyle = '#ffffff';
      ctx.shadowBlur = 8 * scaleFactor;
      ctx.shadowColor = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('PRESS SPACEBAR TO PLAY AGAIN', playFieldWidth / 2, playFieldHeight - (50 * scaleFactor));
      ctx.shadowBlur = 0;
    }

    // Draw robot speech text (only visible during actual gameplay, not on connection/start screens)
    if (robotText && gameState.isPlaying && !gameState.showStartScreen) {
      const robotFontSize = Math.round(20 * scaleFactor);
      ctx.font = `bold ${robotFontSize}px "Press Start 2P", monospace`;
      ctx.fillStyle = currentColors.foreground;
      ctx.shadowBlur = 4 * scaleFactor; // Scaled glow
      ctx.shadowColor = currentColors.foreground;
      ctx.textAlign = 'center';

      // Wrap text to fit within playfield with margins
      const lines = wrapText(ctx, robotText, playFieldWidth - (100 * scaleFactor)); // Scaled margin on each side
      const lineHeight = 30 * scaleFactor; // Scaled space between lines
      const startY = (150 * scaleFactor) - ((lines.length - 1) * lineHeight / 2); // Scaled center position

      // Draw each line of wrapped text
      lines.forEach((line, index) => {
        ctx.fillText(line, playFieldWidth / 2, startY + (index * lineHeight));
      });

      ctx.shadowBlur = 0;
    }

    // Draw track name when switching music
    if (showTrackName && (window as any).generativeMusic) {
      const currentState = (window as any).generativeMusic.currentState;
      const pieces = (window as any).generativeMusic.availablePieces;
      const currentPiece = pieces.find((p: any) => p.id === currentState.currentPieceId);

      if (currentPiece) {
        ctx.save();
        const trackNameSize = Math.round(24 * scaleFactor);
        ctx.font = `bold ${trackNameSize}px "Press Start 2P", monospace`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 15 * scaleFactor;
        ctx.shadowColor = '#00ffff';

        // Fade effect based on time elapsed since showing
        const elapsed = Date.now() - trackNameShowTimeRef.current;
        const fadeProgress = Math.min(1, elapsed / 4000);
        const alpha = fadeProgress > 0.8 ? (1 - (fadeProgress - 0.8) / 0.2) : 1;
        ctx.globalAlpha = alpha;

        const trackText = `♫ ${currentPiece.title.toUpperCase()} ♫`;
        ctx.fillText(trackText, playFieldWidth / 2, 100 * scaleFactor);

        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }

    // Draw active effects status with live countdown and robot voice announcements
    if (gameState.activeEffects.length > 0) {
      const effectsSize = Math.round(20 * scaleFactor);
      ctx.font = `bold ${effectsSize}px "Press Start 2P", monospace`;
      ctx.fillStyle = currentColors.foreground;
      ctx.shadowBlur = 8;
      ctx.shadowColor = currentColors.foreground;
      ctx.textAlign = 'center';

      // Track countdown changes for robot voice announcements
      const newCountdowns: {[effectType: string]: number} = {};

      gameState.activeEffects.forEach((effect, index) => {
        const remaining = Math.ceil((effect.duration - (Date.now() - effect.startTime)) / 1000);
        if (remaining >= 0) {
          const pickupData = PICKUP_TYPES.find(p => p.type === effect.type);
          if (pickupData) {
            const yPos = 150 + (index * 30);
            ctx.fillText(`${pickupData.description} ${remaining}`, playFieldWidth / 2, yPos);

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
            // Use ref for immediate synchronous checking to prevent duplicates
            const hasBeenAnnounced = announcedCountdownsRef.current[effect.type]?.has(remaining) || false;

            if (remaining <= 5 && remaining >= 0 && !hasBeenAnnounced) {
              // Check if enough time has passed since pickup announcement
              const announcementTime = pickupAnnouncementTimes[effect.type];
              const timeSinceAnnouncement = Date.now() - (announcementTime || 0);
              const minimumDelay = 3500; // Wait 3.5 seconds after pickup announcement

              if (!announcementTime || timeSinceAnnouncement >= minimumDelay) {
                // Mark this number as announced IMMEDIATELY in ref to prevent duplicates
                if (!announcedCountdownsRef.current[effect.type]) {
                  announcedCountdownsRef.current[effect.type] = new Set();
                }
                announcedCountdownsRef.current[effect.type].add(remaining);

                // Update state for UI consistency (async is fine for this)
                setAnnouncedCountdowns(prev => ({
                  ...prev,
                  [effect.type]: new Set([...(prev[effect.type] || []), remaining])
                }));

                // Use staggered speech for countdown numbers to prevent voice conflicts
                // Add unique delay based on effect type to prevent voice conflicts
                const delayOffset = index * 800; // Stagger announcements by 800ms per effect
                setTimeout(() => {
                  // Use speakRobotic with retry logic for countdown numbers
                  if (!isSpeakingRef.current) {
                    speakRobotic(remaining.toString());
                  } else {
                    // If still speaking, retry after a short delay
                    setTimeout(() => speakRobotic(remaining.toString()), 200);
                  }
                }, 50 + delayOffset);
              } else {
                // If we can't announce due to delay, schedule it for later
                const remainingDelay = minimumDelay - timeSinceAnnouncement;
                setTimeout(() => {
                  // Double-check that this number wasn't already announced while we waited (use ref)
                  if (!announcedCountdownsRef.current[effect.type]?.has(remaining)) {
                    const currentRemaining = Math.ceil((effect.duration - (Date.now() - effect.startTime)) / 1000);
                    if (currentRemaining === remaining && currentRemaining <= 5 && currentRemaining >= 0) {
                      // Mark as announced IMMEDIATELY in ref
                      if (!announcedCountdownsRef.current[effect.type]) {
                        announcedCountdownsRef.current[effect.type] = new Set();
                      }
                      announcedCountdownsRef.current[effect.type].add(remaining);

                      // Update state for UI consistency
                      setAnnouncedCountdowns(prev => ({
                        ...prev,
                        [effect.type]: new Set([...(prev[effect.type] || []), remaining])
                      }));
                      // Use speakRobotic instead of forceSpeak to prevent overlapping
                      if (!isSpeakingRef.current) {
                        speakRobotic(remaining.toString());
                      }
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
      ctx.shadowBlur = 0;

      // Clean up announced countdowns for effects that no longer exist
      const activeEffectTypes = new Set(Object.keys(newCountdowns));

      // Clean up ref synchronously
      const cleanedRef: {[effectType: string]: Set<number>} = {};
      for (const effectType of activeEffectTypes) {
        cleanedRef[effectType] = announcedCountdownsRef.current[effectType] || new Set<number>();
      }
      announcedCountdownsRef.current = cleanedRef;

      // Clean up state
      setAnnouncedCountdowns(prev => {
        const cleaned: {[effectType: string]: Set<number>} = {};
        for (const effectType of activeEffectTypes) {
          cleaned[effectType] = prev[effectType] || new Set<number>();
        }
        return cleaned;
      });
    }

    // Add on-screen text overlays
    const overlayTextSize = Math.round(16 * scaleFactor);
    ctx.font = `bold ${overlayTextSize}px "Press Start 2P", monospace`;
    ctx.fillStyle = currentColors.foreground;
    ctx.globalAlpha = 1; // Full opacity for all text

    if (gameState.gameMode === 'auto') {
      // Show 404 text on left side and enjoy message on right side - vertically centered
      const centerY = playFieldHeight / 2;
      const leftX = playFieldWidth * 0.25; // Left quarter position
      const rightX = playFieldWidth * 0.75; // Right quarter position

      // Left side - 404 and PAGE NOT FOUND (centered vertically)
      const auto404Size = Math.round(48 * scaleFactor);
      ctx.font = `bold ${auto404Size}px "Press Start 2P", monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('404', leftX, centerY - (20 * scaleFactor));

      const autoPageSize = Math.round(16 * scaleFactor);
      ctx.font = `bold ${autoPageSize}px "Press Start 2P", monospace`;
      ctx.fillText('PAGE NOT FOUND', leftX, centerY + (20 * scaleFactor));

      // Right side - Enjoy message (centered vertically)
      const autoEnjoySize = Math.round(12 * scaleFactor);
      ctx.font = `bold ${autoEnjoySize}px "Press Start 2P", monospace`;
      // Break the text into multiple lines, centered around centerY
      ctx.fillText('But hey,', rightX, centerY - (40 * scaleFactor));
      ctx.fillText('enjoy some', rightX, centerY - (15 * scaleFactor));
      ctx.fillText('classic Pong', rightX, centerY + (10 * scaleFactor));
      ctx.fillText('while you\'re here!', rightX, centerY + (35 * scaleFactor));

      // Spacebar instruction at bottom center with connection status
      ctx.textAlign = 'center';
      const autoSpacebarSize = Math.round(10 * scaleFactor);
      ctx.font = `bold ${autoSpacebarSize}px "Press Start 2P", monospace`;

      // Show connection status with visual indicators
      if (connectionStatus === 'connecting' || connectionStatus === 'server_down' || connectionStatus === 'server_starting') {
        // Blink every 500ms
        const isVisible = Math.floor(Date.now() / 500) % 2 === 0;

        if (connectionStatus === 'server_down') {
          ctx.fillStyle = '#ff4444'; // Red for server down
          ctx.fillText(`SERVER DOWN`, playFieldWidth / 2, playFieldHeight - (160 * scaleFactor));
        } else if (connectionStatus === 'server_starting') {
          if (isVisible) {
            ctx.fillStyle = '#ffaa00'; // Orange for server starting
            ctx.fillText(`STARTING SERVER`, playFieldWidth / 2, playFieldHeight - (160 * scaleFactor));
          }
        } else {
          if (isVisible) {
            ctx.fillStyle = currentColors.foreground; // Normal color for connecting
            ctx.fillText(`CONNECTING`, playFieldWidth / 2, playFieldHeight - (160 * scaleFactor));
          }
        }

        ctx.fillStyle = currentColors.foreground; // Reset color for other text
        ctx.fillText(connectionMessage || 'Connecting to multiplayer server...', playFieldWidth / 2, playFieldHeight - (140 * scaleFactor));
        ctx.fillText('Press D for debug mode to see connection logs', playFieldWidth / 2, playFieldHeight - (120 * scaleFactor));
        ctx.fillText(`Press C to toggle CRT effect (${crtEffect ? 'ON' : 'OFF'})`, playFieldWidth / 2, playFieldHeight - (100 * scaleFactor));
      } else if (connectionStatus === 'warming') {
        // Enhanced warming display with phase-specific feedback
        const elapsed = connectionStartTime > 0 ? Math.floor((Date.now() - connectionStartTime) / 1000) : 0;
        const estimatedTotal = 60; // 60 second estimate
        const actualProgress = Math.min(elapsed / estimatedTotal, 0.95); // Cap at 95% until connected

        // Phase-specific animations and emojis
        let phaseEmoji = '[FIRE]';
        let phaseColor = '#ff6600';
        let phaseText = 'WARMING UP';

        if (currentPhase === 'initializing') {
          phaseEmoji = '[REFRESH]';
          phaseColor = '#0080ff';
          phaseText = 'INITIALIZING';
        } else if (currentPhase === 'warming') {
          const fireFrames = ['[FIRE]', '[RED]', '🟠', '🟡'];
          phaseEmoji = fireFrames[Math.floor(Date.now() / 400) % fireFrames.length];
          phaseColor = '#ff6600';
          phaseText = 'WARMING UP';
        } else if (currentPhase === 'booting') {
          const bootFrames = ['[BOLT]', '🔌', '💻', '⚙️'];
          phaseEmoji = bootFrames[Math.floor(Date.now() / 500) % bootFrames.length];
          phaseColor = '#ffff00';
          phaseText = 'BOOTING';
        } else if (currentPhase === 'finalizing') {
          const finalFrames = ['[ROCKET]', '✨', '⭐', '[TARGET]'];
          phaseEmoji = finalFrames[Math.floor(Date.now() / 300) % finalFrames.length];
          phaseColor = '#00ff80';
          phaseText = 'FINALIZING';
        }

        ctx.fillText(`${phaseEmoji} SERVER ${phaseText} ${phaseEmoji}`, playFieldWidth / 2, playFieldHeight - (180 * scaleFactor));
        ctx.fillText(connectionMessage, playFieldWidth / 2, playFieldHeight - (160 * scaleFactor));

        // Enhanced progress bar with time estimate
        const progressWidth = 300 * scaleFactor;
        const progressHeight = 8 * scaleFactor;
        const progressX = canvasSize.width / 2 - progressWidth / 2;
        const progressY = canvasSize.height - (145 * scaleFactor);
        const progressBorder = 2 * scaleFactor;

        // Background bar with border
        ctx.fillStyle = '#222';
        ctx.fillRect(progressX - progressBorder, progressY - progressBorder, progressWidth + (progressBorder * 2), progressHeight + (progressBorder * 2));
        ctx.fillStyle = '#333';
        ctx.fillRect(progressX, progressY, progressWidth, progressHeight);

        // Progress fill with phase-specific color
        ctx.fillStyle = phaseColor;
        ctx.fillRect(progressX, progressY, progressWidth * actualProgress, progressHeight);

        // Progress percentage and time info
        ctx.fillStyle = currentColors.foreground;
        const progressInfoSize = Math.round(8 * scaleFactor);
        ctx.font = `bold ${progressInfoSize}px "Press Start 2P", monospace`;
        const progressPercent = Math.floor(actualProgress * 100);
        const timeRemaining = Math.max(0, estimatedTotal - elapsed);
        ctx.fillText(`${progressPercent}% - ~${timeRemaining}s remaining`, playFieldWidth / 2, playFieldHeight - (130 * scaleFactor));

        // Retry count display
        if (retryCount > 0) {
          ctx.fillText(`Retry attempt ${retryCount}/5`, playFieldWidth / 2, playFieldHeight - (115 * scaleFactor));
        }

        // Restore text color and font
        const warmingHelpSize = Math.round(10 * scaleFactor);
        ctx.font = `bold ${warmingHelpSize}px "Press Start 2P", monospace`;
        ctx.fillStyle = currentColors.foreground;
        ctx.fillText('Free servers take time to boot up - please be patient!', playFieldWidth / 2, playFieldHeight - (100 * scaleFactor));
        ctx.fillText(`Press C to toggle CRT effect (${crtEffect ? 'ON' : 'OFF'})`, playFieldWidth / 2, playFieldHeight - (85 * scaleFactor));
      } else if (connectionStatus === 'retrying') {
        // Enhanced retry display with progress visualization
        const dots = '.'.repeat((Math.floor(Date.now() / 300) % 4) + 1);
        const retryFrames = ['[REFRESH]', '⏳', '🔁', '[BOLT]'];
        const retryEmoji = retryFrames[Math.floor(Date.now() / 400) % retryFrames.length];

        ctx.fillText(`${retryEmoji} RETRYING CONNECTION${dots}`, playFieldWidth / 2, playFieldHeight - (180 * scaleFactor));
        ctx.fillText(connectionMessage || `Retry attempt ${retryCount}/5...`, playFieldWidth / 2, playFieldHeight - (160 * scaleFactor));

        // Retry attempt progress bar
        const retryProgressWidth = 250 * scaleFactor;
        const retryProgressHeight = 6 * scaleFactor;
        const retryProgressX = canvasSize.width / 2 - retryProgressWidth / 2;
        const retryProgressY = canvasSize.height - (145 * scaleFactor);

        // Background
        ctx.fillStyle = '#333';
        ctx.fillRect(retryProgressX, retryProgressY, retryProgressWidth, retryProgressHeight);

        // Progress based on retry count
        const retryProgress = Math.min(retryCount / 5, 1);
        const retryColor = retryProgress < 0.6 ? '#ffaa00' : retryProgress < 0.8 ? '#ff6600' : '#ff3300';
        ctx.fillStyle = retryColor;
        ctx.fillRect(retryProgressX, retryProgressY, retryProgressWidth * retryProgress, retryProgressHeight);

        // Retry status text
        ctx.fillStyle = currentColors.foreground;
        const retryStatusSize = Math.round(8 * scaleFactor);
        ctx.font = `bold ${retryStatusSize}px "Press Start 2P", monospace`;
        ctx.fillText(`Attempt ${retryCount}/5 - ${Math.max(0, 5 - retryCount)} retries remaining`, playFieldWidth / 2, playFieldHeight - (130 * scaleFactor));

        // Restore font and show additional info
        const retryHelpSize = Math.round(10 * scaleFactor);
        ctx.font = `bold ${retryHelpSize}px "Press Start 2P", monospace`;
        ctx.fillText('Server may be sleeping - retrying automatically', playFieldWidth / 2, playFieldHeight - (115 * scaleFactor));
        ctx.fillText(`Press C to toggle CRT effect (${crtEffect ? 'ON' : 'OFF'})`, playFieldWidth / 2, playFieldHeight - (100 * scaleFactor));
      } else if (connectionStatus === 'error') {
        ctx.fillStyle = '#ff0000'; // Red for error
        ctx.fillText('[X] CONNECTION FAILED', playFieldWidth / 2, playFieldHeight - (160 * scaleFactor));
        ctx.fillStyle = currentColors.foreground;
        ctx.fillText(connectionMessage || 'Server may be sleeping or unreachable', playFieldWidth / 2, playFieldHeight - (140 * scaleFactor));
        ctx.fillText(`Failed ${retryCount} time${retryCount !== 1 ? 's' : ''}`, playFieldWidth / 2, playFieldHeight - (120 * scaleFactor));
        ctx.fillStyle = '#00ff00'; // Green for retry prompt
        ctx.fillText('Press ANY KEY to retry connection', playFieldWidth / 2, playFieldHeight - (100 * scaleFactor));
      } else {
        ctx.fillText('Press ANY KEY to join online multiplayer', playFieldWidth / 2, playFieldHeight - (160 * scaleFactor));
        ctx.fillText('Move your paddle: W/S keys OR hover mouse', playFieldWidth / 2, playFieldHeight - (140 * scaleFactor));
        ctx.fillText('Press D for debug mode, C for CRT effect', playFieldWidth / 2, playFieldHeight - (120 * scaleFactor));
        ctx.fillText(`CRT Effect: ${crtEffect ? 'ON' : 'OFF'}`, playFieldWidth / 2, playFieldHeight - (100 * scaleFactor));
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
        const multiInfoSize = Math.round(12 * scaleFactor);
        ctx.font = `bold ${multiInfoSize}px "Press Start 2P", monospace`;

        // Show other fading info text (not connection status)
        // Connection status is now shown below outside the fade zone

        // Restore color
        ctx.fillStyle = currentColors.foreground;
      }

      // Always show connection status (outside of fade zone)
      ctx.textAlign = 'center';
      ctx.fillStyle = currentColors.foreground;

      if (connectionStatus === 'connecting' || connectionStatus === 'server_down' || connectionStatus === 'server_starting') {
        const dots = '.'.repeat((Math.floor(Date.now() / 500) % 3) + 1);
        const multiConnectSize = Math.round(12 * scaleFactor);
        ctx.font = `bold ${multiConnectSize}px "Press Start 2P", monospace`;

        if (connectionStatus === 'server_down') {
          ctx.fillStyle = '#ff4444'; // Red for server down
          ctx.fillText(`WEBSOCKET SERVER DOWN`, playFieldWidth / 2, playFieldHeight - (180 * scaleFactor));
        } else if (connectionStatus === 'server_starting') {
          ctx.fillStyle = '#ffaa00'; // Orange for server starting
          ctx.fillText(`STARTING WEBSOCKET SERVER${dots}`, playFieldWidth / 2, playFieldHeight - (180 * scaleFactor));
        } else {
          ctx.fillStyle = currentColors.foreground; // Normal color for connecting
          ctx.fillText(`CONNECTING TO MULTIPLAYER${dots}`, playFieldWidth / 2, playFieldHeight - (180 * scaleFactor));
        }

        ctx.fillStyle = currentColors.foreground; // Reset color for other text
        const multiMsgSize = Math.round(10 * scaleFactor);
        ctx.font = `bold ${multiMsgSize}px "Press Start 2P", monospace`;
        ctx.fillText(connectionMessage || 'Establishing connection...', playFieldWidth / 2, playFieldHeight - (160 * scaleFactor));
      } else if (connectionStatus === 'warming') {
        const elapsed = connectionStartTime > 0 ? Math.floor((Date.now() - connectionStartTime) / 1000) : 0;
        let phaseText = 'WARMING UP';

        if (currentPhase === 'initializing') {
          phaseText = 'INITIALIZING';
        } else if (currentPhase === 'warming') {
          phaseText = 'WARMING UP';
        } else if (currentPhase === 'booting') {
          phaseText = 'BOOTING';
        } else if (currentPhase === 'finalizing') {
          phaseText = 'FINALIZING';
        }

        const multiWarmSize = Math.round(12 * scaleFactor);
        ctx.font = `bold ${multiWarmSize}px "Press Start 2P", monospace`;
        ctx.fillText(`SERVER ${phaseText}`, playFieldWidth / 2, playFieldHeight - (180 * scaleFactor));
        const multiWarmMsgSize = Math.round(10 * scaleFactor);
        ctx.font = `bold ${multiWarmMsgSize}px "Press Start 2P", monospace`;
        ctx.fillText(connectionMessage, playFieldWidth / 2, playFieldHeight - (160 * scaleFactor));
        ctx.fillText(`${elapsed}s elapsed - Please wait...`, playFieldWidth / 2, playFieldHeight - (145 * scaleFactor));
      } else if (connectionStatus === 'retrying') {
        const dots = '.'.repeat((Math.floor(Date.now() / 300) % 4) + 1);
        const multiRetrySize = Math.round(12 * scaleFactor);
        ctx.font = `bold ${multiRetrySize}px "Press Start 2P", monospace`;
        ctx.fillText(`RETRYING CONNECTION${dots}`, playFieldWidth / 2, playFieldHeight - (180 * scaleFactor));
        const multiRetryMsgSize = Math.round(10 * scaleFactor);
        ctx.font = `bold ${multiRetryMsgSize}px "Press Start 2P", monospace`;
        ctx.fillText(connectionMessage || `Attempt ${retryCount}/5...`, playFieldWidth / 2, playFieldHeight - (160 * scaleFactor));
      } else if (connectionStatus === 'error') {
        const multiErrorSize = Math.round(12 * scaleFactor);
        ctx.font = `bold ${multiErrorSize}px "Press Start 2P", monospace`;
        ctx.fillText('[X] CONNECTION FAILED', playFieldWidth / 2, playFieldHeight - (180 * scaleFactor));
        const multiErrorMsgSize = Math.round(10 * scaleFactor);
        ctx.font = `bold ${multiErrorMsgSize}px "Press Start 2P", monospace`;
        ctx.fillText('Press ANY KEY to retry', playFieldWidth / 2, playFieldHeight - (160 * scaleFactor));
      }

      // Show spectator status when connected (player side text removed)
      if (connectionStatus === 'connected' || multiplayerState.isConnected) {
        const currentMultiplayerState = latestMultiplayerStateRef.current;

        // Only show spectator status, not player paddle position
        if (currentMultiplayerState.playerSide === 'spectator') {
          ctx.fillStyle = currentColors.foreground;
          ctx.textAlign = 'center';
          const spectatorSize = Math.round(12 * scaleFactor);
          ctx.font = `bold ${spectatorSize}px "Press Start 2P", monospace`;
          ctx.fillText('MULTIPLAYER MODE', playFieldWidth / 2, playFieldHeight - (180 * scaleFactor));
          ctx.fillText('SPECTATING', playFieldWidth / 2, playFieldHeight - (160 * scaleFactor));
        }
      }

    }

    // CRT shader completely disabled

    // Debug collision zones - always visible - DISABLED
    if (false) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0; // Make fully opaque
      ctx.lineWidth = 2;

      // Debug mode indicator
      ctx.fillStyle = 'rgba(255, 255, 0, 1.0)';
      const debugFontSize = Math.round(16 * scaleFactor);
      ctx.font = `${debugFontSize}px monospace`;
      ctx.textAlign = 'left';
      ctx.fillText('DEBUG MODE: Collision Zones Visible', 10 * scaleFactor, 30 * scaleFactor);

      const COLLISION_BUFFER = 2;
      const BOUNDARY_SPACING = BORDER_THICKNESS * 2;

      // Paddle collision zones with different colors
      const paddleZones = [
        {
          x: gameState.paddles.left.x - COLLISION_BUFFER,
          y: gameState.paddles.left.y - COLLISION_BUFFER,
          width: gameState.paddles.left.width + (COLLISION_BUFFER * 2),
          height: gameState.paddles.left.height + (COLLISION_BUFFER * 2),
          color: 'rgba(255, 0, 0, 0.7)',
          label: 'LEFT'
        },
        {
          x: gameState.paddles.right.x - COLLISION_BUFFER,
          y: gameState.paddles.right.y - COLLISION_BUFFER,
          width: gameState.paddles.right.width + (COLLISION_BUFFER * 2),
          height: gameState.paddles.right.height + (COLLISION_BUFFER * 2),
          color: 'rgba(0, 255, 0, 0.7)',
          label: 'RIGHT'
        }
      ];

      // Add top/bottom paddles if they exist (with reduced collision buffer for better gameplay)
      const HORIZONTAL_COLLISION_BUFFER = 1; // Reduced from 2 to make horizontal paddles less sticky

      if (gameState.paddles.top) {
        paddleZones.push({
          x: gameState.paddles.top.x - HORIZONTAL_COLLISION_BUFFER,
          y: gameState.paddles.top.y - HORIZONTAL_COLLISION_BUFFER,
          width: gameState.paddles.top.width + (HORIZONTAL_COLLISION_BUFFER * 2),
          height: gameState.paddles.top.height + (HORIZONTAL_COLLISION_BUFFER * 2),
          color: 'rgba(0, 0, 255, 0.7)',
          label: 'TOP'
        });
      }

      if (gameState.paddles.bottom) {
        paddleZones.push({
          x: gameState.paddles.bottom.x - HORIZONTAL_COLLISION_BUFFER,
          y: gameState.paddles.bottom.y - HORIZONTAL_COLLISION_BUFFER,
          width: gameState.paddles.bottom.width + (HORIZONTAL_COLLISION_BUFFER * 2),
          height: gameState.paddles.bottom.height + (HORIZONTAL_COLLISION_BUFFER * 2),
          color: 'rgba(255, 255, 0, 0.7)',
          label: 'BOTTOM'
        });
      }

      // Draw paddle collision zones
      paddleZones.forEach(zone => {
        ctx.fillStyle = zone.color;
        ctx.strokeStyle = zone.color;
        ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
        ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);

        // Label
        ctx.fillStyle = 'white';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(zone.label, zone.x + zone.width/2, zone.y + zone.height/2 + 3);
      });

      // Boundary zones for scoring detection
      const boundaryZones = [
        {
          x: -50, y: 0, width: BOUNDARY_SPACING + 50, height: canvasSize.height,
          color: 'rgba(255, 0, 255, 0.5)', label: 'LEFT BOUNDARY'
        },
        {
          x: canvasSize.width - BOUNDARY_SPACING, y: 0, width: BOUNDARY_SPACING + 50, height: canvasSize.height,
          color: 'rgba(255, 0, 255, 0.5)', label: 'RIGHT BOUNDARY'
        },
        {
          x: 0, y: -50, width: canvasSize.width, height: BOUNDARY_SPACING + 50,
          color: 'rgba(0, 255, 255, 0.5)', label: 'TOP BOUNDARY'
        },
        {
          x: 0, y: canvasSize.height - BOUNDARY_SPACING, width: canvasSize.width, height: BOUNDARY_SPACING + 50,
          color: 'rgba(0, 255, 255, 0.5)', label: 'BOTTOM BOUNDARY'
        }
      ];

      // Draw boundary zones
      boundaryZones.forEach(zone => {
        ctx.fillStyle = zone.color;
        ctx.strokeStyle = zone.color;
        ctx.fillRect(zone.x, zone.y, zone.width, zone.height);
        ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);

        // Label
        ctx.fillStyle = 'white';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        if (zone.label.includes('LEFT') || zone.label.includes('RIGHT')) {
          ctx.fillText(zone.label, zone.x + zone.width/2, playFieldHeight/2);
        } else {
          ctx.fillText(zone.label, playFieldWidth/2, zone.y + zone.height/2);
        }
      });

      // LEGACY COLLISION ZONES - 48px zones where user reports bouncing
      const legacyZones = [
        {
          x: 0, y: 0, width: canvasSize.width, height: 48,
          color: 'rgba(255, 0, 0, 0.9)', label: 'LEGACY 48px TOP'
        },
        {
          x: 0, y: canvasSize.height - 48, width: canvasSize.width, height: 48,
          color: 'rgba(255, 0, 0, 0.9)', label: 'LEGACY 48px BOTTOM'
        },
        {
          x: 0, y: 0, width: 48, height: canvasSize.height,
          color: 'rgba(255, 0, 0, 0.9)', label: 'LEGACY 48px LEFT'
        },
        {
          x: canvasSize.width - 48, y: 0, width: 48, height: canvasSize.height,
          color: 'rgba(255, 0, 0, 0.9)', label: 'LEGACY 48px RIGHT'
        }
      ];

      // Draw legacy zones in bright red to highlight them
      legacyZones.forEach(zone => {
        ctx.strokeStyle = zone.color;
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 5]); // Dashed line to distinguish from other zones
        ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);

        // Label in bright white
        ctx.fillStyle = 'white';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 3;
        if (zone.label.includes('LEFT') || zone.label.includes('RIGHT')) {
          ctx.fillText(zone.label, zone.x + zone.width/2, playFieldHeight/2 + 20);
        } else {
          ctx.fillText(zone.label, playFieldWidth/2, zone.y + zone.height/2 + 10);
        }
        ctx.shadowBlur = 0; // Reset shadow
        ctx.setLineDash([]); // Reset line dash
      });

      // Ball trajectory prediction
      if (!gameState.isPaused && gameState.ball.dx && gameState.ball.dy) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;

        const ballCenterX = gameState.ball.x + gameState.ball.size / 2;
        const ballCenterY = gameState.ball.y + gameState.ball.size / 2;
        const trajectoryLength = 100; // How far to project

        ctx.beginPath();
        ctx.moveTo(ballCenterX, ballCenterY);
        ctx.lineTo(
          ballCenterX + (gameState.ball.dx * trajectoryLength / Math.sqrt(gameState.ball.dx * gameState.ball.dx + gameState.ball.dy * gameState.ball.dy)),
          ballCenterY + (gameState.ball.dy * trajectoryLength / Math.sqrt(gameState.ball.dx * gameState.ball.dx + gameState.ball.dy * gameState.ball.dy))
        );
        ctx.stroke();
        ctx.setLineDash([]); // Reset line dash
      }

      ctx.restore();
    }

    // Draw playfield border (while still in translated/scaled context)
    const glowIntensity = musicDataRef.current?.volume || 0;
    const mainGlowSize = 15 + glowIntensity * 25;
    ctx.strokeStyle = currentColors.foreground;
    ctx.lineWidth = BORDER_THICKNESS;
    ctx.shadowBlur = mainGlowSize;
    ctx.shadowColor = currentColors.foreground;
    ctx.strokeRect(BORDER_THICKNESS/2, BORDER_THICKNESS/2, playFieldWidth - BORDER_THICKNESS, playFieldHeight - BORDER_THICKNESS);
    ctx.shadowBlur = 0;

    // 📐 Restore canvas state after dynamic playfield scaling (always restore since we always save)
    ctx.restore();

  }, [gameState, canvasSize, connectionStatus, multiplayerState.isConnected, multiplayerState.playerSide, infoTextFadeStart, localTestMode, crtEffect, applyCRTEffect, showAudioPrompt]);

  // Update function refs when functions change (prevents game loop restart)
  useEffect(() => {
    updateGameRef.current = updateGame;
  }, [updateGame]);

  useEffect(() => {
    renderRef.current = render;
  }, [render]);

  // High-performance 60fps game loop
  useEffect(() => {
    // Always run the game loop (paddles should be moveable at all times, even during pauses)
    // Game loop handles isPlaying checks internally for ball/physics logic

    let lastTime = 0;

    const gameLoop = (currentTime: number) => {
      lastTime = currentTime;

      // Get music analysis data for reactive visual effects
      const musicData = (window as any).generativeMusic?.getAnalysisData?.() || { volume: 0, disharmonic: 0, beat: 0 };
      musicDataRef.current = musicData;

      // 🕒 Calculate delta time for frame-rate independent physics
      const deltaTime = currentTime - lastFrameTimeRef.current;
      lastFrameTimeRef.current = currentTime;
      deltaTimeRef.current = Math.min(deltaTime, targetFrameTime * 2); // Cap delta time to prevent large jumps

      // [BOLT] PERFORMANCE: Update cached time only every 4th frame (reduces Date.now() calls)
      timeUpdateCountRef.current++;
      if (timeUpdateCountRef.current % 4 === 0) {
        cachedTimeRef.current = Date.now();
      }

      // Update paddle animation progress
      if (paddleAnimationProgress < 1 && paddleAnimationStartTimeRef.current > 0) {
        const elapsed = currentTime - paddleAnimationStartTimeRef.current;
        const duration = 500; // 500ms animation
        const progress = Math.min(elapsed / duration, 1);

        // Bouncy easing: elastic overshoot
        const eased = progress < 1
          ? 1 - Math.pow(1 - progress, 3) * Math.cos(progress * Math.PI * 2.5)
          : 1;

        setPaddleAnimationProgress(eased);
      }

      // Update game logic - optimized state updates (using ref to avoid recreating game loop)
      if (updateGameRef.current) {
        updateGameRef.current();
      }

      // Render immediately - optimized canvas operations (using ref to avoid recreating game loop)
      if (renderRef.current) {
        renderRef.current();
      }

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
  }, []); // Empty deps - game loop should run continuously without restarts


  // Prevent React strict mode from causing duplicate WebSocket connections
  const hasInitialized = useRef(false);

  // Initialize PixiJS for CRT shader effect (only when CRT is enabled)
  useEffect(() => {
    if (!crtEffect) return; // Skip initialization if CRT is disabled
    if (!pixiContainerRef.current || !canvasRef.current) return;

    let app: Application | null = null;

    (async () => {
      try {
        app = new Application();

        // Create PixiJS canvas with explicit resolution to avoid Retina scaling
        await app.init({
          width: canvasSize.width,
          height: canvasSize.height,
          backgroundAlpha: 0,
          antialias: false,
          resolution: 1, // Force 1:1 pixel mapping, ignore devicePixelRatio
        });

        if (!pixiContainerRef.current) {
          console.warn('[PixiJS] Container ref no longer available after init');
          return;
        }
        if (!app || !app.stage) {
          console.error('[PixiJS] Stage is null - initialization failed');
          return;
        }
      } catch (error) {
        console.error('[PixiJS] Initialization error:', error);
        return;
      }

      pixiContainerRef.current.appendChild(app.canvas);
      pixiAppRef.current = app;

      // Style the PixiJS canvas - exact dimensions to avoid scaling
      app.canvas.style.position = 'absolute';
      app.canvas.style.top = '0';
      app.canvas.style.left = '0';
      app.canvas.style.width = `${canvasSize.width}px`;
      app.canvas.style.height = `${canvasSize.height}px`;
      app.canvas.style.display = 'block';
      // Set cursor style on PixiJS canvas to match game state
      app.canvas.style.cursor = cursorHidden ? 'none' : 'default';

      // Create sprite that we'll update each frame
      if (!canvasRef.current) {
        console.error('Canvas ref is null');
        return;
      }
      // Force texture to exact canvas dimensions
      // Use linear for smooth blur sampling (blur will average big pixels smoothly)
      let texture = Texture.from(canvasRef.current, {
        scaleMode: 'linear',
        resolution: 1
      });

      // Override texture frame and source resolution to ensure exact 1:1 mapping
      texture.frame.width = canvasRef.current.width;
      texture.frame.height = canvasRef.current.height;
      if (texture.source) {
        texture.source.resolution = 1; // Force source resolution to 1
        // Set texture wrapping to CLAMP to prevent magenta artifacts in corners
        texture.source.style.addressMode = 'clamp-to-edge';
      }
      texture.updateUvs();

      // Single sprite with CRT effects and curved reflections
      const playfieldSprite = new Sprite(texture);
      playfieldSprite.width = canvasRef.current.width;
      playfieldSprite.height = canvasRef.current.height;
      playfieldSprite.x = 0;
      playfieldSprite.y = 0;

      const filter = new CRTFilter({
        curvature: 12.0,
        scanlineIntensity: 0.1,
        vignetteIntensity: 0.15,
        noiseIntensity: 0.05,
        brightness: 1.25,
        chromaticAberration: 0.004,
        bezelSize: 0.0625,
        reflectionOpacity: 0.8,  // Enable reflections on curved bezel
        borderNormalized: 0,  // No border - reflections start at playfield edge
        reflectionWidth: 80 / canvasSize.width,
      });
      playfieldSprite.filters = [filter];
      app.stage.addChild(playfieldSprite);

      crtFilterRef.current = filter;

      // console.log('[CRT] Filter created and applied:', {
      //   hasCrtFilter: !!filter,
      //   filterApplied: sprite.filters.length > 0,
      //   filterSettings: {
      //     curvature: 6.0,
      //     scanlineIntensity: 0.15,
      //     vignetteIntensity: 0.3
      //   }
      // });

      // Don't recreate texture - just keep one and it should update automatically
      // PixiJS will detect the canvas has changed and update the texture
      let frameCount = 0;
      let lastLogTime = 0;
      let loggedReflectionParams = false;
      app.ticker.add(() => {
        // Safety check: ensure app and stage still exist (prevents errors during cleanup)
        if (!app || !app.stage) {
          return;
        }

        frameCount++;

        // Debug log every 120 frames (every 2 seconds at 60fps)
        // const now = Date.now();
        // if (now - lastLogTime > 2000) {
        //   console.log('[CRT] Render frame:', {
        //     frame: frameCount,
        //     hasTexture: !!sprite.texture,
        //     hasFilter: !!sprite.filters && sprite.filters.length > 0,
        //     filterCount: sprite.filters?.length || 0,
        //     filterTime: (filter.uniforms as any)?.uTime
        //   });
        //   lastLogTime = now;
        // }

        // PixiJS v8: Access uniforms via filter.resources.crtUniforms.uniforms (nested!)
        if (filter && filter.resources && filter.resources.crtUniforms) {
          const uniformGroup = filter.resources.crtUniforms;
          const uniforms = uniformGroup.uniforms; // The actual uniforms are nested inside!

          // Update uniforms directly
          if (uniforms.uTime !== undefined) uniforms.uTime = Date.now() * 0.001;
          if (uniforms.uResolutionX !== undefined) uniforms.uResolutionX = canvasSize.width;
          if (uniforms.uResolutionY !== undefined) uniforms.uResolutionY = canvasSize.height;
          if (uniforms.uBorderNormalized !== undefined) uniforms.uBorderNormalized = 0;  // No border

          // Update CRT filter with music analysis data for RGB bleed effect
          const musicData = (window as any).generativeMusic?.getAnalysisData?.() || { volume: 0, disharmonic: 0, beat: 0 };
          if (uniforms.uDisharmonic !== undefined) {
            uniforms.uDisharmonic = musicData.disharmonic;
          }
          // Make reflections pulse with music
          if (uniforms.uReflectionOpacity !== undefined) {
            uniforms.uReflectionOpacity = 1.3 + musicData.disharmonic * 0.5; // 1.3 to 1.8 based on music
          }

          // Update reflection adjustment parameters (use ref for latest values, apply to all sides)
          const params = reflectionParamsRef.current;
          if (uniforms.uTopOffset !== undefined) {
            uniforms.uTopOffset = params.offset;
            uniforms.uTopDepth = params.depth;
            uniforms.uRightOffset = params.offset;
            uniforms.uRightDepth = params.depth;
            uniforms.uBottomOffset = params.offset;
            uniforms.uBottomDepth = params.depth;
            uniforms.uLeftOffset = params.offset;
            uniforms.uLeftDepth = params.depth;

            // Log reflection params once
            if (!loggedReflectionParams) {
              console.log('🔧 Reflection uniform values (all sides):', {
                offset: uniforms.uTopOffset,
                depth: uniforms.uTopDepth
              });
              loggedReflectionParams = true;
            }
          }
        }

        // Force texture update from canvas source every frame
        // In PixiJS v8, we need to force update to capture canvas changes
        if (texture.source) {
          texture.source.update();
        }
      });

      // console.log('[CRT] PixiJS initialized with CRT filter:', {
      //   filterEnabled: crtEffect,
      //   canvasSize: { width: canvasSize.width, height: canvasSize.height },
      //   hasSprite: !!sprite,
      //   hasFilter: !!filter
      // });
    })();

    return () => {
      if (app) {
        try {
          app.destroy(true);
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
    };
  }, [crtEffect, canvasSize.width, canvasSize.height]);

  // Toggle CRT filter on/off
  useEffect(() => {
    if (pixiAppRef.current && pixiAppRef.current.stage && crtFilterRef.current && pixiAppRef.current.stage.children.length > 0) {
      const sprite = pixiAppRef.current.stage.children[0] as Sprite;
      if (sprite) {
        sprite.filters = crtEffect ? [crtFilterRef.current] : [];
        // console.log('[CRT] Filter toggled:', crtEffect ? 'ON' : 'OFF');
      }
    }
  }, [crtEffect]);

  // Listen for localStorage events from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pong-game-state' && e.newValue && gameState.gameMode !== 'multiplayer') {
        try {
          const incomingGameState = JSON.parse(e.newValue);
          // LocalStorage received gameState with paddles - ensure correct dimensions
          setGameState(prevState => ({
            ...incomingGameState,
            // Use incoming paddles but enforce correct dimensions
            paddles: {
              left: {
                ...incomingGameState.paddles.left,
                height: PADDLE_LENGTH,
                width: PADDLE_THICKNESS
              },
              right: {
                ...incomingGameState.paddles.right,
                height: PADDLE_LENGTH,
                width: PADDLE_THICKNESS
              },
              top: incomingGameState.paddles?.top ? {
                ...incomingGameState.paddles.top,
                height: PADDLE_THICKNESS,
                width: PADDLE_LENGTH
              } : prevState.paddles.top,
              bottom: incomingGameState.paddles?.bottom ? {
                ...incomingGameState.paddles.bottom,
                height: PADDLE_THICKNESS,
                width: PADDLE_LENGTH
              } : prevState.paddles.bottom
            },
            trails: {
              ...incomingGameState.trails,
              ball: prevState.trails.ball || [], // Preserve client-side ball trails
              leftPaddle: prevState.trails.leftPaddle || [], // Preserve client-side left paddle trails
              rightPaddle: prevState.trails.rightPaddle || [], // Preserve client-side right paddle trails
              topPaddle: prevState.trails.topPaddle || [],
              bottomPaddle: prevState.trails.bottomPaddle || []
            }
          }));
        } catch (error) {
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [gameState.gameMode]);

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

  // Update PixiJS canvas cursor when cursorHidden changes
  useEffect(() => {
    try {
      if (pixiAppRef.current?.canvas?.style) {
        pixiAppRef.current.canvas.style.cursor = cursorHidden ? 'none' : 'default';
      }
    } catch (e) {
      // Ignore canvas access errors during hot reload
    }
  }, [cursorHidden]);

  // Track if we just dismissed audio prompt to prevent double-trigger
  const justDismissedAudioRef = useRef<number>(0);

  // Universal input handler to initialize audio on any user interaction
  useEffect(() => {
    const handleAnyUserInput = async (e: Event) => {
      // Dismiss audio prompt on click or touch
      if ((e.type === 'click' || e.type === 'mousedown' || e.type === 'touchstart') && showAudioPrompt && !audioPromptDismissedRef.current) {
        // Initialize audio ONLY when dismissing prompt (after user interaction)
        await initializeAudio();
        // console.log('[MUSIC] DISMISSING AUDIO PROMPT WITH MOUSE CLICK');
        audioPromptDismissedRef.current = true;
        setShowAudioPrompt(false);
        justDismissedAudioRef.current = Date.now(); // Mark that we just dismissed

        // Show start screen after dismissing audio prompt (matching spacebar behavior)
        if (!isSpectatorMode) {
          setGameState(prev => ({ ...prev, showStartScreen: true }));
        }

        // Don't process game start on this click - just dismiss the prompt
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Don't process clicks within 500ms of dismissing audio prompt
      if (Date.now() - justDismissedAudioRef.current < 500) {
        return;
      }

      // Handle start screen click to start game (only if audio prompt is not shown)
      if ((e.type === 'click' || e.type === 'mousedown' || e.type === 'touchstart') && gameState.showStartScreen && !showAudioPrompt) {
        console.log('[ROCKET] STARTING GAME FROM START SCREEN VIA MOUSE CLICK!');
        // Start paddle animation
        paddleAnimationStartTimeRef.current = Date.now();
        setPaddleAnimationProgress(0);

        // Try to connect to multiplayer WebSocket
        if (!multiplayerState.isConnected) {
          try {
            connectWebSocket();
            setGameState(prev => ({
              ...prev,
              showStartScreen: false,
              gameMode: 'multiplayer',
              isPlaying: true,
              score: { left: 0, right: 0, top: 0, bottom: 0 },
              winner: null,
              gameEnded: false,
              ball: {
                ...prev.ball,
                ...getCenteredBallPosition(),
                dx: Math.random() > 0.5 ? 6 : -6,
                dy: (Math.random() - 0.5) * 6 * 0.8
              }
            }));
            setTimeout(() => speakRobotic('CONNECTING TO SERVER'), 100);
          } catch (error) {
            console.error('[ERROR] Failed to connect to multiplayer:', error);
            setGameState(prev => ({
              ...prev,
              showStartScreen: false,
              gameMode: 'player',
              isPlaying: true,
              ball: {
                ...prev.ball,
                dx: Math.random() > 0.5 ? 6 : -6,
                dy: (Math.random() - 0.5) * 6 * 0.8
              }
            }));
            setTimeout(() => speakRobotic('CONNECTION FAILED, STARTING SINGLE PLAYER'), 100);
          }
        } else {
          // Already connected, just start the game
          setGameState(prev => ({
            ...prev,
            showStartScreen: false,
            gameMode: 'multiplayer',
            isPlaying: true,
            score: { left: 0, right: 0, top: 0, bottom: 0 },
            winner: null,
            gameEnded: false,
            ball: {
              ...prev.ball,
              x: canvasSize.width / 2,
              y: canvasSize.height / 2,
              dx: Math.random() > 0.5 ? 6 : -6,
              dy: (Math.random() - 0.5) * 6 * 0.8
            }
          }));
          setTimeout(() => speakRobotic('MULTIPLAYER GAME STARTING'), 100);
        }
      }
    };

    // Add listeners for all possible user input events
    // Use passive: false for events where we need preventDefault()
    const eventsWithPreventDefault = ['click', 'mousedown', 'touchstart'];
    const passiveEvents = ['keydown', 'keyup', 'mouseup', 'touchend', 'wheel', 'scroll'];

    eventsWithPreventDefault.forEach(eventType => {
      document.addEventListener(eventType, handleAnyUserInput, { once: false, passive: false });
    });

    passiveEvents.forEach(eventType => {
      document.addEventListener(eventType, handleAnyUserInput, { once: false, passive: true });
    });

    return () => {
      [...eventsWithPreventDefault, ...passiveEvents].forEach(eventType => {
        document.removeEventListener(eventType, handleAnyUserInput);
      });
    };
  }, [initializeAudio, showAudioPrompt, isSpectatorMode, canvasSize.width, canvasSize.height, connectWebSocket, gameState.showStartScreen, multiplayerState.isConnected, speakRobotic]);

  // Global mouse move handler to track mouse outside canvas
  useEffect(() => {
    const handleGlobalMouseMove = async (e: MouseEvent | PointerEvent) => {
      // Don't initialize audio on mouse move - only on click/key press
      // await initializeAudio();

      // Start ambient sounds immediately on first interaction (including title screen)
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        let y, x;

        // Use movement deltas if pointer is locked, otherwise use absolute position
        if (document.pointerLockElement === canvasRef.current) {
          // Accumulate movement deltas
          y = accumulatedMouseY + e.movementY;
          x = accumulatedMouseX + e.movementX;
          setAccumulatedMouseY(y);
          setAccumulatedMouseX(x);
        } else {
          // Use absolute position relative to canvas
          y = e.clientY - rect.top;
          x = e.clientX - rect.left;
        }

        setMouseY(y);
        setMouseX(x);

        // Always enable mouse control for your assigned paddle
        if (gameState.gameMode === 'multiplayer') {
          setControlSide(multiplayerState.playerSide === 'spectator' ? null : multiplayerState.playerSide);
        } else {
          // In single player vs AI, always control right paddle (player)
          setControlSide('right');
        }

        // Always hide cursor during gameplay
        setCursorHidden(gameState.isPlaying);
      }
    };

    document.addEventListener('mousemove', handleGlobalMouseMove);
    document.addEventListener('pointermove', handleGlobalMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('pointermove', handleGlobalMouseMove);
    };
  }, [gameState.gameMode, gameState.isPlaying, multiplayerState.playerSide, initializeAudio, accumulatedMouseY, accumulatedMouseX]);

  // Watch for coin collections and play ca-ching sound
  useEffect(() => {
    // Track collected labyrinth coins
    if (gameState.labyrinthCoins) {
      gameState.labyrinthCoins.forEach((coin: any) => {
        if (coin.collected && coin.collectedAt) {
          const timeSinceCollection = Date.now() - coin.collectedAt;
          // Only play sound once (within first 50ms of collection)
          if (timeSinceCollection < 50 && !coin.soundPlayed) {
            playCoinSound();
            coin.soundPlayed = true; // Mark to prevent replay
          }
        }
      });
    }

    // Track collected coin_shower coins
    if (gameState.coins) {
      gameState.coins.forEach((coin: any) => {
        if (coin.collected && coin.collectedAt) {
          const timeSinceCollection = Date.now() - coin.collectedAt;
          // Only play sound once (within first 50ms of collection)
          if (timeSinceCollection < 50 && !coin.soundPlayed) {
            playCoinSound();
            coin.soundPlayed = true; // Mark to prevent replay
          }
        }
      });
    }
  }, [gameState.labyrinthCoins, gameState.coins, playCoinSound]);

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

  // Pointer lock change handler
  useEffect(() => {
    const handlePointerLockChange = () => {
      if (document.pointerLockElement === canvasRef.current) {
        // Initialize accumulated position to current canvas center
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          setAccumulatedMouseY(rect.height / 2);
          setAccumulatedMouseX(rect.width / 2);
        }
      }
    };

    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => document.removeEventListener('pointerlockchange', handlePointerLockChange);
  }, []);

  // Escape key handler for pointer lock
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && document.pointerLockElement) {
        document.exitPointerLock();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Prevent mobile scrolling globally
  useEffect(() => {
    // Prevent scrolling on mobile devices
    const preventDefault = (e: Event) => e.preventDefault();

    // Force both HTML and body to prevent ANY scrolling and remove default spacing
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100%';
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.body.style.top = '0';
    document.body.style.left = '0';
    document.body.style.margin = '0';
    document.body.style.padding = '0';

    // Prevent scroll on touch devices
    document.addEventListener('touchmove', preventDefault, { passive: false });
    document.addEventListener('wheel', preventDefault, { passive: false });

    return () => {
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
      document.documentElement.style.margin = '';
      document.documentElement.style.padding = '';
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.margin = '';
      document.body.style.padding = '';
      document.removeEventListener('touchmove', preventDefault);
      document.removeEventListener('wheel', preventDefault);
    };
  }, []);

  return (
    <div
      className="flex items-center justify-center"
      style={{
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: '#1a1a1a',
        overflow: 'hidden' // Prevent box-shadows from causing scrolling
      }}
    >
      {/* Outer frame wrapper for rounded corners */}
      <div style={{
        padding: '32px',
        margin: 'auto',
        background: 'linear-gradient(135deg, #444 0%, #2a2a2a 25%, #222 50%, #1a1a1a 75%, #1a1a1a 100%)',
        borderRadius: '32px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
        width: 'fit-content',
      }}>
      {/* Container for game - match canvas size exactly */}
      <div style={{
        position: 'relative',
        width: `${canvasSize.width}px`,
        height: `${canvasSize.height}px`,
        borderRadius: '8px',
        overflow: 'hidden',
      }}>
      <div style={{
        position: 'relative',
        width: `${canvasSize.width}px`,
        height: `${canvasSize.height}px`,
      }}>
        {/* Shared container for canvas and PIXI to ensure perfect alignment */}
        <div style={{
          position: 'relative',
          width: `${canvasSize.width}px`,
          height: `${canvasSize.height}px`,
        }}>
        {/* Canvas for game rendering - hidden when CRT is active (PixiJS shows it instead) */}
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="block"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${canvasSize.width}px`,
            height: `${canvasSize.height}px`,
            background: 'transparent',
            outline: 'none',
            imageRendering: 'auto',
            cursor: cursorHidden ? 'none' : 'default',
            // Disable text smoothing and antialiasing for pixelated text
            fontSmooth: 'never',
            WebkitFontSmoothing: 'none',
            MozOsxFontSmoothing: 'unset',
            textRendering: 'geometricPrecision',
            visibility: crtEffect ? 'hidden' : 'visible', // Hide canvas when CRT is active
          } as React.CSSProperties}
          tabIndex={0}
          onClick={async () => {
            // Handle audio prompt dismissal
            if (showAudioPrompt) {
            audioPromptDismissedRef.current = true; // Set ref like keyboard handler
            setShowAudioPrompt(false);
            // Initialize audio context on user interaction
            await initializeAudio();
            // Don't process game start on this click - just dismiss the prompt
            return;
          }

          // Handle start screen - start game on click
          if (gameState.showStartScreen) {
            await initializeAudio();
            // Start paddle animation
            paddleAnimationStartTimeRef.current = Date.now();
            setPaddleAnimationProgress(0);

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
                console.error('[ERROR] Failed to connect to multiplayer:', error);
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
              console.log('[WARNING] Connection error, starting single player');
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
            // Request pointer lock for continuous mouse control
            if (!document.pointerLockElement) {
              canvasRef.current.requestPointerLock();
            }
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
            // Don't process game start on this touch - just dismiss the prompt
            return;
          }

          // Handle start screen - start game on touch
          if (gameState.showStartScreen) {
            // Start paddle animation
            paddleAnimationStartTimeRef.current = Date.now();
            setPaddleAnimationProgress(0);

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
                console.error('[ERROR] Failed to connect to multiplayer:', error);
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
              console.log('[WARNING] Connection error, starting single player');
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

            // For single player, always control left paddle with Y movement
            // For multiplayer, use smart paddle selection based on game mode
            if (gameState.gameMode === 'player' || gameState.gameMode === 'auto') {
              // Single player - always control left paddle with vertical movement
              setControlSide('left');
              setTouchY(y);
              setTouchX(null);
            } else {
              // Multiplayer mode - determine which paddle to control based on touch position
              const distToLeft = x;
              const distToRight = canvasSize.width - x;
              const distToTop = y;
              const distToBottom = canvasSize.height - y;
              const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

              if (minDist === distToLeft) {
                setControlSide('left');
                setTouchY(y);
                setTouchX(null);
              } else if (minDist === distToRight) {
                setControlSide('right');
                setTouchY(y);
                setTouchX(null);
              } else if (minDist === distToTop) {
                setControlSide('top');
                setTouchX(x);
                setTouchY(null);
              } else {
                setControlSide('bottom');
                setTouchX(x);
                setTouchY(null);
              }
            }
          }
        }}
        onTouchMove={(e) => {
          e.preventDefault();

          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect && e.touches.length > 0) {
            const touch = e.touches[0];
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;

            // Update the appropriate coordinate based on control side
            if (controlSide === 'left' || controlSide === 'right') {
              // Vertical paddles use Y coordinate
              setTouchY(y);
            } else if (controlSide === 'top' || controlSide === 'bottom') {
              // Horizontal paddles use X coordinate
              setTouchX(x);
            }
          }
        }}
        onTouchEnd={(e) => {
          e.preventDefault();

          setTouchY(null);
          setTouchX(null);
          setControlSide(null);
        }}
      />

      {/* PixiJS WebGL container for CRT shader post-processing - visible when CRT is ON */}
      <div
        ref={pixiContainerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: `${canvasSize.width}px`,
          height: `${canvasSize.height}px`,
          cursor: cursorHidden ? 'none' : 'default',
          imageRendering: 'pixelated',
          pointerEvents: 'none', // Let events pass through to canvas
          zIndex: 10, // Above canvas
          visibility: crtEffect ? 'visible' : 'hidden', // Only show when CRT is active
        }}
      />

      {/* Inner border glow overlay - visible inside game area */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 15, // Above everything to be visible
      }} />
      </div>
      </div>
      </div>

      {/* Spectator Mode UI Overlay */}
      {isSpectatorMode && (
        <div className="fixed inset-0 pointer-events-none z-10">
          {/* Spectator mode active - no overlays, just clean game view */}
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

      {/* Ambient Music - only plays on this page */}
      <GlobalAmbientMusic lanMode={lanMode} isSpectatorMode={isSpectatorMode} />

      </div>
    </div>
  );
};

export default Pong404;