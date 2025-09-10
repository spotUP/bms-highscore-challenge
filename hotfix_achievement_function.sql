-- Hotfix for ambiguous column reference in get_tournament_achievements function
CREATE OR REPLACE FUNCTION get_tournament_achievements(
  p_tournament_id UUID
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  type achievement_type,
  badge_icon TEXT,
  badge_color TEXT,
  criteria JSONB,
  points INTEGER,
  is_active BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  unlock_count BIGINT
) AS $$
BEGIN
  -- Check if user has permission to view achievements in this tournament
  IF NOT EXISTS (
    SELECT 1 FROM tournaments t
    WHERE t.id = p_tournament_id 
    AND (
      t.created_by = auth.uid()
      OR t.is_public = true
    )
  ) AND NOT EXISTS (
    SELECT 1 FROM tournament_members tm
    WHERE tm.tournament_id = p_tournament_id 
    AND tm.user_id = auth.uid() 
    AND tm.is_active = true
  ) THEN
    RAISE EXCEPTION 'Permission denied: You can only view achievements in tournaments you have access to';
  END IF;

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
    COUNT(pa.id) as unlock_count
  FROM achievements a
  LEFT JOIN player_achievements pa ON a.id = pa.achievement_id
  WHERE a.tournament_id = p_tournament_id
  GROUP BY a.id, a.name, a.description, a.type, a.badge_icon, a.badge_color, 
           a.criteria, a.points, a.is_active, a.created_at, a.updated_at
  ORDER BY a.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
