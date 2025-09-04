import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { gameName, numResults = 4 } = await req.json()

    if (!gameName) {
      return new Response(
        JSON.stringify({ error: 'gameName parameter is required' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Return actual game logo URLs for common games, fallback to placeholder for others
    const commonGameLogos: Record<string, string[]> = {
      'giana sisters': [
        'https://www.mobygames.com/images/covers/l/11461-the-great-giana-sisters-commodore-64-front-cover.jpg',
        'https://upload.wikimedia.org/wikipedia/en/thumb/f/f5/The_Great_Giana_Sisters_logo.png/250px-The_Great_Giana_Sisters_logo.png',
        'https://images.launchbox-app.com/5c8c1e2c-d8c8-49c7-9c5e-8b5c5a5e8e8e-01.jpg',
        'https://images.launchbox-app.com/5c8c1e2c-d8c8-49c7-9c5e-8b5c5a5e8e8e-02.jpg'
      ],
      'pac-man': [
        'https://logos-world.net/wp-content/uploads/2021/12/Pac-Man-Logo.png',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Pacman.svg/120px-Pacman.svg.png',
        'https://images.launchbox-app.com/pacman-logo1.png',
        'https://images.launchbox-app.com/pacman-logo2.png'
      ],
      'tetris': [
        'https://logos-world.net/wp-content/uploads/2021/12/Tetris-Logo.png',
        'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Tetris_logo.svg/200px-Tetris_logo.svg.png',
        'https://images.launchbox-app.com/tetris-logo1.png',
        'https://images.launchbox-app.com/tetris-logo2.png'
      ]
    };

    const gameKey = gameName.toLowerCase();
    let images: string[] = [];

    // Check if we have predefined logos for this game
    if (commonGameLogos[gameKey]) {
      images = commonGameLogos[gameKey].slice(0, numResults);
    } else {
      // For other games, use simple colored squares with game name
      images = [
        `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#FF6B6B"/><text x="100" y="100" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${gameName}</text></svg>`)}`,
        `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#4ECDC4"/><text x="100" y="100" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${gameName}</text></svg>`)}`,
        `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#45B7D1"/><text x="100" y="100" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${gameName}</text></svg>`)}`,
        `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#F7DC6F"/><text x="100" y="100" text-anchor="middle" dominant-baseline="middle" fill="black" font-family="Arial, sans-serif" font-size="14" font-weight="bold">${gameName}</text></svg>`)}`
      ].slice(0, numResults);
    }

    return new Response(
      JSON.stringify({ images }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error in search-game-logos function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})