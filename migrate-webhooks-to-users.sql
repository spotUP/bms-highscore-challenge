-- Migrate webhooks to be user-specific
-- Run this in your Supabase SQL Editor

-- First, check if the current webhook_config table exists
DO $$ 
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'webhook_config') THEN
    -- Rename the old table to backup
    ALTER TABLE webhook_config RENAME TO webhook_config_backup;
    RAISE NOTICE 'Backed up existing webhook_config table to webhook_config_backup';
  END IF;
END $$;

-- Create new user-specific webhook_config table
CREATE TABLE IF NOT EXISTS webhook_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    webhook_url TEXT,
    enabled BOOLEAN DEFAULT false,
    events TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one config per user per platform
    UNIQUE(user_id, platform)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_webhook_config_user_id ON webhook_config(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_config_user_platform ON webhook_config(user_id, platform);

-- Enable RLS
ALTER TABLE webhook_config ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own webhook configs" ON webhook_config
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own webhook configs" ON webhook_config
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own webhook configs" ON webhook_config
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own webhook configs" ON webhook_config
    FOR DELETE USING (auth.uid() = user_id);

-- Create function to initialize default webhook configs for a user
CREATE OR REPLACE FUNCTION initialize_user_webhooks(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Insert default webhook configurations for the user
    INSERT INTO webhook_config (user_id, platform, webhook_url, enabled, events) VALUES
    (p_user_id, 'teams', '', false, ARRAY['score_submitted', 'achievement_unlocked', 'competition_started', 'competition_ended']),
    (p_user_id, 'discord', '', false, ARRAY['score_submitted', 'achievement_unlocked', 'competition_started', 'competition_ended']),
    (p_user_id, 'slack', '', false, ARRAY['score_submitted', 'achievement_unlocked', 'competition_started', 'competition_ended'])
    ON CONFLICT (user_id, platform) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Create function to update webhook config
CREATE OR REPLACE FUNCTION update_user_webhook_config(
    p_user_id UUID,
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
    WHERE user_id = p_user_id AND platform = p_platform;
    
    IF NOT FOUND THEN
        INSERT INTO webhook_config (user_id, platform, webhook_url, enabled)
        VALUES (p_user_id, p_platform, p_webhook_url, COALESCE(p_enabled, false));
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically initialize webhooks for new users
CREATE OR REPLACE FUNCTION handle_new_user_webhooks()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM initialize_user_webhooks(NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger that runs when a new user is created
CREATE TRIGGER on_auth_user_created_webhook
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user_webhooks();

-- Test the setup
SELECT 'User-specific webhook config table created successfully!' as status;

-- Show the new table structure (for information only)
-- You can run this separately in psql if needed: \d webhook_config
