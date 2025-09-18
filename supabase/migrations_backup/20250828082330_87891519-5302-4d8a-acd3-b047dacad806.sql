-- Fix Profile Data Exposure Security Issue
-- Remove the overly permissive policy that exposes all user data
DROP POLICY IF EXISTS "Usernames are viewable for leaderboards" ON public.profiles;

-- Create a secure function to get only usernames for leaderboards
-- This will be used if/when leaderboards move from localStorage to database
CREATE OR REPLACE FUNCTION public.get_public_username(user_uuid uuid)
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(username, 'Anonymous') 
  FROM public.profiles 
  WHERE user_id = user_uuid;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_public_username(uuid) TO authenticated;