-- Create a webhook configuration table
-- Run this in your Supabase SQL Editor

-- Create webhook_config table
CREATE TABLE IF NOT EXISTS webhook_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    platform VARCHAR(50) NOT NULL UNIQUE,
    webhook_url TEXT,
    enabled BOOLEAN DEFAULT false,
    events TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default webhook configurations
INSERT INTO webhook_config (platform, webhook_url, enabled, events) VALUES
('teams', '', false, ARRAY['score_submitted', 'achievement_unlocked', 'competition_started', 'competition_ended']),
('discord', '', false, ARRAY['score_submitted', 'achievement_unlocked', 'competition_started', 'competition_ended']),
('slack', '', false, ARRAY['score_submitted', 'achievement_unlocked', 'competition_started', 'competition_ended'])
ON CONFLICT (platform) DO NOTHING;

-- Create function to update webhook config
CREATE OR REPLACE FUNCTION update_webhook_config(
    p_platform VARCHAR(50),
    p_webhook_url TEXT,
    p_enabled BOOLEAN DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE webhook_config 
    SET 
        webhook_url = COALESCE(p_webhook_url, webhook_url),
        enabled = COALESCE(p_enabled, enabled),
        updated_at = NOW()
    WHERE platform = p_platform;
    
    IF NOT FOUND THEN
        INSERT INTO webhook_config (platform, webhook_url, enabled)
        VALUES (p_platform, p_webhook_url, COALESCE(p_enabled, false));
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Test the setup
SELECT 'Webhook config table created successfully!' as status;
SELECT platform, enabled, webhook_url FROM webhook_config;
