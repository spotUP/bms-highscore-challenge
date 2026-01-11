// Vercel API route for proxying Clear Logo images from Cloudflare R2
// Path: /api/clear-logos/[filename]

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { filename } = req.query;

  if (!filename || typeof filename !== 'string') {
    return res.status(400).json({ error: 'Filename required' });
  }

  // Try multiple environment variable formats for R2 domain
  const r2Domain = process.env.CLOUDFLARE_R2_DOMAIN ||
                   process.env.VITE_CLOUDFLARE_R2_DOMAIN ||
                   'pub-1a84b69be18749cc982661f2fd3478b2.r2.dev'; // Fallback to correct domain

  console.log(`🔍 Environment check:`);
  console.log(`   - CLOUDFLARE_R2_DOMAIN: ${process.env.CLOUDFLARE_R2_DOMAIN || 'undefined'}`);
  console.log(`   - VITE_CLOUDFLARE_R2_DOMAIN: ${process.env.VITE_CLOUDFLARE_R2_DOMAIN || 'undefined'}`);
  console.log(`   - Using R2 domain: ${r2Domain}`);

  const logoUrl = `https://${r2Domain}/clear-logos/${filename}`;

  try {
    console.log(`🖼️ Proxying logo request: ${filename}`);
    console.log(`🌐 Full URL: ${logoUrl}`);

    const response = await fetch(logoUrl);

    if (!response.ok) {
      console.log(`❌ Logo not found: ${filename} (${response.status} ${response.statusText}) - returning placeholder`);
      // Return a small gray placeholder SVG with "No Logo" text
      const placeholderSvg = `
        <svg width="64" height="64" xmlns="http://www.w3.org/2000/svg">
          <rect width="64" height="64" fill="#374151"/>
          <text x="32" y="20" text-anchor="middle" fill="#9CA3AF" font-family="Arial" font-size="10">No Logo</text>
          <text x="32" y="35" text-anchor="middle" fill="#6B7280" font-family="Arial" font-size="8">Available</text>
        </svg>
      `;
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=300'); // Cache missing logos for 5 minutes
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD');
      return res.send(placeholderSvg);
    }

    const imageBuffer = await response.arrayBuffer();

    // Set appropriate headers for Vercel
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD');

    res.send(Buffer.from(imageBuffer));
    console.log(`✅ Served logo: ${filename} (${imageBuffer.byteLength} bytes)`);

  } catch (error) {
    console.error(`❌ Error proxying logo ${filename}:`, error);
    res.status(500).json({ error: 'Failed to fetch logo' });
  }
}