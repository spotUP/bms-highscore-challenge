-- Create scores table
CREATE TABLE public.scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_name TEXT NOT NULL CHECK (LENGTH(player_name) <= 3),
  score INTEGER NOT NULL CHECK (score >= 0),
  game_id UUID NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

-- Create policies for scores access
CREATE POLICY "Scores are viewable by everyone" 
ON public.scores 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can create scores" 
ON public.scores 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.role = 'admin'::app_role
));

CREATE POLICY "Admins can update scores" 
ON public.scores 
FOR UPDATE 
USING (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.role = 'admin'::app_role
));

CREATE POLICY "Admins can delete scores" 
ON public.scores 
FOR DELETE 
USING (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.role = 'admin'::app_role
));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_scores_updated_at
BEFORE UPDATE ON public.scores
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for game logos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('game-logos', 'game-logos', true);

-- Create storage policies for game logos
CREATE POLICY "Game logos are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'game-logos');

CREATE POLICY "Admins can upload game logos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'game-logos' 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'::app_role
  )
);

CREATE POLICY "Admins can update game logos" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'game-logos' 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'::app_role
  )
);

CREATE POLICY "Admins can delete game logos" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'game-logos' 
  AND EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'::app_role
  )
);