-- Functions for fetching recent achievements after score submission
-- Called by useAchievements.ts to show achievement toast notifications

-- For authenticated users: fetch recent achievements by user_id
CREATE OR REPLACE FUNCTION public.get_recent_achievements_for_user(
  p_user_id uuid,
  p_tournament_id uuid,
  p_since_minutes integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  achievement_id uuid,
  player_name text,
  achievement_name text,
  achievement_description text,
  badge_icon text,
  badge_color text,
  points integer,
  created_by uuid,
  unlocked_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    pa.id,
    pa.achievement_id,
    pa.player_name,
    a.name AS achievement_name,
    a.description AS achievement_description,
    a.badge_icon,
    a.badge_color,
    a.points,
    pa.user_id AS created_by,
    pa.unlocked_at
  FROM public.player_achievements pa
  JOIN public.achievements a ON a.id = pa.achievement_id
  WHERE pa.user_id = p_user_id
    AND pa.tournament_id = p_tournament_id
    AND pa.unlocked_at >= (now() - make_interval(mins => p_since_minutes))
  ORDER BY pa.unlocked_at DESC;
$$;

-- For anonymous users: fetch recent achievements by tournament + player name
CREATE OR REPLACE FUNCTION public.get_recent_achievements_by_tournament(
  p_tournament_id uuid,
  p_player_name text,
  p_since_minutes integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  achievement_id uuid,
  player_name text,
  achievement_name text,
  achievement_description text,
  badge_icon text,
  badge_color text,
  points integer,
  unlocked_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    pa.id,
    pa.achievement_id,
    pa.player_name,
    a.name AS achievement_name,
    a.description AS achievement_description,
    a.badge_icon,
    a.badge_color,
    a.points,
    pa.unlocked_at
  FROM public.player_achievements pa
  JOIN public.achievements a ON a.id = pa.achievement_id
  WHERE pa.tournament_id = p_tournament_id
    AND UPPER(pa.player_name) = UPPER(p_player_name)
    AND pa.unlocked_at >= (now() - make_interval(mins => p_since_minutes))
  ORDER BY pa.unlocked_at DESC;
$$;
