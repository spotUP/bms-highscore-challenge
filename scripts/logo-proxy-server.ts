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
      console.log(`❌ Logo not found: ${filename} (${response.status})`);
      return res.status(404).json({ error: 'Logo not found' });
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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Clear Logo proxy server running' });
});

app.listen(PORT, () => {
  console.log(`🚀 Clear Logo proxy server running on http://localhost:${PORT}`);
  console.log(`📋 Proxy endpoint: http://localhost:${PORT}/clear-logos/{filename}`);
  console.log(`💡 Use this as base URL in your webapp to bypass CORS`);
});