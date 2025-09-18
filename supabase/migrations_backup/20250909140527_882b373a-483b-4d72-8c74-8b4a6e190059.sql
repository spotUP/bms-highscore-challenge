-- Enable RLS on all tables that don't have it
-- Fix critical security issues

-- Enable RLS on competition_history table
ALTER TABLE competition_history ENABLE ROW LEVEL SECURITY;

-- Enable RLS on competition_games table  
ALTER TABLE competition_games ENABLE ROW LEVEL SECURITY;

-- Enable RLS on competition_players table
ALTER TABLE competition_players ENABLE ROW LEVEL SECURITY;

-- Enable RLS on competition_scores table
ALTER TABLE competition_scores ENABLE ROW LEVEL SECURITY;

-- Add security definer to all functions without SET search_path
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = is_admin.user_id 
        AND role = 'admin'
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS character varying
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    user_role VARCHAR(50);
BEGIN
    SELECT role INTO user_role 
    FROM user_roles 
    WHERE user_roles.user_id = get_user_role.user_id;
    
    RETURN COALESCE(user_role, 'user');
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_username(user_uuid uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COALESCE(username, 'Anonymous') 
  FROM public.profiles 
  WHERE user_id = user_uuid;
$function$;

CREATE OR REPLACE FUNCTION public.update_user_roles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, username)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'username'
  );
  
  -- Give admin role to first user, regular user role to others
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    CASE 
      WHEN (SELECT COUNT(*) FROM auth.users) = 1 THEN 'admin'::public.app_role
      ELSE 'user'::public.app_role
    END
  );
  
  RETURN NEW;
END;
$function$;