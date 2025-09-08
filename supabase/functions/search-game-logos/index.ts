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

    console.log('=== LAUNCHBOX DIRECT SEARCH ===')
    console.log('Searching LaunchBox Games Database directly for:', gameName)
    console.log('=== END LAUNCHBOX SEARCH INIT ===')

    // Search LaunchBox Games Database directly with more specific query
    const searchQuery = gameName
    const searchUrl = `https://gamesdb.launchbox-app.com/games/search?q=${encodeURIComponent(searchQuery)}&platform=Arcade`
    
    console.log('Searching for exact game:', gameName)

    console.log('=== LAUNCHBOX SEARCH DEBUG ===')
    console.log('Searching for:', searchQuery)
    console.log('Search URL:', searchUrl)
    console.log('=== END LAUNCHBOX SEARCH DEBUG ===')

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GameLogoBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('LaunchBox search error:', response.status, errorText)
      
      // Return fallback images on API error
      const fallbackImages = [
        `https://dummyimage.com/200x200/ff9999/ffffff&text=${encodeURIComponent(gameName)}+LaunchBox+Error`,
        `https://dummyimage.com/200x200/99ff99/ffffff&text=${encodeURIComponent(gameName)}+Search+Failed`,
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

    const html = await response.text()
    console.log('LaunchBox response received, HTML length:', html.length)
    
    // Debug: Check if we got a valid response
    if (html.length < 1000) {
      console.log('HTML response seems too short, might be an error page')
      console.log('HTML content:', html.substring(0, 500))
    }
    
    // Debug: Check if the page contains the game we're looking for
    const hasGameTitle = html.toLowerCase().includes(gameName.toLowerCase())
    console.log(`Page contains game title "${gameName}":`, hasGameTitle)
    
    // Parse HTML to extract clear logo image URLs from the Clear Logo section
    const images: string[] = []
    
    // First, try to find the Clear Logo section in the HTML
    // Look for the section that contains "Clear Logo" heading
    const clearLogoSectionRegex = /### Clear Logo[\s\S]*?(?=### [A-Z]|$)/i
    const clearLogoSection = html.match(clearLogoSectionRegex)
    
    console.log('Clear Logo section found:', !!clearLogoSection)
    
    if (clearLogoSection) {
      console.log('Clear Logo section length:', clearLogoSection[0].length)
      console.log('Clear Logo section preview:', clearLogoSection[0].substring(0, 200))
      
      // Extract image URLs from within the Clear Logo section only
      const imageRegex = /https:\/\/images\.launchbox-app\.com\/[^"'\s]+\.(png|jpg|jpeg)/gi
      const sectionMatches = clearLogoSection[0].match(imageRegex)
      
      if (sectionMatches) {
        images.push(...sectionMatches.slice(0, numResults))
        console.log('Found images in Clear Logo section:', sectionMatches.length)
        console.log('Clear Logo section URLs:', sectionMatches)
      }
    }
    
    // If no Clear Logo section found, try alternative approach
    if (images.length === 0) {
      console.log('No Clear Logo section found, trying alternative parsing...')
      
      // Look for LaunchBox clear logo images with more specific pattern
      const clearLogoRegex = /https:\/\/images\.launchbox-app\.com\/[^"'\s]*clear[^"'\s]*\.(png|jpg|jpeg)/gi
      const clearMatches = html.match(clearLogoRegex)
      
      if (clearMatches) {
        images.push(...clearMatches.slice(0, numResults))
        console.log('Found LaunchBox clear logos via regex:', clearMatches.length)
        console.log('Clear logo URLs:', clearMatches)
      }
    }
    
    // Debug: If still no images, let's see what's in the HTML
    if (images.length === 0) {
      console.log('No clear logos found, debugging HTML content...')
      
      // Check if there are any LaunchBox images at all
      const allLaunchBoxImages = html.match(/https:\/\/images\.launchbox-app\.com\/[^"'\s]+\.(png|jpg|jpeg)/gi)
      console.log('All LaunchBox images found:', allLaunchBoxImages?.length || 0)
      if (allLaunchBoxImages && allLaunchBoxImages.length > 0) {
        console.log('Sample LaunchBox image URLs:', allLaunchBoxImages.slice(0, 5))
      }
      
      // Check if the page has the expected structure
      const hasMediaSection = html.includes('Media')
      const hasClearLogoText = html.includes('Clear Logo')
      console.log('Page has Media section:', hasMediaSection)
      console.log('Page has Clear Logo text:', hasClearLogoText)
    }
    
    // Final fallback: look for any LaunchBox logo images (but log that it's not from Clear Logo section)
    if (images.length === 0) {
      console.log('No clear logos found, using general logo fallback...')
      const logoRegex = /https:\/\/images\.launchbox-app\.com\/[^"'\s]*logo[^"'\s]*\.(png|jpg|jpeg)/gi
      const logoMatches = html.match(logoRegex)
      
      if (logoMatches) {
        images.push(...logoMatches.slice(0, numResults))
        console.log('Found LaunchBox logos (NOT from Clear Logo section):', logoMatches.length)
        console.log('Logo URLs:', logoMatches)
      }
    }
    
    console.log(`Final result: Found ${images.length} LaunchBox images for "${gameName}"`)
    console.log('Final image URLs:', images)

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