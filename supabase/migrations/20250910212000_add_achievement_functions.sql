-- Function to find duplicate achievements
CREATE OR REPLACE FUNCTION find_duplicate_achievements()
RETURNS TABLE (
  name text,
  tournament_id uuid,
  count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.name,
    a.tournament_id,
    COUNT(*) as count
  FROM achievements a
  GROUP BY a.name, a.tournament_id
  HAVING COUNT(*) > 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add unique constraint if it doesn't exist
CREATE OR REPLACE FUNCTION add_achievement_name_constraint()
RETURNS void AS $$
BEGIN
  -- First drop the constraint if it exists
  IF EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'achievements_name_tournament_unique'
  ) THEN
    EXECUTE 'ALTER TABLE achievements DROP CONSTRAINT achievements_name_tournament_unique';
  END IF;
  
  -- Add the constraint
  EXECUTE 'ALTER TABLE achievements ADD CONSTRAINT achievements_name_tournament_unique UNIQUE (name, tournament_id)';
  
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error adding constraint: %', SQLERRM;
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
