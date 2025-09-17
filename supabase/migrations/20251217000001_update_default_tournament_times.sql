-- Update default arcade tournament with start and end times
UPDATE public.tournaments
SET
  start_time = NOW() - INTERVAL '7 days',
  end_time = NOW() + INTERVAL '30 days'
WHERE slug = 'default-arcade';

-- If no tournament with that slug exists, let's see what we have
-- This will help identify the correct tournament to update