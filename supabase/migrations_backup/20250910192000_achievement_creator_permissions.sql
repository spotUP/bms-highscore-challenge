-- Allow tournament creators to manage achievements in their tournaments

-- Update RLS policies to allow tournament creators to edit their achievements
DROP POLICY IF EXISTS "Only admins can manage achievements" ON achievements;

-- Tournament creators can manage achievements in their own tournaments
CREATE POLICY "Tournament creators can manage their achievements" ON achievements
  FOR ALL USING (
    -- Tournament creator can manage achievements in their tournament
    tournament_id IN (
      SELECT id FROM tournaments WHERE created_by = auth.uid()
    )
    OR
    -- Tournament admins can also manage achievements
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin') 
      AND is_active = true
    )
  )
  WITH CHECK (
    -- Same check for inserts/updates
    tournament_id IN (
      SELECT id FROM tournaments WHERE created_by = auth.uid()
    )
    OR
    tournament_id IN (
      SELECT tournament_id FROM tournament_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin') 
      AND is_active = true
    )
  );

-- Create helper functions for achievement management

-- Function to create a new achievement for a tournament
CREATE OR REPLACE FUNCTION create_tournament_achievement(
  p_tournament_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_type achievement_type,
  p_badge_icon TEXT DEFAULT '🏆',
  p_badge_color TEXT DEFAULT '#FFD700',
  p_criteria JSONB DEFAULT '{}',
  p_points INTEGER DEFAULT 10
)
RETURNS UUID AS $$
DECLARE
  new_achievement_id UUID;
BEGIN
  -- Check if user has permission to create achievements in this tournament
  IF NOT EXISTS (
    SELECT 1 FROM tournaments 
    WHERE id = p_tournament_id 
    AND created_by = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM tournament_members 
    WHERE tournament_id = p_tournament_id 
    AND user_id = auth.uid() 
    AND role IN ('owner', 'admin') 
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Permission denied: You can only create achievements in tournaments you own or admin';
  END IF;

  -- Create the achievement
  INSERT INTO achievements (
    tournament_id,
    name,
    description,
    type,
    badge_icon,
    badge_color,
    criteria,
    points,
    is_active
  ) VALUES (
    p_tournament_id,
    p_name,
    p_description,
    p_type,
    p_badge_icon,
    p_badge_color,
    p_criteria,
    p_points,
    true
  ) RETURNING id INTO new_achievement_id;

  RETURN new_achievement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update an existing achievement
CREATE OR REPLACE FUNCTION update_tournament_achievement(
  p_achievement_id UUID,
  p_name TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_badge_icon TEXT DEFAULT NULL,
  p_badge_color TEXT DEFAULT NULL,
  p_criteria JSONB DEFAULT NULL,
  p_points INTEGER DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  tournament_id_check UUID;
BEGIN
  -- Get the tournament_id for this achievement
  SELECT tournament_id INTO tournament_id_check 
  FROM achievements 
  WHERE id = p_achievement_id;

  IF tournament_id_check IS NULL THEN
    RAISE EXCEPTION 'Achievement not found';
  END IF;

  -- Check if user has permission to update achievements in this tournament
  IF NOT EXISTS (
    SELECT 1 FROM tournaments 
    WHERE id = tournament_id_check 
    AND created_by = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM tournament_members 
    WHERE tournament_id = tournament_id_check 
    AND user_id = auth.uid() 
    AND role IN ('owner', 'admin') 
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Permission denied: You can only update achievements in tournaments you own or admin';
  END IF;

  -- Update the achievement (only update fields that are not NULL)
  UPDATE achievements SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    badge_icon = COALESCE(p_badge_icon, badge_icon),
    badge_color = COALESCE(p_badge_color, badge_color),
    criteria = COALESCE(p_criteria, criteria),
    points = COALESCE(p_points, points),
    is_active = COALESCE(p_is_active, is_active),
    updated_at = NOW()
  WHERE id = p_achievement_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete an achievement (soft delete by setting is_active = false)
CREATE OR REPLACE FUNCTION delete_tournament_achievement(
  p_achievement_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  tournament_id_check UUID;
BEGIN
  -- Get the tournament_id for this achievement
  SELECT tournament_id INTO tournament_id_check 
  FROM achievements 
  WHERE id = p_achievement_id;

  IF tournament_id_check IS NULL THEN
    RAISE EXCEPTION 'Achievement not found';
  END IF;

  -- Check if user has permission to delete achievements in this tournament
  IF NOT EXISTS (
    SELECT 1 FROM tournaments 
    WHERE id = tournament_id_check 
    AND created_by = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM tournament_members 
    WHERE tournament_id = tournament_id_check 
    AND user_id = auth.uid() 
    AND role IN ('owner', 'admin') 
    AND is_active = true
  ) THEN
    RAISE EXCEPTION 'Permission denied: You can only delete achievements in tournaments you own or admin';
  END IF;

  -- Soft delete the achievement
  UPDATE achievements SET
    is_active = false,
    updated_at = NOW()
  WHERE id = p_achievement_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get achievements for a tournament (for management UI)
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
