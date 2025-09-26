import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

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
  };
  paddles: {
    left: { y: number; height: number; width: number; speed: number; velocity: number; targetY: number; originalHeight: number };
    right: { y: number; height: number; width: number; speed: number; velocity: number; targetY: number; originalHeight: number };
  };
  score: {
    left: number;
    right: number;
  };
  isPlaying: boolean;
  gameMode: 'auto' | 'player' | 'multiplayer';
  colorIndex: number;
  isPaused: boolean;
  pauseEndTime: number;
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
  };
  decrunchEffect: {
    isActive: boolean;
    startTime: number;
    duration: number;
  };
}

interface MultiplayerState {
  playerId: string;
  playerSide: 'left' | 'right' | 'spectator';
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
const BALL_SPEED = 6; // Moderate speed for playable gameplay
const MIN_BALL_SPEED = 4;  // Slower minimum speed
const MAX_BALL_SPEED = 10; // Slower maximum speed
// Game runs at native refresh rate via requestAnimationFrame (typically 60fps)
const PADDLE_ACCELERATION = 0.2; // Reduced acceleration for smoother control
const PADDLE_FRICTION = 0.88; // Slightly more friction for better control
const HUMAN_REACTION_DELAY = 12; // More frames of delay for realistic AI at 60fps
const PANIC_MOVE_CHANCE = 0.08; // Lower chance for panic moves at 60fps
const PANIC_VELOCITY_MULTIPLIER = 8; // Reduced panic speed multiplier
const EXTREME_PANIC_CHANCE = 0.04; // Lower extreme panic chance
const EXTREME_PANIC_MULTIPLIER = 20; // Reduced extreme panic speed

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
  { type: 'multi_ball', pattern: 'plus', color: '#ff9900', description: 'Coming Soon!', scale: 'wholetone', note: 3 },
  { type: 'freeze_opponent', pattern: 'cross', color: '#00ffff', description: 'Freeze Enemy!', scale: 'locrian', note: 0 },
  { type: 'super_speed', pattern: 'stripes', color: '#ffffff', description: 'LUDICROUS SPEED!', scale: 'diminished', note: 7 },
  { type: 'coin_shower', pattern: 'diamond', color: '#ffdd00', description: 'Coin Shower!', scale: 'wholetone', note: 4 },
  { type: 'teleport_ball', pattern: 'star', color: '#9966ff', description: 'Teleport Ball!', scale: 'diminished', note: 1 },
];

// WebSocket server URL - production server on Render
const WS_SERVER_URL = import.meta.env.DEV
  ? 'ws://localhost:3002'
  : 'wss://bms-highscore-challenge.onrender.com';

// Beautiful color palette inspired by retro gaming and synthwave aesthetics
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

