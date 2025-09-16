-- Add user_id column to scores table to fix trigger errors
ALTER TABLE scores ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_scores_user_id ON scores(user_id);