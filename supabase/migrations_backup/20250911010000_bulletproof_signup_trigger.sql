-- Bulletproof signup trigger that never fails and logs errors instead of blocking signup

-- Create a simple log table for debugging trigger issues (optional)
CREATE TABLE IF NOT EXISTS public.signup_trigger_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Bulletproof handle_new_user function that never throws
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Wrap everything in exception handling so signup never fails
  BEGIN
    -- Try to insert/update profile
    INSERT INTO public.profiles (user_id, full_name, username)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
      COALESCE(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1))
    )
    ON CONFLICT (user_id) DO UPDATE
    SET full_name = EXCLUDED.full_name,
        username = EXCLUDED.username;

  EXCEPTION WHEN others THEN
    -- Log the error but don't fail signup
    INSERT INTO public.signup_trigger_logs (user_id, error_message)
    VALUES (NEW.id, 'Profile insert failed: ' || SQLERRM)
    ON CONFLICT DO NOTHING;
  END;

  -- Try to insert default role
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (
      NEW.id,
      CASE
        WHEN (SELECT COUNT(*) FROM auth.users) = 1 THEN 'admin'::public.app_role
        ELSE 'user'::public.app_role
      END
    )
    ON CONFLICT (user_id, role) DO NOTHING;

  EXCEPTION WHEN others THEN
    -- Log the error but don't fail signup
    INSERT INTO public.signup_trigger_logs (user_id, error_message)
    VALUES (NEW.id, 'Role insert failed: ' || SQLERRM)
    ON CONFLICT DO NOTHING;
  END;

  -- Always return NEW so signup succeeds
  RETURN NEW;
END;
$$;

-- Ensure function is owned by postgres for SECURITY DEFINER
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Recreate trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
