-- Ak už máš staršiu tabuľku file_metadata bez stĺpca user_id, spusti toto.
-- Pre nový projekt stačí backend/sql/file_metadata.sql

ALTER TABLE file_metadata
  ADD COLUMN IF NOT EXISTS user_id UUID;

CREATE INDEX IF NOT EXISTS idx_file_metadata_user_id ON file_metadata(user_id);

COMMENT ON COLUMN file_metadata.user_id IS 'LearnFlow user id (JWT userId); NULL = legacy záznam bez vlastníka';
