import { createClient } from '@supabase/supabase-js'

// Use service role key for database admin operations
const supabaseUrl = process.env.VITE_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createTable() {
  try {
    console.log('Creating competitions table...')

    // Test if the table already exists
    const { data: existingTable, error: checkError } = await supabase
      .from('competitions')
      .select('id')
      .limit(1)

    if (!checkError) {
      console.log('✅ Competitions table already exists!')
      return
    }

    // If we get here, the table doesn't exist, let's try to create it via the database
    // Since we can't use exec_sql, let's use a simpler approach
    console.log('Table does not exist, it needs to be created via migration.')
    console.log('The migration file has been created: supabase/migrations/20250915142000_create_competitions_table.sql')
    console.log('Please apply it manually via Supabase dashboard or local development environment.')

    console.log('\nFor now, the CompetitionManager will work in mock mode without persistent database storage.')
    console.log('The UI functionality is complete and ready to use.')

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

createTable()