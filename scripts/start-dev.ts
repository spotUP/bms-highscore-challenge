#!/usr/bin/env node

import { spawn } from 'child_process';
import { execSync } from 'child_process';

/**
 * Clean Dev Server Starter - Kills existing processes and starts fresh
 * Handles WebSocket server, Vite dev server, and TypeScript compilation
 */

console.log('🚀 Starting clean development environment...');

// Kill existing processes on common ports
console.log('🔪 Killing processes on port 8080 (Vite)...');
try {
  const lsof = execSync('lsof -ti:8080', { encoding: 'utf8' });
  const pids = lsof.trim().split('\n').filter(pid => pid.trim());
  if (pids.length > 0) {
    console.log(`Killing ${pids.length} processes on port 8080: ${pids.join(', ')}`);
    pids.forEach(pid => require('child_process').execSync(`kill -9 ${pid.trim()}`, { stdio: 'ignore' });
  } else {
    console.log('No processes found on port 8080');
  }
} catch (error) {
  console.log('No processes to kill on port 8080');
}

// Kill existing WebSocket server processes
console.log('🔪 Killing existing WebSocket server processes...');
try {
  const psOutput = execSync('ps aux | grep "pong-websocket-server.ts"', { encoding: 'utf8' });
  const lines = psOutput.trim().split('\n');
  const pids = lines
    .map(line => {
      const match = line.match(/\\s*(\\d+)/);
      return match ? match[1] : null;
    })
    .filter(pid => pid && !line.includes('grep'));
    
  if (pids.length > 0) {
    console.log(`Killing ${pids.length} WebSocket processes: ${pids.join(', ')}`);
    pids.forEach(pid => {
      try {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
      } catch (error) {
        console.log(`Failed to kill process ${pid}, it may have already terminated`);
      }
    });
  } else {
    console.log('No WebSocket server processes found');
  }
} catch (error) {
  console.log('No WebSocket processes to kill');
}

// Wait a moment for processes to fully terminate
console.log('⏳ Waiting 2 seconds for processes to terminate...');
await new Promise(resolve => setTimeout(resolve, 2000));

// Start TypeScript compilation check
console.log('📝 Running predev checks...');
try {
  execSync('tsx scripts/check-env.ts', { stdio: 'inherit' });
  console.log('✅ Environment check passed');
} catch (error) {
  console.error('❌ Environment check failed:', error.message);
  process.exit(1);
}

// Start WebSocket server in background
console.log('🌐 Starting WebSocket server...');
const wsProcess = spawn('tsx', ['scripts/pong-websocket-server.ts'], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' }
});

wsProcess.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error('❌ Port 8080 is still in use after cleanup');
    process.exit(1);
  } else {
    console.error('❌ WebSocket server error:', error.message);
    process.exit(1);
  }
});

wsProcess.on('spawn', () => {
  console.log('✅ WebSocket server started successfully');
});

// Wait for WebSocket to be ready
console.log('⏳ Waiting 3 seconds for WebSocket server to initialize...');
await new Promise(resolve => setTimeout(resolve, 3000));

// Start Vite dev server
console.log('⚡ Starting Vite development server...');
const viteProcess = spawn('vite', {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' }
});

viteProcess.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error('❌ Port 8080 is still in use - Vite cannot start');
    process.exit(1);
  } else {
    console.error('❌ Vite server error:', error.message);
    process.exit(1);
  }
});

console.log('\n🎮 Development server is running!');
console.log('📱 WebSocket server: running');
console.log('🌐 Vite server: http://localhost:8080');
console.log('\n📝 To stop: Ctrl+C');
console.log('🔍 Access PongSlangDemo at: http://localhost:8080/pages/PongSlangDemo.tsx');
console.log('\n💡 Pro tip: Check browser console (F12) for shader compilation logs');

// Graceful shutdown handler
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down development server...');
  viteProcess.kill('SIGTERM');
  wsProcess.kill('SIGTERM');
  process.exit(0);
});

// Handle process exit
viteProcess.on('exit', (code) => {
  console.log(`\n🚀 Vite server exited with code ${code}`);
  process.exit(code || 0);
});
