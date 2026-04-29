-- Migration v35: Complete dispute notification coverage
--
-- Fixes & additions:
--   1. Fix notify_payment_status_changed — 'disputed' wording now varies by
--      who raised it; 'released'/'refunded' now mention dispute context when
--      dispute_initiated_by is set.
--   2. Statement-submitted notifications — when either party adds their
--      dispute statement, the other party and all admins are notified.
--      When both statements are present, admins get a "ready for review" ping.
--   3. admin_dispute_debit_customer — now notifies the customer and all admins.
-- Run after migration_v34.sql

-- ============================================================
-- 1. Fix notify_payment_status_changed
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
  v_data_user     JSONB;
  v_data_admin    JSONB;
  v_is_dispute    BOOLEAN;
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

  v_price_fmt  := 'P' || trim(to_char(NEW.amount, 'FM999,999,990.00'));
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

    -- Notify all admins
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT p.id,
           'payment_dispute',
           'New dispute needs review',
           format('%s initiated a dispute on a payment of %s. Awaiting both statements.', 
                  CASE WHEN NEW.dispute_initiated_by = 'customer' THEN v_customer_name ELSE v_provider_name END,
                  v_price_fmt),
           v_data_admin
    FROM public.profiles p
    WHERE p.role = 'admin';

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
             format('Dispute on %s resolved: payment released to provider.', v_price_fmt),
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
             format('Dispute on %s resolved: payment refunded to customer.', v_price_fmt),
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
-- Trigger already wired from v32; CREATE OR REPLACE of function is sufficient.


-- ============================================================
-- 2. Dispute statement submitted — notify other party + admins
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_dispute_statement_submitted()
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
  v_data_user     JSONB;
  v_data_admin    JSONB;
  v_both_now      BOOLEAN;
BEGIN
  -- Only act on disputed payments
  IF NEW.status <> 'disputed' THEN
    RETURN NEW;
  END IF;

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

  v_price_fmt  := 'P' || trim(to_char(NEW.amount, 'FM999,999,990.00'));
  v_data_user  := jsonb_build_object(
    'booking_id', NEW.booking_id::text,
    'path',       '/bookings?booking=' || NEW.booking_id::text
  );
  v_data_admin := jsonb_build_object(
    'payment_id', NEW.id::text,
    'booking_id', NEW.booking_id::text,
    'path',       '/admin/reports?payment=' || NEW.id::text
  );

  v_both_now := NEW.dispute_customer_statement IS NOT NULL
             AND NEW.dispute_provider_statement IS NOT NULL;

  -- ── Customer just added their statement ──────────────────────────────────
  IF NEW.dispute_customer_statement IS NOT NULL
     AND OLD.dispute_customer_statement IS NULL
  THEN
    -- Notify provider (only if they haven't submitted yet)
    IF NEW.dispute_provider_statement IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
        v_provider_uid, 'dispute_statement', 'Customer submitted their statement',
        format('%s has submitted their statement for the %s dispute. Add your statement so the admin can review both sides. Tap to open.', v_customer_name, v_price_fmt),
        v_data_user
      );
    END IF;
    -- Notify admins
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT p.id, 'payment_dispute', 'Dispute statement received',
           format('%s submitted their statement for the %s dispute.', v_customer_name, v_price_fmt),
           v_data_admin
    FROM public.profiles p WHERE p.role = 'admin';
  END IF;

  -- ── Provider just added their statement ──────────────────────────────────
  IF NEW.dispute_provider_statement IS NOT NULL
     AND OLD.dispute_provider_statement IS NULL
  THEN
    -- Notify customer (only if they haven't submitted yet)
    IF NEW.dispute_customer_statement IS NULL THEN
      INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
        v_customer_id, 'dispute_statement', 'Provider submitted their statement',
        format('%s has submitted their statement for the %s dispute. Add your statement so the admin can review both sides. Tap to open.', v_provider_name, v_price_fmt),
        v_data_user
      );
    END IF;
    -- Notify admins
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT p.id, 'payment_dispute', 'Dispute statement received',
           format('%s submitted their statement for the %s dispute.', v_provider_name, v_price_fmt),
           v_data_admin
    FROM public.profiles p WHERE p.role = 'admin';
  END IF;

  -- ── Both statements now in → special admin ping ──────────────────────────
  IF v_both_now
     AND NOT (OLD.dispute_customer_statement IS NOT NULL AND OLD.dispute_provider_statement IS NOT NULL)
  THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    SELECT p.id, 'payment_dispute', 'Both statements received — ready for review',
           format('Both %s and %s have submitted statements for the %s dispute. Ready for your decision.', v_customer_name, v_provider_name, v_price_fmt),
           v_data_admin
    FROM public.profiles p WHERE p.role = 'admin';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payments_dispute_statement_notify ON public.payments;
CREATE TRIGGER trg_payments_dispute_statement_notify
  AFTER UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_dispute_statement_submitted();


-- ============================================================
-- 3. admin_dispute_debit_customer — add customer + admin notifications
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_dispute_debit_customer(
  p_payment_id UUID,
  p_amount DECIMAL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id  UUID;
  v_wallet_id    UUID;
  v_price_fmt    TEXT;
  v_data_user    JSONB;
  v_data_admin   JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT b.customer_id INTO v_customer_id
  FROM public.payments p
  JOIN public.bookings b ON b.id = p.booking_id
  WHERE p.id = p_payment_id;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Payment or booking not found';
  END IF;

  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_customer_id;
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Customer wallet not found';
  END IF;

  -- Debit wallet
  UPDATE public.wallets
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE id = v_wallet_id;

  INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description)
  VALUES (
    v_wallet_id,
    'dispute_adjustment',
    'debit',
    p_amount,
    p_payment_id,
    'Dispute adjustment (admin) — may result in negative balance until topped up'
  );

  v_price_fmt  := 'P' || trim(to_char(p_amount, 'FM999,999,990.00'));
  v_data_user  := jsonb_build_object(
    'path', '/wallet'
  );
  v_data_admin := jsonb_build_object(
    'payment_id', p_payment_id::text,
    'path',       '/admin/reports?payment=' || p_payment_id::text
  );

  -- Notify customer
  INSERT INTO public.notifications (user_id, type, title, body, data) VALUES (
    v_customer_id,
    'dispute_debit',
    'Dispute adjustment applied',
    format('An admin applied a dispute adjustment of %s to your wallet following the review of a dispute. Your balance may be negative — please top up to restore it. Tap to view your wallet.', v_price_fmt),
    v_data_user
  );

  -- Confirm to admins
  INSERT INTO public.notifications (user_id, type, title, body, data)
  SELECT p.id, 'payment_dispute', 'Dispute debit applied',
         format('Admin debited %s from the customer wallet as a dispute adjustment.', v_price_fmt),
         v_data_admin
  FROM public.profiles p WHERE p.role = 'admin';
END;
$$;
