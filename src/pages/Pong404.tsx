import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';

interface GameState {
  ball: {
    x: number;
    y: number;
    dx: number;
    dy: number;
    size: number;
  };
  paddles: {
    left: { y: number; height: number; width: number; speed: number; velocity: number; targetY: number };
    right: { y: number; height: number; width: number; speed: number; velocity: number; targetY: number };
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
const PADDLE_SPEED = 18; // Reduced for 60fps gameplay
const BALL_SPEED = 5; // Much slower for better 60fps gameplay
const MIN_BALL_SPEED = 3;  // Slower minimum speed
const MAX_BALL_SPEED = 8; // Slower maximum speed
// Game runs at native refresh rate via requestAnimationFrame (typically 60fps)
const PADDLE_ACCELERATION = 0.2; // Reduced acceleration for smoother control
const PADDLE_FRICTION = 0.88; // Slightly more friction for better control
const HUMAN_REACTION_DELAY = 12; // More frames of delay for realistic AI at 60fps
const PANIC_MOVE_CHANCE = 0.08; // Lower chance for panic moves at 60fps
const PANIC_VELOCITY_MULTIPLIER = 8; // Reduced panic speed multiplier
const EXTREME_PANIC_CHANCE = 0.04; // Lower extreme panic chance
const EXTREME_PANIC_MULTIPLIER = 20; // Reduced extreme panic speed

// WebSocket server URL - only available in development
const WS_SERVER_URL = import.meta.env.DEV ? 'ws://localhost:3002' : null;

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

  // Dynamic canvas size state with proper aspect ratio
  const [canvasSize, setCanvasSize] = useState({
    width: 1200,
    height: 750
  });
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [gameState, setGameState] = useState<GameState>({
    ball: {
      x: canvasSize.width / 2,
      y: canvasSize.height / 2,
      dx: BALL_SPEED,
      dy: BALL_SPEED,
      size: 12,
    },
    paddles: {
      left: { y: Math.max(0, Math.min(canvasSize.height - 80, canvasSize.height / 2 - 40)), height: 80, width: 12, speed: PADDLE_SPEED, velocity: 0, targetY: Math.max(0, Math.min(canvasSize.height - 80, canvasSize.height / 2 - 40)) },
      right: { y: Math.max(0, Math.min(canvasSize.height - 80, canvasSize.height / 2 - 40)), height: 80, width: 12, speed: PADDLE_SPEED, velocity: 0, targetY: Math.max(0, Math.min(canvasSize.height - 80, canvasSize.height / 2 - 40)) },
    },
    score: { left: 0, right: 0 }, // Start with real scoring
    isPlaying: true,
    gameMode: 'auto',
    colorIndex: 0,
    isPaused: false,
    pauseEndTime: 0,
    decrunchEffect: {
      isActive: false,
      startTime: 0,
      duration: 200, // 0.2 seconds (very short)
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

  const [localTestMode, setLocalTestMode] = useState(false);
  const [crtEffect, setCrtEffect] = useState(true); // CRT shader enabled by default

  // WebSocket connection management
  const connectWebSocket = useCallback(() => {
    if (!WS_SERVER_URL) {
      console.log('⚠️ Multiplayer not available in production');
      setConnectionStatus('error');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    console.log('🔌 Connecting to WebSocket server...');
    setConnectionStatus('connecting');

    try {
      const ws = new WebSocket(WS_SERVER_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setConnectionStatus('connected');

        // Join the multiplayer room
        ws.send(JSON.stringify({
          type: 'join_room',
          playerId: multiplayerState.playerId,
          roomId: multiplayerState.roomId
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.reason);
        setConnectionStatus('error');
        setMultiplayerState(prev => ({ ...prev, isConnected: false }));

        // Attempt to reconnect after 3 seconds
        if (!event.wasClean) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Attempting to reconnect...');
            connectWebSocket();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionStatus('error');
      };

    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
    }
  }, [multiplayerState.playerId, multiplayerState.roomId]);

  // Handle incoming WebSocket messages
  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    switch (message.type) {
      case 'joined_room':
        console.log('🏓 Joined room successfully:', message.data);
        setMultiplayerState(prev => ({
          ...prev,
          playerSide: message.data.playerSide,
          isGameMaster: message.data.isGameMaster,
          playerCount: message.data.playerCount,
          isConnected: true
        }));

        if (message.data.gameState) {
          setGameState(message.data.gameState);
        }
        break;

      case 'player_joined':
        console.log('👋 Player joined:', message.data);
        setMultiplayerState(prev => ({
          ...prev,
          playerCount: message.data.playerCount
        }));
        break;

      case 'player_left':
        console.log('👋 Player left:', message.data);
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

      default:
        console.log('❓ Unknown WebSocket message:', message);
    }
  }, []);

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
  }, [multiplayerState.playerId, multiplayerState.isConnected]);

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
  }, [multiplayerState.playerId, multiplayerState.roomId, multiplayerState.isConnected, multiplayerState.isGameMaster]);

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

  // Initialize Web Audio API (only after user gesture)
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioInitAttempted = useRef<boolean>(false);

  // Generate authentic Pong beep sound - only create AudioContext when actually needed
  const playBeep = useCallback((frequency: number, duration: number) => {
    // Only create AudioContext when actually trying to play a sound (user gesture)
    if (!audioContextRef.current && !audioInitAttempted.current) {
      audioInitAttempted.current = true;
      try {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        // Audio not supported - fail silently
        return;
      }
    }

    // Exit early if no audio context or not in running state
    if (!audioContextRef.current || audioContextRef.current.state !== 'running') {
      return;
    }

    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);

    oscillator.frequency.setValueAtTime(frequency, audioContextRef.current.currentTime);
    oscillator.type = 'square'; // Classic arcade sound

    gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContextRef.current.currentTime + duration);

    oscillator.start(audioContextRef.current.currentTime);
    oscillator.stop(audioContextRef.current.currentTime + duration);
  }, []);

  // Connect WebSocket when entering multiplayer mode
  useEffect(() => {
    if (gameState.gameMode === 'multiplayer' && !multiplayerState.isConnected && connectionStatus === 'idle') {
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [gameState.gameMode, multiplayerState.isConnected, connectionStatus, connectWebSocket]);

  const [keys, setKeys] = useState({
    w: false,
    s: false,
    up: false,
    down: false,
  });

  const [infoTextFadeStart, setInfoTextFadeStart] = useState<number | null>(null);
  const leftFrameCountRef = useRef<number>(0);
  const rightFrameCountRef = useRef<number>(0);

  // Game logic
  const updateGame = useCallback(() => {
    setGameState(prevState => {
      const newState = { ...prevState };

      // Check decrunch effect timeout FIRST (should work even when paused)
      if (newState.decrunchEffect.isActive) {
        const currentTime = Date.now();
        if (currentTime >= newState.decrunchEffect.startTime + 200) { // Always use 200ms duration
          newState.decrunchEffect.isActive = false;
          newState.decrunchEffect.startTime = 0;
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

      // Auto-switch to player mode when keys are pressed (if not in multiplayer)
      if (newState.gameMode === 'auto' && (keys.w || keys.s || keys.up || keys.down)) {
        newState.gameMode = 'player';
      }

      // Update paddle positions
      if (newState.gameMode === 'player') {
        // Single-player controls with smooth interpolation
        // Left paddle smooth movement
        if (keys.w && newState.paddles.left.y > 12) {
          newState.paddles.left.velocity -= 1.0; // Slower acceleration for 60fps
        } else if (keys.s && newState.paddles.left.y < canvasSize.height - 12 - newState.paddles.left.height) {
          newState.paddles.left.velocity += 1.0; // Slower acceleration for 60fps
        } else {
          newState.paddles.left.velocity *= 0.88; // More friction for control
        }

        // Apply velocity with limits
        newState.paddles.left.velocity = Math.max(-newState.paddles.left.speed, Math.min(newState.paddles.left.speed, newState.paddles.left.velocity));
        newState.paddles.left.y += newState.paddles.left.velocity;
        newState.paddles.left.y = Math.max(12, Math.min(canvasSize.height - 12 - newState.paddles.left.height, newState.paddles.left.y));

        // Right paddle smooth movement
        if (keys.up && newState.paddles.right.y > 12) {
          newState.paddles.right.velocity -= 1.0; // Slower acceleration for 60fps
        } else if (keys.down && newState.paddles.right.y < canvasSize.height - 12 - newState.paddles.right.height) {
          newState.paddles.right.velocity += 1.0; // Slower acceleration for 60fps
        } else {
          newState.paddles.right.velocity *= 0.88; // More friction for control
        }

        // Apply velocity with limits
        newState.paddles.right.velocity = Math.max(-newState.paddles.right.speed, Math.min(newState.paddles.right.speed, newState.paddles.right.velocity));
        newState.paddles.right.y += newState.paddles.right.velocity;
        newState.paddles.right.y = Math.max(12, Math.min(canvasSize.height - 12 - newState.paddles.right.height, newState.paddles.right.y));
      } else if (newState.gameMode === 'multiplayer') {
        // Multiplayer controls (only the paddle assigned to this player, unless in local test mode)
        if (multiplayerState.playerSide === 'left' || localTestMode) {
          const oldY = newState.paddles.left.y;

          // Smooth left paddle movement for multiplayer (using W/S keys)
          if (keys.w && newState.paddles.left.y > 12) {
            newState.paddles.left.velocity -= 1.0; // Slower acceleration for 60fps
          } else if (keys.s && newState.paddles.left.y < canvasSize.height - 12 - newState.paddles.left.height) {
            newState.paddles.left.velocity += 1.0; // Slower acceleration for 60fps
          } else {
            newState.paddles.left.velocity *= 0.88; // More friction for control
          }

          // Apply velocity with limits
          newState.paddles.left.velocity = Math.max(-newState.paddles.left.speed, Math.min(newState.paddles.left.speed, newState.paddles.left.velocity));
          newState.paddles.left.y += newState.paddles.left.velocity;
          newState.paddles.left.y = Math.max(12, Math.min(canvasSize.height - 12 - newState.paddles.left.height, newState.paddles.left.y));

          if (Math.abs(newState.paddles.left.y - oldY) > 2.0 && !localTestMode) {
            updatePaddlePosition(newState.paddles.left.y, newState.paddles.left.velocity, newState.paddles.left.y);
          }
        }
        if (multiplayerState.playerSide === 'right' || localTestMode) {
          const oldY = newState.paddles.right.y;

          // Smooth right paddle movement for multiplayer
          if (keys.up && newState.paddles.right.y > 12) {
            newState.paddles.right.velocity -= 1.0; // Slower acceleration for 60fps
          } else if (keys.down && newState.paddles.right.y < canvasSize.height - 12 - newState.paddles.right.height) {
            newState.paddles.right.velocity += 1.0; // Slower acceleration for 60fps
          } else {
            newState.paddles.right.velocity *= 0.88; // More friction for control
          }

          // Apply velocity with limits
          newState.paddles.right.velocity = Math.max(-newState.paddles.right.speed, Math.min(newState.paddles.right.speed, newState.paddles.right.velocity));
          newState.paddles.right.y += newState.paddles.right.velocity;
          newState.paddles.right.y = Math.max(12, Math.min(canvasSize.height - 12 - newState.paddles.right.height, newState.paddles.right.y));

          if (Math.abs(newState.paddles.right.y - oldY) > 2.0 && !localTestMode) {
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
      }

      // Skip ball logic if game is paused (but allow paddle movement)
      if (!newState.isPaused) {
        // Start info text fade when game actually begins (ball starts moving)
        if (!infoTextFadeStart && (Math.abs(newState.ball.dx) > 0 || Math.abs(newState.ball.dy) > 0)) {
          setInfoTextFadeStart(Date.now());
        }

        // Update ball position
        newState.ball.x += newState.ball.dx;
        newState.ball.y += newState.ball.dy;

        // Ball collision with top/bottom walls (account for border thickness)
        const borderThickness = 12;
        const ballAtTopWall = newState.ball.y <= borderThickness;
        const ballAtBottomWall = newState.ball.y >= canvasSize.height - borderThickness - newState.ball.size;

        // Only trigger collision if ball is moving towards the wall (prevents repeated triggers)
        if ((ballAtTopWall && newState.ball.dy < 0) || (ballAtBottomWall && newState.ball.dy > 0)) {
          newState.ball.dy = -newState.ball.dy;

          // Only play beep sound if we're the game master to avoid duplicate sounds
          if (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer') {
            playBeep(800, 0.1); // Wall hit sound
          }
        }

        // Ball collision with paddles
        const ballLeft = newState.ball.x;
        const ballRight = newState.ball.x + newState.ball.size;
        const ballTop = newState.ball.y;
        const ballBottom = newState.ball.y + newState.ball.size;

        // Advanced paddle collision with speed variation based on hit position

        // Left paddle collision (with spacing from wall)
        const leftPaddleX = 30; // 30px spacing from left wall
        if (
          ballLeft <= leftPaddleX + newState.paddles.left.width &&
          ballBottom >= newState.paddles.left.y &&
          ballTop <= newState.paddles.left.y + newState.paddles.left.height &&
          newState.ball.dx < 0
        ) {
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

          // Different beep pitch based on hit position (edge hits = higher pitch)
          // Only play beep sound if we're the game master to avoid duplicate sounds
          if (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer') {
            const beepFreq = 500 + (distanceFromCenter * 300); // 500-800 Hz
            playBeep(beepFreq, 0.1);
          }
        }

        // Right paddle collision (with spacing from wall)
        const rightPaddleX = canvasSize.width - 30 - newState.paddles.right.width; // 30px spacing from right wall
        if (
          ballRight >= rightPaddleX &&
          ballBottom >= newState.paddles.right.y &&
          ballTop <= newState.paddles.right.y + newState.paddles.right.height &&
          newState.ball.dx > 0
        ) {
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

          // Different beep pitch based on hit position (edge hits = higher pitch)
          // Only play beep sound if we're the game master to avoid duplicate sounds
          if (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer') {
            const beepFreq = 500 + (distanceFromCenter * 300); // 500-800 Hz
            playBeep(beepFreq, 0.1);
          }
        }

        // Handle scoring when ball goes off screen
        if (newState.ball.x < -20) {
          // Right player scores (left computer player missed)
          newState.score.right++;
          // Only play beep sound if we're the game master to avoid duplicate sounds
          if (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer') {
            playBeep(300, 0.3); // Lower tone for score
          }

          // Trigger decrunch effect for the miss
          newState.decrunchEffect.isActive = true;
          newState.decrunchEffect.startTime = Date.now();

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
          // Only play beep sound if we're the game master to avoid duplicate sounds
          if (multiplayerState.isGameMaster || newState.gameMode !== 'multiplayer') {
            playBeep(300, 0.3); // Lower tone for score
          }

          // Trigger decrunch effect for the miss
          newState.decrunchEffect.isActive = true;
          newState.decrunchEffect.startTime = Date.now();

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
  }, [keys, playBeep, canvasSize, multiplayerState.isGameMaster, updateGameState, localTestMode, multiplayerState.playerSide, updatePaddlePosition, multiplayerState]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w':
          setKeys(prev => ({ ...prev, w: true }));
          break;
        case 's':
          setKeys(prev => ({ ...prev, s: true }));
          break;
        case 'arrowup':
          setKeys(prev => ({ ...prev, up: true }));
          break;
        case 'arrowdown':
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
          console.log('Local test mode:', !localTestMode ? 'ON (A/D = left paddle, ↑/↓ = right paddle)' : 'OFF');
          break;
        case 'c':
          e.preventDefault();
          setCrtEffect(prev => !prev);
          console.log('CRT Effect:', !crtEffect ? 'ON (Vintage CRT monitor simulation)' : 'OFF (Clean modern display)');
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
              console.error('Failed to join multiplayer game:', error);
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
              console.error('Failed to join multiplayer game:', error);
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
              console.error('Failed to reset game room:', error);
            }
          }
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key.toLowerCase()) {
        case 'w':
          setKeys(prev => ({ ...prev, w: false }));
          break;
        case 's':
          setKeys(prev => ({ ...prev, s: false }));
          break;
        case 'arrowup':
          setKeys(prev => ({ ...prev, up: false }));
          break;
        case 'arrowdown':
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

  // C64-style decrunch effect renderer - only affects foreground elements
  const renderDecrunchEffect = useCallback((ctx: CanvasRenderingContext2D, canvasSize: { width: number; height: number }, targetColor: string, progress: number) => {
    // Create a mask that only affects non-background pixels
    // This simulates the authentic C64 decrunch effect that only affects sprites/text

    // Get current canvas data to identify non-background pixels
    const imageData = ctx.getImageData(0, 0, canvasSize.width, canvasSize.height);
    const data = imageData.data;
    const backgroundColorRGB = hexToRgb(COLOR_PALETTE[gameState.colorIndex].background);

    // Create effect patterns based on progress
    const scanlineSpacing = 2; // Every 2 pixels like C64
    const time = progress * 16; // Much faster animation (doubled from 8)

    // Apply decrunch effect only to foreground pixels
    for (let y = 0; y < canvasSize.height; y += scanlineSpacing) {
      for (let x = 0; x < canvasSize.width; x++) {
        const pixelIndex = (y * canvasSize.width + x) * 4;

        // Check if this pixel is not background color
        const r = data[pixelIndex];
        const g = data[pixelIndex + 1];
        const b = data[pixelIndex + 2];

        // If pixel is not background color (i.e., it's a paddle, ball, text, etc.)
        const isBackground = Math.abs(r - backgroundColorRGB.r) < 30 &&
                           Math.abs(g - backgroundColorRGB.g) < 30 &&
                           Math.abs(b - backgroundColorRGB.b) < 30;

        if (!isBackground) {
          // Apply authentic C64 decrunch effect patterns

          // Phase 1: Horizontal line corruption (like the GIF) - faster oscillation
          const corruptionOffset = Math.sin(y * 0.1 + time * 6) * 5 * progress; // Reduced from 10 to 5
          const shouldCorrupt = Math.random() < (0.4 * progress); // More frequent corruption

          if (shouldCorrupt) {
            // Create horizontal line artifacts
            ctx.globalAlpha = 0.7;
            ctx.strokeStyle = targetColor;
            ctx.lineWidth = 1;

            const lineStartX = Math.max(0, x + corruptionOffset);
            const lineEndX = Math.min(canvasSize.width, x + corruptionOffset + 10 + Math.random() * 20); // Reduced from 20+40 to 10+20

            // Flickering horizontal lines (like in the GIF)
            if (Math.random() > 0.4) {
              ctx.beginPath();
              ctx.moveTo(lineStartX, y);
              ctx.lineTo(lineEndX, y);
              ctx.stroke();
            }
          }

          // Phase 2: Interlaced effect (classic C64 loading pattern) - faster interlacing
          if (progress > 0.3) {
            const interlacePhase = (progress - 0.3) * 2; // Faster phase progression
            if (y % 4 === Math.floor(time * 4) % 4) { // Faster interlace cycling
              // Create interlaced corruption
              const displacement = Math.sin(x * 0.05 + time * 8) * 2.5 * interlacePhase; // Reduced from 5 to 2.5

              if (Math.random() < (0.4 * interlacePhase)) {
                ctx.globalAlpha = 0.6;
                ctx.fillStyle = targetColor;

                // Draw corrupted pixel blocks
                const blockWidth = 2 + Math.floor(Math.random() * 4);
                ctx.fillRect(x + displacement, y, blockWidth, 1);
              }
            }
          }

          // Phase 3: Final decompression artifacts
          if (progress > 0.7) {
            const finalPhase = (progress - 0.7) * 3;

            // Random pixel corruption that fades out
            if (Math.random() < (0.2 * (1 - finalPhase))) {
              ctx.globalAlpha = 0.5 * (1 - finalPhase);
              ctx.fillStyle = targetColor;

              // Small corruption blocks
              const corruptSize = Math.random() < 0.5 ? 1 : 2;
              ctx.fillRect(x, y, corruptSize, corruptSize);
            }
          }
        }
      }
    }

    // Reset alpha
    ctx.globalAlpha = 1;
  }, [gameState.colorIndex, hexToRgb]);

  // High-performance render function
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

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

    // Draw paddles - using dynamic color (with spacing from walls)
    ctx.fillStyle = currentColors.foreground;
    const leftPaddleX = 30; // 30px spacing from left wall
    const rightPaddleX = canvasSize.width - 30 - gameState.paddles.right.width; // 30px spacing from right wall
    ctx.fillRect(leftPaddleX, gameState.paddles.left.y, gameState.paddles.left.width, gameState.paddles.left.height);
    ctx.fillRect(rightPaddleX, gameState.paddles.right.y, gameState.paddles.right.width, gameState.paddles.right.height);

    // Draw ball - using dynamic color (hide during pause)
    if (!gameState.isPaused) {
      ctx.fillRect(gameState.ball.x, gameState.ball.y, gameState.ball.size, gameState.ball.size);
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

      if (connectionStatus === 'connecting') {
        ctx.fillText('CONNECTING TO MULTIPLAYER...', canvasSize.width / 2, canvasSize.height - 40);
        ctx.fillText(`Press C to toggle CRT effect (${crtEffect ? 'ON' : 'OFF'})`, canvasSize.width / 2, canvasSize.height - 20);
      } else if (connectionStatus === 'error') {
        ctx.fillText('CONNECTION FAILED - Press SPACEBAR to retry', canvasSize.width / 2, canvasSize.height - 40);
        ctx.fillText(`Press C to toggle CRT effect (${crtEffect ? 'ON' : 'OFF'})`, canvasSize.width / 2, canvasSize.height - 20);
      } else {
        ctx.fillText('Press SPACEBAR to join online multiplayer', canvasSize.width / 2, canvasSize.height - 40);
        ctx.fillText(`Press C to toggle CRT effect (${crtEffect ? 'ON' : 'OFF'})`, canvasSize.width / 2, canvasSize.height - 20);
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

        // Show connection status and player info
        if (connectionStatus === 'connecting') {
          ctx.fillText('CONNECTING TO MULTIPLAYER...', canvasSize.width / 2, canvasSize.height - 60);
        } else if (connectionStatus === 'error') {
          ctx.fillText('CONNECTION FAILED', canvasSize.width / 2, canvasSize.height - 80);
          ctx.fillText('Press SPACEBAR to retry', canvasSize.width / 2, canvasSize.height - 60);
        } else if (multiplayerState.isConnected) {
          const playerSideText = multiplayerState.playerSide === 'spectator'
            ? 'SPECTATING'
            : `YOU: ${multiplayerState.playerSide.toUpperCase()} PADDLE`;

          ctx.fillText('MULTIPLAYER MODE', canvasSize.width / 2, canvasSize.height - 100);
          ctx.fillText(playerSideText, canvasSize.width / 2, canvasSize.height - 80);

          if (multiplayerState.playerSide !== 'spectator') {
            const controls = localTestMode
              ? 'A/D = left paddle, ↑/↓ = right paddle'
              : multiplayerState.playerSide === 'left' ? 'W/S keys' : '↑/↓ arrows';
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

      // Left side controls
      ctx.fillText('Player 1:', 30, canvasSize.height - 60);
      ctx.fillText('↑/↓ arrows', 30, canvasSize.height - 40);

      // Right side controls
      ctx.textAlign = 'right';
      ctx.fillText('Player 2:', canvasSize.width - 30, canvasSize.height - 60);
      ctx.fillText('↑/↓ arrows', canvasSize.width - 30, canvasSize.height - 40);

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

    // Apply C64-style decrunch effect when active
    if (gameState.decrunchEffect.isActive) {
      const currentTime = Date.now();
      const elapsed = currentTime - gameState.decrunchEffect.startTime;
      const progress = Math.min(elapsed / 200, 1); // Always use 200ms duration

      // Get the target color (current foreground color)
      const targetColor = currentColors.foreground;

      // Create decrunch effect
      renderDecrunchEffect(ctx, canvasSize, targetColor, progress);
    }

  }, [gameState, canvasSize, connectionStatus, multiplayerState.isConnected, multiplayerState.playerSide, infoTextFadeStart, localTestMode, renderDecrunchEffect, crtEffect, applyCRTEffect]);

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


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden bg-black flex items-center justify-center">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="block border border-gray-600"
        style={{
          background: COLOR_PALETTE[gameState.colorIndex].background
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