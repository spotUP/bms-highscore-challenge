import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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

async function applyMigration() {
  try {
    console.log('Reading migrations file...')
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250915142000_create_competitions_table.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8')

    console.log('Applying competitions table migration...')

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.length === 0) continue

      console.log(`Executing statement ${i + 1}/${statements.length}...`)
      const { error } = await supabase.rpc('exec_sql', {
        sql: statement + ';'
      })

      if (error) {
        console.error(`Error in statement ${i + 1}:`, error)
        if (!error.message.includes('already exists') && !error.message.includes('does not exist')) {
          throw error
        } else {
          console.log('Skipping (already exists or harmless error)')
        }
      }
    }

    console.log('✅ Migration applied successfully!')

    // Test the new table
    console.log('Testing competitions table...')
    const { data, error } = await supabase.from('competitions').select('*').limit(1)
    if (error) {
      console.error('Error testing table:', error)
    } else {
      console.log('✅ Competitions table is accessible')
    }

  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  }
}

applyMigration()