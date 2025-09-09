-- Add Demolition Man game to the database
-- This adds Demolition Man as a SPECIAL CASE game (not included in main challenge)

-- Check if Demolition Man already exists, if not insert it
DO $$
BEGIN
    -- Try to insert the Demolition Man game
    IF NOT EXISTS (
        SELECT 1 FROM games 
        WHERE name = 'Demolition Man' 
        AND tournament_id = '72e5cd46-2fab-4c20-bcd0-f4d84346ec26'
    ) THEN
        INSERT INTO games (
            name, 
            logo_url, 
            is_active, 
            include_in_challenge,
            tournament_id
        ) VALUES (
            'Demolition Man',
            'https://tnsgrwntmnzpaifmutqh.supabase.co/storage/v1/object/public/game-logos/demolition-man.png',
            true,
            false, -- FALSE = Not included in main 4-game challenge (special sidebar game only)
            '72e5cd46-2fab-4c20-bcd0-f4d84346ec26'
        );
    ELSE
        -- Update existing record
        UPDATE games SET
            logo_url = 'https://tnsgrwntmnzpaifmutqh.supabase.co/storage/v1/object/public/game-logos/demolition-man.png',
            is_active = true,
            include_in_challenge = false,
            updated_at = NOW()
        WHERE name = 'Demolition Man' 
        AND tournament_id = '72e5cd46-2fab-4c20-bcd0-f4d84346ec26';
    END IF;
END $$;

-- Verify the game was added
SELECT id, name, logo_url, is_active, include_in_challenge, tournament_id
FROM games 
WHERE name = 'Demolition Man' 
AND tournament_id = '72e5cd46-2fab-4c20-bcd0-f4d84346ec26';

SELECT 'Demolition Man game added successfully!' as status;
