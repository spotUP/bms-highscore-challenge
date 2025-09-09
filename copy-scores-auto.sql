-- Automatic copy of all scores from Default Arcade Tournament to BMS Highscore Challenge
-- This script automatically finds the tournament IDs and copies all data

DO $$
DECLARE
  default_tournament_id UUID;
  bms_tournament_id UUID;
  row_count_var INTEGER;
BEGIN
  -- Find tournament IDs automatically
  SELECT id INTO default_tournament_id
  FROM public.tournaments
  WHERE name = 'Default Arcade Tournament' OR slug = 'default-arcade'
  LIMIT 1;

  SELECT id INTO bms_tournament_id
  FROM public.tournaments
  WHERE name = 'BMS Highscore Challenge' OR slug = 'bms-highscore-challenge'
  LIMIT 1;

  -- Validate we found both tournaments
  IF default_tournament_id IS NULL THEN
    RAISE EXCEPTION 'Default Arcade Tournament not found. Please make sure it exists.';
  END IF;

  IF bms_tournament_id IS NULL THEN
    RAISE EXCEPTION 'BMS Highscore Challenge tournament not found. Please create it first.';
  END IF;

  RAISE NOTICE 'Found tournaments:';
  RAISE NOTICE '  Default: %', default_tournament_id;
  RAISE NOTICE '  BMS: %', bms_tournament_id;

  -- Temporarily disable the achievement trigger to prevent issues during copy
  RAISE NOTICE 'Disabling achievement trigger temporarily...';
  ALTER TABLE public.scores DISABLE TRIGGER check_achievements_on_game_play;

  -- Step 1: Copy games (if they don't already exist)
  RAISE NOTICE 'Copying games...';
  INSERT INTO public.games (
    name,
    description,
    logo_url,
    is_active,
    include_in_challenge,
    tournament_id,
    created_at,
    updated_at
  )
  SELECT
    g.name,
    g.description,
    g.logo_url,
    g.is_active,
    g.include_in_challenge,
    bms_tournament_id,
    NOW(),
    NOW()
  FROM public.games g
  WHERE g.tournament_id = default_tournament_id
    AND NOT EXISTS (
      SELECT 1 FROM public.games g2
      WHERE g2.tournament_id = bms_tournament_id
        AND g2.name = g.name
    );

  GET DIAGNOSTICS row_count_var = ROW_COUNT;
  RAISE NOTICE 'Copied % games', row_count_var;

  -- Step 2: Copy scores with new game IDs
  RAISE NOTICE 'Copying scores...';
  INSERT INTO public.scores (
    player_name,
    score,
    game_id,
    tournament_id,
    created_at,
    updated_at
  )
  SELECT
    s.player_name,
    s.score,
    g2.id as new_game_id,
    bms_tournament_id,
    s.created_at,
    NOW()
  FROM public.scores s
  JOIN public.games g ON s.game_id = g.id
  JOIN public.games g2 ON g2.name = g.name AND g2.tournament_id = bms_tournament_id
  WHERE s.tournament_id = default_tournament_id;

  GET DIAGNOSTICS row_count_var = ROW_COUNT;
  RAISE NOTICE 'Copied % scores', row_count_var;

  -- Step 3: Copy achievements
  RAISE NOTICE 'Copying achievements...';
  INSERT INTO public.achievements (
    name,
    description,
    type,
    badge_icon,
    badge_color,
    criteria,
    points,
    is_active,
    tournament_id,
    created_at,
    updated_at
  )
  SELECT
    a.name,
    a.description,
    a.type,
    a.badge_icon,
    a.badge_color,
    a.criteria,
    a.points,
    a.is_active,
    bms_tournament_id,
    NOW(),
    NOW()
  FROM public.achievements a
  WHERE a.tournament_id = default_tournament_id
    AND NOT EXISTS (
      SELECT 1 FROM public.achievements a2
      WHERE a2.tournament_id = bms_tournament_id
        AND a2.name = a.name
    );

  GET DIAGNOSTICS row_count_var = ROW_COUNT;
  RAISE NOTICE 'Copied % achievements', row_count_var;

  -- Step 4: Copy player achievements manually (since trigger is disabled)
  RAISE NOTICE 'Copying player achievements manually...';
  INSERT INTO public.player_achievements (
    player_name,
    achievement_id,
    unlocked_at,
    game_id,
    score,
    metadata,
    tournament_id,
    created_at
  )
  SELECT
    pa.player_name,
    a2.id as new_achievement_id,
    pa.unlocked_at,
    g2.id as new_game_id,
    pa.score,
    pa.metadata,
    bms_tournament_id,
    NOW()
  FROM public.player_achievements pa
  LEFT JOIN public.games g ON pa.game_id = g.id
  LEFT JOIN public.games g2 ON g2.name = g.name AND g2.tournament_id = bms_tournament_id
  JOIN public.achievements a ON pa.achievement_id = a.id
  JOIN public.achievements a2 ON a2.name = a.name AND a2.tournament_id = bms_tournament_id
  WHERE pa.tournament_id = default_tournament_id
    AND NOT EXISTS (
      SELECT 1 FROM public.player_achievements pa2
      WHERE pa2.player_name = pa.player_name
        AND pa2.achievement_id = a2.id
        AND pa2.tournament_id = bms_tournament_id
    );

  GET DIAGNOSTICS row_count_var = ROW_COUNT;
  RAISE NOTICE 'Copied % player achievements', row_count_var;

  -- Step 5: Copy player stats
  RAISE NOTICE 'Copying player stats...';
  INSERT INTO public.player_stats (
    player_name,
    games_played,
    total_score,
    average_score,
    best_score,
    ranking_points,
    achievements_unlocked,
    tournament_id,
    created_at,
    updated_at
  )
  SELECT
    ps.player_name,
    ps.games_played,
    ps.total_score,
    ps.average_score,
    ps.best_score,
    ps.ranking_points,
    ps.achievements_unlocked,
    bms_tournament_id,
    NOW(),
    NOW()
  FROM public.player_stats ps
  WHERE ps.tournament_id = default_tournament_id
    AND NOT EXISTS (
      SELECT 1 FROM public.player_stats ps2
      WHERE ps2.tournament_id = bms_tournament_id
        AND ps2.player_name = ps.player_name
    );

  GET DIAGNOSTICS row_count_var = ROW_COUNT;
  RAISE NOTICE 'Copied % player stats', row_count_var;

  -- Re-enable the achievement trigger
  RAISE NOTICE 'Re-enabling achievement trigger...';
  ALTER TABLE public.scores ENABLE TRIGGER check_achievements_on_game_play;

  RAISE NOTICE '✅ Score copy completed successfully!';
  RAISE NOTICE '📊 All data has been successfully copied from Default Arcade Tournament to BMS Highscore Challenge!';

END $$;

-- Verification: Check both tournaments now have the same data
SELECT
  t.name as tournament_name,
  COUNT(DISTINCT g.id) as games,
  COUNT(DISTINCT s.id) as scores,
  COUNT(DISTINCT a.id) as achievements,
  COUNT(DISTINCT pa.id) as player_achievements,
  COUNT(DISTINCT ps.id) as player_stats
FROM public.tournaments t
LEFT JOIN public.games g ON t.id = g.tournament_id
LEFT JOIN public.scores s ON t.id = s.tournament_id
LEFT JOIN public.achievements a ON t.id = a.tournament_id
LEFT JOIN public.player_achievements pa ON t.id = pa.tournament_id
LEFT JOIN public.player_stats ps ON t.id = ps.tournament_id
WHERE t.name IN ('Default Arcade Tournament', 'BMS Highscore Challenge')
GROUP BY t.id, t.name
ORDER BY t.name;
