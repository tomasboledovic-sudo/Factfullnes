-- Jednorazovo v Supabase SQL Editor: stĺpec pre AI test z nahraného súboru
ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS generated_quiz JSONB;

COMMENT ON COLUMN file_metadata.generated_quiz IS 'Vygenerovaný test (JSON: questions, correctOption, description, …)';
