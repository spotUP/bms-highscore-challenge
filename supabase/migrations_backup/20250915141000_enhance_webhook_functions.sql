-- Enhanced webhook functions to support event type configuration

-- Create enhanced function to update webhook configuration with events
CREATE OR REPLACE FUNCTION public.update_user_webhook_config_with_events(
  p_user_id uuid,
  p_platform text,
  p_webhook_url text DEFAULT NULL,
  p_enabled boolean DEFAULT NULL,
  p_events text DEFAULT NULL
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
    events = CASE
      WHEN p_events IS NOT NULL THEN p_events::jsonb
      ELSE events
    END,
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
      COALESCE(p_events::jsonb, '["score_submitted", "achievement_unlocked", "competition_started", "competition_ended"]'::jsonb)
    );
  END IF;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.update_user_webhook_config_with_events(uuid, text, text, boolean, text) TO authenticated;