-- Apply RLS recursion fix with correct function overloads
CREATE OR REPLACE FUNCTION public.user_is_member(p_tournament_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_member boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_members tm
    WHERE tm.tournament_id = p_tournament_id
      AND tm.user_id = auth.uid()
      AND tm.is_active = true
  ) INTO is_member;
  RETURN is_member;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.user_is_member(uuid) TO authenticated;