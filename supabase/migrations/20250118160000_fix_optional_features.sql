-- Fix optional features identified in deploy tests

-- 1. Fix bracket tournaments foreign key constraint
-- The constraint name is incorrect, should reference auth.users not bracket_competitions
ALTER TABLE bracket_tournaments DROP CONSTRAINT IF EXISTS bracket_competitions_created_by_fkey;
ALTER TABLE bracket_tournaments ADD CONSTRAINT bracket_tournaments_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Add status column to tournaments table if missing
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft'
  CHECK (status IN ('draft', 'active', 'completed'));

-- Update existing tournaments to have draft status
UPDATE tournaments SET status = 'draft' WHERE status IS NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);

-- 3. Enable realtime for WebSocket connections
ALTER PUBLICATION supabase_realtime ADD TABLE scores;
ALTER PUBLICATION supabase_realtime ADD TABLE tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE bracket_tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE bracket_matches;