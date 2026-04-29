-- migration_v39.sql
-- Add media support to messages (image / file attachments)
-- and create the chat-media storage bucket.

-- ── 1. Extend messages table ──────────────────────────────────────────────────

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'file')),
  ADD COLUMN IF NOT EXISTS media_url  TEXT,
  ADD COLUMN IF NOT EXISTS media_name TEXT;

-- ── 2. Storage bucket for chat media ─────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own files
CREATE POLICY "chat_media_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-media');

-- Anyone can read (images display inline)
CREATE POLICY "chat_media_select"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'chat-media');

-- Owner can delete their own uploads
CREATE POLICY "chat_media_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'chat-media' AND owner = auth.uid());
