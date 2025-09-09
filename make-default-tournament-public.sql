-- Make the default tournament public for anonymous access
UPDATE public.tournaments
SET is_public = true
WHERE name = 'Default Arcade Tournament'
   OR slug = 'default-arcade';

-- Verify the change
SELECT id, name, slug, is_public, created_by
FROM public.tournaments
WHERE name = 'Default Arcade Tournament'
   OR slug = 'default-arcade';
