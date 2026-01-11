-- Simple webhook_config table creation without admin dependencies
-- This creates the basic webhook functionality to fix 404 errors

-- Create the webhook_config table
CREATE TABLE IF NOT EXISTS public.webhook_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL, -- 'teams', 'discord', 'slack', etc.
  webhook_url text,
  enabled boolean DEFAULT false,
  events jsonb DEFAULT '[]'::jsonb, -- Array of event types this webhook should receive
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Ensure one config per user per platform
  UNIQUE(user_id, platform)
);

-- Enable RLS
ALTER TABLE public.webhook_config ENABLE ROW LEVEL SECURITY;

-- Simple RLS policy: Users can only see and manage their own webhook configs
CREATE POLICY "Users can manage their own webhook configs"
ON public.webhook_config FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_webhook_config_updated_at
  BEFORE UPDATE ON public.webhook_config
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Create function to initialize default webhook configs for a user
CREATE OR REPLACE FUNCTION public.initialize_user_webhooks(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert default webhook configurations for all platforms
  INSERT INTO public.webhook_config (user_id, platform, webhook_url, enabled, events)
  VALUES
    (p_user_id, 'teams', '', false, '["score_submitted", "achievement_unlocked", "competition_started", "competition_ended"]'::jsonb),
    (p_user_id, 'discord', '', false, '["score_submitted", "achievement_unlocked", "competition_started", "competition_ended"]'::jsonb),
    (p_user_id, 'slack', '', false, '["score_submitted", "achievement_unlocked", "competition_started", "competition_ended"]'::jsonb)
  ON CONFLICT (user_id, platform) DO NOTHING; -- Don't overwrite existing configs
END;
$$;

-- Create function to update webhook configuration
CREATE OR REPLACE FUNCTION public.update_user_webhook_config(
  p_user_id uuid,
  p_platform text,
  p_webhook_url text DEFAULT NULL,
  p_enabled boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ensure user can only update their own webhooks (additional security check)
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Cannot update webhook config for other users';
  END IF;

  -- Initialize user webhooks if they don't exist
  PERFORM public.initialize_user_webhooks(p_user_id);

  -- Update the webhook configuration
  UPDATE public.webhook_config
  SET
    webhook_url = COALESCE(p_webhook_url, webhook_url),
    enabled = COALESCE(p_enabled, enabled),
    updated_at = timezone('utc'::text, now())
  WHERE user_id = p_user_id AND platform = p_platform;

  -- If no rows were affected, the platform doesn't exist, so insert it
  IF NOT FOUND THEN
    INSERT INTO public.webhook_config (user_id, platform, webhook_url, enabled, events)
    VALUES (
      p_user_id,
      p_platform,
      COALESCE(p_webhook_url, ''),
      COALESCE(p_enabled, false),
      '["score_submitted", "achievement_unlocked", "competition_started", "competition_ended"]'::jsonb
    );
  END IF;
END;
$$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.webhook_config TO authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_user_webhooks(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_webhook_config(uuid, text, text, boolean) TO authenticated;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_webhook_config_user_id ON public.webhook_config(user_id);
CREATE INDEX IF NOT EXISTS idx_webhook_config_platform ON public.webhook_config(platform);
CREATE INDEX IF NOT EXISTS idx_webhook_config_enabled ON public.webhook_config(enabled);