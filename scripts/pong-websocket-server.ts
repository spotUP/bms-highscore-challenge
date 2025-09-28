import { WebSocketServer } from 'ws';
import { createServer } from 'http';

// Force redeploy - 2025-09-26T16:47:00Z - Root directory already empty, forcing webhook

// Types for game entities
interface Pickup {
  id: string;
  x: number;
  y: number;
  type: 'speed_up' | 'speed_down' | 'big_ball' | 'small_ball' | 'drunk_ball' | 'grow_paddle' | 'shrink_paddle' | 'reverse_controls' | 'invisible_ball' | 'multi_ball' | 'freeze_opponent' | 'super_speed' | 'coin_shower' | 'teleport_ball' | 'gravity_in_space' | 'super_striker' | 'sticky_paddles' | 'machine_gun' | 'dynamic_playfield' | 'switch_sides' | 'blocker' | 'time_warp' | 'portal_ball' | 'mirror_mode' | 'quantum_ball' | 'black_hole' | 'lightning_storm' | 'invisible_paddles' | 'ball_trail_mine' | 'paddle_swap' | 'disco_mode' | 'pac_man' | 'banana_peel' | 'rubber_ball' | 'drunk_paddles' | 'magnet_ball' | 'balloon_ball' | 'earthquake' | 'confetti_cannon' | 'hypno_ball' | 'conga_line' | 'arkanoid';
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
  type: 'speed_up' | 'speed_down' | 'big_ball' | 'small_ball' | 'drunk_ball' | 'grow_paddle' | 'shrink_paddle' | 'reverse_controls' | 'invisible_ball' | 'multi_ball' | 'freeze_opponent' | 'super_speed' | 'coin_shower' | 'teleport_ball' | 'gravity_in_space' | 'super_striker' | 'sticky_paddles' | 'machine_gun' | 'dynamic_playfield' | 'switch_sides' | 'blocker' | 'time_warp' | 'portal_ball' | 'mirror_mode' | 'quantum_ball' | 'black_hole' | 'lightning_storm' | 'invisible_paddles' | 'ball_trail_mine' | 'paddle_swap' | 'disco_mode' | 'pac_man' | 'banana_peel' | 'rubber_ball' | 'drunk_paddles' | 'magnet_ball' | 'balloon_ball' | 'earthquake' | 'confetti_cannon' | 'hypno_ball' | 'conga_line' | 'arkanoid';
  startTime: number;
  duration: number;
  originalValue?: any;
  side?: string;
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
    hasTrailMines: boolean;
    trailMines: any[];
    isSlippery: boolean;
    bounciness: number;
    isMagnetic: boolean;
    isFloating: boolean;
    isHypnotic: boolean;
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
  drunkStartTime: number;
  earthquakeActive: boolean;
  earthquakeStartTime: number;
  confetti: any[];
  hypnoStartTime: number;
  congaBalls: any[];
  extraBalls: any[];
  // Arkanoid mode properties
  arkanoidBricks: any[];
  arkanoidActive: boolean;
  arkanoidMode: boolean;
  arkanoidBricksHit: number;
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
      console.log('[▶] New WebSocket connection at', new Date().toISOString());
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

    console.log(`[✓] Player ${playerId} joined as ${playerSide} (${room.players.size} total players)`);
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

    console.log(`[↻] Room ${roomId} reset by gamemaster ${playerId}`);
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
        previousTouchedBy: null,
        hasGravity: false,
        isAiming: false,
        aimStartTime: 0,
        aimX: 0,
        aimY: 0,
        aimTargetX: 0,
        aimTargetY: 0,
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
        isHypnotic: false
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
      arkanoidBricksHit: 0
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

