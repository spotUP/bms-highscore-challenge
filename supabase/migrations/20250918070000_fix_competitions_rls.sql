-- Fix competitions table RLS policies to allow public read access

-- Enable RLS on competitions table
ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;

-- Allow public read access to competitions
CREATE POLICY IF NOT EXISTS "competitions_public_read"
ON competitions FOR SELECT
USING (true);

-- Also ensure tournaments table has proper RLS for public read
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "tournaments_public_read"
ON tournaments FOR SELECT
USING (true);