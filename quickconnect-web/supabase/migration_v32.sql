-- Migration v32: Comprehensive notifications for every key event in the
-- quotation, booking and payment lifecycle.
--
-- What this adds (existing coverage noted):
--   QUOTES
--     ✅ Already: customer notified when provider sends a quote (v24)
--     NEW: provider notified when customer creates a quote request (INSERT)
--     NEW: provider notified when customer accepts or rejects a quote (UPDATE)
--   LOOKING FOR RESPONSES
--     ✅ Already: customer notified when provider successfully submits a response (v26)
--     ✅ Already: customer notified when provider is blocked by insufficient funds (v29/v31)
--     NEW: provider notified when customer accepts or rejects their response (UPDATE)
--   BOOKINGS
--     NEW: both customer and provider notified when booking is created (INSERT)
--     NEW: customer notified on confirmed / in_progress / completed / cancelled
--     NEW: provider notified on completed / cancelled
--   PAYMENTS
--     NEW: customer notified when payment is held (escrow)
--     NEW: provider notified when payment is released
--     NEW: customer notified when payment is refunded
--     NEW: both notified when payment is disputed
-- Run after migration_v31.sql

-- ============================================================
-- QUOTES — provider notifications
-- ============================================================

-- 1. Provider: new quote request from customer
CREATE OR REPLACE FUNCTION public.notify_provider_quote_requested()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_name TEXT;
  v_desc_short    TEXT;
  v_provider_uid  UUID;
BEGIN
  SELECT COALESCE(full_name, 'A customer')
  INTO v_customer_name
  FROM public.profiles
  WHERE id = NEW.customer_id;

  SELECT sp.profile_id
  INTO v_provider_uid
  FROM public.service_providers sp
  WHERE sp.id = NEW.provider_id;

  v_desc_short := left(COALESCE(NEW.service_description, 'a service'), 80);

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_provider_uid,
    'quote_request',
    'New quote request',
    format('%s is requesting a quote for "%s".', v_customer_name, v_desc_short),
    jsonb_build_object('quote_id', NEW.id::text, 'path', '/quotes?quote=' || NEW.id::text)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotes_after_insert_notify_provider ON public.quotes;
CREATE TRIGGER trg_quotes_after_insert_notify_provider
  AFTER INSERT ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_provider_quote_requested();


-- 2. Provider: customer accepted or rejected the quote
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
  v_type          TEXT;
  v_title         TEXT;
  v_body          TEXT;
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
    v_type  := 'quote_accepted';
    v_title := 'Quote accepted!';
    v_body  := format('%s accepted your quote for "%s". A booking will be created shortly.', v_customer_name, v_desc_short);
  ELSE
    v_type  := 'quote_rejected';
    v_title := 'Quote declined';
    v_body  := format('%s declined your quote for "%s".', v_customer_name, v_desc_short);
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_provider_uid,
    v_type,
    v_title,
    v_body,
    jsonb_build_object('quote_id', NEW.id::text, 'path', '/quotes?quote=' || NEW.id::text)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotes_after_update_notify_provider ON public.quotes;
CREATE TRIGGER trg_quotes_after_update_notify_provider
  AFTER UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_provider_quote_decision();


-- ============================================================
-- LOOKING FOR RESPONSES — provider notified on accept / reject
-- ============================================================

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
  v_type          TEXT;
  v_title         TEXT;
  v_body          TEXT;
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
    v_type  := 'response_accepted';
    v_title := 'Quote accepted!';
    v_body  := format('%s accepted your quote for "%s". A booking has been created.', v_customer_name, left(COALESCE(v_post_desc, 'the job'), 80));
  ELSE
    v_type  := 'response_rejected';
    v_title := 'Quote declined';
    v_body  := format('%s declined your quote for "%s".', v_customer_name, left(COALESCE(v_post_desc, 'the job'), 80));
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_provider_uid,
    v_type,
    v_title,
    v_body,
    jsonb_build_object('post_id', v_post_id::text, 'path', '/looking-for/' || v_post_id::text)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_looking_for_responses_after_update_notify_provider ON public.looking_for_responses;
CREATE TRIGGER trg_looking_for_responses_after_update_notify_provider
  AFTER UPDATE ON public.looking_for_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_provider_response_decision();


-- ============================================================
-- BOOKINGS — creation + status changes
-- ============================================================

-- 3. Both parties: booking created
CREATE OR REPLACE FUNCTION public.notify_booking_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_name TEXT;
  v_provider_name TEXT;
  v_provider_uid  UUID;
  v_price_fmt     TEXT;
  v_path          TEXT;
BEGIN
  SELECT COALESCE(full_name, 'A customer')
  INTO v_customer_name
  FROM public.profiles
  WHERE id = NEW.customer_id;

  SELECT COALESCE(sp.business_name, p.full_name, 'Your provider'), sp.profile_id
  INTO v_provider_name, v_provider_uid
  FROM public.service_providers sp
  JOIN public.profiles p ON p.id = sp.profile_id
  WHERE sp.id = NEW.provider_id;

  v_price_fmt := 'P' || trim(to_char(NEW.agreed_price, 'FM999,999,990.00'));
  v_path      := '/bookings?booking=' || NEW.id::text;

  -- Customer
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.customer_id,
    'booking_created',
    'Booking created',
    format('Your booking with %s for %s is awaiting confirmation.', v_provider_name, v_price_fmt),
    jsonb_build_object('booking_id', NEW.id::text, 'path', v_path)
  );

  -- Provider
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    v_provider_uid,
    'booking_created',
    'New booking request',
    format('%s created a booking for %s. Confirm to proceed.', v_customer_name, v_price_fmt),
    jsonb_build_object('booking_id', NEW.id::text, 'path', v_path)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_after_insert_notify ON public.bookings;
