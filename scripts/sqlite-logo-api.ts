#!/usr/bin/env tsx

import sqlite3 from 'sqlite3';
import { createServer } from 'http';
import { URL } from 'url';

const DB_FILE = 'production-turbo-logos.db';
const PORT = 3001;

// Initialize SQLite database connection
let db: sqlite3.Database;

function initializeDatabase(): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(DB_FILE, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        reject(err);
        return;
      }
      console.log('✅ Connected to SQLite logo database');
      resolve(db);
    });
  });
}

function getLogoById(gameId: number): Promise<{ logo_base64: string; name: string; platform_name: string } | null> {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT logo_base64, name, platform_name FROM games WHERE id = ? AND logo_base64 IS NOT NULL',
      [gameId],
      (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row || null);
      }
    );
  });
}

function getLogosCount(): Promise<{ total: number; with_logos: number }> {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT COUNT(*) as total, COUNT(logo_base64) as with_logos FROM games',
      (err, row: any) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      }
    );
  });
}

function getRecentLogos(limit: number = 10): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT id, name, platform_name, processed_at FROM games WHERE logo_base64 IS NOT NULL ORDER BY processed_at DESC LIMIT ?',
      [limit],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      }
    );
  });
}

async function handleRequest(req: any, res: any) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    if (path === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', database: 'connected' }));
      return;
    }

    if (path === '/stats') {
      const stats = await getLogosCount();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(stats));
      return;
    }

    if (path === '/recent') {
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const recent = await getRecentLogos(limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(recent));
      return;
    }

    if (path.startsWith('/logo/')) {
      const gameId = parseInt(path.split('/')[2]);
      if (isNaN(gameId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid game ID' }));
        return;
      }

      const logo = await getLogoById(gameId);
      if (!logo) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Logo not found' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        gameId,
        name: logo.name,
        platform: logo.platform_name,
        logo: logo.logo_base64
      }));
      return;
    }

    // Default 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));

  } catch (error) {
    console.error('API Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
}

async function startServer() {
  try {
    await initializeDatabase();

    const server = createServer(handleRequest);

    server.listen(PORT, () => {
      console.log(`🚀 SQLite Logo API server running on port ${PORT}`);
      console.log('📍 Available endpoints:');
      console.log(`   http://localhost:${PORT}/health - Health check`);
      console.log(`   http://localhost:${PORT}/stats - Logo statistics`);
      console.log(`   http://localhost:${PORT}/recent - Recent logos`);
      console.log(`   http://localhost:${PORT}/logo/{gameId} - Get logo by game ID`);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('🛑 Shutting down server...');
      server.close(() => {
        db.close(() => {
          console.log('✅ Database connection closed');
          process.exit(0);
        });
      });
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer().catch(console.error);