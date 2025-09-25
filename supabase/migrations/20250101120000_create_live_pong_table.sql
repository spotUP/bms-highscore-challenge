-- Create live_pong table for real-time multiplayer Pong
CREATE TABLE IF NOT EXISTS live_pong (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id TEXT NOT NULL DEFAULT 'main',
  game_state JSONB NOT NULL DEFAULT '{}',
  player_left_id TEXT,
  player_right_id TEXT,
  last_updated_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on room_id for faster queries
CREATE INDEX IF NOT EXISTS live_pong_room_id_idx ON live_pong(room_id);

-- Enable RLS (Row Level Security)
ALTER TABLE live_pong ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for now (can be restricted later)
CREATE POLICY "Allow all operations on live_pong" ON live_pong
  FOR ALL USING (true)
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_live_pong_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE OR REPLACE TRIGGER update_live_pong_updated_at_trigger
  BEFORE UPDATE ON live_pong
  FOR EACH ROW
  EXECUTE FUNCTION update_live_pong_updated_at();

-- Insert default room if it doesn't exist
INSERT INTO live_pong (room_id, game_state, player_left_id, player_right_id)
VALUES ('main', '{}', NULL, NULL)
ON CONFLICT DO NOTHING;