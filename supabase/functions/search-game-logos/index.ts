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

    // Fallback to mock images if Google API is not configured
    if (!apiKey || !searchEngineId) {
      console.log('Google API not configured, using fallback images')
      const fallbackImages = [
        `https://dummyimage.com/200x200/333333/ffffff&text=${encodeURIComponent(gameName)}+1`,
        `https://dummyimage.com/200x200/555555/ffffff&text=${encodeURIComponent(gameName)}+2`,
        `https://dummyimage.com/200x200/777777/ffffff&text=${encodeURIComponent(gameName)}+3`,
        `https://dummyimage.com/200x200/999999/ffffff&text=${encodeURIComponent(gameName)}+4`
      ]
      
      return new Response(
        JSON.stringify({ images: fallbackImages.slice(0, numResults) }),
        { 
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