import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Your existing hardcoded Teams webhook URL
const TEAMS_WEBHOOK_URL = 'https://defaultb880007628fd4e2691f5df32a17ab7.e4.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/feb381c9899444c3937d80295b4afc57/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=5H4ofX0in_nS0DVzRKur5Y4YpXKILSqp2BMUXH4rfKU';

async function populateTeamsWebhook() {
  try {
    console.log('🔗 Populating existing Teams webhook URL into new webhook system...');

    // Get your user ID (assuming you're spotup@gmail.com)
    const { data: users, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
      throw userError;
    }

    const user = users.users.find(u => u.email === 'spotup@gmail.com');
    if (!user) {
      console.error('❌ Could not find user spotup@gmail.com');
      process.exit(1);
    }

    console.log('👤 Found user:', user.email);

    // First, initialize user webhooks if they don't exist
    const { error: initError } = await supabase.rpc('initialize_user_webhooks', {
      p_user_id: user.id
    });

    if (initError && !initError.message.includes('duplicate key')) {
      console.error('❌ Error initializing webhooks:', initError);
      // Continue anyway, might already exist
    }

    console.log('📋 Initialized webhook configs for user');

    // Update the Teams webhook with your existing URL and enable it for all event types
    const { error: updateError } = await supabase
      .from('webhook_config')
      .upsert({
        user_id: user.id,
        platform: 'teams',
        webhook_url: TEAMS_WEBHOOK_URL,
        enabled: true,
        events: JSON.stringify(['score_submitted', 'achievement_unlocked', 'competition_started', 'competition_ended']),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,platform'
      });

    if (updateError) {
      console.error('❌ Error updating Teams webhook:', updateError);
      process.exit(1);
    }

    console.log('✅ Successfully populated Teams webhook!');
    console.log('📊 Webhook URL:', TEAMS_WEBHOOK_URL.substring(0, 50) + '...');
    console.log('🎯 Event types enabled: Achievements, Scores, Competition Start/End');
    console.log('🔔 Webhook is now enabled and ready to use!');

    // Verify it was saved correctly
    const { data: verification, error: verifyError } = await supabase
      .from('webhook_config')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'teams');

    if (verifyError) {
      console.warn('⚠️ Could not verify webhook was saved:', verifyError);
    } else if (verification && verification.length > 0) {
      const webhook = verification[0];
      console.log('✅ Verification: Teams webhook saved correctly');
      console.log('   • Enabled:', webhook.enabled);
      console.log('   • URL set:', !!webhook.webhook_url);
      console.log('   • Events:', webhook.events);
    }

  } catch (error) {
    console.error('❌ Failed to populate Teams webhook:', error);
    process.exit(1);
  }
}

populateTeamsWebhook();