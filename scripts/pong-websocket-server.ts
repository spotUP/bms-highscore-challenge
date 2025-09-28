import { WebSocketServer } from 'ws';
import { createServer } from 'http';

// Force redeploy - 2025-09-26T16:47:00Z - Root directory already empty, forcing webhook

// Types for game entities
interface Pickup {
  id: string;
  x: number;
  y: number;
  type: 'speed' | 'size' | 'reverse' | 'drunk' | 'teleport' | 'paddle' | 'freeze' | 'coins';
  createdAt: number;
  size?: number;
}

interface Coin {
  id: string;
  x: number;
  y: number;
  createdAt: number;
  size: number;
}

interface ActiveEffect {
  type: 'speed' | 'size' | 'reverse' | 'drunk' | 'teleport' | 'paddle' | 'freeze';
  startTime: number;
  duration: number;
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
}

interface Player {
  id: string;
  side: 'left' | 'right' | 'top' | 'bottom' | 'spectator';
  ws: any;
  roomId: string;
  lastSeen: number;
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

  constructor(port = 3002) {
    this.port = port;
    this.instanceId = Math.random().toString(36).substr(2, 9);
    this.server = createServer();
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
      console.log('🎮 New WebSocket connection at', new Date().toISOString());
      let playerId: string | null = null;

      // Enhanced connection tracking
      (ws as any)._connectionTime = connectionTime;

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          console.log('📨 Received message:', data);
          this.handleMessage(ws, data);
          playerId = data.playerId || playerId;
        } catch (error) {
          console.error('❌ Error parsing message:', error);
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
        console.error('❌ WebSocket error:', error);
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
      default:
        console.log('❓ Unknown message type:', fullType, 'original:', type);
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

    if (forceSpectator) {
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

    console.log(`✅ Player ${playerId} joined as ${playerSide} (${room.players.size} total players)`);
  }

  private handlePaddleUpdate(playerId: string, data: any) {
    const player = this.players.get(playerId);
    if (!player) return;

    const room = this.rooms.get(player.roomId);
    if (!room) return;

    player.lastSeen = Date.now();

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

    // Broadcast paddle update to other players
    const updateData: any = {
      side: player.side,
      velocity: data.velocity
    };

    // Add appropriate position data based on paddle side
    if (player.side === 'left' || player.side === 'right') {
      updateData.y = data.y;
      updateData.targetY = data.targetY;
    } else if (player.side === 'top' || player.side === 'bottom') {
      updateData.x = data.x;
      updateData.targetX = data.targetX;
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

    if (deltaData.score) {
      room.gameState.score = deltaData.score;
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

    console.log(`🔄 Room ${roomId} reset by gamemaster ${playerId}`);
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

          console.log(`🔄 Spectator ${spectator.id} promoted to ${player.side} position`);
        }
      }

      // Clean up empty rooms (except main room which is persistent)
      if (room.players.size === 0 && player.roomId !== 'main') {
        this.rooms.delete(player.roomId);
        console.log(`🗑️ Empty room ${player.roomId} deleted`);
      } else if (room.players.size === 0 && player.roomId === 'main') {
        console.log(`🏠 Main room kept alive (empty but persistent)`);
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
          console.error(`❌ Error sending message to player ${player.id}:`, error);
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
      isActive: true,
      canvasSize: { width: 800, height: 600 }
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
        previousTouchedBy: null
      },
      paddles: {
        left: { y: 250, height: 100, width: 12, speed: 32, velocity: 0, targetY: 250, originalHeight: 100 },
        right: { y: 250, height: 100, width: 12, speed: 32, velocity: 0, targetY: 250, originalHeight: 100 },
        top: { x: 360, height: 12, width: 80, speed: 32, velocity: 0, targetX: 360, originalWidth: 80 },
        bottom: { x: 360, height: 12, width: 80, speed: 32, velocity: 0, targetX: 360, originalWidth: 80 }
      },
      score: {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0
      },
      isPlaying: false, // Start with start screen
      showStartScreen: true,
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
      }
    };
  }

  private startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      const timeout = 30000; // 30 seconds

      // Clean up inactive players
      this.players.forEach((player, playerId) => {
        if (now - player.lastSeen > timeout) {
          console.log(`🧹 Cleaning up inactive player ${playerId}`);
          this.handlePlayerDisconnect(playerId);
        }
      });

      // Clean up inactive rooms
      this.rooms.forEach((room, roomId) => {
        if (now - room.lastUpdate > timeout && room.players.size === 0) {
          console.log(`🧹 Cleaning up inactive room ${roomId}`);
          this.rooms.delete(roomId);
        }
      });
    }, 10000); // Check every 10 seconds
  }

  private createPersistentMainRoom() {
    // Create the main room that persists even when empty
    const mainRoom = this.createNewRoom('main');
    this.rooms.set('main', mainRoom);
    console.log(`🏠 Persistent main room created`);
  }

  private startGameLoop() {
    // Server-side game loop running at 60 FPS for smooth physics
    const GAME_LOOP_FPS = 60;
    const GAME_LOOP_INTERVAL = 1000 / GAME_LOOP_FPS;

    setInterval(() => {
      this.updateGameLogic();
    }, GAME_LOOP_INTERVAL);

    console.log(`🔄 Server game loop started at ${GAME_LOOP_FPS} FPS`);
  }

  private updateGameLogic() {
    const now = Date.now();

    this.rooms.forEach((room, roomId) => {
      // Only update active game rooms with players
      if (!room.isActive || room.players.size === 0) return;

      const gameState = room.gameState;
      const canvasSize = room.canvasSize;

      // Only update game logic if game is playing and not paused
      if (!gameState.isPlaying || gameState.isPaused || gameState.gameEnded) return;

      let gameStateChanged = false;

      // Update ball physics
      if (this.updateBallPhysics(gameState, canvasSize)) {
        gameStateChanged = true;
      }

      // Handle pickups generation and collision
      if (this.updatePickups(gameState, canvasSize, now)) {
        gameStateChanged = true;
      }

      // Update active effects
      if (this.updateActiveEffects(gameState, now)) {
        gameStateChanged = true;
      }

      // Broadcast game state updates to all players if changed
      if (gameStateChanged) {
        this.broadcastToRoom(roomId, {
          type: 'server_game_update',
          data: {
            ball: gameState.ball,
            score: gameState.score,
            pickups: gameState.pickups,
            coins: gameState.coins,
            activeEffects: gameState.activeEffects,
            pickupEffect: gameState.pickupEffect,
            rumbleEffect: gameState.rumbleEffect,
            winner: gameState.winner,
            gameEnded: gameState.gameEnded
          }
        });

        room.lastUpdate = now;
      }
    });
  }

  private updateBallPhysics(gameState: GameState, canvasSize: { width: number; height: number }): boolean {
    const COLLISION_BUFFER = 0; // Precise collision detection - hitbox matches paddle size exactly
    let ballChanged = false;

    // Update ball position
    gameState.ball.x += gameState.ball.dx;
    gameState.ball.y += gameState.ball.dy;
    ballChanged = true;

    // Ball collision with paddles (server-side authoritative)
    const ballLeft = gameState.ball.x;
    const ballRight = gameState.ball.x + gameState.ball.size;
    const ballTop = gameState.ball.y;
    const ballBottom = gameState.ball.y + gameState.ball.size;
    const prevBallX = gameState.ball.x - gameState.ball.dx;
    const prevBallY = gameState.ball.y - gameState.ball.dy;
    const ballCenterX = gameState.ball.x + gameState.ball.size / 2;
    const ballCenterY = gameState.ball.y + gameState.ball.size / 2;
    const prevBallCenterX = prevBallX + gameState.ball.size / 2;
    const prevBallCenterY = prevBallY + gameState.ball.size / 2;

    // Left paddle collision (30px spacing from left wall only)
    const leftPaddleX = 30;
    const leftPaddleRight = leftPaddleX + gameState.paddles.left.width;
    const ballIntersectsLeftPaddle =
      ballLeft <= leftPaddleRight + COLLISION_BUFFER &&
      ballRight >= leftPaddleX - COLLISION_BUFFER &&
      ballBottom >= gameState.paddles.left.y - COLLISION_BUFFER &&
      ballTop <= gameState.paddles.left.y + gameState.paddles.left.height + COLLISION_BUFFER;
    const ballTrajectoryIntersectsLeftPaddle = this.lineIntersectsRect(
      prevBallCenterX, prevBallCenterY, ballCenterX, ballCenterY,
      leftPaddleX, gameState.paddles.left.y, gameState.paddles.left.width, gameState.paddles.left.height
    );
    const ballCameFromRight = prevBallX > leftPaddleRight || prevBallCenterX > leftPaddleRight;

    if ((ballIntersectsLeftPaddle || ballTrajectoryIntersectsLeftPaddle) && ballCameFromRight && gameState.ball.dx < 0) {
      const hitPosition = (ballCenterY - gameState.paddles.left.y) / gameState.paddles.left.height;
      const normalizedHit = (hitPosition - 0.5) * 2;
      const maxSpeedVariation = 10;
      const newDx = Math.abs(gameState.ball.dx) + Math.random() * 2;
      const newDy = normalizedHit * maxSpeedVariation + (Math.random() - 0.5) * 2;

      gameState.ball.dx = newDx;
      gameState.ball.dy = newDy;
      gameState.ball.x = leftPaddleRight + 1;
      gameState.ball.previousTouchedBy = gameState.ball.lastTouchedBy;
      gameState.ball.lastTouchedBy = 'left';
      ballChanged = true;
    }

    // Right paddle collision
    const rightPaddleX = canvasSize.width - 30 - gameState.paddles.right.width;
    const rightPaddleLeft = rightPaddleX;
    const ballIntersectsRightPaddle =
      ballRight >= rightPaddleLeft - COLLISION_BUFFER &&
      ballLeft <= rightPaddleX + gameState.paddles.right.width + COLLISION_BUFFER &&
      ballBottom >= gameState.paddles.right.y - COLLISION_BUFFER &&
      ballTop <= gameState.paddles.right.y + gameState.paddles.right.height + COLLISION_BUFFER;
    const ballTrajectoryIntersectsRightPaddle = this.lineIntersectsRect(
      prevBallCenterX, prevBallCenterY, ballCenterX, ballCenterY,
      rightPaddleX, gameState.paddles.right.y, gameState.paddles.right.width, gameState.paddles.right.height
    );
    const ballCameFromLeft = prevBallX < rightPaddleLeft || prevBallCenterX < rightPaddleLeft;

    if ((ballIntersectsRightPaddle || ballTrajectoryIntersectsRightPaddle) && ballCameFromLeft && gameState.ball.dx > 0) {
      const hitPosition = (ballCenterY - gameState.paddles.right.y) / gameState.paddles.right.height;
      const normalizedHit = (hitPosition - 0.5) * 2;
      const maxSpeedVariation = 10;
      const newDx = -(Math.abs(gameState.ball.dx) + Math.random() * 2);
      const newDy = normalizedHit * maxSpeedVariation + (Math.random() - 0.5) * 2;

      gameState.ball.dx = newDx;
      gameState.ball.dy = newDy;
      gameState.ball.x = rightPaddleLeft - gameState.ball.size - 1;
      gameState.ball.previousTouchedBy = gameState.ball.lastTouchedBy;
      gameState.ball.lastTouchedBy = 'right';
      ballChanged = true;
    }

    // Top paddle collision
    const topPaddleY = 30;
    const topPaddleBottom = topPaddleY + gameState.paddles.top.height;
    const ballIntersectsTopPaddle =
      ballTop <= topPaddleBottom + COLLISION_BUFFER &&
      ballBottom >= topPaddleY - COLLISION_BUFFER &&
      ballRight >= gameState.paddles.top.x - COLLISION_BUFFER &&
      ballLeft <= gameState.paddles.top.x + gameState.paddles.top.width + COLLISION_BUFFER;
    const ballTrajectoryIntersectsTopPaddle = this.lineIntersectsRect(
      prevBallCenterX, prevBallCenterY, ballCenterX, ballCenterY,
      gameState.paddles.top.x, topPaddleY, gameState.paddles.top.width, gameState.paddles.top.height
    );
    const ballCameFromBelow = prevBallY > topPaddleBottom || prevBallCenterY > topPaddleBottom;

    if ((ballIntersectsTopPaddle || ballTrajectoryIntersectsTopPaddle) && ballCameFromBelow && gameState.ball.dy < 0) {
      const hitPosition = (ballCenterX - gameState.paddles.top.x) / gameState.paddles.top.width;
      const normalizedHit = (hitPosition - 0.5) * 2;
      const maxSpeedVariation = 10;
      const newDy = Math.abs(gameState.ball.dy) + Math.random() * 2;
      const newDx = normalizedHit * maxSpeedVariation + (Math.random() - 0.5) * 2;

      gameState.ball.dx = newDx;
      gameState.ball.dy = newDy;
      gameState.ball.y = topPaddleBottom + 1;
      gameState.ball.previousTouchedBy = gameState.ball.lastTouchedBy;
      gameState.ball.lastTouchedBy = 'top';
      ballChanged = true;
    }

    // Bottom paddle collision
    const bottomPaddleY = canvasSize.height - 30 - gameState.paddles.bottom.height;
    const bottomPaddleTop = bottomPaddleY;
    const ballIntersectsBottomPaddle =
      ballBottom >= bottomPaddleTop - COLLISION_BUFFER &&
      ballTop <= bottomPaddleY + gameState.paddles.bottom.height + COLLISION_BUFFER &&
      ballRight >= gameState.paddles.bottom.x - COLLISION_BUFFER &&
      ballLeft <= gameState.paddles.bottom.x + gameState.paddles.bottom.width + COLLISION_BUFFER;
    const ballTrajectoryIntersectsBottomPaddle = this.lineIntersectsRect(
      prevBallCenterX, prevBallCenterY, ballCenterX, ballCenterY,
      gameState.paddles.bottom.x, bottomPaddleY, gameState.paddles.bottom.width, gameState.paddles.bottom.height
    );
    const ballCameFromAbove = prevBallY < bottomPaddleTop || prevBallCenterY < bottomPaddleTop;

    if ((ballIntersectsBottomPaddle || ballTrajectoryIntersectsBottomPaddle) && ballCameFromAbove && gameState.ball.dy > 0) {
      const hitPosition = (ballCenterX - gameState.paddles.bottom.x) / gameState.paddles.bottom.width;
      const normalizedHit = (hitPosition - 0.5) * 2;
      const maxSpeedVariation = 10;
      const newDy = -(Math.abs(gameState.ball.dy) + Math.random() * 2);
      const newDx = normalizedHit * maxSpeedVariation + (Math.random() - 0.5) * 2;

      gameState.ball.dx = newDx;
      gameState.ball.dy = newDy;
      gameState.ball.y = bottomPaddleTop - gameState.ball.size - 1;
      gameState.ball.previousTouchedBy = gameState.ball.lastTouchedBy;
      gameState.ball.lastTouchedBy = 'bottom';
      ballChanged = true;
    }

    // Scoring boundaries - ball goes off screen
    if (gameState.ball.x < -20) {
      this.handleScoring(gameState, 'left');
      ballChanged = true;
    } else if (gameState.ball.x > canvasSize.width + 20) {
      this.handleScoring(gameState, 'right');
      ballChanged = true;
    } else if (gameState.ball.y < -20) {
      this.handleScoring(gameState, 'top');
      ballChanged = true;
    } else if (gameState.ball.y > canvasSize.height + 20) {
      this.handleScoring(gameState, 'bottom');
      ballChanged = true;
    }

    return ballChanged;
  }

  private handleScoring(gameState: GameState, boundaryHit: 'left' | 'right' | 'top' | 'bottom'): void {
    let scoringPlayer: 'left' | 'right' | 'top' | 'bottom';

    // Determine who gets the score based on last touch
    if (gameState.ball.lastTouchedBy) {
      // Check for self-goal (player hit ball into their own wall)
      const isSelfGoal = gameState.ball.lastTouchedBy === boundaryHit;
      if (isSelfGoal && gameState.ball.previousTouchedBy) {
        // Self-goal: previous player gets the score
        scoringPlayer = gameState.ball.previousTouchedBy;
      } else if (!isSelfGoal) {
        // Normal goal: last toucher gets the score
        scoringPlayer = gameState.ball.lastTouchedBy;
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

    // Check for winner (first to 3 points)
    if (gameState.score[scoringPlayer] >= 3) {
      gameState.winner = scoringPlayer;
      gameState.gameEnded = true;
      gameState.isPlaying = false;
      console.log(`🎉 Game Over! Winner: ${scoringPlayer}`);
    }

    // Reset ball position
    this.resetBall(gameState);
  }

  private resetBall(gameState: GameState): void {
    gameState.ball.x = 400;
    gameState.ball.y = 300;
    gameState.ball.dx = Math.random() > 0.5 ? 10 : -10;
    gameState.ball.dy = Math.random() > 0.5 ? 10 : -10;
    gameState.ball.lastTouchedBy = null;
    gameState.ball.previousTouchedBy = null;
  }

  private updatePickups(gameState: GameState, canvasSize: { width: number; height: number }, now: number): boolean {
    let pickupsChanged = false;

    // Generate new pickups
    if (now >= gameState.nextPickupTime && gameState.pickups.length < 3) {
      this.generatePickup(gameState, canvasSize);

      // Progressive pickup frequency (starts at 8s, decreases to 4s)
      const gameTime = now - (gameState.nextPickupTime - 5000); // Game start time estimation
      const baseInterval = 8000; // 8 seconds
      const minInterval = 4000; // 4 seconds minimum
      const progressionRate = gameTime / 60000; // Over 1 minute
      const currentInterval = Math.max(minInterval, baseInterval - (progressionRate * 4000));

      gameState.nextPickupTime = now + currentInterval;
      pickupsChanged = true;
    }

    // Check ball collision with pickups
    gameState.pickups.forEach((pickup, index) => {
      const ballCenterX = gameState.ball.x + gameState.ball.size / 2;
      const ballCenterY = gameState.ball.y + gameState.ball.size / 2;
      const pickupCenterX = pickup.x + (pickup.size || 24) / 2;
      const pickupCenterY = pickup.y + (pickup.size || 24) / 2;
      const distance = Math.sqrt(
        Math.pow(ballCenterX - pickupCenterX, 2) + Math.pow(ballCenterY - pickupCenterY, 2)
      );

      if (distance < (gameState.ball.size + (pickup.size || 24)) / 2) {
        // Pickup collected!
        this.applyPickupEffect(gameState, pickup);
        gameState.pickups.splice(index, 1);

        // Create pickup effect animation
        gameState.pickupEffect = {
          isActive: true,
          startTime: now,
          x: pickup.x,
          y: pickup.y
        };

        pickupsChanged = true;
      }
    });

    return pickupsChanged;
  }

  private generatePickup(gameState: GameState, canvasSize: { width: number; height: number }): void {
    const pickupTypes: Pickup['type'][] = ['speed', 'size', 'reverse', 'drunk', 'teleport', 'paddle', 'freeze'];
    const type = pickupTypes[Math.floor(Math.random() * pickupTypes.length)];

    const pickup: Pickup = {
      id: Math.random().toString(36).substr(2, 9),
      x: Math.random() * (canvasSize.width - 100) + 50,
      y: Math.random() * (canvasSize.height - 100) + 50,
      type,
      createdAt: Date.now(),
      size: 24
    };

    gameState.pickups.push(pickup);
  }

  private applyPickupEffect(gameState: GameState, pickup: Pickup): void {
    const effect: ActiveEffect = {
      type: pickup.type,
      startTime: Date.now(),
      duration: 5000 // 5 seconds
    };

    gameState.activeEffects.push(effect);

    // Apply immediate effects based on pickup type
    switch (pickup.type) {
      case 'speed':
        const speedMultiplier = 1.5;
        gameState.ball.dx *= speedMultiplier;
        gameState.ball.dy *= speedMultiplier;
        break;

      case 'size':
        gameState.ball.size = Math.min(gameState.ball.size * 1.5, 40);
        break;

      case 'reverse':
        gameState.ball.dx *= -1;
        gameState.ball.dy *= -1;
        break;

      case 'drunk':
        gameState.ball.isDrunk = true;
        break;

      case 'freeze':
        // Freeze all paddle movement for 3 seconds
        gameState.paddles.left.velocity = 0;
        gameState.paddles.right.velocity = 0;
        gameState.paddles.top.velocity = 0;
        gameState.paddles.bottom.velocity = 0;
        break;
    }
  }

  private updateActiveEffects(gameState: GameState, now: number): boolean {
    let effectsChanged = false;

    // Remove expired effects
    const initialLength = gameState.activeEffects.length;
    gameState.activeEffects = gameState.activeEffects.filter(effect => {
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

  private reversePickupEffect(gameState: GameState, effect: ActiveEffect): void {
    switch (effect.type) {
      case 'size':
        gameState.ball.size = gameState.ball.originalSize;
        break;

      case 'drunk':
        gameState.ball.isDrunk = false;
        gameState.ball.drunkAngle = 0;
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
    this.server.listen(this.port, '0.0.0.0', () => {
      console.log(`🚀 Pong WebSocket server running on http://0.0.0.0:${this.port}`);
      console.log(`🎮 Ready for Pong multiplayer connections!`);
      console.log(`🆔 Server Instance ID: ${this.instanceId}`);
    });

    // Send periodic heartbeat to all connected clients
    setInterval(() => {
      this.players.forEach((player) => {
        if (player.ws.readyState === 1) { // WebSocket.OPEN
          try {
            player.ws.send(JSON.stringify({
              type: 'heartbeat',
              timestamp: Date.now(),
              serverInstanceId: this.instanceId
            }));
          } catch (error) {
            console.error(`❌ Error sending heartbeat to player ${player.id}:`, error);
          }
        }
      });
    }, 30000); // Send heartbeat every 30 seconds
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