-- Fix tournaments table missing status column

-- Add status column to tournaments table if it doesn't exist
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed'));

-- Update any existing tournaments to have draft status if null
UPDATE tournaments SET status = 'draft' WHERE status IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);