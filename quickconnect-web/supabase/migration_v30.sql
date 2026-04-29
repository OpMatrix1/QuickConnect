-- Migration v30: Enable Realtime for additional tables so the UI can
-- subscribe to live updates without polling.
-- Run after migration_v29.sql

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.looking_for_posts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_transactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
