-- Step 1: Add missing columns to achievements table
-- Run this first in your Supabase SQL Editor

-- Add missing columns to the achievements table
ALTER TABLE achievements 
ADD COLUMN IF NOT EXISTS achievement_type VARCHAR(50) DEFAULT 'score_based',
ADD COLUMN IF NOT EXISTS condition_type VARCHAR(50) DEFAULT 'score_threshold',
ADD COLUMN IF NOT EXISTS condition_value INTEGER DEFAULT 1;

-- Check if columns were added successfully
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'achievements' 
AND table_schema = 'public'
ORDER BY ordinal_position;
