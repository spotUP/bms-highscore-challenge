#!/usr/bin/env tsx

// Simple proxy server to bypass CORS issues with R2
// This fetches logos from R2 and serves them with proper CORS headers

import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';

config();

const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());

// Proxy endpoint for Clear Logos
app.get('/clear-logos/:filename', async (req, res) => {
  const { filename } = req.params;
  const r2Domain = process.env.VITE_CLOUDFLARE_R2_DOMAIN;

  if (!r2Domain) {
    return res.status(500).json({ error: 'R2 domain not configured' });
  }

  const logoUrl = `https://${r2Domain}/clear-logos/${filename}`;

  try {
    console.log(`🖼️ Proxying logo request: ${filename}`);

    const response = await fetch(logoUrl);

    if (!response.ok) {
      console.log(`❌ Logo not found: ${filename} (${response.status}) - returning placeholder`);
      // Return a small gray placeholder image with "No Logo" text
      const placeholderSvg = `
        <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" fill="#374151"/>
          <text x="32" y="20" text-anchor="middle" fill="#9CA3AF" font-family="Arial" font-size="10">No Logo</text>
          <text x="32" y="35" text-anchor="middle" fill="#6B7280" font-family="Arial" font-size="8">Available</text>
        </svg>
      `;
      const placeholderImage = Buffer.from(placeholderSvg);
      res.set({
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=300', // Cache missing logos for 5 minutes
        'Access-Control-Allow-Origin': '*'
      });
      return res.send(placeholderImage);
    }

    const imageBuffer = await response.arrayBuffer();

    // Set appropriate headers
    res.set({
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    });

    res.send(Buffer.from(imageBuffer));
    console.log(`✅ Served logo: ${filename} (${imageBuffer.byteLength} bytes)`);

  } catch (error) {
    console.error(`❌ Error proxying logo ${filename}:`, error);
    res.status(500).json({ error: 'Failed to fetch logo' });
  }
});

// Proxy endpoint for RAWG images - use middleware to handle all /rawg-images/* routes
app.use('/rawg-images', async (req, res, next) => {
  // Only handle GET requests
  if (req.method !== 'GET') {
    return next();
  }

  const imagePath = req.url.substring(1); // Remove leading slash

  if (!imagePath) {
    return res.status(400).json({ error: 'Image path required' });
  }

  const rawgImageUrl = `https://media.rawg.io/media/${imagePath}`;

  try {
    console.log(`🖼️ Proxying RAWG image: ${imagePath}`);

    const response = await fetch(rawgImageUrl);

    if (!response.ok) {
      console.log(`❌ RAWG image not found: ${imagePath} (${response.status})`);
      return res.status(404).json({ error: 'RAWG image not found' });
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Set appropriate headers
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    });

    res.send(Buffer.from(imageBuffer));
    console.log(`✅ Served RAWG image: ${imagePath} (${imageBuffer.byteLength} bytes)`);

  } catch (error) {
    console.error(`❌ Error proxying RAWG image ${imagePath}:`, error);
    res.status(500).json({ error: 'Failed to fetch RAWG image' });
  }
});

// Proxy endpoint for RAWG API calls
app.use('/rawg-api', async (req, res, next) => {
  // Only handle GET requests
  if (req.method !== 'GET') {
    return next();
  }

  const apiPath = req.url; // Keep the full path including query parameters

  if (!apiPath || apiPath === '/') {
    return res.status(400).json({ error: 'API path required' });
  }

  const rawgApiUrl = `https://api.rawg.io${apiPath}`;

  try {
    console.log(`🔗 Proxying RAWG API: ${apiPath}`);

    const response = await fetch(rawgApiUrl);

    if (!response.ok) {
      console.log(`❌ RAWG API error: ${apiPath} (${response.status})`);
      return res.status(response.status).json({ error: 'RAWG API error' });
    }

    const data = await response.json();

    // Set appropriate headers
    res.set({
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      'Access-Control-Allow-Origin': '*'
    });

    res.json(data);
    console.log(`✅ Served RAWG API: ${apiPath}`);

  } catch (error) {
    console.error(`❌ Error proxying RAWG API ${apiPath}:`, error);
    res.status(500).json({ error: 'Failed to fetch from RAWG API' });
  }
});

// Proxy endpoint for IGDB images - use middleware to handle all /igdb-images/* routes
app.use('/igdb-images', async (req, res, next) => {
  // Only handle GET requests
  if (req.method !== 'GET') {
    return next();
  }

  const imagePath = req.url.substring(1); // Remove leading slash

  if (!imagePath) {
    return res.status(400).json({ error: 'Image path required' });
  }

  const igdbImageUrl = `https://images.igdb.com/${imagePath}`;

  try {
    console.log(`🖼️ Proxying IGDB image: ${imagePath}`);

    const response = await fetch(igdbImageUrl);

    if (!response.ok) {
      console.log(`❌ IGDB image error: ${imagePath} (${response.status})`);
      return res.status(response.status).json({ error: 'IGDB image not found' });
    }

    // Get content type from response
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Set appropriate headers
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      'Access-Control-Allow-Origin': '*'
    });

    // Stream the image data
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
    console.log(`🖼️ Served IGDB image: ${imagePath}`);

  } catch (error) {
    console.error(`❌ Error proxying IGDB image ${imagePath}:`, error);
    res.status(500).json({ error: 'Failed to fetch IGDB image' });
  }
});

// Proxy endpoint for IGDB API calls
app.use('/igdb-api', async (req, res, next) => {
  // Only handle POST requests (IGDB uses POST)
  if (req.method !== 'POST') {
    return next();
  }

  const apiPath = req.url; // Keep the full path

  if (!apiPath || apiPath === '/') {
    return res.status(400).json({ error: 'API path required' });
  }

  // IGDB API uses a different base URL
  const igdbApiUrl = `https://api.igdb.com${apiPath}`;

  try {
    console.log(`🎮 Proxying IGDB API: ${apiPath}`);

    const response = await fetch(igdbApiUrl, {
      method: 'POST',
      headers: {
        'Client-ID': Array.isArray(req.headers['client-id']) ? req.headers['client-id'][0] : req.headers['client-id'] || '',
        'Authorization': Array.isArray(req.headers['authorization']) ? req.headers['authorization'][0] : req.headers['authorization'] || '',
        'Content-Type': 'application/json'
      },
      body: req.body
    });

    if (!response.ok) {
      console.log(`❌ IGDB API error: ${apiPath} (${response.status})`);
      return res.status(response.status).json({ error: 'IGDB API error' });
    }

    const data = await response.json();

    // Set appropriate headers
    res.set({
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      'Access-Control-Allow-Origin': '*'
    });

    res.json(data);
    console.log(`✅ Served IGDB API: ${apiPath}`);

  } catch (error) {
    console.error(`❌ Error proxying IGDB API ${apiPath}:`, error);
    res.status(500).json({ error: 'Failed to fetch from IGDB API' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Clear Logo proxy server running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Clear Logo proxy server running on http://localhost:${PORT}`);
  console.log(`📋 Proxy endpoint: http://localhost:${PORT}/clear-logos/{filename}`);
  console.log(`💡 Use this as base URL in your webapp to bypass CORS`);
});