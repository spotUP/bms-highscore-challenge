import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

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

// Canvas size will be calculated dynamically based on viewport
const PADDLE_SPEED = 32; // 4x faster (was 8, now 2x faster than previous 16)
const BALL_SPEED = 9; // Halved from 18 to 9 for better gameplay
const MIN_BALL_SPEED = 6;  // Halved from 12 to 6 for slower center hits
const MAX_BALL_SPEED = 14; // Halved from 28 to 14 for slower edge hits
const TARGET_FPS = 75; // Slightly higher target to ensure consistent 60fps on all devices
const FRAME_TIME = 1000 / TARGET_FPS;
const PADDLE_ACCELERATION = 0.3;
const PADDLE_FRICTION = 0.85;
const HUMAN_REACTION_DELAY = 8; // frames of delay for human-like response (increased for 60fps)
const PANIC_MOVE_CHANCE = 0.15; // 15% chance per frame for sudden movement (reduced for 60fps)
const PANIC_VELOCITY_MULTIPLIER = 15; // How much faster panic moves are (halved for 60fps)
const EXTREME_PANIC_CHANCE = 0.08; // 8% chance for extreme panic moves (reduced for 60fps)
const EXTREME_PANIC_MULTIPLIER = 35; // Extremely fast spinner turns (halved for 60fps)

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

