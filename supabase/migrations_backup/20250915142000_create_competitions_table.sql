-- Create competitions table for proper competition lifecycle management

-- Create competition status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'competition_status') THEN
    CREATE TYPE competition_status AS ENUM ('scheduled', 'active', 'completed', 'cancelled');
  END IF;
END
$$;

-- Create competitions table
CREATE TABLE IF NOT EXISTS public.competitions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  start_time timestamp with time zone NOT NULL,
  end_time timestamp with time zone NOT NULL,
  status competition_status DEFAULT 'scheduled'::competition_status NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,

  -- Ensure end time is after start time
  CONSTRAINT competitions_end_after_start CHECK (end_time > start_time)
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_competitions_status ON public.competitions(status);
CREATE INDEX IF NOT EXISTS idx_competitions_start_time ON public.competitions(start_time);
CREATE INDEX IF NOT EXISTS idx_competitions_created_by ON public.competitions(created_by);

-- Enable RLS
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow authenticated users to view all competitions
DROP POLICY IF EXISTS "Allow authenticated users to view competitions" ON public.competitions;
CREATE POLICY "Allow authenticated users to view competitions"
ON public.competitions FOR SELECT
TO authenticated
USING (true);

-- Allow admins to manage competitions
DROP POLICY IF EXISTS "Allow admins to manage competitions" ON public.competitions;
CREATE POLICY "Allow admins to manage competitions"
ON public.competitions FOR ALL
TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role::text = 'admin'
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM public.user_roles WHERE role::text = 'admin'
  )
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_competitions_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_competitions_updated_at ON public.competitions;
CREATE TRIGGER update_competitions_updated_at
  BEFORE UPDATE ON public.competitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_competitions_updated_at();

-- Grant permissions
GRANT SELECT ON public.competitions TO authenticated;
GRANT ALL ON public.competitions TO authenticated;

-- Helper function to get current active competition
CREATE OR REPLACE FUNCTION public.get_current_competition()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  status competition_status,
  created_by uuid,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.description, c.start_time, c.end_time, c.status, c.created_by, c.created_at, c.updated_at
  FROM public.competitions c
  WHERE c.status = 'active'::competition_status
  ORDER BY c.start_time DESC
  LIMIT 1;
$$;

-- Helper function to start a competition
CREATE OR REPLACE FUNCTION public.start_competition(
  p_competition_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only administrators can start competitions';
  END IF;

  -- End any currently active competitions
  UPDATE public.competitions
  SET status = 'completed'::competition_status,
      updated_at = timezone('utc'::text, now())
  WHERE status = 'active'::competition_status;

  -- Start the specified competition
  UPDATE public.competitions
  SET status = 'active'::competition_status,
      start_time = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  WHERE id = p_competition_id;
END;
$$;

-- Helper function to end current competition
CREATE OR REPLACE FUNCTION public.end_current_competition()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role::text = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only administrators can end competitions';
  END IF;

  -- End current active competition
  UPDATE public.competitions
  SET status = 'completed'::competition_status,
      end_time = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  WHERE status = 'active'::competition_status;
END;
$$;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.get_current_competition() TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_competition(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_current_competition() TO authenticated;