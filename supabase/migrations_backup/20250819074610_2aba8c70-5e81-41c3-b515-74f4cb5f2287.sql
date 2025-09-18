-- Add the missing role column to user_roles table
ALTER TABLE public.user_roles ADD COLUMN role app_role NOT NULL DEFAULT 'user';

-- Recreate the unique constraint
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);