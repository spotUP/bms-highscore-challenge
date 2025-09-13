-- Ensure the Supabase Realtime publication includes our tables
DO $$
BEGIN
  -- Add score_submissions to realtime publication
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.score_submissions';
  EXCEPTION WHEN others THEN
    -- Ignore if already added
    NULL;
  END;

  -- Also ensure player_achievements is included (for achievement unlock notifications)
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.player_achievements';
  EXCEPTION WHEN others THEN
    NULL;
  END;
END $$;
