-- Fix remaining optional feature issues

-- 1. Fix bracket tournaments - check actual constraint name and fix if needed
-- First, let's see what constraints exist and fix them
DO $$
BEGIN
    -- Drop any existing foreign key constraints on created_by
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'bracket_tournaments_created_by_fkey'
        AND table_name = 'bracket_tournaments'
    ) THEN
        ALTER TABLE bracket_tournaments DROP CONSTRAINT bracket_tournaments_created_by_fkey;
    END IF;

    -- Add the correct foreign key constraint
    ALTER TABLE bracket_tournaments ADD CONSTRAINT bracket_tournaments_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

-- 2. Add slug column to tournaments table
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS slug TEXT;

-- Generate slugs for existing tournaments based on name
UPDATE tournaments
SET slug = LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9\s]', '', 'g'), '\s+', '-', 'g'))
WHERE slug IS NULL;

-- Make slug NOT NULL after populating existing records
ALTER TABLE tournaments ALTER COLUMN slug SET NOT NULL;

-- Add unique constraint on slug
ALTER TABLE tournaments ADD CONSTRAINT tournaments_slug_unique UNIQUE (slug);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_tournaments_slug ON tournaments(slug);