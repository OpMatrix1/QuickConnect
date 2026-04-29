-- Migration v34:
-- 1. Fix "job completed" notification body — payment is NOT released at this
--    point; it releases after both parties confirm satisfaction (v33 step).
-- 2. Add notifications for the negotiation (settlement) phase:
--      a. One party proposes a settlement amount  → other party notified
--      b. Other party agrees to the settlement    → proposer notified
--      c. Both agreed                             → both notified to now
--                                                   confirm satisfaction
-- Run after migration_v33.sql

-- ============================================================
-- 1. Fix notify_booking_status_changed — completed messages
-- ============================================================
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
    -- Payment is NOT released here — it releases only after both confirm satisfaction.
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
      NEW.customer_id, 'booking_completed', 'Job marked complete',
      format('%s has marked the job as complete. Please confirm satisfaction so %s can be released.', v_provider_name, v_price_fmt),
      v_data
    );
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
      v_provider_uid, 'booking_completed', 'Job marked complete',
      format('The job for %s is complete. Confirm satisfaction with the customer — %s will be added to your wallet once both parties confirm.', v_customer_name, v_price_fmt),
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

-- The trigger already exists from v32 (DROP IF EXISTS + CREATE), so no re-wiring needed
-- unless the function body needs re-registering (it does via CREATE OR REPLACE above).


-- ============================================================
-- 2. Settlement (negotiation) notifications
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_payment_settlement()
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
  v_amount_fmt    TEXT;
  v_data          JSONB;
  v_both_agreed   BOOLEAN;
  v_both_agreed_before BOOLEAN;
BEGIN
  -- Skip rows where booking_id is missing
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

  v_data := jsonb_build_object(
    'booking_id', NEW.booking_id::text,
    'path',       '/bookings?booking=' || NEW.booking_id::text
  );

  -- ── A. New settlement proposed ─────────────────────────────────────────────
  -- Fires when settlement_proposed_amount changes to a non-null value
  -- (covers both a brand-new proposal and a revised proposal)
  IF NEW.settlement_proposed_amount IS NOT NULL
     AND NEW.settlement_proposed_amount IS DISTINCT FROM OLD.settlement_proposed_amount
  THEN
    v_amount_fmt := 'P' || trim(to_char(NEW.settlement_proposed_amount, 'FM999,999,990.00'));

    IF NEW.settlement_proposed_by = 'customer' THEN
      -- Notify provider
      INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
        v_provider_uid,
        'settlement_proposed',
        'Settlement proposed',
        format('%s has proposed a revised settlement of %s. Tap to review and accept or decline.', v_customer_name, v_amount_fmt),
        v_data
      );
    ELSIF NEW.settlement_proposed_by = 'provider' THEN
      -- Notify customer
      INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
        v_customer_id,
        'settlement_proposed',
        'Settlement proposed',
        format('%s has proposed a settlement of %s. Tap to review and accept or decline.', v_provider_name, v_amount_fmt),
        v_data
      );
    END IF;
  END IF;

  -- ── B. Settlement agreed by the other party ────────────────────────────────
  v_both_agreed        := NEW.settlement_customer_agreed  IS TRUE AND NEW.settlement_provider_agreed  IS TRUE;
  v_both_agreed_before := OLD.settlement_customer_agreed  IS TRUE AND OLD.settlement_provider_agreed  IS TRUE;

  IF v_both_agreed AND NOT v_both_agreed_before
     AND NEW.settlement_proposed_amount IS NOT NULL
  THEN
    v_amount_fmt := 'P' || trim(to_char(NEW.settlement_proposed_amount, 'FM999,999,990.00'));

    -- Notify both parties — settlement is locked in, now they each confirm satisfaction
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
      v_customer_id,
      'settlement_agreed',
      'Settlement agreed',
      format('Both parties have agreed to the settlement of %s. Confirm satisfaction to release the payment. Tap to confirm.', v_amount_fmt),
      v_data
    );
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
      v_provider_uid,
      'settlement_agreed',
      'Settlement agreed',
      format('Both parties have agreed to the settlement of %s. Confirm satisfaction to receive %s in your wallet. Tap to confirm.', v_amount_fmt, v_amount_fmt),
      v_data
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_settlement_notify ON public.payments;
CREATE TRIGGER trg_payments_settlement_notify
  AFTER UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_payment_settlement();
