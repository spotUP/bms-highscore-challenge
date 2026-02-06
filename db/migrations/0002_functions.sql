CREATE OR REPLACE FUNCTION public.create_tournament_achievement(
  p_tournament_id uuid,
  p_name text,
  p_description text,
  p_type text,
  p_badge_icon text DEFAULT '🏆',
  p_badge_color text DEFAULT '#FFD700',
  p_criteria jsonb DEFAULT '{}'::jsonb,
  p_points integer DEFAULT 10
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_achievement_id uuid;
BEGIN
  INSERT INTO public.achievements (
    tournament_id,
    name,
    description,
    type,
    badge_icon,
    badge_color,
    criteria,
    points,
    is_active,
    created_by
  ) VALUES (
    p_tournament_id,
    p_name,
    p_description,
    COALESCE(p_type, 'score_milestone'),
    p_badge_icon,
    p_badge_color,
    p_criteria,
    p_points,
    true,
    auth.uid()
  ) RETURNING id INTO new_achievement_id;

  RETURN new_achievement_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_tournament_achievement(
  p_achievement_id uuid,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_badge_icon text DEFAULT NULL,
  p_badge_color text DEFAULT NULL,
  p_criteria jsonb DEFAULT NULL,
  p_points integer DEFAULT NULL,
  p_is_active boolean DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.achievements SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    badge_icon = COALESCE(p_badge_icon, badge_icon),
    badge_color = COALESCE(p_badge_color, badge_color),
    criteria = COALESCE(p_criteria, criteria),
    points = COALESCE(p_points, points),
    is_active = COALESCE(p_is_active, is_active),
    updated_at = now()
  WHERE id = p_achievement_id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_tournament_achievement(
  p_achievement_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.achievements SET
    is_active = false,
    updated_at = now()
  WHERE id = p_achievement_id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_tournament_achievements(
  p_tournament_id uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  type text,
  badge_icon text,
  badge_color text,
  criteria jsonb,
  points integer,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz,
  unlock_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.name,
    a.description,
    a.type,
    a.badge_icon,
    a.badge_color,
    a.criteria,
    a.points,
    a.is_active,
    a.created_at,
    a.updated_at,
    COUNT(pa.id) AS unlock_count
  FROM public.achievements a
  LEFT JOIN public.player_achievements pa ON a.id = pa.achievement_id
  WHERE a.tournament_id = p_tournament_id
  GROUP BY a.id, a.name, a.description, a.type, a.badge_icon, a.badge_color,
           a.criteria, a.points, a.is_active, a.created_at, a.updated_at
  ORDER BY a.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.initialize_user_webhooks(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.webhook_config (user_id, platform, webhook_url, enabled, events)
  VALUES
    (p_user_id, 'teams', '', false, '["score_submitted", "achievement_unlocked", "competition_started", "competition_ended"]'::jsonb),
    (p_user_id, 'discord', '', false, '["score_submitted", "achievement_unlocked", "competition_started", "competition_ended"]'::jsonb),
    (p_user_id, 'slack', '', false, '["score_submitted", "achievement_unlocked", "competition_started", "competition_ended"]'::jsonb)
  ON CONFLICT (user_id, platform) DO NOTHING;
END;
$$;

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
  IF p_user_id != auth.uid() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Cannot update webhook config for other users';
    END IF;
  END IF;

  PERFORM public.initialize_user_webhooks(p_user_id);

  UPDATE public.webhook_config
  SET
    webhook_url = COALESCE(p_webhook_url, webhook_url),
    enabled = COALESCE(p_enabled, enabled),
    updated_at = now()
  WHERE user_id = p_user_id AND platform = p_platform;

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
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: Cannot update webhook config for other users';
  END IF;

  PERFORM public.initialize_user_webhooks(p_user_id);

  UPDATE public.webhook_config
  SET
    webhook_url = COALESCE(p_webhook_url, webhook_url),
    enabled = COALESCE(p_enabled, enabled),
    events = CASE
      WHEN p_events IS NOT NULL THEN p_events::jsonb
      ELSE events
    END,
    updated_at = now()
  WHERE user_id = p_user_id AND platform = p_platform;

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

CREATE OR REPLACE FUNCTION public.archive_current_competition()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  competition_name text;
  competition_id uuid;
  start_date timestamptz;
  end_date timestamptz;
  total_players integer;
  total_games integer;
  total_scores integer;
  result json;
BEGIN
  competition_name := to_char(now(), 'YYYY-MM');
  start_date := date_trunc('month', now());
  end_date := now();

  INSERT INTO public.competition_history (competition_name, start_date, end_date)
  VALUES (competition_name, start_date, end_date)
  RETURNING id INTO competition_id;

  INSERT INTO public.competition_games (competition_id, game_name, game_logo_url)
  SELECT competition_id, name, logo_url
  FROM public.games
  WHERE include_in_challenge = true;

  SELECT COUNT(*) INTO total_games FROM public.games WHERE include_in_challenge = true;

  WITH ranked_scores AS (
    SELECT
      s.*,
      g.name as game_name,
      ROW_NUMBER() OVER (PARTITION BY s.game_id ORDER BY s.score DESC) as rank_in_game
    FROM public.scores s
    JOIN public.games g ON s.game_id = g.id
    WHERE g.include_in_challenge = true
  )
  INSERT INTO public.competition_scores (competition_id, player_name, game_name, score, rank_in_game, ranking_points)
  SELECT
    competition_id,
    player_name,
    game_name,
    score,
    rank_in_game,
    CASE
      WHEN rank_in_game = 1 THEN 100
      WHEN rank_in_game = 2 THEN 80
      WHEN rank_in_game = 3 THEN 70
      WHEN rank_in_game = 4 THEN 60
      WHEN rank_in_game = 5 THEN 50
      ELSE GREATEST(100 - (rank_in_game - 1) * 10, 10)
    END as ranking_points
  FROM ranked_scores;

  SELECT COUNT(*) INTO total_scores FROM public.competition_scores WHERE competition_id = competition_id;

  WITH player_stats AS (
    SELECT
      player_name,
      SUM(score) as total_score,
      SUM(CASE
        WHEN rank_in_game = 1 THEN 100
        WHEN rank_in_game = 2 THEN 80
        WHEN rank_in_game = 3 THEN 70
        WHEN rank_in_game = 4 THEN 60
        WHEN rank_in_game = 5 THEN 50
        ELSE GREATEST(100 - (rank_in_game - 1) * 10, 10)
      END) as total_ranking_points,
      COUNT(*) as games_played,
      MIN(rank_in_game) as best_rank
    FROM public.competition_scores
    WHERE competition_id = competition_id
    GROUP BY player_name
  ),
  ranked_players AS (
    SELECT
      *,
      ROW_NUMBER() OVER (ORDER BY total_ranking_points DESC, total_score DESC) as final_rank
    FROM player_stats
  )
  INSERT INTO public.competition_players (competition_id, player_name, total_score, total_ranking_points, games_played, best_rank, final_rank)
  SELECT
    competition_id,
    player_name,
    total_score,
    total_ranking_points,
    games_played,
    best_rank,
    final_rank
  FROM ranked_players;

  SELECT COUNT(*) INTO total_players FROM public.competition_players WHERE competition_id = competition_id;

  UPDATE public.competition_history
  SET
    total_players = total_players,
    total_games = total_games,
    total_scores = total_scores
  WHERE id = competition_id;

  DELETE FROM public.scores WHERE game_id IN (SELECT id FROM public.games WHERE include_in_challenge = true);
  UPDATE public.games SET include_in_challenge = false WHERE include_in_challenge = true;

  result := json_build_object(
    'success', true,
    'competition_id', competition_id,
    'competition_name', competition_name,
    'total_players', total_players,
    'total_games', total_games,
    'total_scores', total_scores,
    'start_date', start_date,
    'end_date', end_date
  );

  RETURN result;
END;
$$;
