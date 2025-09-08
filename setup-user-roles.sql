-- Create user roles system
-- Run this in your Supabase SQL Editor

-- Create user_roles table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'moderator', 'user')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_roles.user_id = is_admin.user_id 
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
    user_role VARCHAR(50);
BEGIN
    SELECT role INTO user_role 
    FROM user_roles 
    WHERE user_roles.user_id = get_user_role.user_id;
    
    RETURN COALESCE(user_role, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_user_roles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_roles_updated_at ON user_roles;
CREATE TRIGGER trigger_update_user_roles_updated_at
    BEFORE UPDATE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_user_roles_updated_at();

-- Set up Row Level Security (RLS)
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own role
CREATE POLICY "Users can read own role" ON user_roles
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: Admins can read all roles
CREATE POLICY "Admins can read all roles" ON user_roles
    FOR SELECT
    USING (is_admin(auth.uid()));

-- Policy: Admins can insert/update/delete roles
CREATE POLICY "Admins can manage roles" ON user_roles
    FOR ALL
    USING (is_admin(auth.uid()));

-- Create initial admin user (replace with your email)
-- INSERT INTO user_roles (user_id, role) 
-- VALUES ((SELECT id FROM auth.users WHERE email = 'your-email@example.com'), 'admin')
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- Show current setup
SELECT 'User roles system created successfully!' as status;
SELECT COUNT(*) as total_users FROM auth.users;
SELECT role, COUNT(*) as count FROM user_roles GROUP BY role;
