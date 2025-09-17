-- Update the specific tournament that was failing
UPDATE public.tournaments
SET
  start_time = '2025-09-16T05:00:00.000Z'::timestamp with time zone,
  end_time = '2025-10-09T20:00:00.000Z'::timestamp with time zone
WHERE id = 'd7840a88-008c-4a22-a522-01ca9e6eae6d';

-- Also update any tournament named "Default Arcade Tournament" just in case
UPDATE public.tournaments
SET
  start_time = '2025-09-16T05:00:00.000Z'::timestamp with time zone,
  end_time = '2025-10-09T20:00:00.000Z'::timestamp with time zone
WHERE name = 'Default Arcade Tournament' AND start_time IS NULL;