#!/usr/bin/env tsx

// 🎮 PONG PHYSICS SIMULATOR
// Comprehensive test suite to analyze ball movement, collision detection, and physics behavior

import { CollisionDetector, CollisionManager, Ball, Paddle, CollisionResult } from '../src/utils/CollisionDetection.js';

interface GameState {
  ball: {
    x: number;
    y: number;
    dx: number;
    dy: number;
    size: number;
    isAiming: boolean;
  };
  paddles: {
    left: Paddle;
    right: Paddle;
    top?: Paddle;
    bottom?: Paddle;
  };
  trails: {
    ball: Array<{ x: number; y: number; timestamp: number }>;
    leftPaddle: Array<any>;
    rightPaddle: Array<any>;
    topPaddle: Array<any>;
    bottomPaddle: Array<any>;
  };
  canvasWidth: number;
  canvasHeight: number;
}

class PongPhysicsSimulator {
  private collisionManager: CollisionManager;

  constructor() {
    this.collisionManager = new CollisionManager();
  }

  // 🎯 Create standard game state for testing
  createTestGameState(ballX: number, ballY: number, ballDX: number, ballDY: number): GameState {
    const canvasWidth = 800;
    const canvasHeight = 600;
    const PADDLE_THICKNESS = 20; // Match main game paddle thickness for consistency
    const PADDLE_LENGTH = 140; // Match main game paddle length for consistency
    const BOUNDARY_SPACING = 48;

    return {
      ball: {
        x: ballX,
        y: ballY,
        dx: ballDX,
        dy: ballDY,
        size: 12,
        isAiming: false
      },
      paddles: {
        left: {
          side: 'left',
          x: BOUNDARY_SPACING,
          y: canvasHeight / 2 - PADDLE_LENGTH / 2,
          width: PADDLE_THICKNESS,
          height: PADDLE_LENGTH
        },
        right: {
          side: 'right',
          x: canvasWidth - BOUNDARY_SPACING - PADDLE_THICKNESS,
          y: canvasHeight / 2 - PADDLE_LENGTH / 2,
          width: PADDLE_THICKNESS,
          height: PADDLE_LENGTH
        },
        top: {
          side: 'top',
          x: canvasWidth / 2 - PADDLE_LENGTH / 2,
          y: BOUNDARY_SPACING,
          width: PADDLE_LENGTH,
          height: PADDLE_THICKNESS
        },
        bottom: {
          side: 'bottom',
          x: canvasWidth / 2 - PADDLE_LENGTH / 2,
          y: canvasHeight - BOUNDARY_SPACING - PADDLE_THICKNESS,
          width: PADDLE_LENGTH,
          height: PADDLE_THICKNESS
        }
      },
      trails: {
        ball: [],
        leftPaddle: [],
        rightPaddle: [],
        topPaddle: [],
        bottomPaddle: []
      },
      canvasWidth,
      canvasHeight
    };
  }

