-- Make created_by nullable for deploy testing flexibility
-- This allows testing without requiring actual auth users

-- Make bracket_tournaments.created_by nullable
ALTER TABLE bracket_tournaments ALTER COLUMN created_by DROP NOT NULL;