-- Initialize webhooks for specific user: spotup@gmail.com
-- Run this in your Supabase SQL Editor

-- First, find the user ID for spotup@gmail.com
DO $$
DECLARE
    user_uuid UUID;
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
    
    -- Initialize webhooks for this user
    PERFORM initialize_user_webhooks(user_uuid);
    
    RAISE NOTICE 'Initialized webhook configs for spotup@gmail.com';
END $$;

-- Verify the webhooks were created
SELECT 
    u.email,
    wc.platform,
    wc.enabled,
    CASE 
        WHEN wc.webhook_url = '' OR wc.webhook_url IS NULL THEN 'No URL set'
        ELSE 'URL configured'
    END as url_status,
    wc.events,
    wc.created_at
FROM auth.users u
JOIN webhook_config wc ON wc.user_id = u.id
WHERE u.email = 'spotup@gmail.com'
ORDER BY wc.platform;

-- If no results above, let's check if the user exists
SELECT 
    id, 
    email, 
    created_at,
    email_confirmed_at
FROM auth.users 
WHERE email = 'spotup@gmail.com';

-- Also show any existing webhook configs (if any)
SELECT COUNT(*) as total_webhook_configs FROM webhook_config;
