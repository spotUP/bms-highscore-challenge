-- Quick fix for player_stats RLS issue
-- Run this in Supabase SQL Editor

-- Add current user as owner of BMS Highscore Challenge tournament
INSERT INTO tournament_members (tournament_id, user_id, role, is_active)
SELECT
  t.id as tournament_id,
  '6a5550ca-ec3e-413d-9a9b-e20ec827f045' as user_id,
  'owner'::tournament_role as role,
  true as is_active
FROM tournaments t
WHERE t.slug = 'bms-highscore-challenge'
  AND NOT EXISTS (
    SELECT 1 FROM tournament_members tm
    WHERE tm.tournament_id = t.id
    AND tm.user_id = '6a5550ca-ec3e-413d-9a9b-e20ec827f045'
  );

-- Verify the fix worked
SELECT
  tm.role,
  tm.is_active,
  t.name as tournament_name,
  tm.created_at
FROM tournament_members tm
JOIN tournaments t ON tm.tournament_id = t.id
WHERE tm.user_id = '6a5550ca-ec3e-413d-9a9b-e20ec827f045';
