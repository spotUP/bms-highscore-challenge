-- Allow anyone to submit scores (not just admins)
DROP POLICY IF EXISTS "Admins can create scores" ON public.scores;

CREATE POLICY "Anyone can create scores" 
ON public.scores 
FOR INSERT 
WITH CHECK (true);