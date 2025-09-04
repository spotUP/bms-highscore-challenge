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

    const apiKey = Deno.env.get('GOOGLE_CUSTOM_SEARCH_API_KEY')
    const searchEngineId = Deno.env.get('GOOGLE_CUSTOM_SEARCH_ENGINE_ID')

    if (!apiKey || !searchEngineId) {
      console.error('Missing Google Custom Search credentials')
      return new Response(
        JSON.stringify({ error: 'Search service not configured' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Search for game logos using Google Custom Search API
    const searchQuery = `${gameName} game logo clear transparent`
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(searchQuery)}&searchType=image&num=${numResults}&imgType=clipart&imgColorType=trans&safe=active`

    console.log('Searching for:', searchQuery)

    const response = await fetch(searchUrl)
    
    if (!response.ok) {
      console.error('Google Search API error:', response.status, await response.text())
      throw new Error(`Google Search API error: ${response.status}`)
    }

    const data = await response.json()
    
    const images = data.items?.map((item: any) => item.link) || []
    
    console.log(`Found ${images.length} images for "${gameName}"`)

    return new Response(
      JSON.stringify({ images }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error in search-game-logos function:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to search for images', details: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})