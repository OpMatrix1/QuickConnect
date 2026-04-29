-- Migration v25: Enable Realtime on the notifications table so the bell
-- updates live when a DB trigger inserts a new notification row.
-- Run after migration_v24.sql

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
