-- Critical Security Fix: Add comprehensive RLS policies for user_roles table
-- This prevents unauthorized privilege escalation

-- Policy: Only allow admins to grant admin roles to other users
CREATE POLICY "Only admins can grant admin roles" 
ON public.user_roles 
FOR INSERT 
WITH CHECK (
  CASE 
    WHEN role = 'admin'::app_role THEN
      EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'admin'::app_role
      )
    ELSE true
  END
);

-- Policy: Only allow admins to modify roles
CREATE POLICY "Only admins can modify roles" 
ON public.user_roles 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  )
);

-- Policy: Only allow admins to delete roles
CREATE POLICY "Only admins can delete roles" 
ON public.user_roles 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  )
);

-- Add constraints for input validation
ALTER TABLE public.scores 
ADD CONSTRAINT score_positive CHECK (score >= 0),
ADD CONSTRAINT score_reasonable CHECK (score <= 999999999);

ALTER TABLE public.scores 
ADD CONSTRAINT player_name_length CHECK (length(trim(player_name)) >= 1 AND length(trim(player_name)) <= 50);

-- Add constraint to prevent multiple admin roles per user
ALTER TABLE public.user_roles 
ADD CONSTRAINT unique_user_role UNIQUE (user_id, role);

-- Create audit log table for role changes
CREATE TABLE public.role_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  old_role app_role,
  new_role app_role,
  action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.role_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Only admins can view audit logs" 
ON public.role_audit_log 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  )
);

-- Create trigger function for audit logging
CREATE OR REPLACE FUNCTION public.log_role_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.role_audit_log (user_id, changed_by, new_role, action)
    VALUES (NEW.user_id, auth.uid(), NEW.role, 'INSERT');
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.role_audit_log (user_id, changed_by, old_role, new_role, action)
    VALUES (NEW.user_id, auth.uid(), OLD.role, NEW.role, 'UPDATE');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.role_audit_log (user_id, changed_by, old_role, action)
    VALUES (OLD.user_id, auth.uid(), OLD.role, 'DELETE');
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for audit logging
CREATE TRIGGER role_changes_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_role_changes();

-- Enhanced storage policies for file upload security
-- Drop existing policies and recreate with better security
DROP POLICY IF EXISTS "Users can upload game logos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload game logos" ON storage.objects;

-- More restrictive logo upload policy
CREATE POLICY "Secure admin logo uploads" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'game-logos' AND
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  ) AND
  (storage.filename(name) ~* '\.(jpg|jpeg|png|gif|webp)$') AND
  length(name) < 200
);

-- Add rate limiting table for score submissions
CREATE TABLE public.score_submission_rate_limit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address INET,
  user_id UUID,
  submission_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on rate limit table
ALTER TABLE public.score_submission_rate_limit ENABLE ROW LEVEL SECURITY;

-- Users can view their own rate limit data
CREATE POLICY "Users can view own rate limits" 
ON public.score_submission_rate_limit 
FOR SELECT 
USING (user_id = auth.uid());

-- Create function to check rate limits
CREATE OR REPLACE FUNCTION public.check_score_submission_rate_limit()
RETURNS BOOLEAN AS $$
DECLARE
  current_count INTEGER;
  window_start_time TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Check submissions in the last hour
  window_start_time := now() - INTERVAL '1 hour';
  
  SELECT COUNT(*) INTO current_count
  FROM public.scores
  WHERE created_at >= window_start_time
  AND EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid()
  );
  
  -- Allow up to 10 submissions per hour for regular users
  -- Unlimited for admins
  IF EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'::app_role
  ) THEN
    RETURN TRUE;
  END IF;
  
  RETURN current_count < 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;