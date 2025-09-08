-- Check what enum values are available for the type column
-- Run this in your Supabase SQL Editor

-- Check what enum values exist
SELECT unnest(enum_range(NULL::achievement_type)) as type_values;

-- Also check what values are currently being used in the achievements table
SELECT DISTINCT type FROM achievements;