  // 🔍 Simulate single frame physics update
  simulateFrame(gameState: GameState): {
    gameState: GameState;
    collisions: CollisionResult[];
    wallCollision: CollisionResult | null;
    issues: string[];
  } {
    const issues: string[] = [];
    const newState = { ...gameState };

    console.log(`\n🎯 FRAME SIMULATION`);
    console.log(`Ball: (${newState.ball.x.toFixed(1)}, ${newState.ball.y.toFixed(1)}) velocity: (${newState.ball.dx.toFixed(2)}, ${newState.ball.dy.toFixed(2)})`);

    // 1. COLLISION DETECTION (before movement)
    const collisions = this.collisionManager.detectAllCollisions(newState, newState.canvasWidth, newState.canvasHeight);

    console.log(`📊 Detected ${collisions.length} collisions`);
    collisions.forEach((collision, i) => {
      console.log(`  ${i + 1}. ${collision.hit ? 'HIT' : 'MISS'} - Side: ${collision.side}, Penetration: ${collision.penetration.toFixed(2)}`);
    });

    // 2. PROCESS COLLISIONS
    let ballCollisionProcessed = false;
    collisions.forEach(collision => {
      if (collision.hit) {
        if ((collision.object2 as any).side) {
          // Ball-paddle collision
          const paddle = collision.object2 as Paddle;
          console.log(`🏓 Ball-Paddle collision with ${paddle.side} paddle`);

          if (!ballCollisionProcessed) {
            // Apply Arkanoid-style physics
            const hitPosition = collision.hitPosition;
            const centerOffset = (hitPosition - 0.5) * 2; // -1 to 1

            if (paddle.side === 'left' || paddle.side === 'right') {
              newState.ball.dx = -newState.ball.dx;
              newState.ball.dy += centerOffset * 3; // Angle influence
            } else {
              newState.ball.dy = -newState.ball.dy;
              newState.ball.dx += centerOffset * 3; // Angle influence
            }

            // Speed boost
            const speedBoost = 1.02;
            newState.ball.dx *= speedBoost;
            newState.ball.dy *= speedBoost;

            ballCollisionProcessed = true;
            console.log(`  ⚡ New velocity: (${newState.ball.dx.toFixed(2)}, ${newState.ball.dy.toFixed(2)})`);
          }
        }
      }
    });

    // 3. BALL MOVEMENT (after collision processing)
    if (!newState.ball.isAiming) {
      const prevX = newState.ball.x;
      const prevY = newState.ball.y;

      newState.ball.x += newState.ball.dx;
      newState.ball.y += newState.ball.dy;

      console.log(`🚀 Ball moved from (${prevX.toFixed(1)}, ${prevY.toFixed(1)}) to (${newState.ball.x.toFixed(1)}, ${newState.ball.y.toFixed(1)})`);
    }

    // 4. CHECK FOR WALL COLLISIONS (scoring boundaries)
    const ballBounds = {
      left: newState.ball.x,
      right: newState.ball.x + newState.ball.size,
      top: newState.ball.y,
      bottom: newState.ball.y + newState.ball.size
    };

    let wallCollision: CollisionResult | null = null;

    // Check if ball is outside play area (scoring condition)
    if (ballBounds.right < -newState.ball.size) {
      wallCollision = { hit: true, side: 'left' } as CollisionResult;
      console.log(`🥅 SCORE: Ball exited left side at x=${newState.ball.x.toFixed(1)}`);
    } else if (ballBounds.left > newState.canvasWidth + newState.ball.size) {
      wallCollision = { hit: true, side: 'right' } as CollisionResult;
      console.log(`🥅 SCORE: Ball exited right side at x=${newState.ball.x.toFixed(1)}`);
    } else if (ballBounds.bottom < -newState.ball.size) {
      wallCollision = { hit: true, side: 'top' } as CollisionResult;
      console.log(`🥅 SCORE: Ball exited top side at y=${newState.ball.y.toFixed(1)}`);
    } else if (ballBounds.top > newState.canvasHeight + newState.ball.size) {
      wallCollision = { hit: true, side: 'bottom' } as CollisionResult;
      console.log(`🥅 SCORE: Ball exited bottom side at y=${newState.ball.y.toFixed(1)}`);
    }

    // 5. CHECK FOR STUCK CONDITIONS
    const boundaries = {
      left: 48,
      right: newState.canvasWidth - 48,
      top: 48,
      bottom: newState.canvasHeight - 48
    };

    if (newState.ball.x < boundaries.left && Math.abs(newState.ball.dx) < 0.1) {
      issues.push(`⚠️  Ball stuck near left boundary at x=${newState.ball.x.toFixed(1)}`);
    }
    if (newState.ball.x > boundaries.right && Math.abs(newState.ball.dx) < 0.1) {
      issues.push(`⚠️  Ball stuck near right boundary at x=${newState.ball.x.toFixed(1)}`);
    }
    if (newState.ball.y < boundaries.top && Math.abs(newState.ball.dy) < 0.1) {
      issues.push(`⚠️  Ball stuck near top boundary at y=${newState.ball.y.toFixed(1)}`);
    }
    if (newState.ball.y > boundaries.bottom && Math.abs(newState.ball.dy) < 0.1) {
      issues.push(`⚠️  Ball stuck near bottom boundary at y=${newState.ball.y.toFixed(1)}`);
    }

    // 6. ADD BALL TRAIL
    newState.trails.ball.push({
      x: newState.ball.x,
      y: newState.ball.y,
      timestamp: Date.now()
    });

    return { gameState: newState, collisions, wallCollision, issues };
  }

