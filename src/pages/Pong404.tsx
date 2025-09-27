import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import SamJs from 'sam-js';

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
const BALL_SPEED = 6; // Moderate speed for playable gameplay
const MIN_BALL_SPEED = 4;  // Slower minimum speed
const MAX_BALL_SPEED = 10; // Slower maximum speed
// Game runs at native refresh rate via requestAnimationFrame (typically 60fps)
const PADDLE_ACCELERATION = 0.2; // Reduced acceleration for smoother control
const PADDLE_FRICTION = 0.88; // Slightly more friction for better control
const HUMAN_REACTION_DELAY = 8; // Reduced delay for more responsive AI at 60fps
const PANIC_MOVE_CHANCE = 0.08; // Lower chance for panic moves at 60fps
const COLLISION_BUFFER = 3; // Extra pixels for collision detection tolerance
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

  // Check URL parameters for spectator mode
  const urlParams = new URLSearchParams(window.location.search);
  const isSpectatorMode = urlParams.get('spectator') === 'true' || urlParams.get('mode') === 'spectator';

  // Dynamic canvas size state with proper aspect ratio (larger for spectator mode)
  const [canvasSize, setCanvasSize] = useState({
    width: isSpectatorMode ? 1600 : 1200,
    height: isSpectatorMode ? 1000 : 750
  });
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error' | 'retrying'>('idle');
  const [retryCount, setRetryCount] = useState(0);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [isCRTEnabled, setIsCRTEnabled] = useState(false);

  const [gameState, _setGameState] = useState<GameState>({
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
      lastTouchedBy: null,
      previousTouchedBy: null,
    },
    paddles: {
      left: { y: Math.max(0, Math.min(canvasSize.height - 120, canvasSize.height / 2 - 60)), height: 120, width: 12, speed: PADDLE_SPEED, velocity: 0, targetY: Math.max(0, Math.min(canvasSize.height - 120, canvasSize.height / 2 - 60)), originalHeight: 120 },
      right: { y: Math.max(0, Math.min(canvasSize.height - 120, canvasSize.height / 2 - 60)), height: 120, width: 12, speed: PADDLE_SPEED, velocity: 0, targetY: Math.max(0, Math.min(canvasSize.height - 120, canvasSize.height / 2 - 60)), originalHeight: 120 },
      top: { x: Math.max(0, Math.min(canvasSize.width - 120, canvasSize.width / 2 - 60)), height: 12, width: 120, speed: PADDLE_SPEED, velocity: 0, targetX: Math.max(0, Math.min(canvasSize.width - 120, canvasSize.width / 2 - 60)), originalWidth: 120 },
      bottom: { x: Math.max(0, Math.min(canvasSize.width - 120, canvasSize.width / 2 - 60)), height: 12, width: 120, speed: PADDLE_SPEED, velocity: 0, targetX: Math.max(0, Math.min(canvasSize.width - 120, canvasSize.width / 2 - 60)), originalWidth: 120 },
    },
    score: { left: 0, right: 0, top: 0, bottom: 0 }, // 4-player scoring
    isPlaying: false,
    showStartScreen: true,
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
  });

  // Wrapper around setGameState to ensure top/bottom paddles are always preserved
  const setGameState = useCallback((newStateOrUpdater: GameState | ((prev: GameState) => GameState)) => {
    if (typeof newStateOrUpdater === 'function') {
      _setGameState(prevState => {
        const newState = newStateOrUpdater(prevState);

        // Always ensure top and bottom paddles exist
        if (!newState.paddles.top && prevState.paddles.top) {
          console.log('🔧 Restoring missing TOP paddle');
          newState.paddles.top = prevState.paddles.top;
        }
        if (!newState.paddles.bottom && prevState.paddles.bottom) {
          console.log('🔧 Restoring missing BOTTOM paddle');
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
          console.log('🔧 Restoring missing TOP paddle from direct replacement');
          finalState.paddles.top = prevState.paddles.top;
        }
        if (!finalState.paddles.bottom && prevState?.paddles.bottom) {
          console.log('🔧 Restoring missing BOTTOM paddle from direct replacement');
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
              roomId: multiplayerState.roomId,
              data: { forceSpectator: isSpectatorMode }
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
          console.log('🔍 Server sent gameState with paddles:', message.data.gameState.paddles);
          console.log('🔍 Client prevState has paddles:', Object.keys(prevState.paddles));
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

  // Send game state update via WebSocket (only for gamemaster)
  const updateGameState = useCallback((newGameState: GameState) => {
    if (wsRef.current?.readyState === WebSocket.OPEN &&
        multiplayerState.isConnected &&
        multiplayerState.isGameMaster) {
      wsRef.current.send(JSON.stringify({
        type: 'update_game_state',
        playerId: multiplayerState.playerId,
        roomId: multiplayerState.roomId,
        data: newGameState
      }));
    }
  }, [multiplayerState.isConnected, multiplayerState.isGameMaster, multiplayerState.playerId, multiplayerState.roomId]);

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

    // Ensure beeps master gain stays at correct level
    beepsMasterGainRef.current.gain.setValueAtTime(0.15, ctx.currentTime);

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

      // Ambient sounds will automatically use the new scale on their next fluctuation
    }

    let frequency: number;
    let duration: number;
    let harmony: number[] = []; // Additional notes for richer sound

    const currentScale = MUSICAL_SCALES[melodyState.currentScale as keyof typeof MUSICAL_SCALES];

    switch (eventType) {
      case 'paddle':
        // Ascending melody pattern for paddle hits - use higher octave to avoid drone masking
        const paddleNote = currentScale[melodyState.paddleHitIndex % currentScale.length];
        frequency = paddleNote * 4; // Two octaves higher than drone
        duration = 0.15;

        // Add harmony (fifth interval for space-like resonance)
        const fifthIndex = (melodyState.paddleHitIndex + 2) % currentScale.length;
        harmony = [currentScale[fifthIndex] * 3]; // Match higher octave

        melodyState.paddleHitIndex = (melodyState.paddleHitIndex + 1) % currentScale.length;
        break;

      case 'wall':
        // Descending pattern for wall hits (more ominous) - use higher octave to avoid drone masking
        const wallNoteIndex = (currentScale.length - 1) - (melodyState.wallHitIndex % currentScale.length);
        frequency = currentScale[wallNoteIndex] * 3; // Higher octave than drone
        duration = 0.12;

        // Add dissonant harmony (minor second)
        const dissonantIndex = (wallNoteIndex + 1) % currentScale.length;
        harmony = [currentScale[dissonantIndex] * 3.3]; // Match higher octave with slight dissonance

        melodyState.wallHitIndex = (melodyState.wallHitIndex + 1) % currentScale.length;
        break;

      case 'score':
        // Dramatic chord progression for scoring - use higher octave to avoid drone masking
        const scoreBase = currentScale[melodyState.scoreIndex % currentScale.length];
        frequency = scoreBase * 2; // One octave higher than drone
        duration = 0.8; // Much longer for impact

        // Rich chord with multiple harmonies - all in higher octave range
        harmony = [
          scoreBase * 1.0,  // Same octave as drone (for bass)
          scoreBase * 2.5,  // Minor third in higher octave
          scoreBase * 3.0,  // Fifth in higher octave
          scoreBase * 4.0   // Two octaves above
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
        playTone(harmonyFreq, duration * 0.8, effectType, 0.025); // Much lower volume for harmony
      }, index * 20); // Slight delay between harmony notes
    });

  }, [playTone]);

  // Subtle background ambience - very low volume, deep frequencies only
  const startAmbienceSound = useCallback(() => {
    console.log('🎭 startAmbienceSound called - DRAMATIC CINEMATIC MODE');

    if (ambienceActiveRef.current || !audioContextRef.current) {
      console.log('🎵 Ambient sound start cancelled - already active or no audio context');
      return;
    }

    console.log('🎵 Starting ambient sounds now!');
    const ctx = audioContextRef.current;
    ambienceActiveRef.current = true;

    // Create dedicated ambient audio bus with DRAMATIC master control
    if (!ambienceMasterGainRef.current) {
      ambienceMasterGainRef.current = ctx.createGain();
      ambienceMasterGainRef.current.gain.setValueAtTime(0.15, ctx.currentTime); // Background level for drama
      ambienceMasterGainRef.current.connect(ctx.destination);

      // Add DRAMATIC master volume swells every 15-30 seconds
      const addMasterDrama = () => {
        if (!ambienceMasterGainRef.current || !ambienceActiveRef.current) return;

        const dramaticVolume = 0.08 + Math.random() * 0.12; // 0.08 to 0.2 - subtle background swells
        const swellDuration = 8 + Math.random() * 12; // 8-20 second swells
        const now = ctx.currentTime;

        try {
          ambienceMasterGainRef.current.gain.exponentialRampToValueAtTime(dramaticVolume, now + swellDuration);
          console.log(`🎭 MASTER DRAMA SWELL: ${dramaticVolume.toFixed(2)} over ${swellDuration.toFixed(1)}s`);
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

    // Create dramatic, cinematic ambient layers with spaceship humming
    const currentScale = MUSICAL_SCALES[melodyState.currentScale as keyof typeof MUSICAL_SCALES];
    const ambienceLayers = [
      // SPACESHIP HUMMING - Continuous lonely space atmosphere
      { freq: 60, volume: 0.35, type: 'sine' as OscillatorType, modDepth: 0.02, modRate: 0.08, tension: 'humming' }, // Deep engine hum
      { freq: 120, volume: 0.25, type: 'triangle' as OscillatorType, modDepth: 0.015, modRate: 0.12, tension: 'humming' }, // Ventilation system
      { freq: 180, volume: 0.2, type: 'sine' as OscillatorType, modDepth: 0.01, modRate: 0.06, tension: 'humming' }, // Generator harmonics
      { freq: 90, volume: 0.15, type: 'sawtooth' as OscillatorType, modDepth: 0.008, modRate: 0.04, tension: 'humming' }, // Low machinery
      { freq: 240, volume: 0.12, type: 'triangle' as OscillatorType, modDepth: 0.012, modRate: 0.09, tension: 'humming' }, // High systems

      // DRAMATIC SUB-BASS FOUNDATION - Ominous but subtle
      { freq: currentScale[0] * 0.2, volume: 0.25, type: 'sine' as OscillatorType, modDepth: 0.08, modRate: 0.05, tension: 'ominous' },
      { freq: currentScale[0] * 0.4, volume: 0.22, type: 'sawtooth' as OscillatorType, modDepth: 0.06, modRate: 0.08, tension: 'ominous' },
      { freq: currentScale[4] * 0.25, volume: 0.2, type: 'triangle' as OscillatorType, modDepth: 0.07, modRate: 0.12, tension: 'ominous' },

      // TENSION BUILDERS - Dissonant but background
      { freq: currentScale[1] * 0.6, volume: 0.18, type: 'sawtooth' as OscillatorType, modDepth: 0.12, modRate: 0.18, tension: 'suspense' },
      { freq: currentScale[2] * 0.8, volume: 0.16, type: 'square' as OscillatorType, modDepth: 0.1, modRate: 0.15, tension: 'suspense' },
      { freq: currentScale[3] * 0.9, volume: 0.14, type: 'sawtooth' as OscillatorType, modDepth: 0.09, modRate: 0.22, tension: 'suspense' },

      // CINEMATIC MID-RANGE - Epic but restrained
      { freq: currentScale[0] * 1.2, volume: 0.12, type: 'triangle' as OscillatorType, modDepth: 0.15, modRate: 0.28, tension: 'epic' },
      { freq: currentScale[2] * 1.5, volume: 0.11, type: 'sawtooth' as OscillatorType, modDepth: 0.18, modRate: 0.35, tension: 'epic' },
      { freq: currentScale[4] * 1.8, volume: 0.1, type: 'square' as OscillatorType, modDepth: 0.2, modRate: 0.42, tension: 'epic' },

      // DRAMATIC HARMONICS - Subtle intensity
      { freq: currentScale[1] * 2.2, volume: 0.09, type: 'sawtooth' as OscillatorType, modDepth: 0.25, modRate: 0.48, tension: 'intense' },
      { freq: currentScale[3] * 2.8, volume: 0.08, type: 'triangle' as OscillatorType, modDepth: 0.22, modRate: 0.55, tension: 'intense' },
      { freq: currentScale[0] * 3.5, volume: 0.07, type: 'square' as OscillatorType, modDepth: 0.28, modRate: 0.62, tension: 'intense' },

      // ETHEREAL DRAMA - Whisper-level tension
      { freq: currentScale[2] * 4.2, volume: 0.06, type: 'sine' as OscillatorType, modDepth: 0.35, modRate: 0.75, tension: 'ethereal' },
      { freq: currentScale[4] * 5.0, volume: 0.05, type: 'triangle' as OscillatorType, modDepth: 0.4, modRate: 0.88, tension: 'ethereal' },
      { freq: currentScale[1] * 6.5, volume: 0.04, type: 'sine' as OscillatorType, modDepth: 0.45, modRate: 1.2, tension: 'ethereal' },

      // DRAMATIC OVERTONES - Barely audible sparkle
      { freq: currentScale[3] * 7.8, volume: 0.03, type: 'triangle' as OscillatorType, modDepth: 0.5, modRate: 1.5, tension: 'sparkle' },
      { freq: currentScale[0] * 9.2, volume: 0.02, type: 'sine' as OscillatorType, modDepth: 0.6, modRate: 1.8, tension: 'sparkle' },
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
          lfo.type = 'sawtooth'; // Harsh, threatening
          modCharacter = { rate: layer.modRate * 0.3, depth: layer.modDepth * 2.5 };
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
          lfo.type = 'square'; // Chaotic energy
          modCharacter = { rate: layer.modRate * 2.5, depth: layer.modDepth * 5.0 };
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
          console.log('🎵 Fluctuation stopped - ambienceActiveRef is false');
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
        console.log(`🎭 DRAMA Layer ${index} (${(layer as any).tension}): ${fluctuationDuration.toFixed(2)}s, volume: ${randomVolume.toFixed(3)}`);
      };

      addFluctuation(); // Start fluctuation immediately
    });

    // Restart oscillators every 5 minutes to ensure they never end
    const restartInterval = setInterval(() => {
      if (ambienceActiveRef.current) {
        console.log('🎵 Restarting ambient oscillators to ensure continuity');
        stopAmbienceSound();
        setTimeout(() => startAmbienceSound(), 100);
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

  // Public speech function that adds to queue
  // Simple speech function with overlap prevention
  const speakRobotic = useCallback((text: string) => {
    // Skip if already speaking
    if (isSpeakingRef.current) {
      console.log(`🤖 Skipping speech (already speaking): "${text}"`);
      return;
    }

    isSpeakingRef.current = true;
    console.log(`🤖 SAM Speaking: "${text}"`);

    // Initialize audio context if needed
    if (!audioContextRef.current) {
      initializeAudio();
    }

    // Create dedicated speech audio bus if it doesn't exist
    if (!speechMasterGainRef.current && audioContextRef.current) {
      speechMasterGainRef.current = audioContextRef.current.createGain();
      speechMasterGainRef.current.gain.setValueAtTime(0.8, audioContextRef.current.currentTime);
      speechMasterGainRef.current.connect(audioContextRef.current.destination);
    }

    try {
      // Create SAM instance
      const sam = new SamJs({
        pitch: 150,
        speed: 96,
        mouth: 108,
        throat: 122
      });

      // Simple direct speech
      sam.speak(text);

      // Reset speaking flag after estimated duration
      const speechDuration = 2500 + (text.length * 80);
      setTimeout(() => {
        isSpeakingRef.current = false;
        console.log(`🤖 Speech finished: "${text}"`);
      }, speechDuration);

      console.log(`🤖 SAM voice speaking: "${text}"`);

    } catch (error) {
      console.error('🤖 SAM speech error:', error);
      isSpeakingRef.current = false;
    }
  }, [initializeAudio]);


  // Welcome message and ambient sound on start screen
  useEffect(() => {
    if (gameState.showStartScreen) {
      // Start ambient sounds on title screen
      if (audioContextRef.current && audioContextRef.current.state === 'running' && !ambienceActiveRef.current) {
        console.log('🎵 Starting ambient sounds for title screen...');
        setTimeout(() => startAmbienceSound(), 100);
      }

      // Delay the welcome message to ensure voices are loaded
      const timer = setTimeout(() => {
        speakRobotic('WELCOME TO SPACE BLAZERS');
      }, 1500);
      return () => clearTimeout(timer);
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
    console.log('🎵 Ambient audio check:', {
      audioContext: !!audioContextRef.current,
      audioState: audioContextRef.current?.state,
      gameMode: gameState.gameMode,
      ambienceActive: ambienceActiveRef.current
    });

    // Start ambient sounds for ANY game mode (auto, player, multiplayer)
    if (audioContextRef.current && audioContextRef.current.state === 'running' &&
        !ambienceActiveRef.current) {
      console.log('🎵 Starting ambient sounds for all game modes...');
      setTimeout(() => startAmbienceSound(), 200); // Much shorter delay for better reliability
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
    a: false,
    d: false,
    left: false,
    right: false,
  });

  // Mouse and touch control state
  const [mouseY, setMouseY] = useState<number | null>(null);
  const [touchY, setTouchY] = useState<number | null>(null);
  const [controlSide, setControlSide] = useState<'left' | 'right' | null>(null);
  const [cursorHidden, setCursorHidden] = useState(false);

  const [infoTextFadeStart, setInfoTextFadeStart] = useState<number | null>(null);

  // Track previous countdown values for robot voice announcements
  const [previousCountdowns, setPreviousCountdowns] = useState<{[effectType: string]: number}>({});
  // Track when pickup announcements were made to delay countdown
  const [pickupAnnouncementTimes, setPickupAnnouncementTimes] = useState<{[effectType: string]: number}>({});

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

  // Game logic
  const updateGame = useCallback(() => {
    setGameState(prevState => {
      const newState = { ...prevState };

      // Debug: Check if paddles are being lost in the game loop
      if (!newState.paddles.top || !newState.paddles.bottom) {
        console.log('🚨 PADDLES LOST IN GAME LOOP!', {
          hasTop: !!newState.paddles.top,
          hasBottom: !!newState.paddles.bottom,
          allPaddles: Object.keys(newState.paddles)
        });
      }



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
      const hasInput = keys.w || keys.s || keys.up || keys.down || keys.a || keys.d || keys.left || keys.right || mouseY !== null || touchY !== null;

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

          // Calculate velocity based on movement delta for trail effects
          const deltaY = clampedY - newState.paddles.right.y;
          newState.paddles.right.velocity = deltaY;

          newState.paddles.right.y = clampedY;

          // Add trail for mouse/touch controlled right paddle movement
          if (Math.abs(newState.paddles.right.velocity) > 0.01) {
            const now = Date.now();
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
        newState.paddles.right.y = Math.max(12, Math.min(canvasSize.height - 12 - newState.paddles.right.height, newState.paddles.right.y));

        // In player mode, make the left paddle AI-controlled (always, since player controls right)
        if (newState.gameMode === 'player') {
          const now = Date.now();
          leftFrameCountRef.current++;
          const ballCenterY = newState.ball.y + newState.ball.size / 2;
          const updatePaddleWithAI = (paddle: any, frameCount: number) => {
            const reactionDelay = HUMAN_REACTION_DELAY + 1;
            if (frameCount % reactionDelay === 0) {
              const inaccuracy = (Math.random() - 0.5) * 8; // Reduced from 18 to 8
              const predictionError = Math.random() < 0.15 ? (Math.random() - 0.5) * 12 : 0; // Reduced frequency and magnitude
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

          // Add trail tracking for left paddle AI movement
          if (Math.abs(newState.paddles.left.velocity) > 0.01) {
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
        console.log('🎮 MULTIPLAYER MODE - Player side:', multiplayerState.playerSide);
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
            updatePaddlePosition(newState.paddles.right.y, newState.paddles.right.velocity, newState.paddles.right.y);
          }
        }

        // Top paddle controls - A/D keys (A = LEFT, D = RIGHT)
        if ((multiplayerState.playerSide === 'top' || localTestMode) && newState.paddles.top) {
          const oldX = newState.paddles.top.x;

          if (keys.a) {
            // A key moves LEFT (decrease X) - with acceleration
            newState.paddles.top.velocity -= 1.2; // Reduced acceleration
            newState.paddles.top.velocity = Math.max(-newState.paddles.top.speed * 1.5, newState.paddles.top.velocity);
          } else if (keys.d) {
            // D key moves RIGHT (increase X) - with acceleration
            newState.paddles.top.velocity += 1.2; // Reduced acceleration
            newState.paddles.top.velocity = Math.min(newState.paddles.top.speed * 1.5, newState.paddles.top.velocity);
          } else {
            // No input - apply friction to slow down
            newState.paddles.top.velocity *= 0.8; // Friction
            if (Math.abs(newState.paddles.top.velocity) < 0.1) {
              newState.paddles.top.velocity = 0; // Stop when very slow
            }
          }

          // Apply top paddle movement
          newState.paddles.top.x += newState.paddles.top.velocity;
          newState.paddles.top.x = Math.max(12, Math.min(canvasSize.width - 12 - newState.paddles.top.width, newState.paddles.top.x));

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
        if ((multiplayerState.playerSide === 'bottom' || localTestMode) && newState.paddles.bottom) {
          const oldX = newState.paddles.bottom.x;

          if (keys.left) {
            // Left arrow moves LEFT (decrease X) - with acceleration
            newState.paddles.bottom.velocity -= 1.2; // Reduced acceleration
            newState.paddles.bottom.velocity = Math.max(-newState.paddles.bottom.speed * 1.5, newState.paddles.bottom.velocity);
          } else if (keys.right) {
            // Right arrow moves RIGHT (increase X) - with acceleration
            newState.paddles.bottom.velocity += 1.2; // Reduced acceleration
            newState.paddles.bottom.velocity = Math.min(newState.paddles.bottom.speed * 1.5, newState.paddles.bottom.velocity);
          } else {
            // No input - apply friction to slow down
            newState.paddles.bottom.velocity *= 0.8; // Friction
            if (Math.abs(newState.paddles.bottom.velocity) < 0.1) {
              newState.paddles.bottom.velocity = 0; // Stop when very slow
            }
          }

          // Apply bottom paddle movement
          newState.paddles.bottom.x += newState.paddles.bottom.velocity;
          newState.paddles.bottom.x = Math.max(12, Math.min(canvasSize.width - 12 - newState.paddles.bottom.width, newState.paddles.bottom.x));

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

        // Clean old trail points (keep last 500ms for ball, 400ms for paddles)
        newState.trails.ball = newState.trails.ball.filter(point => now - point.timestamp < 500);
        newState.trails.leftPaddle = newState.trails.leftPaddle.filter(point => now - point.timestamp < 400);
        newState.trails.rightPaddle = newState.trails.rightPaddle.filter(point => now - point.timestamp < 400);
        newState.trails.topPaddle = newState.trails.topPaddle.filter(point => now - point.timestamp < 400);
        newState.trails.bottomPaddle = newState.trails.bottomPaddle.filter(point => now - point.timestamp < 400);

        // Handle pickup spawning (max 3 simultaneous pickups)
        if (newState.pickups && newState.pickups.length < 3 && Date.now() >= newState.nextPickupTime) {
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

        // NOTE: Top and bottom walls are now scoring boundaries (like left/right walls)
        // The ball should pass through them to trigger scoring, not bounce off them.

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

        // Check if ball is intersecting with left paddle (with collision buffer)
        const ballIntersectsLeftPaddle =
          ballLeft <= leftPaddleRight + COLLISION_BUFFER &&
          ballRight >= leftPaddleX - COLLISION_BUFFER &&
          ballBottom >= newState.paddles.left.y - COLLISION_BUFFER &&
          ballTop <= newState.paddles.left.y + newState.paddles.left.height + COLLISION_BUFFER;

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

          // Track ball touch for scoring system
          newState.ball.previousTouchedBy = newState.ball.lastTouchedBy;
          newState.ball.lastTouchedBy = 'left';

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

          // Track ball touch for scoring system
          newState.ball.previousTouchedBy = newState.ball.lastTouchedBy;
          newState.ball.lastTouchedBy = 'right';

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

        // Top paddle collision (with spacing from wall) - only if top paddle exists
        if (newState.paddles.top) {
          const topPaddleY = 30; // 30px spacing from top wall
          const topPaddleBottom = topPaddleY + newState.paddles.top.height;

        // Check if ball is intersecting with top paddle (with collision buffer)
        const ballIntersectsTopPaddle =
          ballTop <= topPaddleBottom + COLLISION_BUFFER &&
          ballBottom >= topPaddleY - COLLISION_BUFFER &&
          ballRight >= newState.paddles.top.x - COLLISION_BUFFER &&
          ballLeft <= newState.paddles.top.x + newState.paddles.top.width + COLLISION_BUFFER;

        // Check if ball came from below (proper collision)
        const ballCameFromBelow = prevBallY > topPaddleBottom;


        if (ballIntersectsTopPaddle && ballCameFromBelow && newState.ball.dy < 0) {
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
          newState.ball.previousTouchedBy = newState.ball.lastTouchedBy;
          newState.ball.lastTouchedBy = 'top';

          // Trigger rumble effect on top paddle hit
          newState.rumbleEffect.isActive = true;
          newState.rumbleEffect.startTime = Date.now();
          newState.rumbleEffect.intensity = 8; // Strong rumble for paddle hits

          // Only play beep sound if we're the game master to avoid duplicate sounds
          if (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer') {
            playMelodyNote('paddle', null, 'both'); // Paddle hit with space melody
          }
        }
        } // End top paddle collision check

        // Bottom paddle collision (with spacing from wall) - only if bottom paddle exists
        if (newState.paddles.bottom) {
        const bottomPaddleY = canvasSize.height - 30 - newState.paddles.bottom.height; // 30px spacing from bottom wall
        const bottomPaddleTop = bottomPaddleY;

        // Check if ball is intersecting with bottom paddle (with collision buffer)
        const ballIntersectsBottomPaddle =
          ballBottom >= bottomPaddleTop - COLLISION_BUFFER &&
          ballTop <= bottomPaddleY + newState.paddles.bottom.height + COLLISION_BUFFER &&
          ballRight >= newState.paddles.bottom.x - COLLISION_BUFFER &&
          ballLeft <= newState.paddles.bottom.x + newState.paddles.bottom.width + COLLISION_BUFFER;

        // Check if ball came from above (proper collision)
        const ballCameFromAbove = prevBallY < bottomPaddleTop;


        if (ballIntersectsBottomPaddle && ballCameFromAbove && newState.ball.dy > 0) {
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
          newState.ball.previousTouchedBy = newState.ball.lastTouchedBy;
          newState.ball.lastTouchedBy = 'bottom';

          // Trigger rumble effect on bottom paddle hit
          newState.rumbleEffect.isActive = true;
          newState.rumbleEffect.startTime = Date.now();
          newState.rumbleEffect.intensity = 8; // Strong rumble for paddle hits

          // Only play beep sound if we're the game master to avoid duplicate sounds
          if (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer') {
            playMelodyNote('paddle', null, 'both'); // Paddle hit with space melody
          }
        }
        } // End bottom paddle collision check

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
          newState.score[scoringPlayer]++;
          clearAllPickupEffects(newState);

          // Removed score announcements to reduce audio spam

          // Check for winner (first to 11)
          if (newState.score[scoringPlayer] >= 11) {
            console.log('🏆 WINNER DETECTED:', scoringPlayer, 'with score:', newState.score[scoringPlayer]);
            newState.winner = scoringPlayer;
            newState.gameEnded = true;
            newState.isPlaying = false;
            console.log('🏆 Game state after winner:', { winner: newState.winner, gameEnded: newState.gameEnded, isPlaying: newState.isPlaying });

            // Classic Berzerk-style victory announcement
            setTimeout(() => speakRobotic(`${scoringPlayer.toUpperCase()} PLAYER WINS THE GAME`), 800);

            // Epic victory rumble effect!
            newState.rumbleEffect.isActive = true;
            newState.rumbleEffect.startTime = Date.now();
            newState.rumbleEffect.intensity = 50; // Maximum rumble for victory!

            // Victory sound
            if (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer') {
              // Play victory fanfare
              setTimeout(() => playMelodyNote('score', null, 'both'), 0);
              setTimeout(() => playMelodyNote('score', null, 'both'), 200);
              setTimeout(() => playMelodyNote('score', null, 'both'), 400);
            }
          } else {
            // Regular scoring effects
            newState.rumbleEffect.isActive = true;
            newState.rumbleEffect.startTime = Date.now();
            newState.rumbleEffect.intensity = 25; // Much stronger rumble for scoring

            // Only play beep sound if we're the game master to avoid duplicate sounds
            if (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer') {
              playMelodyNote('score', null, 'reverb'); // Score with dramatic dystopic chord
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

          // Store next ball direction for after pause
          setTimeout(() => {
            setGameState(current => ({
              ...current,
              ball: {
                ...current.ball,
                dx: boundaryHit === 'left' || boundaryHit === 'right'
                    ? (boundaryHit === 'left' ? BALL_SPEED : -BALL_SPEED)
                    : (Math.random() > 0.5 ? BALL_SPEED : -BALL_SPEED),
                dy: boundaryHit === 'top' || boundaryHit === 'bottom'
                    ? (boundaryHit === 'top' ? -BALL_SPEED : BALL_SPEED)
                    : (Math.random() > 0.5 ? BALL_SPEED : -BALL_SPEED)
              }
            }));
          }, 2000);
        };

        // Handle scoring when ball goes off screen with last-touch system
        if (newState.ball.x < -20) {
          handleLastTouchScoring('left');
        } else if (newState.ball.x > canvasSize.width + 20) {
          handleLastTouchScoring('right');
        } else if (newState.ball.y < -20) {
          handleLastTouchScoring('top');
        } else if (newState.ball.y > canvasSize.height + 20) {
          handleLastTouchScoring('bottom');

        }

        // In multiplayer mode, only sync ball/score changes if we're the gamemaster
        if (newState.gameMode === 'multiplayer' && multiplayerState.isGameMaster) {
          updateGameState(newState);
        }
      } // End of ball logic check - only runs when game is active

      return newState;
    });
  }, [keys, playMelodyNote, canvasSize, multiplayerState.isGameMaster, updateGameState, localTestMode, multiplayerState.playerSide, updatePaddlePosition, multiplayerState, mouseY, touchY, controlSide, createPickup, applyPickupEffect, updateEffects, initializeAudio, speakRobotic]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore key repeat events
      if (e.repeat) return;

      // Disable all game controls in spectator mode (except space for audio)
      if (isSpectatorMode && e.key !== ' ') return;

      // Initialize audio on first user interaction
      await initializeAudio();

      // Start ambient sounds immediately on first keyboard interaction (including title screen)
      if (!ambienceActiveRef.current && audioContextRef.current) {
        console.log('🎵 Starting ambient sounds on keyboard interaction', {
          audioState: audioContextRef.current.state,
          ambienceActive: ambienceActiveRef.current
        });
        setTimeout(() => {
          console.log('🎵 Executing startAmbienceSound from keyboard');
          startAmbienceSound();
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
        case ' ':
          e.preventDefault();

          // Check if showing start screen - transition to gameplay
          if (gameState.showStartScreen) {
            setGameState(prev => ({
              ...prev,
              showStartScreen: false,
              isPlaying: true,
              gameMode: 'player'
            }));
            // Classic Berzerk-style game start announcement
            setTimeout(() => speakRobotic('GAME START'), 500);
            return;
          }

          // Check if game has ended - restart if so
          if (gameState.gameEnded) {
            // Reset game state for new game
            setGameState({
              ball: {
                x: canvasSize.width / 2,
                y: canvasSize.height / 2,
                dx: BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
                dy: BALL_SPEED * (Math.random() > 0.5 ? 1 : -1),
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
                left: { y: 250, height: 140, width: 12, speed: 32, velocity: 0, targetY: 250, originalHeight: 140 },
                right: { y: 250, height: 140, width: 12, speed: 32, velocity: 0, targetY: 250, originalHeight: 140 },
                top: { x: 350, height: 12, width: 140, speed: 32, velocity: 0, targetX: 350, originalWidth: 140 },
                bottom: { x: 350, height: 12, width: 140, speed: 32, velocity: 0, targetX: 350, originalWidth: 140 }
              },
              score: { left: 0, right: 0, top: 0, bottom: 0 },
              isPlaying: false,
              gameMode: 'auto',
              colorIndex: 0,
              isPaused: false,
              pauseEndTime: 0,
              winner: null,
              gameEnded: false,
              showStartScreen: true,
              rumbleEffect: { isActive: false, startTime: 0, intensity: 0 },
              pickupEffect: { isActive: false, startTime: 0, x: 0, y: 0 },
              decrunchEffect: { isActive: false, startTime: 0, duration: 0 },
              activeEffects: [],
              pickups: [],
              coins: [],
              nextPickupTime: Date.now() + Math.random() * 10000 + 5000,
              trails: { ball: [], leftPaddle: [], rightPaddle: [], topPaddle: [], bottomPaddle: [] }
            });

            // Play restart sound
            if (multiplayerState.isGameMaster || gameState.gameMode !== 'multiplayer') {
              playMelodyNote('score', null, 'both');
            }
            return;
          }

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
                score: { left: 0, right: 0, top: 0, bottom: 0 }
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
                score: { left: 0, right: 0, top: 0, bottom: 0 }
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
      // Disable all game controls in spectator mode
      if (isSpectatorMode) return;

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

    // 🚀 START SCREEN
    if (gameState.showStartScreen) {
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
      ctx.fillText('PLAYER 2 (RIGHT): ↑/↓ KEYS', canvasSize.width / 2 - 300, controlsY + 30);
      ctx.fillText('PLAYER 3 (TOP): A/D KEYS', canvasSize.width / 2 - 300, controlsY + 60);
      ctx.fillText('PLAYER 4 (BOTTOM): ←/→ KEYS', canvasSize.width / 2 - 300, controlsY + 90);

      // Options
      ctx.fillText('OPTIONS:', canvasSize.width / 2 - 300, controlsY + 140);
      ctx.fillText('C - TOGGLE CRT EFFECT', canvasSize.width / 2 - 300, controlsY + 170);
      ctx.fillText('M - TOGGLE MUSIC', canvasSize.width / 2 - 300, controlsY + 200);

      // Start instructions
      ctx.font = 'bold 20px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PRESS SPACEBAR TO START', canvasSize.width / 2, canvasSize.height / 2 + 150);

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
    if (gameState.trails.ball.length > 1) {
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
    if (gameState.trails.leftPaddle.length > 0) {
    }
    renderVerticalPaddleTrail(gameState.trails.leftPaddle, 30 + gameState.paddles.left.width / 2);
    renderVerticalPaddleTrail(gameState.trails.rightPaddle, canvasSize.width - 30 - gameState.paddles.right.width / 2);

    // Render top and bottom paddle trails (horizontal paddles)
    if (gameState.paddles.top) {
      renderHorizontalPaddleTrail(gameState.trails.topPaddle, 30 + gameState.paddles.top.height / 2);
    }
    if (gameState.paddles.bottom) {
      renderHorizontalPaddleTrail(gameState.trails.bottomPaddle, canvasSize.height - 30 - gameState.paddles.bottom.height / 2);
    }

    // Reset alpha for normal rendering
    ctx.globalAlpha = 1;

    // Draw paddles - using dynamic color (with spacing from walls)
    ctx.fillStyle = currentColors.foreground;
    const leftPaddleX = 30; // 30px spacing from left wall
    const rightPaddleX = canvasSize.width - 30 - gameState.paddles.right.width; // 30px spacing from right wall
    const topPaddleY = 30; // 30px spacing from top wall
    const bottomPaddleY = gameState.paddles.bottom ?
      canvasSize.height - 30 - gameState.paddles.bottom.height :
      canvasSize.height - 30 - 12; // 30px spacing from bottom wall, fallback to 12px height

    // Draw left and right paddles (vertical)
    ctx.fillRect(leftPaddleX, gameState.paddles.left.y, gameState.paddles.left.width, gameState.paddles.left.height);
    ctx.fillRect(rightPaddleX, gameState.paddles.right.y, gameState.paddles.right.width, gameState.paddles.right.height);

    // Draw top and bottom paddles (horizontal) - only if they exist
    if (gameState.paddles.top) {
      ctx.fillRect(gameState.paddles.top.x, topPaddleY, gameState.paddles.top.width, gameState.paddles.top.height);
    }
    if (gameState.paddles.bottom) {
      ctx.fillRect(gameState.paddles.bottom.x, bottomPaddleY, gameState.paddles.bottom.width, gameState.paddles.bottom.height);
    }

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
    gameState.pickups?.forEach((pickup) => {
      const time = Date.now() * 0.005;
      const pulse = 0.8 + Math.sin(time) * 0.2; // Pulsing effect

      ctx.save();
      ctx.globalAlpha = pulse;

      // Draw pixelated pattern with NO gaps between pixels
      const drawPixelatedPattern = (pattern: string, x: number, y: number, size: number, color: string) => {
        const pixelSize = 8; // Smaller pixels for tighter detail
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

    // 🏆 WINNER ANNOUNCEMENT 🏆
    if (gameState.gameEnded && gameState.winner) {
      // Animated winner display with pulsing and glow effects
      ctx.save();
      ctx.translate(canvasSize.width / 2, canvasSize.height / 2);

      // Pulsing animation effect
      const pulseScale = 1 + Math.sin(time * 8) * 0.1; // Pulse between 0.9 and 1.1
      const glowIntensity = (Math.sin(time * 6) + 1) * 0.5; // Glow between 0 and 1

      ctx.scale(pulseScale, pulseScale);

      // Glowing effect with shadow
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 20 + glowIntensity * 10;

      // Winner announcement - animated white with glow
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

            // Check if countdown changed and announce it
            const previousValue = previousCountdowns[effect.type];
            if (previousValue !== remaining && remaining <= 5 && remaining >= 0) {
              // Check if enough time has passed since pickup announcement
              const announcementTime = pickupAnnouncementTimes[effect.type];
              const timeSinceAnnouncement = Date.now() - (announcementTime || 0);
              const minimumDelay = 3500; // Wait 3.5 seconds after pickup announcement

              if (!announcementTime || timeSinceAnnouncement >= minimumDelay) {
                // Force interrupt current speech for countdown numbers
                isSpeakingRef.current = false;
                // Announce countdown for last 5 seconds
                setTimeout(() => speakRobotic(remaining.toString()), 50);
              }
            }
          }
        }
      });

      // Update previous countdowns
      setPreviousCountdowns(newCountdowns);
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

  }, [gameState, canvasSize, connectionStatus, multiplayerState.isConnected, multiplayerState.playerSide, infoTextFadeStart, localTestMode, crtEffect, applyCRTEffect]);

  // High-performance 60fps game loop
  useEffect(() => {
    // Continue running if game is playing OR if there's a winner to display OR showing start screen
    if (!gameState.isPlaying && !(gameState.gameEnded && gameState.winner) && !gameState.showStartScreen) return;

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
  }, [gameState.isPlaying, gameState.showStartScreen, updateGame, render]);


  // Prevent React strict mode from causing duplicate WebSocket connections
  const hasInitialized = useRef(false);

  // Listen for localStorage events from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pong-game-state' && e.newValue && !multiplayerState.isGameMaster) {
        try {
          const incomingGameState = JSON.parse(e.newValue);
          console.log('🔍 LocalStorage received gameState with paddles:', incomingGameState.paddles);
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
        console.log('🎵 Starting ambient sounds on mouse interaction');
        setTimeout(() => startAmbienceSound(), 50); // Even shorter delay
      }

      // Disable paddle controls in spectator mode (but allow audio initialization)
      if (isSpectatorMode) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        // Calculate mouse Y position relative to canvas, clamping to canvas bounds
        const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        setMouseY(y);

        // In multiplayer, only control your assigned paddle
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
          cursor: cursorHidden ? 'none' : 'default'
        }}
        tabIndex={0}
        onClick={() => {
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
          setControlSide(null);
          setCursorHidden(false);
        }}
        onTouchStart={async (e) => {
          e.preventDefault();
          // Initialize audio on first touch
          await initializeAudio();

          // Disable touch controls in spectator mode
          if (isSpectatorMode) return;

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
          // Disable touch controls in spectator mode
          if (isSpectatorMode) return;

          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect && e.touches.length > 0) {
            const touch = e.touches[0];
            const y = touch.clientY - rect.top;
            setTouchY(y);
          }
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          // Disable touch controls in spectator mode
          if (isSpectatorMode) return;

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