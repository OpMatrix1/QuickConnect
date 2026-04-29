-- Migration v36: Use negotiated (settlement) amount in release/refund/confirm
-- notifications instead of always showing the original payment amount.
--
-- When settlement_proposed_amount IS NOT NULL AND both _agreed flags are TRUE,
-- the effective amount is the negotiated figure, not the original payment.amount.
-- Run after migration_v35.sql

-- ============================================================
-- Helper: pick effective amount
--   → settlement amount when both parties agreed to a settlement
--   → original payment amount otherwise
-- ============================================================
-- (Inlined per function — PostgreSQL doesn't allow scalar UDFs in a trigger
--  context as cleanly, so we inline the CASE expression.)


-- ============================================================
-- 1. Fix notify_payment_status_changed
--    (replaces the version from migration_v35)
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_payment_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id      UUID;
  v_provider_uid     UUID;
  v_provider_name    TEXT;
  v_customer_name    TEXT;
  v_effective_amount NUMERIC;
  v_price_fmt        TEXT;
  v_data_user        JSONB;
  v_data_admin       JSONB;
  v_is_dispute       BOOLEAN;
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

  -- Use negotiated amount if both parties agreed to a settlement,
  -- otherwise fall back to the original payment amount.
  v_effective_amount := CASE
    WHEN NEW.settlement_proposed_amount IS NOT NULL
         AND NEW.settlement_customer_agreed IS TRUE
         AND NEW.settlement_provider_agreed IS TRUE
    THEN NEW.settlement_proposed_amount
    ELSE NEW.amount
  END;

  v_price_fmt  := 'P' || trim(to_char(v_effective_amount, 'FM999,999,990.00'));
  v_is_dispute := NEW.dispute_initiated_by IS NOT NULL;
  v_data_user  := jsonb_build_object(
    'booking_id', NEW.booking_id::text,
    'path',       '/bookings?booking=' || NEW.booking_id::text
  );
  v_data_admin := jsonb_build_object(
    'payment_id', NEW.id::text,
    'booking_id', NEW.booking_id::text,
    'path',       '/admin/reports?payment=' || NEW.id::text
  );

  -- ── Dispute raised ────────────────────────────────────────────────────────
  IF NEW.status = 'disputed' THEN
    IF NEW.dispute_initiated_by = 'customer' THEN
      INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
        v_customer_id, 'payment_disputed', 'Dispute raised',
        format('You raised a dispute on the payment of %s. An admin will review both statements shortly.', v_price_fmt),
        v_data_user
      );
      INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
        v_provider_uid, 'payment_disputed', 'Dispute raised',
        format('%s raised a dispute on the payment of %s. Please add your statement so an admin can review.', v_customer_name, v_price_fmt),
        v_data_user
      );
    ELSE
      INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
        v_provider_uid, 'payment_disputed', 'Dispute raised',
        format('You raised a dispute on the payment of %s. An admin will review both statements shortly.', v_price_fmt),
        v_data_user
      );
      INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
        v_customer_id, 'payment_disputed', 'Dispute raised',
        format('%s raised a dispute on the payment of %s. Please add your statement so an admin can review.', v_provider_name, v_price_fmt),
        v_data_user
      );
    END IF;
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT p.id, 'payment_dispute', 'New dispute needs review',
           format('%s initiated a dispute on a payment of %s. Awaiting both statements.',
                  CASE WHEN NEW.dispute_initiated_by = 'customer' THEN v_customer_name ELSE v_provider_name END,
                  v_price_fmt),
           v_data_admin
    FROM public.profiles p WHERE p.role = 'admin';

  -- ── Payment released ──────────────────────────────────────────────────────
  ELSIF NEW.status = 'released' THEN
    IF v_is_dispute THEN
      INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
        v_customer_id, 'dispute_resolved', 'Dispute resolved',
        format('An admin reviewed the dispute and released %s to %s.', v_price_fmt, v_provider_name),
        v_data_user
      );
      INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
        v_provider_uid, 'dispute_resolved', 'Dispute resolved in your favor',
        format('%s has been released to your wallet following the admin''s decision.', v_price_fmt),
        v_data_user
      );
      INSERT INTO public.notifications (user_id, type, title, body, data)
      SELECT p.id, 'payment_dispute', 'Dispute closed — payment released',
             format('Dispute resolved: %s released to provider.', v_price_fmt),
             v_data_admin
      FROM public.profiles p WHERE p.role = 'admin';
    ELSE
      INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
        v_provider_uid, 'payment_released', 'Payment released',
        format('%s has been released to your wallet. Great work!', v_price_fmt),
        v_data_user
      );
    END IF;

  -- ── Payment refunded ──────────────────────────────────────────────────────
  ELSIF NEW.status = 'refunded' THEN
    IF v_is_dispute THEN
      INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
        v_customer_id, 'dispute_resolved', 'Dispute resolved in your favor',
        format('An admin reviewed the dispute and refunded %s to your wallet.', v_price_fmt),
        v_data_user
      );
      INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
        v_provider_uid, 'dispute_resolved', 'Dispute resolved',
        format('An admin reviewed the dispute and the payment of %s was refunded to the customer.', v_price_fmt),
        v_data_user
      );
      INSERT INTO public.notifications (user_id, type, title, body, data)
      SELECT p.id, 'payment_dispute', 'Dispute closed — payment refunded',
             format('Dispute resolved: %s refunded to customer.', v_price_fmt),
             v_data_admin
      FROM public.profiles p WHERE p.role = 'admin';
    ELSE
      INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
        v_customer_id, 'payment_refunded', 'Payment refunded',
        format('%s has been refunded to your wallet.', v_price_fmt),
        v_data_user
      );
    END IF;

  -- ── Payment held ──────────────────────────────────────────────────────────
  ELSIF NEW.status = 'held' THEN
    INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
      v_customer_id, 'payment_held', 'Payment held in escrow',
      format('%s is securely held in escrow and will be released when the job is complete.', v_price_fmt),
      v_data_user
    );
  END IF;

  RETURN NEW;
END;
$$;


-- ============================================================
-- 2. Fix notify_payment_confirm_pending (from migration_v33)
--    — show negotiated amount in the "please confirm satisfaction" message
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_payment_confirm_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id      UUID;
  v_provider_uid     UUID;
  v_provider_name    TEXT;
  v_customer_name    TEXT;
  v_effective_amount NUMERIC;
  v_price_fmt        TEXT;
  v_data             JSONB;
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

  v_effective_amount := CASE
    WHEN NEW.settlement_proposed_amount IS NOT NULL
         AND NEW.settlement_customer_agreed IS TRUE
         AND NEW.settlement_provider_agreed IS TRUE
    THEN NEW.settlement_proposed_amount
    ELSE NEW.amount
  END;

  v_price_fmt := 'P' || trim(to_char(v_effective_amount, 'FM999,999,990.00'));
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
      format('%s has confirmed the job is done and is waiting for you to confirm. Once you confirm, %s will be released. Tap to confirm.', v_provider_name, v_price_fmt),
      v_data
    );
  END IF;

  RETURN NEW;
END;
$$;
-- Trigger already wired from migration_v33; CREATE OR REPLACE is sufficient.
