-- Migration v33: "Waiting for your confirmation" notifications for every
-- dual-confirm step in the booking/payment lifecycle.
--
-- The pattern: when the FIRST party confirms, notify the OTHER party.
-- When BOTH have already confirmed the trigger skips (the status-change
-- trigger in v32 sends the final notification instead).
--
-- Steps covered:
--   1. Booking → "Ready to start" (customer_ready_in_progress / provider_ready_in_progress)
--   2. Booking → "Work done"      (customer_work_complete    / provider_work_complete)
--   3. Payment satisfaction       (payments.customer_confirmed / provider_confirmed)
--   4. Booking provider-confirms  (bookings.status → confirmed by provider)
--      Already sent by v32; no change needed.
--   5. Booking cancel (any party) → other party notified.
--      Already sent by v32 on status → cancelled; no change needed.
-- Run after migration_v32.sql

-- ============================================================
-- HELPER: names for both parties from a booking row
-- ============================================================
-- (inline in each function — keeps functions self-contained)

-- ============================================================
-- 1. "Ready to start work" — first party notifies the other
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_booking_ready_for_work_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_name TEXT;
  v_provider_name TEXT;
  v_provider_uid  UUID;
  v_path          TEXT;
  v_data          JSONB;
BEGIN
  v_path := '/bookings?booking=' || NEW.id::text;
  v_data := jsonb_build_object('booking_id', NEW.id::text, 'path', v_path);

  SELECT COALESCE(full_name, 'The customer')
  INTO v_customer_name
  FROM public.profiles WHERE id = NEW.customer_id;

  SELECT COALESCE(sp.business_name, p.full_name, 'The provider'), sp.profile_id
  INTO v_provider_name, v_provider_uid
  FROM public.service_providers sp
  JOIN public.profiles p ON p.id = sp.profile_id
  WHERE sp.id = NEW.provider_id;

  -- Customer just confirmed → notify provider (only if provider hasn't confirmed yet)
  IF NEW.customer_ready_in_progress IS TRUE
     AND (OLD.customer_ready_in_progress IS NOT TRUE)
     AND NEW.provider_ready_in_progress IS NOT TRUE
  THEN
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
      v_provider_uid,
      'booking_awaiting_start_confirm',
      'Confirm job start',
      format('%s has marked the job as ready to start and is waiting for you to confirm. Tap to confirm.', v_customer_name),
      v_data
    );
  END IF;

  -- Provider just confirmed → notify customer (only if customer hasn't confirmed yet)
  IF NEW.provider_ready_in_progress IS TRUE
     AND (OLD.provider_ready_in_progress IS NOT TRUE)
     AND NEW.customer_ready_in_progress IS NOT TRUE
  THEN
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
      NEW.customer_id,
      'booking_awaiting_start_confirm',
      'Confirm job start',
      format('%s has marked the job as ready to start and is waiting for you to confirm. Tap to confirm.', v_provider_name),
      v_data
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_ready_for_work_notify ON public.bookings;
CREATE TRIGGER trg_bookings_ready_for_work_notify
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_booking_ready_for_work_pending();


-- ============================================================
-- 2. "Work done" — first party notifies the other
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_booking_work_complete_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_name TEXT;
  v_provider_name TEXT;
  v_provider_uid  UUID;
  v_path          TEXT;
  v_data          JSONB;
BEGIN
  v_path := '/bookings?booking=' || NEW.id::text;
  v_data := jsonb_build_object('booking_id', NEW.id::text, 'path', v_path);

  SELECT COALESCE(full_name, 'The customer')
  INTO v_customer_name
  FROM public.profiles WHERE id = NEW.customer_id;

  SELECT COALESCE(sp.business_name, p.full_name, 'The provider'), sp.profile_id
  INTO v_provider_name, v_provider_uid
  FROM public.service_providers sp
  JOIN public.profiles p ON p.id = sp.profile_id
  WHERE sp.id = NEW.provider_id;

  -- Customer just confirmed work done → notify provider (only if provider hasn't yet)
  IF NEW.customer_work_complete IS TRUE
     AND (OLD.customer_work_complete IS NOT TRUE)
     AND NEW.provider_work_complete IS NOT TRUE
  THEN
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
      v_provider_uid,
      'booking_awaiting_complete_confirm',
      'Confirm job completion',
      format('%s has marked the job as complete and is waiting for you to confirm. Tap to confirm.', v_customer_name),
      v_data
    );
  END IF;

  -- Provider just confirmed work done → notify customer (only if customer hasn't yet)
  IF NEW.provider_work_complete IS TRUE
     AND (OLD.provider_work_complete IS NOT TRUE)
     AND NEW.customer_work_complete IS NOT TRUE
  THEN
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
      NEW.customer_id,
      'booking_awaiting_complete_confirm',
      'Confirm job completion',
      format('%s has marked the job as complete and is waiting for you to confirm. Tap to confirm.', v_provider_name),
      v_data
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_work_complete_notify ON public.bookings;
CREATE TRIGGER trg_bookings_work_complete_notify
  AFTER UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_booking_work_complete_pending();


-- ============================================================
-- 3. Payment satisfaction ("confirm & release escrow")
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_payment_confirm_pending()
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
  SELECT b.customer_id,
         COALESCE(sp.business_name, pp.full_name, 'The provider'), sp.profile_id,
         COALESCE(cp.full_name, 'The customer')
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

  -- Customer just confirmed satisfaction → notify provider (only if provider hasn't yet)
  IF NEW.customer_confirmed IS TRUE
     AND (OLD.customer_confirmed IS NOT TRUE)
     AND NEW.provider_confirmed IS NOT TRUE
  THEN
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
      v_provider_uid,
      'payment_awaiting_confirm',
      'Confirm payment release',
      format('%s has confirmed satisfaction and is waiting for you to confirm. Once you confirm, %s will be released to your wallet. Tap to confirm.', v_customer_name, v_price_fmt),
      v_data
    );
  END IF;

  -- Provider just confirmed satisfaction → notify customer (only if customer hasn't yet)
  IF NEW.provider_confirmed IS TRUE
     AND (OLD.provider_confirmed IS NOT TRUE)
     AND NEW.customer_confirmed IS NOT TRUE
  THEN
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
      v_customer_id,
      'payment_awaiting_confirm',
      'Confirm payment release',
      format('%s has confirmed the job is done and is waiting for you to confirm. Once you confirm, the payment of %s will be released. Tap to confirm.', v_provider_name, v_price_fmt),
      v_data
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_confirm_pending_notify ON public.payments;
CREATE TRIGGER trg_payments_confirm_pending_notify
  AFTER UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_confirm_pending();
