-- migration_v38.sql
-- Route "quote_accepted" notifications to My Bookings (not the Quotes page).
-- Also fixes the body text to say "A booking has been created." consistently.

CREATE OR REPLACE FUNCTION public.notify_provider_quote_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_name TEXT;
  v_desc_short    TEXT;
  v_provider_uid  UUID;
  v_booking_id    UUID;
  v_type          TEXT;
  v_title         TEXT;
  v_body          TEXT;
  v_data          JSONB;
BEGIN
  IF NEW.status NOT IN ('accepted', 'rejected') THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, 'A customer')
  INTO v_customer_name
  FROM public.profiles
  WHERE id = NEW.customer_id;

  SELECT sp.profile_id
  INTO v_provider_uid
  FROM public.service_providers sp
  WHERE sp.id = NEW.provider_id;

  v_desc_short := left(COALESCE(NEW.service_description, 'your service'), 80);

  IF NEW.status = 'accepted' THEN
    -- Look up the booking created from this quote
    SELECT id INTO v_booking_id
    FROM public.bookings
    WHERE quote_id = NEW.id
    ORDER BY created_at DESC
    LIMIT 1;

    v_type  := 'quote_accepted';
    v_title := 'Quote accepted!';
    v_body  := format(
      '%s accepted your quote for "%s". A booking has been created.',
      v_customer_name, v_desc_short
    );

    IF v_booking_id IS NOT NULL THEN
      v_data := jsonb_build_object(
        'quote_id',   NEW.id::text,
        'booking_id', v_booking_id::text,
        'path',       '/bookings?booking=' || v_booking_id::text
      );
    ELSE
      -- Booking not yet committed — fall back to My Bookings list
      v_data := jsonb_build_object(
        'quote_id', NEW.id::text,
        'path',     '/bookings'
      );
    END IF;
  ELSE
    v_type  := 'quote_rejected';
    v_title := 'Quote declined';
    v_body  := format('%s declined your quote for "%s".', v_customer_name, v_desc_short);
    v_data  := jsonb_build_object(
      'quote_id', NEW.id::text,
      'path',     '/quotes?quote=' || NEW.id::text
    );
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (v_provider_uid, v_type, v_title, v_body, v_data);

  RETURN NEW;
END;
$$;

-- Trigger already exists from migration_v32; recreate to pick up new function body
DROP TRIGGER IF EXISTS trg_quotes_after_update_notify_provider ON public.quotes;
CREATE TRIGGER trg_quotes_after_update_notify_provider
  AFTER UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_provider_quote_decision();
