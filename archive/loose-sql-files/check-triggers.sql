-- Check what triggers exist on the scores table
SELECT
  event_object_table,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'scores'
ORDER BY trigger_name;
