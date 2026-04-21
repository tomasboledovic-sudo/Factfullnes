-- Oprava: FK na auth.users bráni uploadu — Factfulness používa public.users (email/heslo), nie Supabase Auth.
-- Spusti v Supabase → SQL Editor (jednorazovo).

ALTER TABLE file_metadata
  DROP CONSTRAINT IF EXISTS file_metadata_user_id_fkey;

ALTER TABLE file_metadata
  ADD CONSTRAINT file_metadata_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES public.users (id)
  ON DELETE CASCADE;

COMMENT ON CONSTRAINT file_metadata_user_id_fkey ON file_metadata IS
  'Vlastník súboru = riadok v public.users (rovnaký id ako v JWT).';