  // 🎮 Run comprehensive test scenarios
  runTestScenarios() {
    console.log('🚀 STARTING PONG PHYSICS SIMULATION TESTS\n');

    // Test 1: Ball heading towards right paddle
    console.log('📋 TEST 1: Ball approaching right paddle');
    this.runScenario('Right Paddle Approach', 700, 300, 3, 0, 50);

    // Test 2: Ball heading towards left paddle
    console.log('\n📋 TEST 2: Ball approaching left paddle');
    this.runScenario('Left Paddle Approach', 100, 300, -3, 0, 50);

    // Test 3: Ball heading towards top paddle
    console.log('\n📋 TEST 3: Ball approaching top paddle');
    this.runScenario('Top Paddle Approach', 400, 100, 0, -3, 50);

    // Test 4: Ball heading towards bottom paddle
    console.log('\n📋 TEST 4: Ball approaching bottom paddle');
    this.runScenario('Bottom Paddle Approach', 400, 500, 0, 3, 50);

    // Test 5: Ball near right wall (stuck condition)
    console.log('\n📋 TEST 5: Ball near right wall');
    this.runScenario('Right Wall Stuck Test', 780, 300, 0.5, 0, 20);

    // Test 6: Ball bouncing off invisible walls
    console.log('\n📋 TEST 6: Ball bouncing off invisible boundaries');
    this.runScenario('Invisible Wall Bounce', 750, 100, 2, -1, 30);

    // Test 7: Ball trail generation test
    console.log('\n📋 TEST 7: Ball trail generation');
    this.runScenario('Trail Generation Test', 400, 300, 4, 2, 10);

    // 🚨 CRITICAL BUG HUNTING TESTS
    console.log('\n\n🔥 CRITICAL BUG HUNTING TESTS:');

    // Test 8: Ball hitting wall without paddle nearby
    console.log('\n📋 TEST 8: Ball hitting wall without paddle (BUG TEST)');
    this.runScenario('Ball Hitting Wall Without Paddle', 790, 300, 5, 0, 15);

    // Test 9: Ball in corner areas
    console.log('\n📋 TEST 9: Ball in corner collision zones');
    this.runScenario('Corner Area Collision', 760, 50, 2, -1, 20);

    // Test 10: Fast ball missing paddle
    console.log('\n📋 TEST 10: High-speed ball bypassing paddle');
    this.runScenario('High Speed Ball Bypass', 750, 300, 10, 0, 10);

    // Test 11: Ball near boundary with minimal velocity
    console.log('\n📋 TEST 11: Ball near boundary edge cases');
    this.runScenario('Boundary Edge Case', 768, 300, 1, 0.1, 15);
  }

  private runScenario(name: string, startX: number, startY: number, dx: number, dy: number, frames: number) {
    console.log(`\n🎯 SCENARIO: ${name}`);
    console.log(`Starting position: (${startX}, ${startY}), velocity: (${dx}, ${dy})`);
    console.log(`Simulating ${frames} frames...\n`);

    let gameState = this.createTestGameState(startX, startY, dx, dy);
    let allIssues: string[] = [];
    let collisionCount = 0;
    let wallCollisionCount = 0;

    for (let frame = 0; frame < frames; frame++) {
      console.log(`--- FRAME ${frame + 1} ---`);

      const result = this.simulateFrame(gameState);
      gameState = result.gameState;

      if (result.collisions.some(c => c.hit)) collisionCount++;
      if (result.wallCollision?.hit) wallCollisionCount++;

      if (result.issues.length > 0) {
        allIssues.push(...result.issues);
        result.issues.forEach(issue => console.log(issue));
      }

      // Stop if ball goes off screen
      if (result.wallCollision?.hit) {
        console.log(`🛑 Ball exited play area - stopping simulation`);
        break;
      }
    }

    console.log(`\n📊 SCENARIO SUMMARY:`);
    console.log(`  Total collisions detected: ${collisionCount}`);
    console.log(`  Wall collisions: ${wallCollisionCount}`);
    console.log(`  Issues found: ${allIssues.length}`);
    console.log(`  Final ball position: (${gameState.ball.x.toFixed(1)}, ${gameState.ball.y.toFixed(1)})`);
    console.log(`  Final ball velocity: (${gameState.ball.dx.toFixed(2)}, ${gameState.ball.dy.toFixed(2)})`);
    console.log(`  Ball trail points: ${gameState.trails.ball.length}`);

    if (allIssues.length > 0) {
      console.log(`\n⚠️  ISSUES DETECTED:`);
      allIssues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
    }
  }
}

// 🏃‍♂️ Run the simulation
const simulator = new PongPhysicsSimulator();
simulator.runTestScenarios();

console.log('\n✅ PHYSICS SIMULATION COMPLETE');