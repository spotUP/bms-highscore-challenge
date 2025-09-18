import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:')
  if (!supabaseUrl) console.error('   - VITE_SUPABASE_URL')
  if (!supabaseServiceKey) console.error('   - SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createAdminUser() {
  console.log('🔧 Creating admin user...')

  const email = 'info@guardtools.com'
  const password = 'Qwerty1!'

  try {
    // Create the user using the admin client
    console.log(`Creating user: ${email}`)

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Auto-confirm the email
      user_metadata: {
        role: 'admin'
      }
    })

    if (authError) {
      console.error('❌ Error creating user:', authError)
      return
    }

    console.log('✅ User created successfully:', authData.user?.id)

    // Add admin role to user_roles table
    if (authData.user?.id) {
      console.log('Setting admin role...')

      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'admin'
        })

      if (roleError) {
        console.error('❌ Error setting admin role:', roleError)
        // Check if user already has role
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', authData.user.id)
          .single()

        if (existingRole) {
          console.log('ℹ️  User already has role:', existingRole.role)
        }
      } else {
        console.log('✅ Admin role assigned successfully')
      }
    }

    console.log('\n🎉 Admin user created successfully!')
    console.log('📧 Email:', email)
    console.log('🔑 Password:', password)
    console.log('👑 Role: admin')
    console.log('\nYou can now log in with these credentials.')

  } catch (error) {
    console.error('❌ Failed to create admin user:', error)
  }
}

createAdminUser()
  .then(() => {
    console.log('\n✨ Admin user creation process completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Script failed:', error)
    process.exit(1)
  })