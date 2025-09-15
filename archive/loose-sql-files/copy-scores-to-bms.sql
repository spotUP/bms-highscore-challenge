-- Copy all scores from Default Arcade Tournament to BMS Highscore Challenge tournament
-- This script safely duplicates all scores, achievements, and player data

-- Step 1: Find the tournament IDs
SELECT
  id as tournament_id,
  name,
  slug
FROM public.tournaments
WHERE name IN ('Default Arcade Tournament', 'BMS Highscore Challenge')
   OR slug IN ('default-arcade', 'bms-highscore-challenge')
ORDER BY created_at;

-- Step 2: Get the IDs (you'll need to replace these with actual values from Step 1)
-- Replace these placeholders with the actual tournament IDs from the query above:
-- DEFAULT_TOURNAMENT_ID: The ID of your "Default Arcade Tournament"
-- BMS_TOURNAMENT_ID: The ID of your "BMS Highscore Challenge" tournament

DO $$
DECLARE
  default_tournament_id UUID := 'DEFAULT_TOURNAMENT_ID'; -- Replace with actual ID
  bms_tournament_id UUID := 'BMS_TOURNAMENT_ID'; -- Replace with actual ID
  score_count INTEGER;
  achievement_count INTEGER;
  player_count INTEGER;
BEGIN
  -- Validate tournament IDs exist
  IF NOT EXISTS (SELECT 1 FROM public.tournaments WHERE id = default_tournament_id) THEN
    RAISE EXCEPTION 'Default tournament ID does not exist: %', default_tournament_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.tournaments WHERE id = bms_tournament_id) THEN
    RAISE EXCEPTION 'BMS tournament ID does not exist: %', bms_tournament_id;
  END IF;

  RAISE NOTICE 'Copying from tournament: % to tournament: %', default_tournament_id, bms_tournament_id;

  -- Step 3: Copy games (if they don't already exist)
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

  GET DIAGNOSTICS game_count = ROW_COUNT;
  RAISE NOTICE 'Copied % games', game_count;

  -- Step 4: Copy scores with new game IDs
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

  GET DIAGNOSTICS score_count = ROW_COUNT;
  RAISE NOTICE 'Copied % scores', score_count;

  -- Step 5: Copy achievements
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

  GET DIAGNOSTICS achievement_count = ROW_COUNT;
  RAISE NOTICE 'Copied % achievements', achievement_count;

  -- Step 6: Copy player achievements
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
  WHERE pa.tournament_id = default_tournament_id;

  GET DIAGNOSTICS player_achievement_count = ROW_COUNT;
  RAISE NOTICE 'Copied % player achievements', player_achievement_count;

  -- Step 7: Copy player stats
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

  GET DIAGNOSTICS player_count = ROW_COUNT;
  RAISE NOTICE 'Copied % player stats', player_count;

  RAISE NOTICE 'Score copy completed successfully!';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - Games: %', game_count;
  RAISE NOTICE '  - Scores: %', score_count;
  RAISE NOTICE '  - Achievements: %', achievement_count;
  RAISE NOTICE '  - Player Achievements: %', player_achievement_count;
  RAISE NOTICE '  - Player Stats: %', player_count;

END $$;

-- Verification: Check the results
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
