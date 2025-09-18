import { createClient } from '@supabase/supabase-js'
import { getGameLogoUrl } from '../src/lib/utils'

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  if (!supabaseUrl) console.error('   - VITE_SUPABASE_URL')
  if (!supabaseServiceKey) console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Fallback logo mapping from Index.tsx
const LOGO_MAP: Record<string, string> = {
  "pacman": "/src/assets/pacman-logo.png",
  "pac-man": "/src/assets/pacman-logo.png",
  "spaceinvaders": "/src/assets/space-invaders-logo.png",
  "space invaders": "/src/assets/space-invaders-logo.png",
  "tetris": "/src/assets/tetris-logo.png",
  "donkeykong": "/src/assets/donkey-kong-logo.png",
  "donkey kong": "/src/assets/donkey-kong-logo.png",
}

interface Game {
  id: string
  name: string
  logo_url: string | null
  is_active: boolean
  tournament_id: string
}

async function saveCompetitionLogos() {
  console.log('🏆 Starting competition logo saving process...')

  try {
    // Get all active games from current tournament
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, name, logo_url, is_active, tournament_id')
      .eq('is_active', true)

    if (gamesError) {
      console.error('❌ Error fetching tournament games:', gamesError)
      return
    }

    if (!games || games.length === 0) {
      console.log('ℹ️ No active tournament games found')
      return
    }

    console.log(`📋 Found ${games.length} active tournament games`)

    let saved = 0
    let skipped = 0
    let failed = 0

    for (const game of games) {
      console.log(`\n🎮 Processing game: ${game.name}`)

      // Determine the logo URL using the same logic as Index.tsx
      const logoUrl = getGameLogoUrl(game.logo_url) ||
                     LOGO_MAP[game.name.toLowerCase()] ||
                     LOGO_MAP[game.id.toLowerCase()]

      if (!logoUrl) {
        console.log(`   ⚠️ No logo found for ${game.name}`)
        skipped++
        continue
      }

      console.log(`   🖼️ Logo URL: ${logoUrl}`)

      try {
        // Try to find the game in games_database by name match
        const { data: matchedGames, error: searchError } = await supabase
          .from('games_database')
          .select('id, name, logo_url')
          .ilike('name', game.name)
          .limit(1)

        if (searchError) {
          console.error(`   ❌ Error searching for ${game.name}:`, searchError)
          failed++
          continue
        }

        if (!matchedGames || matchedGames.length === 0) {
          console.log(`   ⚠️ No matching game found in games_database for "${game.name}"`)
          skipped++
          continue
        }

        const matchedGame = matchedGames[0]
        console.log(`   ✅ Found match: "${matchedGame.name}"`)

        // Update the games_database table with the logo URL if it doesn't already have one
        if (matchedGame.logo_url && matchedGame.logo_url !== logoUrl) {
          console.log(`   ℹ️ Game already has logo: ${matchedGame.logo_url}`)
          skipped++
          continue
        }

        const { error: updateError } = await supabase
          .from('games_database')
          .update({ logo_url: logoUrl })
          .eq('id', matchedGame.id)

        if (updateError) {
          console.error(`   ❌ Error updating logo for ${game.name}:`, updateError)
          failed++
          continue
        }

        console.log(`   ✅ Successfully saved logo for ${game.name}`)
        saved++

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`   ❌ Unexpected error processing ${game.name}:`, error)
        failed++
      }
    }

    console.log(`\n📊 Summary:`)
    console.log(`   ✅ Saved: ${saved}`)
    console.log(`   ⚠️ Skipped: ${skipped}`)
    console.log(`   ❌ Failed: ${failed}`)
    console.log(`   📈 Total: ${games.length}`)

    if (saved > 0) {
      console.log(`\n🎉 Successfully saved ${saved} competition logos to database!`)
    }

  } catch (error) {
    console.error('❌ Fatal error during logo saving process:', error)
    process.exit(1)
  }
}

// Run the script
saveCompetitionLogos()
  .then(() => {
    console.log('\n✨ Logo saving process completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Script failed:', error)
    process.exit(1)
  })