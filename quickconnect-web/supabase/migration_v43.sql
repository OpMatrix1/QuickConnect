-- migration_v43.sql
-- Fix "Quote accepted!" notification for looking-for responses:
-- route provider to My Bookings (the created booking) instead of the post.

CREATE OR REPLACE FUNCTION public.notify_provider_response_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_name TEXT;
  v_post_id       UUID;
  v_post_desc     TEXT;
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

  SELECT lfp.id, lfp.description,
         COALESCE(pr.full_name, 'The customer')
  INTO v_post_id, v_post_desc, v_customer_name
  FROM public.looking_for_posts lfp
  JOIN public.profiles pr ON pr.id = lfp.customer_id
  WHERE lfp.id = NEW.post_id;

  SELECT sp.profile_id
  INTO v_provider_uid
  FROM public.service_providers sp
  WHERE sp.id = NEW.provider_id;

  IF NEW.status = 'accepted' THEN
    -- Look up the booking created from this response
    SELECT id INTO v_booking_id
    FROM public.bookings
    WHERE looking_for_response_id = NEW.id
    ORDER BY created_at DESC
    LIMIT 1;

    v_type  := 'response_accepted';
    v_title := 'Quote accepted!';
    v_body  := format(
      '%s accepted your quote for "%s". A booking has been created.',
      v_customer_name, left(COALESCE(v_post_desc, 'the job'), 80)
    );

    IF v_booking_id IS NOT NULL THEN
      v_data := jsonb_build_object(
        'post_id',    v_post_id::text,
        'booking_id', v_booking_id::text,
        'path',       '/bookings?booking=' || v_booking_id::text
      );
    ELSE
      -- Booking not yet committed — fall back to My Bookings list
      v_data := jsonb_build_object(
        'post_id', v_post_id::text,
        'path',    '/bookings'
      );
    END IF;
  ELSE
    v_type  := 'response_rejected';
    v_title := 'Quote declined';
    v_body  := format('%s declined your quote for "%s".', v_customer_name, left(COALESCE(v_post_desc, 'the job'), 80));
    v_data  := jsonb_build_object(
      'post_id', v_post_id::text,
      'path',    '/looking-for/' || v_post_id::text
    );
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (v_provider_uid, v_type, v_title, v_body, v_data);

  RETURN NEW;
END;
$$;

-- Recreate trigger to pick up updated function
DROP TRIGGER IF EXISTS trg_looking_for_responses_after_update_notify_provider ON public.looking_for_responses;
CREATE TRIGGER trg_looking_for_responses_after_update_notify_provider
  AFTER UPDATE ON public.looking_for_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_provider_response_decision();
