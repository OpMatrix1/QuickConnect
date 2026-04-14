-- Enable Realtime for bookings (live status updates in the app).
-- Run after prior migrations.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