const Pong404: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastHeartbeatRef = useRef<number>(0);



  // Dynamic canvas size state with proper aspect ratio
  const [canvasSize, setCanvasSize] = useState({
    width: 1200,
    height: 750
  });
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error' | 'retrying'>('idle');
  const [retryCount, setRetryCount] = useState(0);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [gameState, setGameState] = useState<GameState>({
    ball: {
      x: canvasSize.width / 2,
      y: canvasSize.height / 2,
      dx: BALL_SPEED,
      dy: BALL_SPEED,
      size: 12,
      originalSize: 12,
      isDrunk: false,
      drunkAngle: 0,
      isTeleporting: false,
      lastTeleportTime: 0,
      stuckCheckStartTime: 0,
      stuckCheckStartX: 0,
    },
    paddles: {
      left: { y: Math.max(0, Math.min(canvasSize.height - 80, canvasSize.height / 2 - 40)), height: 80, width: 12, speed: PADDLE_SPEED, velocity: 0, targetY: Math.max(0, Math.min(canvasSize.height - 80, canvasSize.height / 2 - 40)), originalHeight: 80 },
      right: { y: Math.max(0, Math.min(canvasSize.height - 80, canvasSize.height / 2 - 40)), height: 80, width: 12, speed: PADDLE_SPEED, velocity: 0, targetY: Math.max(0, Math.min(canvasSize.height - 80, canvasSize.height / 2 - 40)), originalHeight: 80 },
    },
    score: { left: 0, right: 0 }, // Start with real scoring
    isPlaying: true,
    gameMode: 'auto',
    colorIndex: 0,
    isPaused: false,
    pauseEndTime: 0,
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
    },
    decrunchEffect: {
      isActive: false,
      startTime: 0,
      duration: 0,
    },
  });

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


  // Local multiplayer using localStorage for cross-tab sync
  const connectLocalMultiplayer = useCallback(() => {
    setConnectionStatus('connected');

    // Set up localStorage for cross-tab communication
    const playerId = multiplayerState.playerId || 'player-' + Math.random().toString(36).substr(2, 9);
    const roomId = multiplayerState.roomId || 'local-room';

    // Check existing players in localStorage
    const existingPlayers = JSON.parse(localStorage.getItem('pong-players') || '[]');
    const leftPlayer = existingPlayers.find((p: any) => p.side === 'left');
    const rightPlayer = existingPlayers.find((p: any) => p.side === 'right');

    let playerSide: 'left' | 'right' | 'spectator' = 'spectator';
    let isGameMaster = false;

    if (!leftPlayer) {
      playerSide = 'left';
      isGameMaster = true;
    } else if (!rightPlayer) {
      playerSide = 'right';
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
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionStatus('connecting');

    // Shorter timeout with automatic retry for better UX
    const connectionTimeout = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
        // Auto-retry after short delay
        setTimeout(() => {
          connectWebSocket();
        }, 2000);
      }
    }, 15000); // Reduced from 60s to 15s

    const connectToWebSocket = () => {
      try {

        const ws = new WebSocket(WS_SERVER_URL);
        (ws as any)._createTime = Date.now();
        wsRef.current = ws;


        ws.onopen = () => {
          const openTime = Date.now();
          (ws as any)._openTime = openTime;
          const connectionTime = openTime - (ws as any)._createTime;
          setConnectionStatus('connected');

          // Clear the connection timeout since we connected successfully
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
          }

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
              roomId: multiplayerState.roomId
            };
            try {
              ws.send(JSON.stringify(joinMessage));
            } catch (error) {
            }
          } else {
          }
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            handleWebSocketMessage(message);
          } catch (error) {
          }
        };

        ws.onclose = (event) => {
          const closeTime = Date.now();
          const openDuration = (ws as any)._openTime ? closeTime - (ws as any)._openTime : 0;
          const totalDuration = closeTime - (ws as any)._createTime;


          setConnectionStatus('error');
          setMultiplayerState(prev => ({ ...prev, isConnected: false }));

          // Attempt to reconnect with exponential backoff
          if (!event.wasClean) {
            const retryDelay = Math.min(5000 + Math.random() * 5000, 15000); // 5-10 seconds, max 15s
            reconnectTimeoutRef.current = setTimeout(() => {
              connectWebSocket();
            }, retryDelay);
          }
        };

        ws.onerror = (error) => {

          // Clear the connection timeout since we got an error
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
          }

          setConnectionStatus('error');
        };

      } catch (error) {
        setConnectionStatus('error');
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
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'joined_room':
        setConnectionStatus('connected');
        setConnectionMessage(`Joined as ${message.data.playerSide} player! Game ready.`);
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
          setGameState(message.data.gameState);
        }
        break;

      case 'player_joined':
        setMultiplayerState(prev => ({
          ...prev,
          playerCount: message.data.playerCount
        }));
        break;

      case 'player_left':
        setMultiplayerState(prev => ({
          ...prev,
          playerCount: message.data.playerCount
        }));
        break;

      case 'paddle_updated':
        setGameState(prev => {
          const newState = { ...prev };
          if (message.data.side === 'left') {
            newState.paddles.left.y = message.data.y;
            newState.paddles.left.velocity = message.data.velocity || 0;
            newState.paddles.left.targetY = message.data.targetY || message.data.y;
          } else if (message.data.side === 'right') {
            newState.paddles.right.y = message.data.y;
            newState.paddles.right.velocity = message.data.velocity || 0;
            newState.paddles.right.targetY = message.data.targetY || message.data.y;
          }
          return newState;
        });
        break;

      case 'game_state_updated':
        if (message.data) {
          setGameState(message.data);
        }
        break;

      case 'game_reset':
        if (message.data) {
          setGameState(message.data);
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

      default:
    }
  }, [multiplayerState.playerId, multiplayerState.roomId]);

  // Send paddle update via WebSocket
  const updatePaddlePosition = useCallback((y: number, velocity = 0, targetY?: number) => {

    if (wsRef.current?.readyState === WebSocket.OPEN && multiplayerState.isConnected) {
      wsRef.current.send(JSON.stringify({
        type: 'update_paddle',
        playerId: multiplayerState.playerId,
        data: {
          y,
          velocity,
          targetY: targetY || y
        }
      }));
    }
  }, [multiplayerState.playerId, multiplayerState.isConnected, multiplayerState.playerSide]);

  // Send game state update via localStorage (only for gamemaster)
  const updateGameState = useCallback((newGameState: GameState) => {
    if (multiplayerState.isConnected && multiplayerState.isGameMaster) {
      localStorage.setItem('pong-game-state', JSON.stringify({
        ...newGameState,
        timestamp: Date.now()
      }));

      // Trigger storage event for other tabs
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'pong-game-state',
        newValue: JSON.stringify(newGameState)
      }));
    }
  }, [multiplayerState.isConnected, multiplayerState.isGameMaster]);

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

  // Handle window resize with constrained playfield size
  useEffect(() => {
    const updateCanvasSize = () => {
      // Use 90% of viewport with reasonable constraints
      const viewportWidth = window.innerWidth * 0.9;
      const viewportHeight = window.innerHeight * 0.9;

      // Set reasonable bounds
      const maxWidth = Math.min(viewportWidth, 1200);
      const maxHeight = Math.min(viewportHeight, 700);

      // Use actual dimensions but ensure minimum size
      const width = Math.max(maxWidth, 800);
      const height = Math.max(maxHeight, 500);

      setCanvasSize({ width, height });

      // Update game state when canvas size changes
      setGameState(prev => ({
        ...prev,
        ball: {
          ...prev.ball,
          x: prev.ball.x * (width / prev.ball.x > width ? width : prev.ball.x),
          y: prev.ball.y * (height / prev.ball.y > height ? height : prev.ball.y)
        },
        paddles: {
          left: {
            ...prev.paddles.left,
            y: Math.min(prev.paddles.left.y, height - prev.paddles.left.height)
          },
          right: {
            ...prev.paddles.right,
            y: Math.min(prev.paddles.right.y, height - prev.paddles.right.height)
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

  // Enhanced tone generation with custom volume
  const playTone = useCallback((frequency: number, duration: number, effectType: 'normal' | 'echo' | 'reverb' | 'both' = 'both', volume: number = 0.25) => {
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
    mainGain.gain.setValueAtTime(0, now);
    mainGain.gain.linearRampToValueAtTime(volume, now + 0.01); // Quick attack with custom volume
    mainGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Configure mix levels based on effect type
    const dryLevel = effectType === 'reverb' || effectType === 'both' ? 0.6 : 1.0;
    const reverbLevel = effectType === 'reverb' || effectType === 'both' ? 0.3 : 0.0;
    const echoLevel = effectType === 'echo' || effectType === 'both' ? 0.25 : 0.0;

    dryGain.gain.setValueAtTime(dryLevel, now);
    wetGain.gain.setValueAtTime(reverbLevel, now);
    echoWetGain.gain.setValueAtTime(echoLevel, now);

    // Connect the audio graph
    oscillator.connect(mainGain);

    // Dry signal (direct to output)
    mainGain.connect(dryGain);
    dryGain.connect(ctx.destination);

    // Wet signal (through reverb)
    if ((effectType === 'reverb' || effectType === 'both') && reverbNodeRef.current) {
      mainGain.connect(reverbNodeRef.current);
      reverbNodeRef.current.connect(wetGain);
      wetGain.connect(ctx.destination);
    }

    // Echo signal
    if ((effectType === 'echo' || effectType === 'both') && delayNodeRef.current) {
      mainGain.connect(delayNodeRef.current);
      delayNodeRef.current.connect(echoWetGain);
      echoWetGain.connect(ctx.destination);
    }

    // Start and stop
    oscillator.start(now);
    oscillator.stop(now + duration);
  }, [initializeAudioEffects]);

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

  // Legacy beep function for compatibility
  const playBeep = useCallback((frequency: number, duration: number, effectType: 'normal' | 'echo' | 'reverb' | 'both' = 'both') => {
    playTone(frequency, duration, effectType);
  }, [playTone]);

  // Intelligent melody system for dystopic outer space atmosphere
  const playMelodyNote = useCallback((eventType: 'paddle' | 'wall' | 'score' | 'pickup', pickupData?: any, effectType: 'normal' | 'echo' | 'reverb' | 'both' = 'both') => {
    const now = Date.now();

    // Change scale occasionally for variety (every 30-60 seconds)
    if (now - melodyState.lastScaleChange > 30000 + Math.random() * 30000) {
      const scales = Object.keys(MUSICAL_SCALES);
      const oldScale = melodyState.currentScale;
      do {
        melodyState.currentScale = scales[Math.floor(Math.random() * scales.length)] as keyof typeof MUSICAL_SCALES;
      } while (melodyState.currentScale === oldScale);
      melodyState.lastScaleChange = now;
      console.log(`🎵 Scale changed to: ${melodyState.currentScale}`);
    }

    let frequency: number;
    let duration: number;
    let harmony: number[] = []; // Additional notes for richer sound

    const currentScale = MUSICAL_SCALES[melodyState.currentScale as keyof typeof MUSICAL_SCALES];

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
        // Use pickup-specific scale and note
        if (pickupData && pickupData.scale && pickupData.note !== undefined) {
          const pickupScale = MUSICAL_SCALES[pickupData.scale as keyof typeof MUSICAL_SCALES];
          frequency = pickupScale[pickupData.note % pickupScale.length];

          // Temporary scale shift for pickup effect
          const oldScale = melodyState.currentScale;
          melodyState.currentScale = pickupData.scale;

          // Restore original scale after 2 seconds
          setTimeout(() => {
            melodyState.currentScale = oldScale;
          }, 2000);
        } else {
          frequency = currentScale[melodyState.pickupIndex % currentScale.length];
        }
        duration = 0.3;

        // Ethereal harmony for pickups
        harmony = [
          frequency * 0.75, // Minor seventh
          frequency * 1.33, // Fourth
          frequency * 2.25  // Ninth
        ];

        melodyState.pickupIndex = (melodyState.pickupIndex + 3) % currentScale.length; // Jump by 3
        break;

      default:
        frequency = 440;
        duration = 0.1;
    }

    // Play main note
    playTone(frequency, duration, effectType);

    // Play harmony notes with slight delay for richness
    harmony.forEach((harmonyFreq, index) => {
      setTimeout(() => {
        playTone(harmonyFreq, duration * 0.8, effectType, 0.3); // Lower volume for harmony
      }, index * 20); // Slight delay between harmony notes
    });

  }, [playTone]);

  // Ambient spaceship sound system
  const startAmbienceSound = useCallback(() => {
    if (ambienceActiveRef.current || !audioContextRef.current) return;

    const ctx = audioContextRef.current;
    ambienceActiveRef.current = true;

    // Clear any existing oscillators
    ambienceOscillatorsRef.current.forEach(osc => {
      try { osc.stop(); } catch (e) {}
    });
    ambienceGainsRef.current.forEach(gain => gain.disconnect());
    ambienceOscillatorsRef.current = [];
    ambienceGainsRef.current = [];

    // Create multiple layers of ambient sounds
    const ambienceLayers = [
      { freq: 60, volume: 0.02, type: 'sine' as OscillatorType }, // Deep rumble
      { freq: 120, volume: 0.015, type: 'triangle' as OscillatorType }, // Engine hum
      { freq: 220, volume: 0.008, type: 'sawtooth' as OscillatorType }, // Electrical hum
      { freq: 440, volume: 0.004, type: 'sine' as OscillatorType }, // High frequency whistle
    ];

    ambienceLayers.forEach((layer, index) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const filterNode = ctx.createBiquadFilter();

      oscillator.type = layer.type;
      oscillator.frequency.setValueAtTime(layer.freq, ctx.currentTime);

      // Add subtle frequency modulation for organic feel
      const lfoGain = ctx.createGain();
      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.1 + index * 0.05, ctx.currentTime); // Very slow modulation
      lfo.type = 'sine';
      lfoGain.gain.setValueAtTime(layer.freq * 0.02, ctx.currentTime); // Subtle modulation depth

      lfo.connect(lfoGain);
      lfoGain.connect(oscillator.frequency);
      lfo.start();

      // Low-pass filter for muffled spaceship interior sound
      filterNode.type = 'lowpass';
      filterNode.frequency.setValueAtTime(800 - index * 100, ctx.currentTime);
      filterNode.Q.setValueAtTime(0.5, ctx.currentTime);

      // Volume with slow random fluctuation
      gainNode.gain.setValueAtTime(0, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(layer.volume, ctx.currentTime + 2 + index * 0.5);

      // Connect chain: oscillator -> filter -> gain -> reverb -> destination
      oscillator.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(reverbNodeRef.current || ctx.destination);

      oscillator.start();

      ambienceOscillatorsRef.current.push(oscillator);
      ambienceGainsRef.current.push(gainNode);

      // Add random volume fluctuations
      const addFluctuation = () => {
        if (!ambienceActiveRef.current) return;

        const randomVolume = layer.volume * (0.7 + Math.random() * 0.6);
        const randomTime = ctx.currentTime + Math.random() * 8 + 4; // 4-12 seconds

        try {
          gainNode.gain.exponentialRampToValueAtTime(Math.max(0.001, randomVolume), randomTime);
        } catch (e) {}

        setTimeout(addFluctuation, (Math.random() * 8 + 4) * 1000);
      };

      setTimeout(() => addFluctuation(), (Math.random() * 5 + 2) * 1000);
    });

    // Add occasional mysterious "blips" and "beeps"
    const addRandomBlips = () => {
      if (!ambienceActiveRef.current) return;

      const blipOsc = ctx.createOscillator();
      const blipGain = ctx.createGain();

      // Random mysterious frequencies
      const blipFreqs = [180, 280, 340, 520, 680];
      blipOsc.frequency.setValueAtTime(blipFreqs[Math.floor(Math.random() * blipFreqs.length)], ctx.currentTime);
      blipOsc.type = Math.random() > 0.5 ? 'square' : 'triangle';

      blipGain.gain.setValueAtTime(0, ctx.currentTime);
      blipGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.01);
      blipGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      blipOsc.connect(blipGain);
      blipGain.connect(reverbNodeRef.current || ctx.destination);

      blipOsc.start();
      blipOsc.stop(ctx.currentTime + 0.3);

      // Schedule next blip randomly (15-45 seconds)
      setTimeout(addRandomBlips, (Math.random() * 30 + 15) * 1000);
    };

    // Start blips after initial setup
    setTimeout(addRandomBlips, (Math.random() * 10 + 5) * 1000);

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

  // Auto-start ambient sounds when audio context is ready and game is active
  useEffect(() => {
    if (audioContextRef.current && audioContextRef.current.state === 'running' &&
        (gameState.gameMode === 'player' || gameState.gameMode === 'multiplayer') &&
        !ambienceActiveRef.current) {
      setTimeout(() => startAmbienceSound(), 1000); // Start after 1 second
    }

    // Stop ambient sounds when returning to auto mode
    if (gameState.gameMode === 'auto' && ambienceActiveRef.current) {
      stopAmbienceSound();
    }
  }, [gameState.gameMode, startAmbienceSound, stopAmbienceSound]);

  // Cleanup ambient sounds on unmount
  useEffect(() => {
    return () => {
      stopAmbienceSound();
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
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []); // Empty dependency array = only on mount/unmount

  const [keys, setKeys] = useState({
    w: false,
    s: false,
    up: false,
    down: false,
  });

  // Mouse and touch control state
  const [mouseY, setMouseY] = useState<number | null>(null);
  const [touchY, setTouchY] = useState<number | null>(null);
  const [controlSide, setControlSide] = useState<'left' | 'right' | null>(null);
  const [cursorHidden, setCursorHidden] = useState(false);

  const [infoTextFadeStart, setInfoTextFadeStart] = useState<number | null>(null);
  const leftFrameCountRef = useRef<number>(0);
  const rightFrameCountRef = useRef<number>(0);

  // Pickup system functions
  const createPickup = useCallback(() => {
    const pickupType = PICKUP_TYPES[Math.floor(Math.random() * PICKUP_TYPES.length)];
    const padding = 100; // Stay away from edges
    return {
      x: padding + Math.random() * (canvasSize.width - padding * 2),
      y: padding + Math.random() * (canvasSize.height - padding * 2),
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
    gameState.activeEffects = gameState.activeEffects.filter(effect => {
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

  // Game logic
  const updateGame = useCallback(() => {
    setGameState(prevState => {
      const newState = { ...prevState };



      // Check rumble effect timeout (should work even when paused)
      if (newState.rumbleEffect.isActive) {
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

      // Check if we're in a pause state
      if (newState.isPaused) {
        const currentTime = Date.now();
        if (currentTime >= newState.pauseEndTime) {
          // End pause and resume game
          newState.isPaused = false;
          newState.pauseEndTime = 0;
        } else {
          // Still paused - allow paddle movement but skip ball logic
          // Don't return early, just skip ball/collision logic later
        }
      }

      // SIMPLIFIED: Always allow paddle control regardless of mode
      // Auto-switch to player vs AI mode when any input is detected (if not in multiplayer)
      const hasInput = keys.w || keys.s || keys.up || keys.down || mouseY !== null || touchY !== null;

      if (newState.gameMode === 'auto' && hasInput) {
        newState.gameMode = 'player';
      }

      // SIMPLIFIED: Always allow paddle movement in any mode
      // Update paddle positions with cleaner logic (keyboard, mouse, or touch)
      if (newState.gameMode === 'player' || hasInput) {
        // In player mode, left paddle is AI-controlled - no manual input allowed
        // (AI logic handles the left paddle automatically)

        // Handle right paddle controls (keyboard, mouse, touch) - PLAYER CONTROLS
        if (controlSide === 'right' && (mouseY !== null || touchY !== null)) {
          // Mouse/touch control for right paddle (player)
          const targetY = (touchY !== null ? touchY : mouseY!) - newState.paddles.right.height / 2;
          const clampedY = Math.max(12, Math.min(canvasSize.height - 12 - newState.paddles.right.height, targetY));
          newState.paddles.right.y = clampedY;
          newState.paddles.right.velocity = 0;
        }

        // Arrow key controls (can work alongside mouse)
        if (keys.up) {
          // UP arrow moves UP (decrease Y) - with acceleration
          newState.paddles.right.velocity -= 1.2; // Reduced acceleration
          newState.paddles.right.velocity = Math.max(-newState.paddles.right.speed * 1.5, newState.paddles.right.velocity);
          newState.paddles.right.y += newState.paddles.right.velocity;

          // Add trail for right paddle movement
          if (Math.abs(newState.paddles.right.velocity) > 0.1) {
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
          if (Math.abs(newState.paddles.right.velocity) > 0.1) {
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
        newState.paddles.right.y = Math.max(12, Math.min(canvasSize.height - 12 - newState.paddles.right.height, newState.paddles.right.y));

        // In player mode, make the left paddle AI-controlled (always, since player controls right)
        if (newState.gameMode === 'player') {
          leftFrameCountRef.current++;
          const ballCenterY = newState.ball.y + newState.ball.size / 2;
          const updatePaddleWithAI = (paddle: any, frameCount: number) => {
            const reactionDelay = HUMAN_REACTION_DELAY + 3;
            if (frameCount % reactionDelay === 0) {
              const inaccuracy = (Math.random() - 0.5) * 18;
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
            const ballDistance = Math.abs(newState.ball.x - 0); // Distance from left side
            const isPanicSituation = ballDistance < 300;
            const currentPaddleCenter = paddle.y + paddle.height / 2;
            const ballPaddleDistance = Math.abs(ballCenterY - currentPaddleCenter);
            const ballHeadingTowardsPaddle = newState.ball.dx < 0; // Ball heading left
            const isEmergencyPanic = ballHeadingTowardsPaddle && ballDistance < 150 && ballPaddleDistance > 30;

            if (isEmergencyPanic) {
              const extremePanicDirection = Math.sign(ballCenterY - currentPaddleCenter);
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
            paddle.y += paddle.velocity;
            paddle.y = Math.max(0, Math.min(canvasSize.height - paddle.height, paddle.y));
          };

          updatePaddleWithAI(newState.paddles.left, leftFrameCountRef.current);
        }
      } else if (newState.gameMode === 'multiplayer') {
        // Multiplayer controls (only the paddle assigned to this player, unless in local test mode)
        if (multiplayerState.playerSide === 'left' || localTestMode) {
          const oldY = newState.paddles.left.y;

          // Left paddle - W/S keys (W = UP, S = DOWN) - with acceleration
          if (keys.w) {
            // W key moves UP (decrease Y) - with acceleration
            newState.paddles.left.velocity -= 1.2; // Reduced acceleration
            newState.paddles.left.velocity = Math.max(-newState.paddles.left.speed * 1.5, newState.paddles.left.velocity);
          } else if (keys.s) {
            // S key moves DOWN (increase Y) - with acceleration
            newState.paddles.left.velocity += 1.2; // Reduced acceleration
            newState.paddles.left.velocity = Math.min(newState.paddles.left.speed * 1.5, newState.paddles.left.velocity);
          } else {
            // No input - apply friction to slow down
            newState.paddles.left.velocity *= 0.8; // Friction
            if (Math.abs(newState.paddles.left.velocity) < 0.1) {
              newState.paddles.left.velocity = 0; // Stop when very slow
            }
          }

          // Apply left paddle movement
          newState.paddles.left.y += newState.paddles.left.velocity;
          newState.paddles.left.y = Math.max(12, Math.min(canvasSize.height - 12 - newState.paddles.left.height, newState.paddles.left.y));

          // Add left paddle trail point
          if (Math.abs(newState.paddles.left.velocity) > 0.1) {
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
        if (multiplayerState.playerSide === 'right' || localTestMode) {
          const oldY = newState.paddles.right.y;

          // Right paddle - Arrow keys (UP = UP, DOWN = DOWN) - with acceleration
          if (keys.up) {
            // UP arrow moves UP (decrease Y) - with acceleration
            newState.paddles.right.velocity -= 1.2; // Reduced acceleration
            newState.paddles.right.velocity = Math.max(-newState.paddles.right.speed * 1.5, newState.paddles.right.velocity);
          } else if (keys.down) {
            // DOWN arrow moves DOWN (increase Y) - with acceleration
            newState.paddles.right.velocity += 1.2; // Reduced acceleration
            newState.paddles.right.velocity = Math.min(newState.paddles.right.speed * 1.5, newState.paddles.right.velocity);
          } else {
            // No input - apply friction to slow down
            newState.paddles.right.velocity *= 0.8; // Friction
            if (Math.abs(newState.paddles.right.velocity) < 0.1) {
              newState.paddles.right.velocity = 0; // Stop when very slow
            }
          }

          // Apply right paddle movement
          newState.paddles.right.y += newState.paddles.right.velocity;
          newState.paddles.right.y = Math.max(12, Math.min(canvasSize.height - 12 - newState.paddles.right.height, newState.paddles.right.y));

          // Add right paddle trail point
          if (Math.abs(newState.paddles.right.velocity) > 0.1) {
            newState.trails.rightPaddle.push({
              x: canvasSize.width - 12 - newState.paddles.right.width / 2, // Paddle center X
              y: newState.paddles.right.y + newState.paddles.right.height / 2,
              width: newState.paddles.right.width,
              height: newState.paddles.right.height,
              timestamp: now
            });
          }

          if (Math.abs(newState.paddles.right.y - oldY) > 0.5 && !localTestMode) {
            updatePaddlePosition(newState.paddles.right.y, newState.paddles.right.velocity, newState.paddles.right.y);
          }
        }
      } else {
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

        // Add paddle trail points only when paddles are moving
        const now = Date.now();
        if (Math.abs(newState.paddles.left.velocity) > 0.1) {
          newState.trails.leftPaddle.push({
            x: 12 + newState.paddles.left.width / 2, // Left paddle center x position
            y: newState.paddles.left.y + newState.paddles.left.height / 2,
            timestamp: now,
            width: newState.paddles.left.width,
            height: newState.paddles.left.height
          });
        }
        if (Math.abs(newState.paddles.right.velocity) > 0.1) {
          newState.trails.rightPaddle.push({
            x: canvasSize.width - 12 - newState.paddles.right.width / 2, // Right paddle center x position
            y: newState.paddles.right.y + newState.paddles.right.height / 2,
            timestamp: now,
            width: newState.paddles.right.width,
            height: newState.paddles.right.height
          });
        }
      }

      // Skip ball logic if game is paused (but allow paddle movement)
      if (!newState.isPaused) {
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

          // Teleport every 200-500ms for maximum chaos
          if (timeSinceLastTeleport > 200 + Math.random() * 300) {
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

        // Update ball position
        newState.ball.x += newState.ball.dx;
        newState.ball.y += newState.ball.dy;

        // Add ball trail point
        const now = Date.now();
        newState.trails.ball.push({
          x: newState.ball.x + newState.ball.size / 2,
          y: newState.ball.y + newState.ball.size / 2,
          timestamp: now
        });

        // Clean old trail points (keep last 500ms)
        newState.trails.ball = newState.trails.ball.filter(point => now - point.timestamp < 500);
        newState.trails.leftPaddle = newState.trails.leftPaddle.filter(point => now - point.timestamp < 400);
        newState.trails.rightPaddle = newState.trails.rightPaddle.filter(point => now - point.timestamp < 400);

        // Handle pickup spawning (max 3 simultaneous pickups)
        if (newState.pickups.length < 3 && Date.now() >= newState.nextPickupTime) {
          newState.pickups.push(createPickup());
          newState.nextPickupTime = Date.now() + Math.random() * 8000 + 4000; // 4-12 seconds
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
            applyPickupEffect(pickup, newState);
            newState.pickups.splice(i, 1); // Remove this pickup

            // Change colors on pickup!
            newState.colorIndex = (newState.colorIndex + 1) % COLOR_PALETTE.length;
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
            playMelodyNote('score', null, 'both'); // Play collection sound
          }
        }

        // Update active effects
        updateEffects(newState);

        // Ball collision with top/bottom walls (account for border thickness)
        const borderThickness = 12;
        const ballAtTopWall = newState.ball.y <= borderThickness;
        const ballAtBottomWall = newState.ball.y >= canvasSize.height - borderThickness - newState.ball.size;

        // Only trigger collision if ball is moving towards the wall (prevents repeated triggers)
        if ((ballAtTopWall && newState.ball.dy < 0) || (ballAtBottomWall && newState.ball.dy > 0)) {
          newState.ball.dy = -newState.ball.dy;

          // Change colors on wall hit (like paddle hits)!
          newState.colorIndex = (newState.colorIndex + 1) % COLOR_PALETTE.length;

          // Trigger rumble effect on wall hit
          newState.rumbleEffect.isActive = true;
          newState.rumbleEffect.startTime = Date.now();
          newState.rumbleEffect.intensity = 12; // Much stronger rumble intensity

          // Only play beep sound if we're the game master to avoid duplicate sounds
          if (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer') {
            playMelodyNote('wall', null, 'echo'); // Wall hit with dystopic melody
          }
        }

        // Ball collision with paddles
        const ballLeft = newState.ball.x;
        const ballRight = newState.ball.x + newState.ball.size;
        const ballTop = newState.ball.y;
        const ballBottom = newState.ball.y + newState.ball.size;

        // Advanced paddle collision with speed variation based on hit position
        // Store previous ball position for better collision detection
        const prevBallX = newState.ball.x - newState.ball.dx;
        const prevBallY = newState.ball.y - newState.ball.dy;

        // Left paddle collision (with spacing from wall)
        const leftPaddleX = 30; // 30px spacing from left wall
        const leftPaddleRight = leftPaddleX + newState.paddles.left.width;

        // Check if ball is intersecting with left paddle
        const ballIntersectsLeftPaddle =
          ballLeft <= leftPaddleRight &&
          ballRight >= leftPaddleX &&
          ballBottom >= newState.paddles.left.y &&
          ballTop <= newState.paddles.left.y + newState.paddles.left.height;

        // Check if ball came from the right side (proper collision)
        const ballCameFromRight = prevBallX > leftPaddleRight;

        if (ballIntersectsLeftPaddle && ballCameFromRight && newState.ball.dx < 0) {
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

          // Trigger rumble effect on left paddle hit
          newState.rumbleEffect.isActive = true;
          newState.rumbleEffect.startTime = Date.now();
          newState.rumbleEffect.intensity = 8; // Strong rumble for paddle hits

          // Different beep pitch based on hit position (edge hits = higher pitch)
          // Only play beep sound if we're the game master to avoid duplicate sounds
          if (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer') {
            playMelodyNote('paddle', null, 'both'); // Paddle hit with space melody
          }
        }

        // Right paddle collision (with spacing from wall)
        const rightPaddleX = canvasSize.width - 30 - newState.paddles.right.width; // 30px spacing from right wall
        const rightPaddleLeft = rightPaddleX;

        // Check if ball is intersecting with right paddle
        const ballIntersectsRightPaddle =
          ballRight >= rightPaddleLeft &&
          ballLeft <= rightPaddleX + newState.paddles.right.width &&
          ballBottom >= newState.paddles.right.y &&
          ballTop <= newState.paddles.right.y + newState.paddles.right.height;

        // Check if ball came from the left side (proper collision)
        const ballCameFromLeft = prevBallX < rightPaddleLeft;

        if (ballIntersectsRightPaddle && ballCameFromLeft && newState.ball.dx > 0) {
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

          // Trigger rumble effect on right paddle hit
          newState.rumbleEffect.isActive = true;
          newState.rumbleEffect.startTime = Date.now();
          newState.rumbleEffect.intensity = 8; // Strong rumble for paddle hits

          // Different beep pitch based on hit position (edge hits = higher pitch)
          // Only play beep sound if we're the game master to avoid duplicate sounds
          if (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer') {
            playMelodyNote('paddle', null, 'both'); // Paddle hit with space melody
          }
        }

        // Handle scoring when ball goes off screen
        if (newState.ball.x < -20) {
          // Right player scores (left computer player missed)
          newState.score.right++;

          // Massive rumble effect on score!
          newState.rumbleEffect.isActive = true;
          newState.rumbleEffect.startTime = Date.now();
          newState.rumbleEffect.intensity = 25; // Much stronger rumble for scoring

          // Only play beep sound if we're the game master to avoid duplicate sounds
          if (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer') {
            playMelodyNote('score', null, 'reverb'); // Score with dramatic dystopic chord
          }


          // Reset ball to center
          newState.ball.x = canvasSize.width / 2;
          newState.ball.y = canvasSize.height / 2;
          newState.ball.dx = 0; // Stop ball movement during pause
          newState.ball.dy = 0;
          // Start 2-second pause
          newState.isPaused = true;
          newState.pauseEndTime = Date.now() + 2000; // 2 seconds
          // Store next ball direction for after pause
          setTimeout(() => {
            setGameState(current => ({
              ...current,
              ball: {
                ...current.ball,
                dx: BALL_SPEED, // Always serve to left after right scores
                dy: Math.random() > 0.5 ? BALL_SPEED : -BALL_SPEED
              }
            }));
          }, 2000);
        } else if (newState.ball.x > canvasSize.width + 20) {
          // Left player scores (right computer player missed)
          newState.score.left++;

          // Massive rumble effect on score!
          newState.rumbleEffect.isActive = true;
          newState.rumbleEffect.startTime = Date.now();
          newState.rumbleEffect.intensity = 25; // Much stronger rumble for scoring

          // Only play beep sound if we're the game master to avoid duplicate sounds
          if (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer') {
            playMelodyNote('score', null, 'reverb'); // Score with dramatic dystopic chord
          }


          // Reset ball to center
          newState.ball.x = canvasSize.width / 2;
          newState.ball.y = canvasSize.height / 2;
          newState.ball.dx = 0; // Stop ball movement during pause
          newState.ball.dy = 0;
          // Start 2-second pause
          newState.isPaused = true;
          newState.pauseEndTime = Date.now() + 2000; // 2 seconds
          // Store next ball direction for after pause
          setTimeout(() => {
            setGameState(current => ({
              ...current,
              ball: {
                ...current.ball,
                dx: -BALL_SPEED, // Always serve to right after left scores
                dy: Math.random() > 0.5 ? BALL_SPEED : -BALL_SPEED
              }
            }));
          }, 2000);
        }

        // In multiplayer mode, only sync ball/score changes if we're the gamemaster
        if (newState.gameMode === 'multiplayer' && multiplayerState.isGameMaster) {
          updateGameState(newState);
        }
      } // End of !newState.isPaused check - ball logic only

      return newState;
    });
  }, [keys, playMelodyNote, canvasSize, multiplayerState.isGameMaster, updateGameState, localTestMode, multiplayerState.playerSide, updatePaddlePosition, multiplayerState, mouseY, touchY, controlSide, createPickup, applyPickupEffect, updateEffects, initializeAudio]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore key repeat events
      if (e.repeat) return;

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
          if (localTestMode) {
            setKeys(prev => ({ ...prev, w: true }));
          }
          break;
        case 'd':
          if (localTestMode) {
            setKeys(prev => ({ ...prev, s: true }));
          }
          break;
        case 'l':
          e.preventDefault();
          setLocalTestMode(prev => !prev);
          break;
        case 'c':
          e.preventDefault();
          setCrtEffect(prev => !prev);
          break;
        case ' ':
          e.preventDefault();

          // Don't allow multiple connection attempts
          if (connectionStatus === 'connecting') {
            return;
          }

          if (!multiplayerState.isConnected && connectionStatus !== 'error') {
            try {
              connectWebSocket();
              setGameState(prev => ({
                ...prev,
                gameMode: 'multiplayer',
                score: { left: 0, right: 0 }
              }));
            } catch (error) {
            }
          } else if (connectionStatus === 'error') {
            setConnectionStatus('idle');
            try {
              connectWebSocket();
              setGameState(prev => ({
                ...prev,
                gameMode: 'multiplayer',
                score: { left: 0, right: 0 }
              }));
            } catch (error) {
            }
          } else {
            if (gameState.gameMode !== 'multiplayer') {
              setGameState(prev => ({
                ...prev,
                gameMode: 'multiplayer'
              }));
            }
          }
          break;
        case 'r':
          // Reset game room (for testing)
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            try {
              resetRoom();
              setMultiplayerState(prev => ({
                ...prev,
                isConnected: false,
                playerSide: 'spectator',
                isGameMaster: false
              }));
              setGameState(prev => ({
                ...prev,
                gameMode: 'auto'
              }));
            } catch (error) {
            }
          }
          break;
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
          if (localTestMode) {
            setKeys(prev => ({ ...prev, w: false }));
          }
          break;
        case 'd':
          if (localTestMode) {
            setKeys(prev => ({ ...prev, s: false }));
          }
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

  // Simplified CRT Effect - overlay effects only for better performance and appearance
  const applyCRTEffect = useCallback((ctx: CanvasRenderingContext2D, canvasSize: { width: number; height: number }) => {
    const time = Date.now() * 0.001;
    const frameCount = Math.floor(time * 15); // Frame count for animation timing

    ctx.save();

    // 1. CRT Curvature Effect - Visible edge darkening to simulate curved screen
    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;

    ctx.globalCompositeOperation = 'multiply';
    const curvatureGradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, Math.max(canvasSize.width, canvasSize.height) * 0.7
    );
    curvatureGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    curvatureGradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.95)');
    curvatureGradient.addColorStop(0.9, 'rgba(255, 255, 255, 0.8)');
    curvatureGradient.addColorStop(1, 'rgba(255, 255, 255, 0.65)'); // More visible edge darkening

    ctx.fillStyle = curvatureGradient;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // 2. Scanlines - Most important CRT effect, highly optimized
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 1;

    // Pre-calculate scanline pattern once per 4 frames for better performance
    const scanlineOffset = frameCount % 2;

    // Draw scanlines in batches using gradients for better performance
    const scanlineGradient = ctx.createLinearGradient(0, 0, 0, 4);
    scanlineGradient.addColorStop(0, 'rgba(0, 0, 0, 0.2)');
    scanlineGradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
    scanlineGradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');

    ctx.fillStyle = scanlineGradient;

    // Draw scanlines every 2 pixels with pattern offset
    for (let y = scanlineOffset; y < canvasSize.height; y += 4) {
      ctx.fillRect(0, y, canvasSize.width, 1);
    }


    // 4. Vignette - Use single radial gradient (cached)
    ctx.globalCompositeOperation = 'multiply';
    const vignetteGradient = ctx.createRadialGradient(
      canvasSize.width / 2, canvasSize.height / 2, 0,
      canvasSize.width / 2, canvasSize.height / 2, canvasSize.width * 0.7
    );
    vignetteGradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    vignetteGradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.9)');
    vignetteGradient.addColorStop(1, 'rgba(255, 255, 255, 0.7)');

    ctx.fillStyle = vignetteGradient;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // 5. Screen Flicker - Simple but effective
    const flicker = 0.98 + 0.015 * Math.sin(time * 47); // Different frequency to avoid patterns
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

      // Minimal glow around center line only
      ctx.fillRect(canvasSize.width / 2 - 1, 0, 2, canvasSize.height);
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

    // Apply rumble effect by offsetting the entire canvas content
    let rumbleOffsetX = 0;
    let rumbleOffsetY = 0;
    if (gameState.rumbleEffect.isActive) {
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

    // Optimize canvas for performance
    ctx.imageSmoothingEnabled = false; // Disable anti-aliasing for pixel-perfect rendering

    // Get current color scheme
    const currentColors = COLOR_PALETTE[gameState.colorIndex];

    // Clear canvas with dynamic background color
    ctx.fillStyle = currentColors.background;
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

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

    // Draw center line (dashed) - thick as paddles - using dynamic color
    ctx.strokeStyle = currentColors.foreground;
    ctx.lineWidth = 12;
    ctx.setLineDash([20, 20]); // Larger dashes to match thickness
    ctx.beginPath();
    ctx.moveTo(canvasSize.width / 2, 0);
    ctx.lineTo(canvasSize.width / 2, canvasSize.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw comet trails first (behind everything)
    const currentTime = Date.now();

    // Draw ball trail
    if (gameState.trails.ball.length > 1) {
      for (let i = 0; i < gameState.trails.ball.length - 1; i++) {
        const point = gameState.trails.ball[i];
        const age = currentTime - point.timestamp;
        const alpha = Math.max(0, 1 - (age / 500)); // Fade over 500ms

        if (alpha > 0) {
          ctx.globalAlpha = alpha * 0.6; // Make trails semi-transparent
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
    const renderPaddleTrail = (trail: TrailPoint[], paddleX: number) => {
      if (trail.length > 1) {
        for (let i = 0; i < trail.length - 1; i++) {
          const point = trail[i];
          const age = currentTime - point.timestamp;
          const alpha = Math.max(0, 1 - (age / 400)); // Fade over 400ms

          if (alpha > 0 && point.width && point.height) {
            ctx.globalAlpha = alpha * 0.4; // Make paddle trails more subtle
            ctx.fillStyle = currentColors.foreground;

            // Decrease size based on age
            const trailWidth = point.width * (0.5 + alpha * 0.5);
            const trailHeight = point.height * (0.5 + alpha * 0.5);

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

    // Render left and right paddle trails
    renderPaddleTrail(gameState.trails.leftPaddle, 30 + gameState.paddles.left.width / 2);
    renderPaddleTrail(gameState.trails.rightPaddle, canvasSize.width - 30 - gameState.paddles.right.width / 2);

    // Reset alpha for normal rendering
    ctx.globalAlpha = 1;

    // Draw paddles - using dynamic color (with spacing from walls)
    ctx.fillStyle = currentColors.foreground;
    const leftPaddleX = 30; // 30px spacing from left wall
    const rightPaddleX = canvasSize.width - 30 - gameState.paddles.right.width; // 30px spacing from right wall
    ctx.fillRect(leftPaddleX, gameState.paddles.left.y, gameState.paddles.left.width, gameState.paddles.left.height);
    ctx.fillRect(rightPaddleX, gameState.paddles.right.y, gameState.paddles.right.width, gameState.paddles.right.height);

    // Draw ball - using dynamic color (hide during pause)
    if (!gameState.isPaused) {
      // Check if ball should be invisible
      const invisibleEffect = gameState.activeEffects.find(e => e.type === 'invisible_ball');
      if (!invisibleEffect) {
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

    // Draw pickups if they exist
    gameState.pickups.forEach((pickup) => {
      const time = Date.now() * 0.005;
      const pulse = 0.8 + Math.sin(time) * 0.2; // Pulsing effect

      ctx.save();
      ctx.globalAlpha = pulse;

      // Draw pixelated pattern based on pickup type
      const drawPixelatedPattern = (pattern: string, x: number, y: number, size: number, color: string) => {
        const pixelSize = 12; // Each pixel is 12x12 canvas pixels to match score font
        const gridSize = Math.floor(size / pixelSize);

        ctx.fillStyle = color;

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
            const dotSize = 2;
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
      const time = Date.now() * 0.008;
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
    ctx.font = 'bold 48px "Press Start 2P", monospace';
    ctx.fillStyle = currentColors.foreground; // Use dynamic color for scores too
    ctx.textAlign = 'center';
    const leftScoreX = canvasSize.width / 4;
    const rightScoreX = (canvasSize.width * 3) / 4;
    const scoreY = 80; // Moved down from 60 to 80 for more spacing from top

    // Display scores with padding
    const leftScore = gameState.score.left.toString().padStart(2, '0');
    const rightScore = gameState.score.right.toString().padStart(2, '0');
    ctx.fillText(leftScore, leftScoreX, scoreY);
    ctx.fillText(rightScore, rightScoreX, scoreY);

    // Draw active effects status
    if (gameState.activeEffects.length > 0) {
      ctx.font = 'bold 10px "Press Start 2P", monospace';
      ctx.fillStyle = currentColors.foreground;
      ctx.textAlign = 'center';

      gameState.activeEffects.forEach((effect, index) => {
        const remaining = Math.ceil((effect.duration - (Date.now() - effect.startTime)) / 1000);
        if (remaining > 0) {
          const pickupData = PICKUP_TYPES.find(p => p.type === effect.type);
          if (pickupData) {
            const yPos = 150 + (index * 15);
            ctx.fillText(`${pickupData.description} ${remaining}s`, canvasSize.width / 2, yPos);
          }
        }
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
      } else if (connectionStatus === 'retrying') {
        const dots = '.'.repeat((Math.floor(Date.now() / 300) % 4) + 1);
        ctx.fillText(`RETRYING${dots}`, canvasSize.width / 2, canvasSize.height - 80);
        ctx.fillText(connectionMessage || `Retry attempt ${retryCount}/5...`, canvasSize.width / 2, canvasSize.height - 60);
        ctx.fillText('Connection timeout - automatically retrying', canvasSize.width / 2, canvasSize.height - 40);
        ctx.fillText(`Press C to toggle CRT effect (${crtEffect ? 'ON' : 'OFF'})`, canvasSize.width / 2, canvasSize.height - 20);
      } else if (connectionStatus === 'error') {
        ctx.fillText('❌ CONNECTION FAILED', canvasSize.width / 2, canvasSize.height - 80);
        ctx.fillText(connectionMessage || 'Server may be sleeping or unreachable', canvasSize.width / 2, canvasSize.height - 60);
        ctx.fillText('Press SPACEBAR to retry connection', canvasSize.width / 2, canvasSize.height - 40);
        ctx.fillText(`Press C to toggle CRT effect (${crtEffect ? 'ON' : 'OFF'})`, canvasSize.width / 2, canvasSize.height - 20);
      } else {
        ctx.fillText('Press SPACEBAR to join online multiplayer', canvasSize.width / 2, canvasSize.height - 80);
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
        } else if (connectionStatus === 'retrying') {
          const dots = '.'.repeat((Math.floor(Date.now() / 300) % 4) + 1);
          ctx.fillText(`RETRYING CONNECTION${dots}`, canvasSize.width / 2, canvasSize.height - 80);
          ctx.fillText(connectionMessage || `Attempt ${retryCount}/5...`, canvasSize.width / 2, canvasSize.height - 60);
        } else if (connectionStatus === 'error') {
          ctx.fillText('❌ CONNECTION FAILED', canvasSize.width / 2, canvasSize.height - 80);
          ctx.fillText('Press SPACEBAR to retry', canvasSize.width / 2, canvasSize.height - 60);
        } else if (connectionStatus === 'connected' || multiplayerState.isConnected) {
          // Use the latest state from ref to handle React timing issues
          const currentMultiplayerState = latestMultiplayerStateRef.current;

          // Only log if there's a state mismatch (debugging timing issues)
          if (currentMultiplayerState.playerSide !== multiplayerState.playerSide) {
          }

          const playerSideText = currentMultiplayerState.playerSide === 'spectator'
            ? 'SPECTATING'
            : `YOU: ${currentMultiplayerState.playerSide.toUpperCase()} PADDLE`;

          ctx.fillText('MULTIPLAYER MODE', canvasSize.width / 2, canvasSize.height - 100);
          ctx.fillText(playerSideText, canvasSize.width / 2, canvasSize.height - 80);

          if (currentMultiplayerState.playerSide !== 'spectator') {
            const controls = localTestMode
              ? 'A/D = left paddle, ↑/↓ = right paddle'
              : currentMultiplayerState.playerSide === 'left'
                ? 'W/S keys OR hover mouse'
                : '↑/↓ arrows OR hover mouse';
            ctx.fillText(`Controls: ${controls}`, canvasSize.width / 2, canvasSize.height - 60);
          }

          if (localTestMode) {
            ctx.fillText('LOCAL TEST MODE - Press L to toggle', canvasSize.width / 2, canvasSize.height - 40);
          } else {
            ctx.fillText('Press L for local test mode', canvasSize.width / 2, canvasSize.height - 40);
          }
          ctx.fillText(`Press C to toggle CRT effect (${crtEffect ? 'ON' : 'OFF'})`, canvasSize.width / 2, canvasSize.height - 20);
        } else {
          ctx.fillText('CONNECTING...', canvasSize.width / 2, canvasSize.height - 60);
        }

        // Restore color
        ctx.fillStyle = currentColors.foreground;
      }

      // Spacebar instruction
      ctx.textAlign = 'center';
      ctx.font = 'bold 10px "Press Start 2P", monospace';
      ctx.fillText('Press SPACEBAR to return to auto-play', canvasSize.width / 2, canvasSize.height - 20);
    } else {
      // Player mode controls
      ctx.textAlign = 'left';
      ctx.font = 'bold 12px "Press Start 2P", monospace';

      // Left side controls (AI)
      ctx.fillText('AI Opponent:', 30, canvasSize.height - 60);
      ctx.fillText('Computer controlled', 30, canvasSize.height - 40);

      // Right side controls (player)
      ctx.textAlign = 'right';
      ctx.fillText('Player:', canvasSize.width - 30, canvasSize.height - 60);
      ctx.fillText('↑/↓ arrows OR mouse', canvasSize.width - 30, canvasSize.height - 40);

      // Center instruction
      ctx.textAlign = 'center';
      ctx.font = 'bold 10px "Press Start 2P", monospace';
      ctx.fillText('Press SPACEBAR to return to auto-play', canvasSize.width / 2, canvasSize.height - 40);
      ctx.fillText(`Press C to toggle CRT effect (${crtEffect ? 'ON' : 'OFF'})`, canvasSize.width / 2, canvasSize.height - 20);
    }

    // Apply CRT shader effect (if enabled) - but only do expensive pixel distortion occasionally
    if (crtEffect) {
      applyCRTEffect(ctx, canvasSize);
    }


    // Reset canvas transformation after rumble effect
    if (gameState.rumbleEffect.isActive) {
      ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset to identity matrix
    }

  }, [gameState, canvasSize, connectionStatus, multiplayerState.isConnected, multiplayerState.playerSide, infoTextFadeStart, localTestMode, crtEffect, applyCRTEffect]);

  // High-performance 60fps game loop
  useEffect(() => {
    if (!gameState.isPlaying) return;

    let lastTime = 0;

    const gameLoop = (currentTime: number) => {
      // Calculate actual delta time
      const deltaTime = currentTime - lastTime;
      lastTime = currentTime;

      // Cap delta time to prevent spiral of death on lag
      const clampedDelta = Math.min(deltaTime, 33.33); // Max 33ms (30fps minimum)

      // Update game logic at consistent rate
      updateGame();

      // Render immediately after game update for best performance
      render();

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    // Start the game loop
    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState.isPlaying, updateGame, render]);


  // Prevent React strict mode from causing duplicate WebSocket connections
  const hasInitialized = useRef(false);

  // Listen for localStorage events from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pong-game-state' && e.newValue && !multiplayerState.isGameMaster) {
        try {
          const gameState = JSON.parse(e.newValue);
          setGameState(gameState);
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
          cursor: cursorHidden ? 'none' : 'default'
        }}
        tabIndex={0}
        onClick={() => {
          if (canvasRef.current) {
            canvasRef.current.focus();
          }
          setCursorHidden(true);
        }}
        onMouseMove={async (e) => {
          // Initialize audio on first mouse interaction
          await initializeAudio();
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            const y = e.clientY - rect.top;
            setMouseY(y);

            // In multiplayer, only control your assigned paddle
            if (gameState.gameMode === 'multiplayer') {
              setControlSide(multiplayerState.playerSide === 'spectator' ? null : multiplayerState.playerSide);
            } else {
              // In single player vs AI, always control right paddle (player)
              setControlSide('right');
            }

          }
        }}
        onMouseEnter={() => {
          setCursorHidden(true);
        }}
        onMouseLeave={() => {
          // Disable mouse control when leaving canvas
          setMouseY(null);
          setControlSide(null);
          setCursorHidden(false);
        }}
        onTouchStart={async (e) => {
          e.preventDefault();
          // Initialize audio on first touch
          await initializeAudio();
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

      {/* Hidden back link for navigation (accessible via keyboard) */}
      <Link
        to="/"
        className="fixed top-4 left-4 opacity-0 hover:opacity-100 font-arcade text-xs z-10 transition-opacity"
        style={{ color: COLOR_PALETTE[gameState.colorIndex].foreground }}
      >
        ← Home
      </Link>
    </div>
  );
};

export default Pong404;