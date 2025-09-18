-- Fix bracket tournaments foreign key constraint issue
-- This constraint might have been created with the wrong name

-- First, check what constraints actually exist and remove any problematic ones
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- Find all foreign key constraints on bracket_tournaments.created_by
    FOR constraint_record IN
        SELECT constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'bracket_tournaments'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'created_by'
    LOOP
        -- Drop each constraint we find
        EXECUTE 'ALTER TABLE bracket_tournaments DROP CONSTRAINT IF EXISTS ' || constraint_record.constraint_name;
    END LOOP;

    -- Now add the correct constraint
    ALTER TABLE bracket_tournaments ADD CONSTRAINT bracket_tournaments_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

EXCEPTION WHEN OTHERS THEN
    -- If anything fails, just try to add the constraint
    BEGIN
        ALTER TABLE bracket_tournaments ADD CONSTRAINT bracket_tournaments_created_by_fkey
            FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
    EXCEPTION WHEN OTHERS THEN
        -- Constraint might already exist correctly
        NULL;
    END;
END $$;