import { WebSocketServer } from 'ws';
import { createServer } from 'http';

// Force redeploy - 2025-09-26T16:47:00Z - Root directory already empty, forcing webhook

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
      perMessageDeflate: false,
      maxPayload: 1024 * 1024 // 1MB
    });
    this.setupWebSocketHandlers();
    this.createPersistentMainRoom();
    this.startCleanupInterval();
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
    const { type, playerId, roomId, data } = message;

    switch (type) {
      case 'join_room':
        this.handleJoinRoom(ws, playerId, roomId, data?.forceSpectator);
        break;
      case 'update_paddle':
        this.handlePaddleUpdate(playerId, data);
        break;
      case 'update_game_state':
        this.handleGameStateUpdate(playerId, roomId, data);
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
        console.log('❓ Unknown message type:', type);
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

      if (!leftPlayer) {
        playerSide = 'left';
        if (!room.gamemaster) room.gamemaster = playerId;
      } else if (!rightPlayer) {
        playerSide = 'right';
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
      isActive: true
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