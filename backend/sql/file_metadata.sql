-- LearnFlow: metadáta nahraných súborov (ten istý Supabase projekt ako users/topics/sessions).
-- Spusti v SQL editore: https://supabase.com/dashboard/project/nvvffriomfiumwacgnan/sql

CREATE TABLE IF NOT EXISTS file_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users (id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_type TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_file_metadata_user_id ON file_metadata(user_id);

ALTER TABLE file_metadata DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE file_metadata IS 'Uploady používateľov; user_id = LearnFlow users.id';
COMMENT ON COLUMN file_metadata.user_id IS 'LearnFlow user id (JWT); NULL = starý záznam';

-- Ak tabuľka už existuje bez stĺpca: backend/sql/file-metadata-quiz-column.sql
-- generated_quiz JSONB  — AI test z nahraného súboru
