ALTER TABLE games_database
ADD COLUMN IF NOT EXISTS launchbox_id integer;

CREATE INDEX IF NOT EXISTS idx_games_database_launchbox_id
  ON games_database (launchbox_id);
