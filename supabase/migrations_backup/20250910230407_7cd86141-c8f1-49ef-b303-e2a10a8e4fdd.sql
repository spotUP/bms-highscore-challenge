-- Fix security issue: Enable RLS on webhook_config_backup table and restrict access to admins only

-- Enable Row Level Security on webhook_config_backup table
ALTER TABLE webhook_config_backup ENABLE ROW LEVEL SECURITY;

-- Create policy to allow only admins to view webhook config backups
CREATE POLICY "Only admins can view webhook config backups" 
ON webhook_config_backup FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
  )
);

-- Create policy to allow only admins to manage webhook config backups
CREATE POLICY "Only admins can manage webhook config backups" 
ON webhook_config_backup FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'::app_role
  )
);

-- Verify the policies are in place
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'webhook_config_backup'
ORDER BY policyname;