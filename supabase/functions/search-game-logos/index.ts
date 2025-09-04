import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log('search-game-logos function called', req.method)
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Parsing request body...')
    const { gameName, numResults = 4 } = await req.json()
    console.log('Received request for game:', gameName, 'numResults:', numResults)

    if (!gameName) {
      console.log('No game name provided')
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

    console.log('API Key present:', !!apiKey)
    console.log('Search Engine ID present:', !!searchEngineId)

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
    const searchUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${searchEngineId}&q=${encodeURIComponent(searchQuery)}&searchType=image&num=${numResults}&safe=active`

    console.log('Searching for:', searchQuery)
    console.log('Search URL (without key):', searchUrl.replace(apiKey, '[REDACTED]'))
    console.log('Using API Key:', apiKey ? `${apiKey.substring(0, 10)}...` : 'NOT SET')
    console.log('Using Search Engine ID:', searchEngineId)

    const response = await fetch(searchUrl)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google Search API error:', response.status, errorText)
      
      // Return fallback images on API error
      const fallbackImages = [
        `https://dummyimage.com/200x200/ff9999/ffffff&text=${encodeURIComponent(gameName)}+API+Error`,
        `https://dummyimage.com/200x200/99ff99/ffffff&text=${encodeURIComponent(gameName)}+Check+Keys`,
        `https://dummyimage.com/200x200/9999ff/ffffff&text=${encodeURIComponent(gameName)}+Fallback`,
        `https://dummyimage.com/200x200/ffff99/ffffff&text=${encodeURIComponent(gameName)}+Mode`
      ]
      
      return new Response(
        JSON.stringify({ images: fallbackImages.slice(0, numResults) }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const data = await response.json()
    console.log('Google API response received, items count:', data.items?.length || 0)
    
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
    console.error('Error details:', error.message, error.stack)
    
    // Return fallback images even on error
    const fallbackImages = [
      'https://dummyimage.com/200x200/ff0000/ffffff&text=Error+1',
      'https://dummyimage.com/200x200/ff0000/ffffff&text=Error+2',
      'https://dummyimage.com/200x200/ff0000/ffffff&text=Error+3',
      'https://dummyimage.com/200x200/ff0000/ffffff&text=Error+4'
    ]
    
    return new Response(
      JSON.stringify({ images: fallbackImages }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})