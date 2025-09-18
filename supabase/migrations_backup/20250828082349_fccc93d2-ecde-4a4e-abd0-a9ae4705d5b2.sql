-- Fix remaining security warnings from the linter
-- 1. Fix search path for existing functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- 2. Fix search path for update function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- 3. Fix search path for username function
CREATE OR REPLACE FUNCTION public.get_public_username(user_uuid uuid)
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(username, 'Anonymous') 
  FROM public.profiles 
  WHERE user_id = user_uuid;
$$;