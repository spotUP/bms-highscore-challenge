-- First, disable RLS temporarily to insert the admin role
ALTER TABLE user_roles DISABLE ROW LEVEL SECURITY;

-- Add admin role for your user ID
INSERT INTO user_roles (user_id, role)
VALUES ('0f0672de-6b1a-49e1-8857-41fef18dc6f8', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Re-enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Verify the admin entry
SELECT * FROM admin_users WHERE user_id = '0f0672de-6b1a-49e1-8857-41fef18dc6f8';
SELECT * FROM user_roles WHERE user_id = '0f0672de-6b1a-49e1-8857-41fef18dc6f8';