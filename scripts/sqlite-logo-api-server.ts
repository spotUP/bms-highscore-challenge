#!/usr/bin/env npx tsx

import express from 'express';
import sqlite3 from 'sqlite3';
import cors from 'cors';

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());

// Initialize SQLite database connection
const db = new sqlite3.Database('production-turbo-logos.db', (err) => {
  if (err) {
    console.error('Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to SQLite logo database');
});

// Get logo by game ID
app.get('/api/logo/:gameId', (req, res) => {
  const gameId = parseInt(req.params.gameId);

  if (isNaN(gameId)) {
    return res.status(400).json({ error: 'Invalid game ID' });
  }

  db.get(
    'SELECT logo_base64 FROM games WHERE id = ? AND logo_base64 IS NOT NULL AND logo_base64 != ""',
    [gameId],
    (err, row: any) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Logo not found' });
      }

      res.json({ logo: row.logo_base64 });
    }
  );
});

// Get multiple logos by game IDs
app.post('/api/logos/batch', express.json(), (req, res) => {
  const { gameIds } = req.body;

  if (!Array.isArray(gameIds) || gameIds.length === 0) {
    return res.status(400).json({ error: 'Invalid game IDs array' });
  }

  const placeholders = gameIds.map(() => '?').join(',');
  const query = `SELECT id, logo_base64 FROM games WHERE id IN (${placeholders}) AND logo_base64 IS NOT NULL AND logo_base64 != ""`;

  db.all(query, gameIds, (err, rows: any[]) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    const logos = rows.reduce((acc, row) => {
      acc[row.id] = row.logo_base64;
      return acc;
    }, {});

    res.json({ logos });
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  db.get('SELECT COUNT(*) as total, COUNT(logo_base64) as withLogos FROM games', (err, row: any) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({
      status: 'healthy',
      totalGames: row.total,
      gamesWithLogos: row.withLogos,
      percentage: ((row.withLogos / row.total) * 100).toFixed(1) + '%'
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SQLite Logo API server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🖼️  Logo endpoint: http://localhost:${PORT}/api/logo/:gameId`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down SQLite Logo API server...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('✅ Database connection closed');
    }
    process.exit(0);
  });
});