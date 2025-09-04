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

    console.log('Using fallback images for:', gameName)
    const fallbackImages = [
      `https://dummyimage.com/200x200/333333/ffffff&text=${encodeURIComponent(gameName)}+1`,
      `https://dummyimage.com/200x200/555555/ffffff&text=${encodeURIComponent(gameName)}+2`,
      `https://dummyimage.com/200x200/777777/ffffff&text=${encodeURIComponent(gameName)}+3`,
      `https://dummyimage.com/200x200/999999/ffffff&text=${encodeURIComponent(gameName)}+4`
    ]
    
    const images = fallbackImages.slice(0, numResults)
    console.log('Returning', images.length, 'fallback images')
    
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