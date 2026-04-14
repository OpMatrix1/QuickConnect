-- Non-payment disputes: payment row exists as disputed but no wallet escrow was ever held.
-- admin_release_payment previously credited the provider only, so customer wallet never moved.
-- admin_refund_payment previously credited the customer as if escrow existed (free money).
-- This migration branches on whether a payment_hold debit exists for the booking.

CREATE OR REPLACE FUNCTION public.admin_release_payment(p_payment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_booking bookings%ROWTYPE;
  v_provider_profile_id UUID;
  v_provider_wallet_id UUID;
  v_customer_id UUID;
  v_customer_wallet_id UUID;
  v_has_escrow BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;

  IF NOT FOUND OR v_payment.status NOT IN ('held', 'disputed') THEN
    RAISE EXCEPTION 'Payment not found or not in a releasable state';
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = v_payment.booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  SELECT profile_id INTO v_provider_profile_id
    FROM public.service_providers WHERE id = v_booking.provider_id;
  SELECT id INTO v_provider_wallet_id
    FROM public.wallets WHERE user_id = v_provider_profile_id;

  IF v_provider_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Provider wallet not found';
  END IF;

  v_has_escrow := EXISTS (
    SELECT 1
    FROM public.wallet_transactions wt
    WHERE wt.reference_id = v_payment.booking_id
      AND wt.type = 'payment_hold'
      AND wt.direction = 'debit'
  );

  IF v_payment.status = 'held' AND NOT v_has_escrow THEN
    RAISE EXCEPTION 'Cannot release: held payment has no matching wallet escrow (data inconsistency)';
  END IF;

  IF v_payment.status = 'held' THEN
    -- Escrow: funds already left the customer wallet when payment was initiated.
    UPDATE public.wallets
    SET balance = balance + v_payment.amount, updated_at = NOW()
    WHERE id = v_provider_wallet_id;

    INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description)
    VALUES (
      v_provider_wallet_id,
      'payment_release',
      'credit',
      v_payment.amount,
      p_payment_id,
      'Released by admin'
    );
  ELSIF v_has_escrow THEN
    -- Disputed while escrow existed (e.g. after wallet payment): release escrow to provider only.
    UPDATE public.wallets
    SET balance = balance + v_payment.amount, updated_at = NOW()
    WHERE id = v_provider_wallet_id;

    INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description)
    VALUES (
      v_provider_wallet_id,
      'payment_release',
      'credit',
      v_payment.amount,
      p_payment_id,
      'Released by admin'
    );
  ELSE
    -- Disputed dispute row with no escrow (e.g. provider non-payment report): debit customer then credit provider.
    v_customer_id := v_booking.customer_id;
    SELECT id INTO v_customer_wallet_id FROM public.wallets WHERE user_id = v_customer_id;
    IF v_customer_wallet_id IS NULL THEN
      RAISE EXCEPTION 'Customer wallet not found';
    END IF;

    UPDATE public.wallets
    SET balance = balance - v_payment.amount, updated_at = NOW()
    WHERE id = v_customer_wallet_id;

    INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description)
    VALUES (
      v_customer_wallet_id,
      'dispute_adjustment',
      'debit',
      v_payment.amount,
      p_payment_id,
      'Non-escrow dispute — admin released to provider (customer debited)'
    );

    UPDATE public.wallets
    SET balance = balance + v_payment.amount, updated_at = NOW()
    WHERE id = v_provider_wallet_id;

    INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description)
    VALUES (
      v_provider_wallet_id,
      'payment_release',
      'credit',
      v_payment.amount,
      p_payment_id,
      'Non-escrow dispute — released by admin'
    );
  END IF;

  UPDATE public.payments
  SET status = 'released', updated_at = NOW()
  WHERE id = p_payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_refund_payment(p_payment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_customer_id UUID;
  v_customer_wallet_id UUID;
  v_has_escrow BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin only';
  END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id;

  IF NOT FOUND OR v_payment.status NOT IN ('held', 'disputed') THEN
    RAISE EXCEPTION 'Payment not found or not in a refundable state';
  END IF;

  v_has_escrow := EXISTS (
    SELECT 1
    FROM public.wallet_transactions wt
    WHERE wt.reference_id = v_payment.booking_id
      AND wt.type = 'payment_hold'
      AND wt.direction = 'debit'
  );

  IF v_payment.status = 'held' AND NOT v_has_escrow THEN
    RAISE EXCEPTION 'Cannot refund: held payment has no matching wallet escrow (data inconsistency)';
  END IF;

  IF v_has_escrow THEN
    SELECT customer_id INTO v_customer_id FROM public.bookings WHERE id = v_payment.booking_id;
    SELECT id INTO v_customer_wallet_id FROM public.wallets WHERE user_id = v_customer_id;

    UPDATE public.wallets
    SET balance = balance + v_payment.amount, updated_at = NOW()
    WHERE id = v_customer_wallet_id;

    INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description)
    VALUES (v_customer_wallet_id, 'payment_refund', 'credit', v_payment.amount, p_payment_id, 'Refunded by admin');
  END IF;
  -- Disputed with no escrow: nothing was held — favor customer by closing dispute only (no free wallet credit).

  UPDATE public.payments
  SET status = 'refunded', updated_at = NOW()
  WHERE id = p_payment_id;
END;
$$;
