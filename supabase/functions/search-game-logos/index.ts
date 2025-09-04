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

    // Mock image URLs for demonstration - using reliable image sources
    const mockImages = [
      `https://dummyimage.com/200x200/333333/ffffff&text=${encodeURIComponent(gameName)}+1`,
      `https://dummyimage.com/200x200/555555/ffffff&text=${encodeURIComponent(gameName)}+2`,
      `https://dummyimage.com/200x200/777777/ffffff&text=${encodeURIComponent(gameName)}+3`,
      `https://dummyimage.com/200x200/999999/ffffff&text=${encodeURIComponent(gameName)}+4`
    ];

    // For a real implementation, you would:
    // 1. Use a search API key from Deno.env.get('SEARCH_API_KEY')
    // 2. Make requests to Google Custom Search API, Bing Image Search API, etc.
    // 3. Filter results for clear logos and appropriate images
    // 4. Return actual image URLs

    const images = mockImages.slice(0, numResults);

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