-- Realtime messaging: bump conversation activity, notify receiver via notifications table (bell + Realtime).
-- Run after prior migrations.

CREATE OR REPLACE FUNCTION public.on_message_insert_bump_and_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.receiver_id,
    'message',
    'New message',
    LEFT(NEW.content, 160),
    jsonb_build_object(
      'conversation_id', NEW.conversation_id,
      'message_id', NEW.id,
      'path', '/chat/' || NEW.conversation_id::text
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_after_insert_bump_notify ON public.messages;

CREATE TRIGGER trg_messages_after_insert_bump_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.on_message_insert_bump_and_notify();

-- Enable Realtime for messages + quotes (required for postgres_changes in the app).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