CREATE TRIGGER trg_bookings_after_insert_notify
  AFTER INSERT ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_booking_created();


-- 4. Status-change notifications
CREATE OR REPLACE FUNCTION public.notify_booking_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_name TEXT;
  v_provider_name TEXT;
  v_provider_uid  UUID;
  v_price_fmt     TEXT;
  v_path          TEXT;
  v_data          JSONB;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, 'A customer')
  INTO v_customer_name
  FROM public.profiles
  WHERE id = NEW.customer_id;

  SELECT COALESCE(sp.business_name, p.full_name, 'Your provider'), sp.profile_id
  INTO v_provider_name, v_provider_uid
  FROM public.service_providers sp
  JOIN public.profiles p ON p.id = sp.profile_id
  WHERE sp.id = NEW.provider_id;

  v_price_fmt := 'P' || trim(to_char(NEW.agreed_price, 'FM999,999,990.00'));
  v_path      := '/bookings?booking=' || NEW.id::text;
  v_data      := jsonb_build_object('booking_id', NEW.id::text, 'path', v_path);

  IF NEW.status = 'confirmed' THEN
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
      NEW.customer_id, 'booking_confirmed', 'Booking confirmed',
      format('%s confirmed your booking. You''re all set!', v_provider_name),
      v_data
    );

  ELSIF NEW.status = 'in_progress' THEN
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
      NEW.customer_id, 'booking_in_progress', 'Work has started',
      format('%s has started work on your booking.', v_provider_name),
      v_data
    );

  ELSIF NEW.status = 'completed' THEN
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
      NEW.customer_id, 'booking_completed', 'Job completed',
      format('%s marked the job as complete. Please leave a review!', v_provider_name),
      v_data
    );
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
      v_provider_uid, 'booking_completed', 'Job marked complete',
      format('Your job for %s (%s) is complete. Payment will be released to your wallet shortly.', v_customer_name, v_price_fmt),
      v_data
    );

  ELSIF NEW.status = 'cancelled' THEN
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
      NEW.customer_id, 'booking_cancelled', 'Booking cancelled',
      format('Your booking with %s (%s) has been cancelled.', v_provider_name, v_price_fmt),
      v_data
    );
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
      v_provider_uid, 'booking_cancelled', 'Booking cancelled',
      format('The booking with %s (%s) has been cancelled.', v_customer_name, v_price_fmt),
      v_data
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_after_update_notify ON public.bookings;
CREATE TRIGGER trg_bookings_after_update_notify
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_booking_status_changed();


-- ============================================================
-- PAYMENTS — held / released / refunded / disputed
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_payment_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id   UUID;
  v_provider_uid  UUID;
  v_provider_name TEXT;
  v_customer_name TEXT;
  v_price_fmt     TEXT;
  v_data          JSONB;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT b.customer_id,
         COALESCE(sp.business_name, pp.full_name, 'Provider'), sp.profile_id,
         COALESCE(cp.full_name, 'Customer')
  INTO v_customer_id, v_provider_name, v_provider_uid, v_customer_name
  FROM public.bookings b
  JOIN public.service_providers sp ON sp.id = b.provider_id
  JOIN public.profiles pp ON pp.id = sp.profile_id
  JOIN public.profiles cp ON cp.id = b.customer_id
  WHERE b.id = NEW.booking_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_price_fmt := 'P' || trim(to_char(NEW.amount, 'FM999,999,990.00'));
  v_data := jsonb_build_object(
    'booking_id', NEW.booking_id::text,
    'path',       '/bookings?booking=' || NEW.booking_id::text
  );

  IF NEW.status = 'held' THEN
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
      v_customer_id, 'payment_held', 'Payment held in escrow',
      format('%s is securely held in escrow and will be released when the job is complete.', v_price_fmt),
      v_data
    );

  ELSIF NEW.status = 'released' THEN
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
      v_provider_uid, 'payment_released', 'Payment released',
      format('%s has been released to your wallet. Great work!', v_price_fmt),
      v_data
    );

  ELSIF NEW.status = 'refunded' THEN
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
      v_customer_id, 'payment_refunded', 'Payment refunded',
      format('%s has been refunded to your wallet.', v_price_fmt),
      v_data
    );

  ELSIF NEW.status = 'disputed' THEN
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
      v_customer_id, 'payment_disputed', 'Payment dispute raised',
      format('A dispute has been raised on your payment of %s. Our team will review it.', v_price_fmt),
      v_data
    );
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
      v_provider_uid, 'payment_disputed', 'Payment dispute raised',
      format('%s raised a dispute on the payment of %s. Our team will review it.', v_customer_name, v_price_fmt),
      v_data
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_after_update_notify ON public.payments;
CREATE TRIGGER trg_payments_after_update_notify
  AFTER UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_status_changed();