export const Pong404: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastTimeRef = useRef<number>(0);
  const leftFrameCountRef = useRef<number>(0);
  const rightFrameCountRef = useRef<number>(0);
  const subscriptionRef = useRef<any>(null);
  const lastUpdateRef = useRef<number>(0);
  const lastPaddleUpdateRef = useRef<number>(0);
  const lastPaddlePositionRef = useRef<{left: number, right: number}>({left: 200, right: 200});

  // Dynamic canvas size state
  const [canvasSize, setCanvasSize] = useState({
    width: 800,
    height: 400
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

  const [keys, setKeys] = useState({
    w: false,
    s: false,
    up: false,
    down: false,
  });

  const [infoTextFadeStart, setInfoTextFadeStart] = useState<number | null>(null);

  // Helper function to fix paddle positions for current window height
  const fixPaddlePositions = useCallback((gameState: any) => {
    const currentHeight = window.innerHeight;
    const paddleHeight = 80;
    const safeTop = 50; // 50px from top border
    const safeBottom = currentHeight - paddleHeight - 50; // 50px from bottom border

    return {
      ...gameState,
      paddles: {
        left: {
          ...gameState.paddles.left,
          y: Math.max(safeTop, Math.min(safeBottom, Math.max(safeTop, currentHeight / 2 - paddleHeight / 2))) // Center vertically in current window
        },
        right: {
          ...gameState.paddles.right,
          y: Math.max(safeTop, Math.min(safeBottom, Math.max(safeTop, currentHeight / 2 - paddleHeight / 2))) // Center vertically in current window
        }
      }
    };
  }, []);

  // Initialize Web Audio API
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
  }, []);

  // Multiplayer functions
  const joinMultiplayerGame = useCallback(async () => {
    try {
      setConnectionStatus('connecting');

      // Try to get existing game state
      const { data: existingGame, error: fetchError } = await supabase
        .from('live_pong')
        .select('*')
        .eq('room_id', multiplayerState.roomId)
        .single();


      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('❌ Error fetching game state:', fetchError);
        setConnectionStatus('error');
        throw new Error(`Database error: ${fetchError.message}`);
      }

      let playerSide: 'left' | 'right' | 'spectator' = 'spectator';
      let isGameMaster = false;

      if (!existingGame) {
        // Create new game room - always reset to fresh state for single game
        const initialGameState = {
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
          score: { left: 0, right: 0 },
          isPlaying: true,
          gameMode: 'multiplayer',
          colorIndex: 0,
          isPaused: false,
          pauseEndTime: 0,
          decrunchEffect: {
            isActive: false,
            startTime: 0,
            duration: 200,
          },
        };

        const { error: insertError } = await supabase
          .from('live_pong')
          .insert({
            room_id: multiplayerState.roomId,
            game_state: initialGameState,
            player_left_id: multiplayerState.playerId,
            last_updated_by: multiplayerState.playerId
          });

        if (insertError) {
          console.error('Error creating game room (likely race condition):', insertError);
          // Retry by fetching the existing game that was created by another browser
          const { data: retryGame, error: retryError } = await supabase
            .from('live_pong')
            .select('*')
            .eq('room_id', multiplayerState.roomId)
            .single();

          if (retryError || !retryGame) {
            console.error('Failed to recover from race condition:', retryError);
            return;
          }

          // Process as joining existing game
          if (retryGame.player_right_id) {
            playerSide = 'spectator';
          } else {
            // Assign to right paddle since left is taken
            const { error: updateError } = await supabase
              .from('live_pong')
              .update({ player_right_id: multiplayerState.playerId })
              .eq('room_id', multiplayerState.roomId);

            if (updateError) {
              console.error('Error joining as right player:', updateError);
              playerSide = 'spectator';
            } else {
              playerSide = 'right';
            }
          }

          // Set game state from existing game
          if (retryGame.game_state) {
            setGameState(retryGame.game_state);
          }
          isGameMaster = false; // Other player is already game master
        } else {
          // Successfully created new game room
          playerSide = 'left';
          isGameMaster = true;
          setGameState(initialGameState);
        }
      } else {
        // Join existing game
        let updateData: any = {};

        // Check if current player is already assigned
        if (existingGame.player_left_id === multiplayerState.playerId) {
          playerSide = 'left';
        } else if (existingGame.player_right_id === multiplayerState.playerId) {
          playerSide = 'right';
        } else if (!existingGame.player_left_id) {
          updateData.player_left_id = multiplayerState.playerId;
          playerSide = 'left';
        } else if (!existingGame.player_right_id) {
          updateData.player_right_id = multiplayerState.playerId;
          playerSide = 'right';
        } else {
          // Both slots taken by other players - become a spectator
          playerSide = 'spectator';
        }

        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('live_pong')
            .update(updateData)
            .eq('room_id', multiplayerState.roomId);

          if (updateError) {
            console.error('Error joining game:', updateError);
            return;
          }
        }

        // Set the game state from the server with bounds checking
        if (existingGame.game_state) {
          const fixedGameState = fixPaddlePositions(existingGame.game_state);
          setGameState(fixedGameState);
        }
      }


      setMultiplayerState(prev => ({
        ...prev,
        playerSide,
        isConnected: true,
        isGameMaster
      }));

      setConnectionStatus('connected');

    } catch (error) {
      console.error('Error joining multiplayer game:', error);
      setConnectionStatus('error');
      // Reset connection after 3 seconds for retry
      setTimeout(() => {
        setConnectionStatus('idle');
      }, 3000);
    }
  }, [multiplayerState.roomId, multiplayerState.playerId, gameState]);

  const updateMultiplayerGameState = useCallback(async (newGameState: GameState) => {
    if (!multiplayerState.isConnected || !multiplayerState.isGameMaster) return;

    // Throttle updates to avoid overwhelming the database
    const now = Date.now();
    if (now - lastUpdateRef.current < 16) return; // ~60fps max
    lastUpdateRef.current = now;

    try {
      const { error } = await supabase
        .from('live_pong')
        .update({
          game_state: newGameState,
          last_updated_by: multiplayerState.playerId
        })
        .eq('room_id', multiplayerState.roomId);

      if (error) {
        console.error('Error updating game state:', error);
      }
    } catch (error) {
      console.error('Error updating multiplayer game state:', error);
    }
  }, [multiplayerState.isConnected, multiplayerState.isGameMaster, multiplayerState.playerId, multiplayerState.roomId]);

  const updatePaddlePosition = useCallback(async (side: 'left' | 'right', y: number) => {
    if (!multiplayerState.isConnected || multiplayerState.playerSide !== side) return;

    // Throttle paddle updates but prioritize responsiveness
    const now = Date.now();
    const timeSinceLastUpdate = now - lastPaddleUpdateRef.current;
    const lastY = lastPaddlePositionRef.current[side];
    const movementDistance = Math.abs(y - lastY);

    // Smart throttling: send updates on velocity changes or significant movement
    const velocity = movementDistance / Math.max(timeSinceLastUpdate, 1) * 16; // pixels per frame
    const lastVelocity = lastPaddlePositionRef.current.velocity || 0;
    const velocityChange = Math.abs(velocity - lastVelocity);

    // Send update if:
    // 1. Significant velocity change (direction change or speed change)
    // 2. Large movement (>5px)
    // 3. Movement stopped (velocity near zero after movement)
    // 4. Minimum time elapsed for maximum update rate
    const significantVelocityChange = velocityChange > 0.5;
    const largeMovement = movementDistance > 5;
    const movementStopped = velocity < 0.1 && lastVelocity > 0.1;
    const minTimeElapsed = timeSinceLastUpdate > 8; // Max 125fps

    if (!significantVelocityChange && !largeMovement && !movementStopped && !minTimeElapsed) return;

    lastPaddlePositionRef.current.velocity = velocity;

    lastPaddleUpdateRef.current = now;
    lastPaddlePositionRef.current[side] = y;

    try {

      // Store individual paddle positions to avoid conflicts
      const updateData: any = {
        last_updated_by: multiplayerState.playerId
      };

      if (side === 'left') {
        updateData.player_left_paddle_y = y;
      } else {
        updateData.player_right_paddle_y = y;
      }

      const { error } = await supabase
        .from('live_pong')
        .update(updateData)
        .eq('room_id', multiplayerState.roomId);

      if (error) {
        console.error('Error updating paddle position:', error);
      }
    } catch (error) {
      console.error('Error updating paddle position:', error);
    }
  }, [multiplayerState.isConnected, multiplayerState.playerSide, multiplayerState.playerId, multiplayerState.roomId, gameState]);

  // Setup real-time subscription
  useEffect(() => {
    if (!multiplayerState.isConnected) return;

    const subscription = supabase
      .channel(`live_pong_changes_${multiplayerState.roomId}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_pong', filter: `room_id=eq.${multiplayerState.roomId}` },
        (payload) => {
          if (payload.new.last_updated_by !== multiplayerState.playerId) {
            // Update individual paddle positions from the database fields
            setGameState(currentState => {
              let updatedState = { ...currentState };
              let changed = false;

              // Update left paddle if it changed (ultra-sensitive threshold)
              if (payload.new.player_left_paddle_y !== null &&
                  Math.abs(payload.new.player_left_paddle_y - currentState.paddles.left.y) > 0.1) {
                updatedState = {
                  ...updatedState,
                  paddles: {
                    ...updatedState.paddles,
                    left: {
                      ...updatedState.paddles.left,
                      y: (() => {
                        // Calculate velocity-based prediction for ultra-smooth movement
                        const targetY = payload.new.player_left_paddle_y;
                        const currentY = currentState.paddles.left.y;
                        const difference = targetY - currentY;

                        // Estimate velocity and add prediction
                        const velocity = difference * 0.1; // Predict based on movement trend
                        const predictedY = targetY + velocity;

                        // Ultra-fast interpolation with prediction for 60fps smoothness
                        const interpolatedY = currentY + (predictedY - currentY) * 0.95;

                        return Math.max(12, Math.min(canvasSize.height - 12 - updatedState.paddles.left.height, interpolatedY));
                      })()
                    }
                  }
                };
                changed = true;
              }

              // Update right paddle if it changed (ultra-sensitive threshold)
              if (payload.new.player_right_paddle_y !== null &&
                  Math.abs(payload.new.player_right_paddle_y - currentState.paddles.right.y) > 0.1) {
                updatedState = {
                  ...updatedState,
                  paddles: {
                    ...updatedState.paddles,
                    right: {
                      ...updatedState.paddles.right,
                      y: (() => {
                        // Calculate velocity-based prediction for ultra-smooth movement
                        const targetY = payload.new.player_right_paddle_y;
                        const currentY = currentState.paddles.right.y;
                        const difference = targetY - currentY;

                        // Estimate velocity and add prediction
                        const velocity = difference * 0.1; // Predict based on movement trend
                        const predictedY = targetY + velocity;

                        // Ultra-fast interpolation with prediction for 60fps smoothness
                        const interpolatedY = currentY + (predictedY - currentY) * 0.95;

                        return Math.max(12, Math.min(canvasSize.height - 12 - updatedState.paddles.right.height, interpolatedY));
                      })()
                    }
                  }
                };
                changed = true;
              }


              return updatedState;
            });

            // Update player count
            const newPlayerCount = (payload.new.player_left_id ? 1 : 0) + (payload.new.player_right_id ? 1 : 0);
            setMultiplayerState(prev => ({ ...prev, playerCount: newPlayerCount }));
          }
        }
      )
      .subscribe();

    subscriptionRef.current = subscription;

    return () => {
      subscription.unsubscribe();
    };
  }, [multiplayerState.isConnected, multiplayerState.roomId, multiplayerState.playerId, multiplayerState.playerSide]);

  // Handle window resize to make playfield fullscreen
  useEffect(() => {
    const updateCanvasSize = () => {
      const width = window.innerWidth; // Full screen width
      const height = window.innerHeight; // Full screen height
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

  // Generate authentic Pong beep sound
  const playBeep = useCallback((frequency: number, duration: number) => {
    if (!audioContextRef.current) return;

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
        case ' ':
          e.preventDefault();

          // Don't allow multiple connection attempts
          if (connectionStatus === 'connecting') {
            return;
          }

          if (!multiplayerState.isConnected && connectionStatus !== 'error') {
            try {
              await joinMultiplayerGame();
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
              await joinMultiplayerGame();
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
            if (multiplayerState.playerSide === 'spectator') {
              try {
                await joinMultiplayerGame();
              } catch (error) {
                console.error('Failed to rejoin as player:', error);
              }
            }
          }
          break;
        case 'r':
          // Reset game room (for testing)
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            try {
              await supabase
                .from('live_pong')
                .delete()
                .eq('room_id', multiplayerState.roomId);
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [connectionStatus, multiplayerState.isConnected, multiplayerState.playerSide, gameState.gameMode, joinMultiplayerGame, multiplayerState.roomId, setGameState]);

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

      // Update paddle positions
      if (newState.gameMode === 'player') {
        // Single-player controls with smooth interpolation
        // Left paddle smooth movement
        if (keys.w && newState.paddles.left.y > 12) {
          newState.paddles.left.velocity -= 1.8; // Faster acceleration
        } else if (keys.s && newState.paddles.left.y < canvasSize.height - 12 - newState.paddles.left.height) {
          newState.paddles.left.velocity += 1.8; // Faster acceleration
        } else {
          newState.paddles.left.velocity *= 0.85; // Smooth deceleration
        }

        // Apply velocity with limits
        newState.paddles.left.velocity = Math.max(-newState.paddles.left.speed, Math.min(newState.paddles.left.speed, newState.paddles.left.velocity));
        newState.paddles.left.y += newState.paddles.left.velocity;
        newState.paddles.left.y = Math.max(12, Math.min(canvasSize.height - 12 - newState.paddles.left.height, newState.paddles.left.y));

        // Right paddle smooth movement
        if (keys.up && newState.paddles.right.y > 12) {
          newState.paddles.right.velocity -= 1.8; // Faster acceleration
        } else if (keys.down && newState.paddles.right.y < canvasSize.height - 12 - newState.paddles.right.height) {
          newState.paddles.right.velocity += 1.8; // Faster acceleration
        } else {
          newState.paddles.right.velocity *= 0.85; // Smooth deceleration
        }

        // Apply velocity with limits
        newState.paddles.right.velocity = Math.max(-newState.paddles.right.speed, Math.min(newState.paddles.right.speed, newState.paddles.right.velocity));
        newState.paddles.right.y += newState.paddles.right.velocity;
        newState.paddles.right.y = Math.max(12, Math.min(canvasSize.height - 12 - newState.paddles.right.height, newState.paddles.right.y));
      } else if (newState.gameMode === 'multiplayer') {
        // Multiplayer controls (only the paddle assigned to this player)
        if (multiplayerState.playerSide === 'left') {
          const oldY = newState.paddles.left.y;

          // Smooth left paddle movement for multiplayer (using W/S keys)
          if (keys.w && newState.paddles.left.y > 12) {
            newState.paddles.left.velocity -= 1.8; // Faster acceleration
          } else if (keys.s && newState.paddles.left.y < canvasSize.height - 12 - newState.paddles.left.height) {
            newState.paddles.left.velocity += 1.8; // Faster acceleration
          } else {
            newState.paddles.left.velocity *= 0.85; // Smooth deceleration
          }

          // Apply velocity with limits
          newState.paddles.left.velocity = Math.max(-newState.paddles.left.speed, Math.min(newState.paddles.left.speed, newState.paddles.left.velocity));
          newState.paddles.left.y += newState.paddles.left.velocity;
          newState.paddles.left.y = Math.max(12, Math.min(canvasSize.height - 12 - newState.paddles.left.height, newState.paddles.left.y));

          if (Math.abs(newState.paddles.left.y - oldY) > 0.1) {
            updatePaddlePosition('left', newState.paddles.left.y);
          }
        } else if (multiplayerState.playerSide === 'right') {
          const oldY = newState.paddles.right.y;

          // Smooth right paddle movement for multiplayer
          if (keys.up && newState.paddles.right.y > 12) {
            newState.paddles.right.velocity -= 1.8; // Faster acceleration
          } else if (keys.down && newState.paddles.right.y < canvasSize.height - 12 - newState.paddles.right.height) {
            newState.paddles.right.velocity += 1.8; // Faster acceleration
          } else {
            newState.paddles.right.velocity *= 0.85; // Smooth deceleration
          }

          // Apply velocity with limits
          newState.paddles.right.velocity = Math.max(-newState.paddles.right.speed, Math.min(newState.paddles.right.speed, newState.paddles.right.velocity));
          newState.paddles.right.y += newState.paddles.right.velocity;
          newState.paddles.right.y = Math.max(12, Math.min(canvasSize.height - 12 - newState.paddles.right.height, newState.paddles.right.y));

          if (Math.abs(newState.paddles.right.y - oldY) > 0.1) {
            updatePaddlePosition('right', newState.paddles.right.y);
          }
        }

        // In multiplayer mode, disable AI control entirely
        // Players control their own paddles, game master syncs states
        // Uncontrolled paddles will be updated via real-time sync from other browsers

        // DISABLED: Auto-control for unassigned paddles - only if no human player is controlling them
        // DISABLED: Check if left paddle has no human player assigned
        if (false && multiplayerState.playerSide !== 'left') {
          // Auto-control left paddle if no player assigned
          leftFrameCountRef.current++;
          const updatePaddleWithSpinner = (paddle: any, isLeft: boolean, frameCount: number) => {
            // Same auto-control logic as before...
            const reactionDelay = isLeft ? HUMAN_REACTION_DELAY : HUMAN_REACTION_DELAY + 3;
            const ballCenterY = newState.ball.y + newState.ball.size / 2;

            if (frameCount % reactionDelay === 0) {
              const baseInaccuracy = isLeft ? 12 : 18;
              const inaccuracy = (Math.random() - 0.5) * baseInaccuracy;
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
            const ballDistance = Math.abs(newState.ball.x - (isLeft ? 0 : canvasSize.width));
            const ballSpeed = Math.abs(newState.ball.dx);
            const isPanicSituation = ballDistance < 300;
            const currentPaddleCenter = paddle.y + paddle.height / 2;
            const ballPaddleDistance = Math.abs(ballCenterY - currentPaddleCenter);
            const ballHeadingTowardsPaddle = isLeft ? newState.ball.dx < 0 : newState.ball.dx > 0;
            const isEmergencyPanic = ballHeadingTowardsPaddle && ballDistance < 150 && ballPaddleDistance > 30;
            const panicThreatLevel = isPanicSituation && ballPaddleDistance > 20;
            const shouldPanic = (Math.random() < PANIC_MOVE_CHANCE && panicThreatLevel) || isEmergencyPanic;
            const shouldExtremePanic = (Math.random() < EXTREME_PANIC_CHANCE && panicThreatLevel) || isEmergencyPanic;

            let acceleration = isLeft ? PADDLE_ACCELERATION : PADDLE_ACCELERATION * 0.85;

            if (shouldExtremePanic) {
              const extremePanicDirection = Math.sign(ballCenterY - currentPaddleCenter);
              let panicMultiplier = EXTREME_PANIC_MULTIPLIER;
              if (isEmergencyPanic) {
                panicMultiplier = EXTREME_PANIC_MULTIPLIER * 2;
              }
              paddle.velocity = extremePanicDirection * paddle.speed * panicMultiplier;
              paddle.velocity += (Math.random() - 0.5) * 8;
              paddle.velocity *= isEmergencyPanic ? 2.0 : 1.5;
            } else if (shouldPanic) {
              const panicDirection = Math.sign(ballCenterY - currentPaddleCenter);
              paddle.velocity += panicDirection * acceleration * PANIC_VELOCITY_MULTIPLIER;
              paddle.velocity += (Math.random() - 0.5) * 2;
            } else {
              // Human-like movement: decisive action to intercept ball
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

            const friction = isLeft ? PADDLE_FRICTION : PADDLE_FRICTION * 0.95;
            paddle.velocity *= friction;
            const maxSpeed = isLeft ? paddle.speed : paddle.speed * 0.9;
            paddle.velocity = Math.max(-maxSpeed, Math.min(maxSpeed, paddle.velocity));
            paddle.y += paddle.velocity;
            paddle.y = Math.max(0, Math.min(canvasSize.height - paddle.height, paddle.y));
          };

          updatePaddleWithSpinner(newState.paddles.left, true, leftFrameCountRef.current);
        }

        // DISABLED: Check if right paddle has no human player assigned
        if (false && multiplayerState.playerSide !== 'right') {
          // Auto-control right paddle if no player assigned
          rightFrameCountRef.current++;
          const updatePaddleWithSpinner = (paddle: any, isLeft: boolean, frameCount: number) => {
            // Same logic repeated for right paddle...
            const reactionDelay = isLeft ? HUMAN_REACTION_DELAY : HUMAN_REACTION_DELAY + 3;
            const ballCenterY = newState.ball.y + newState.ball.size / 2;

            if (frameCount % reactionDelay === 0) {
              const baseInaccuracy = isLeft ? 12 : 18;
              const inaccuracy = (Math.random() - 0.5) * baseInaccuracy;
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
            const ballDistance = Math.abs(newState.ball.x - (isLeft ? 0 : canvasSize.width));
            const ballSpeed = Math.abs(newState.ball.dx);
            const isPanicSituation = ballDistance < 300;
            const currentPaddleCenter = paddle.y + paddle.height / 2;
            const ballPaddleDistance = Math.abs(ballCenterY - currentPaddleCenter);
            const ballHeadingTowardsPaddle = isLeft ? newState.ball.dx < 0 : newState.ball.dx > 0;
            const isEmergencyPanic = ballHeadingTowardsPaddle && ballDistance < 150 && ballPaddleDistance > 30;
            const panicThreatLevel = isPanicSituation && ballPaddleDistance > 20;
            const shouldPanic = (Math.random() < PANIC_MOVE_CHANCE && panicThreatLevel) || isEmergencyPanic;
            const shouldExtremePanic = (Math.random() < EXTREME_PANIC_CHANCE && panicThreatLevel) || isEmergencyPanic;

            let acceleration = isLeft ? PADDLE_ACCELERATION : PADDLE_ACCELERATION * 0.85;

            if (shouldExtremePanic) {
              const extremePanicDirection = Math.sign(ballCenterY - currentPaddleCenter);
              let panicMultiplier = EXTREME_PANIC_MULTIPLIER;
              if (isEmergencyPanic) {
                panicMultiplier = EXTREME_PANIC_MULTIPLIER * 2;
              }
              paddle.velocity = extremePanicDirection * paddle.speed * panicMultiplier;
              paddle.velocity += (Math.random() - 0.5) * 8;
              paddle.velocity *= isEmergencyPanic ? 2.0 : 1.5;
            } else if (shouldPanic) {
              const panicDirection = Math.sign(ballCenterY - currentPaddleCenter);
              paddle.velocity += panicDirection * acceleration * PANIC_VELOCITY_MULTIPLIER;
              paddle.velocity += (Math.random() - 0.5) * 2;
            } else {
              // Human-like movement: decisive action to intercept ball
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

            const friction = isLeft ? PADDLE_FRICTION : PADDLE_FRICTION * 0.95;
            paddle.velocity *= friction;
            const maxSpeed = isLeft ? paddle.speed : paddle.speed * 0.9;
            paddle.velocity = Math.max(-maxSpeed, Math.min(maxSpeed, paddle.velocity));
            paddle.y += paddle.velocity;
            paddle.y = Math.max(0, Math.min(canvasSize.height - paddle.height, paddle.y));
          };

          updatePaddleWithSpinner(newState.paddles.right, false, rightFrameCountRef.current);
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

      // In multiplayer mode, only sync ball/score changes, not paddle positions
      // Paddle positions are handled individually by each player
      if (newState.gameMode === 'multiplayer' && multiplayerState.isGameMaster) {
        // Only sync ball and score changes, and throttle heavily to reduce load
        const now = Date.now();
        const timeSinceLastUpdate = now - lastUpdateRef.current;

        const ballMoved = Math.abs(newState.ball.x - gameState.ball.x) > 5 || Math.abs(newState.ball.y - gameState.ball.y) > 5;
        const scoreChanged = newState.score.left !== gameState.score.left || newState.score.right !== gameState.score.right;

        if ((ballMoved || scoreChanged) && timeSinceLastUpdate > 100) { // Max 10fps for ball sync
          lastUpdateRef.current = now;
          updateMultiplayerGameState(newState);
        }
      }

      } // End of !newState.isPaused check - ball logic only

      return newState;
    });
  }, [keys, playBeep, canvasSize, multiplayerState.isGameMaster, updateMultiplayerGameState]);

  // Render game
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
        ctx.fillText('CONNECTING TO MULTIPLAYER...', canvasSize.width / 2, canvasSize.height - 20);
      } else if (connectionStatus === 'error') {
        ctx.fillText('CONNECTION FAILED - Press SPACEBAR to retry', canvasSize.width / 2, canvasSize.height - 20);
      } else {
        ctx.fillText('Press SPACEBAR to join online multiplayer', canvasSize.width / 2, canvasSize.height - 20);
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

          ctx.fillText('MULTIPLAYER MODE', canvasSize.width / 2, canvasSize.height - 80);
          ctx.fillText(playerSideText, canvasSize.width / 2, canvasSize.height - 60);

          if (multiplayerState.playerSide !== 'spectator') {
            const controls = multiplayerState.playerSide === 'left' ? 'W/S keys' : '↑/↓ arrows';
            ctx.fillText(`Controls: ${controls}`, canvasSize.width / 2, canvasSize.height - 40);
          }
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
      ctx.fillText('Press SPACEBAR to return to auto-play', canvasSize.width / 2, canvasSize.height - 20);
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

  }, [gameState, canvasSize, connectionStatus, multiplayerState.isConnected, multiplayerState.playerSide, infoTextFadeStart]);

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
  }, [gameState.colorIndex]);

  // Tiny random glitch renderer - applies to actual objects like ball lost effect
  const renderTinyGlitch = useCallback((ctx: CanvasRenderingContext2D, centerX: number, centerY: number, targetColor: string, progress: number, canvasSize: { width: number; height: number }) => {
    const glitchSize = 15; // Small area around the center point
    const intensity = Math.sin(progress * Math.PI);
    const time = progress * 8;

    // Get current canvas data to identify non-background pixels (same as ball lost effect)
    const imageData = ctx.getImageData(
      Math.max(0, centerX - glitchSize),
      Math.max(0, centerY - glitchSize),
      Math.min(glitchSize * 2, canvasSize.width - Math.max(0, centerX - glitchSize)),
      Math.min(glitchSize * 2, canvasSize.height - Math.max(0, centerY - glitchSize))
    );
    const data = imageData.data;
    const backgroundColorRGB = hexToRgb(COLOR_PALETTE[gameState.colorIndex].background);

    ctx.globalAlpha = 0.8 * intensity;
    ctx.strokeStyle = targetColor;
    ctx.lineWidth = 1;

    // Apply tiny decrunch effect only to foreground pixels (same logic as ball lost effect)
    const scanlineSpacing = 2;
    for (let localY = 0; localY < Math.min(glitchSize * 2, canvasSize.height - Math.max(0, centerY - glitchSize)); localY += scanlineSpacing) {
      const actualY = Math.max(0, centerY - glitchSize) + localY;

      for (let localX = 0; localX < Math.min(glitchSize * 2, canvasSize.width - Math.max(0, centerX - glitchSize)); localX++) {
        const actualX = Math.max(0, centerX - glitchSize) + localX;
        const pixelIndex = (localY * Math.min(glitchSize * 2, canvasSize.width - Math.max(0, centerX - glitchSize)) + localX) * 4;

        if (pixelIndex + 2 < data.length) {
          // Check if this pixel is not background color (i.e., it's a game object)
          const r = data[pixelIndex];
          const g = data[pixelIndex + 1];
          const b = data[pixelIndex + 2];

          const isBackground = Math.abs(r - backgroundColorRGB.r) < 30 &&
                             Math.abs(g - backgroundColorRGB.g) < 30 &&
                             Math.abs(b - backgroundColorRGB.b) < 30;

          if (!isBackground) {
            // Apply mini corruption only to this object pixel
            const corruptionOffset = Math.sin(actualY * 0.2 + time * 4) * 1 * progress;
            const shouldCorrupt = Math.random() < (0.6 * progress);

            if (shouldCorrupt && Math.random() > 0.4) {
              const lineStartX = actualX + corruptionOffset;
              const lineEndX = lineStartX + 2 + Math.random() * 4; // Very short lines

              ctx.beginPath();
              ctx.moveTo(lineStartX, actualY);
              ctx.lineTo(lineEndX, actualY);
              ctx.stroke();
            }
          }
        }
      }
    }

    ctx.globalAlpha = 1;
  }, [gameState.colorIndex]);

  // Helper function to convert hex to RGB
  const hexToRgb = useCallback((hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }, []);

  // Optimized game loop for smooth 60fps
  useEffect(() => {
    if (!gameState.isPlaying) return;

    const gameLoop = (currentTime: number) => {
      const deltaTime = currentTime - lastTimeRef.current;

      // Always update game logic and render for smoothest experience
      // Don't wait for exact frame timing - let requestAnimationFrame handle the timing
      if (deltaTime >= FRAME_TIME * 0.8) { // Slightly more aggressive timing
        updateGame();
        lastTimeRef.current = currentTime;
      }

      // Always render at display refresh rate for smoothest visuals
      render();

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    lastTimeRef.current = performance.now();
    gameLoop(lastTimeRef.current);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameState.isPlaying, updateGame, render]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  return (
    <div className="w-screen h-screen overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="block w-full h-full"
        style={{ background: COLOR_PALETTE[gameState.colorIndex].background }}
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