      // Clean up inactive rooms
      this.rooms.forEach((room, roomId) => {
        if (now - room.lastUpdate > timeout && room.players.size === 0) {
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
    console.log(`[⌂] Persistent main room created`);
  }

  private startGameLoop() {
    // Server-side game loop running at 60 FPS for smooth physics
    const GAME_LOOP_FPS = 60;
    const GAME_LOOP_INTERVAL = 1000 / GAME_LOOP_FPS;

    setInterval(() => {
      this.updateGameLogic();
    }, GAME_LOOP_INTERVAL);

    console.log(`[↻] Server game loop started at ${GAME_LOOP_FPS} FPS`);
  }

  private updateGameLogic() {
    const now = Date.now();

    this.rooms.forEach((room, roomId) => {
      // Only update active game rooms with players
      if (!room.isActive || room.players.size === 0) return;

      const gameState = room.gameState;
      const canvasSize = room.canvasSize;

      // Check if pause timer has expired
      if (gameState.isPaused && gameState.pauseEndTime > 0 && Date.now() >= gameState.pauseEndTime) {
        gameState.isPaused = false;
        gameState.pauseEndTime = 0;
        console.log('⏰ Pause timer expired, resuming game');
      }

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

    // Apply gravity effects
    if (gameState.ball.hasGravity) {
      const gravity = 0.3; // Gravity acceleration
      gameState.ball.dy += gravity; // Apply downward gravity
      ballChanged = true;
    }

    // Handle Super Striker aiming mode
    if (gameState.ball.isAiming) {
      const now = Date.now();
      const aimElapsed = now - gameState.ball.aimStartTime;
      if (aimElapsed >= 4000) { // 4 seconds aiming time
        // Time's up, launch the ball
        const aimDx = gameState.ball.aimTargetX - gameState.ball.x;
        const aimDy = gameState.ball.aimTargetY - gameState.ball.y;
        const aimDistance = Math.sqrt(aimDx * aimDx + aimDy * aimDy);
        if (aimDistance > 0) {
          const speed = 10; // Server ball speed
          gameState.ball.dx = (aimDx / aimDistance) * speed;
          gameState.ball.dy = (aimDy / aimDistance) * speed;
        } else {
          // Default direction if no aim target
          gameState.ball.dx = 10;
          gameState.ball.dy = 0;
        }
        gameState.ball.isAiming = false;
        ballChanged = true;
      }
    }

    // Update ball position (only if not aiming)
    if (!gameState.ball.isAiming) {
      gameState.ball.x += gameState.ball.dx;
      gameState.ball.y += gameState.ball.dy;
      ballChanged = true;
    }

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

    // Arkanoid brick collision detection
    if (gameState.arkanoidActive && gameState.arkanoidBricks && gameState.arkanoidBricks.length > 0) {
      for (let i = gameState.arkanoidBricks.length - 1; i >= 0; i--) {
        const brick = gameState.arkanoidBricks[i];

        // Check collision with brick
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
    } else {
      // Pause for goal celebration (2 seconds)
      gameState.isPaused = true;
      gameState.pauseEndTime = Date.now() + 2000;
      console.log(`⏸️ Pausing for goal celebration, resuming in 2 seconds`);
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
    gameState.ball.hasGravity = false;
    gameState.ball.isAiming = false;
    gameState.ball.aimStartTime = 0;
    gameState.ball.aimX = 0;
    gameState.ball.aimY = 0;
    gameState.ball.aimTargetX = 0;
    gameState.ball.aimTargetY = 0;
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
        effect.duration = 4000;
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
        // This will be handled in the input logic on client side
        break;
      case 'invisible_ball':
        // Visual effect handled on client side
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
      case 'sticky_paddles':
        // Ball will stick to paddles for 3 seconds before shooting
        gameState.stickyPaddlesActive = true;
        effect.duration = 15000; // Effect lasts 15 seconds
        break;
      case 'machine_gun':
        // Rapidly fire balls for 3 seconds
        gameState.machineGunActive = true;
        gameState.machineGunStartTime = Date.now();
        gameState.machineGunShooter = gameState.ball.lastTouchedBy;
        effect.duration = 3000; // 3 seconds of machine gun
        break;
      case 'dynamic_playfield':
        // Grow and shrink playfield with easing for 15 seconds
        gameState.playfieldScaleStart = gameState.playfieldScale;
        gameState.playfieldScaleTarget = 0.7 + Math.random() * 0.6; // Scale between 0.7-1.3
        gameState.playfieldScaleTime = Date.now();
        effect.duration = 15000; // 15 seconds
        break;
      case 'switch_sides':
        // All players switch sides and keep their scores
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
        effect.duration = 4000; // 4 seconds to aim
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
        // Add extra balls to the game
        for (let i = 0; i < 2; i++) {
          gameState.extraBalls.push({
            x: gameState.ball.x + (i * 10),
            y: gameState.ball.y + (i * 10),
            dx: gameState.ball.dx * (0.8 + i * 0.2),
            dy: gameState.ball.dy * (0.8 + i * 0.2),
            size: gameState.ball.size,
            id: `extra_${Date.now()}_${i}`
          });
        }
        effect.duration = 15000; // 15 seconds
        break;
      case 'teleport_ball':
        // Teleport ball to random location
        gameState.ball.x = 200 + Math.random() * 400;
        gameState.ball.y = 150 + Math.random() * 300;
        gameState.ball.isTeleporting = true;
        gameState.ball.lastTeleportTime = Date.now();
        effect.duration = 2000; // Visual effect for 2 seconds
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
      case 'invisible_paddles':
        // Make paddles partially invisible
        gameState.paddleVisibility = { left: 0.2, right: 0.2, top: 0.2, bottom: 0.2 };
        effect.duration = 8000; // 8 seconds
        break;
      case 'drunk_paddles':
        // Make paddles move erratically
        gameState.paddlesDrunk = true;
        gameState.drunkStartTime = Date.now();
        effect.duration = 10000; // 10 seconds
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
        // Create coins for collection
        gameState.coins = [];
        for (let i = 0; i < 10; i++) {
          gameState.coins.push({
            id: `coin_${Date.now()}_${i}`,
            x: Math.random() * 600 + 100,
            y: Math.random() * 400 + 100,
            createdAt: Date.now(),
            size: 12
          });
        }
        effect.duration = 15000; // 15 seconds
        break;
      case 'blocker':
        // Create walls/blockers
        gameState.walls = [];
        for (let i = 0; i < 3; i++) {
          gameState.walls.push({
            x: Math.random() * 600 + 100,
            y: Math.random() * 400 + 100,
            width: 20,
            height: 60,
            id: `wall_${i}`
          });
        }
        effect.duration = 20000; // 20 seconds
        break;
      case 'portal_ball':
        // Create portals for ball teleportation
        gameState.ball.hasPortal = true;
        gameState.ball.portalX = Math.random() * 600 + 100;
        gameState.ball.portalY = Math.random() * 400 + 100;
        effect.duration = 15000; // 15 seconds
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
      case 'shrink_paddle':
        if (effect.side && effect.originalValue !== undefined) {
          gameState.paddles[effect.side as keyof typeof gameState.paddles].height = effect.originalValue;
        }
        break;

      case 'gravity_in_space':
        gameState.ball.hasGravity = false;
        break;

      case 'super_striker':
        gameState.ball.isAiming = false;
        // If still aiming when time expires, launch ball in default direction
        if (gameState.ball.isAiming) {
          gameState.ball.dx = 10;
          gameState.ball.dy = 0;
        }
        break;

      case 'sticky_paddles':
        gameState.stickyPaddlesActive = false;
        break;

      case 'machine_gun':
        gameState.machineGunActive = false;
        gameState.machineGunBalls = [];
        break;

      case 'dynamic_playfield':
        gameState.playfieldScale = 1.0;
        gameState.playfieldScaleTarget = 1.0;
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
        gameState.extraBalls = [];
        break;

      case 'teleport_ball':
        gameState.ball.isTeleporting = false;
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
    this.server.listen(this.port, '0.0.0.0', () => {
      console.log(`[▲] Pong WebSocket server running on http://0.0.0.0:${this.port}`);
      console.log(`[▶] Ready for Pong multiplayer connections!`);
      console.log(`[#] Server Instance ID: ${this.instanceId}`);
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
            console.error(`[X] Error sending heartbeat to player ${player.id}:`, error);
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