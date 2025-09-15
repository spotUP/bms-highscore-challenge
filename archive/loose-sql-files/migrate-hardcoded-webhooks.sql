-- Migrate hardcoded webhooks to user-specific configuration for spotup@gmail.com
-- Run this in your Supabase SQL Editor

DO $$
DECLARE
    user_uuid UUID;
    hardcoded_teams_url TEXT := 'https://defaultb880007628fd4e2691f5df32a17ab7.e4.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/feb381c9899444c3937d80295b4afc57/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=5H4ofX0in_nS0DVzRKur5Y4YpXKILSqp2BMUXH4rfKU';
BEGIN
    -- Get the user ID for spotup@gmail.com
    SELECT id INTO user_uuid 
    FROM auth.users 
    WHERE email = 'spotup@gmail.com'
    LIMIT 1;
    
    IF user_uuid IS NULL THEN
        RAISE NOTICE 'User with email spotup@gmail.com not found';
        RETURN;
    END IF;
    
    RAISE NOTICE 'Found user ID: %', user_uuid;
    
    -- First, initialize default webhooks for this user if not exists
    PERFORM initialize_user_webhooks(user_uuid);
    
    -- Now update with the hardcoded Teams webhook URL that was previously being used
    UPDATE webhook_config 
    SET 
        webhook_url = hardcoded_teams_url,
        enabled = true,  -- Enable it since it was being used
        updated_at = NOW()
    WHERE user_id = user_uuid AND platform = 'teams';
    
    RAISE NOTICE 'Updated Teams webhook for spotup@gmail.com with hardcoded URL and enabled it';
    
    -- You can add other hardcoded URLs here if found
    -- Example for Discord (if you had one):
    -- UPDATE webhook_config 
    -- SET 
    --     webhook_url = 'your-discord-webhook-url',
    --     enabled = true,
    --     updated_at = NOW()
    -- WHERE user_id = user_uuid AND platform = 'discord';
    
END $$;

-- Verify the migration
SELECT 
    u.email,
    wc.platform,
    wc.enabled,
    LEFT(wc.webhook_url, 50) || '...' as webhook_url_preview,
    wc.events,
    wc.updated_at
FROM auth.users u
JOIN webhook_config wc ON wc.user_id = u.id
WHERE u.email = 'spotup@gmail.com'
ORDER BY wc.platform;

-- Show a success message
SELECT 'Hardcoded webhooks migrated to user-specific configuration for spotup@gmail.com' as status;
