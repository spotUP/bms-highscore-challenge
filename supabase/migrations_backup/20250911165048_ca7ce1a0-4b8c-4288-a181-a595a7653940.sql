-- Enable RLS on tables that currently have it disabled

-- Enable RLS on achievements_backup_20240910
ALTER TABLE public.achievements_backup_20240910 ENABLE ROW LEVEL SECURITY;

-- Enable RLS on signup_trigger_logs  
ALTER TABLE public.signup_trigger_logs ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for achievements_backup_20240910
-- Only admins should be able to access backup data
CREATE POLICY "Only admins can access achievement backups"
ON public.achievements_backup_20240910
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::public.app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::public.app_role
  )
);

-- Add RLS policies for signup_trigger_logs
-- Only admins should be able to access system logs
CREATE POLICY "Only admins can access signup trigger logs"
ON public.signup_trigger_logs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::public.app_role
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::public.app_role
  )
);

-- Allow system triggers to insert into signup_trigger_logs
CREATE POLICY "System can insert signup trigger logs"
ON public.signup_trigger_logs
FOR INSERT
TO service_role
WITH CHECK (true);