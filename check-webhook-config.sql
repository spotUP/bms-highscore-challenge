-- Check current webhook configuration
-- Run this in your Supabase SQL Editor

-- Check if webhook_config table exists and what's in it
SELECT 
    platform,
    enabled,
    CASE 
        WHEN webhook_url = '' THEN 'No URL set'
        WHEN webhook_url IS NULL THEN 'No URL set'
        ELSE 'URL configured'
    END as url_status,
    events,
    updated_at
FROM webhook_config
ORDER BY platform;
