-- Migration v21: Dual confirmation in_progress → completed (work done), then escrow/satisfaction.
-- Realtime: payments + wallets for live booking UI.
-- Run after migration_v20.sql

-- ---------------------------------------------------------------------------
-- 1. Bookings: both parties confirm work finished before status = completed
-- ---------------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_work_complete BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS provider_work_complete BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.bookings
SET
  customer_work_complete = TRUE,
  provider_work_complete = TRUE
WHERE status = 'completed';

COMMENT ON COLUMN public.bookings.customer_work_complete IS
  'Customer confirms the job/work is finished (paired with provider_work_complete → status completed).';
COMMENT ON COLUMN public.bookings.provider_work_complete IS
  'Provider confirms the job/work is finished.';

-- ---------------------------------------------------------------------------
-- 2. RPC: in_progress → both confirm → completed (does not release escrow)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.booking_confirm_work_complete(p_booking_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b bookings%ROWTYPE;
  v_is_customer BOOLEAN;
  v_is_provider BOOLEAN;
BEGIN
  SELECT * INTO v_b FROM public.bookings WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  v_is_customer := v_b.customer_id = auth.uid();
  v_is_provider := EXISTS (
    SELECT 1 FROM public.service_providers sp
    WHERE sp.id = v_b.provider_id AND sp.profile_id = auth.uid()
  );

  IF NOT v_is_customer AND NOT v_is_provider THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_b.status <> 'in_progress' THEN
    RAISE EXCEPTION 'Work completion can only be confirmed while the booking is in progress';
  END IF;

  IF v_is_customer THEN
    UPDATE public.bookings
    SET customer_work_complete = TRUE, updated_at = NOW()
    WHERE id = p_booking_id;
  ELSE
    UPDATE public.bookings
    SET provider_work_complete = TRUE, updated_at = NOW()
    WHERE id = p_booking_id;
  END IF;

  SELECT * INTO v_b FROM public.bookings WHERE id = p_booking_id;

  IF v_b.customer_work_complete AND v_b.provider_work_complete THEN
    UPDATE public.bookings
    SET status = 'completed', updated_at = NOW()
    WHERE id = p_booking_id;
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Remove: booking completed from payment release (order is work complete first)
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_sync_booking_completed_on_payment ON public.payments;
DROP FUNCTION IF EXISTS public.sync_booking_completed_on_payment_released();

DROP TRIGGER IF EXISTS trg_booking_guard_completed ON public.bookings;
DROP FUNCTION IF EXISTS public.prevent_booking_completed_without_escrow_release();

-- ---------------------------------------------------------------------------
-- 4. Escrow release only after booking.status = completed (work agreed by both)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_release_payment_on_both_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_provider_profile_id UUID;
  v_provider_wallet_id UUID;
  v_customer_wallet_id UUID;
  v_fee_pct NUMERIC;
  v_final NUMERIC;
  v_provider_credit NUMERIC;
  v_shadow BOOLEAN;
  v_legacy BOOLEAN;
BEGIN
  IF NEW.customer_confirmed IS TRUE AND NEW.provider_confirmed IS TRUE THEN
    IF NEW.settlement_proposed_amount IS NOT NULL
       AND NOT (NEW.settlement_customer_agreed AND NEW.settlement_provider_agreed) THEN
      RAISE EXCEPTION 'Both parties must agree to the proposed settlement before both can confirm satisfaction.';
    END IF;
  END IF;

  IF NEW.customer_confirmed IS NOT TRUE OR NEW.provider_confirmed IS NOT TRUE OR NEW.status <> 'held' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = NEW.booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'Both parties must mark the job as completed before confirming satisfaction and releasing escrow.';
  END IF;

  SELECT platform_fee_percent INTO v_fee_pct FROM public.app_settings WHERE id = 1;
  IF v_fee_pct IS NULL THEN
    v_fee_pct := 10;
  END IF;

  v_final := NEW.amount;
  IF NEW.settlement_customer_agreed AND NEW.settlement_provider_agreed
     AND NEW.settlement_proposed_amount IS NOT NULL THEN
    v_final := LEAST(NEW.settlement_proposed_amount, NEW.amount);
  END IF;

  IF v_final <= 0 THEN
    RAISE EXCEPTION 'Invalid settlement amount';
  END IF;

  v_provider_credit := round(v_final * (1 - v_fee_pct / 100.0), 2);

  SELECT profile_id INTO v_provider_profile_id
  FROM public.service_providers WHERE id = v_booking.provider_id;

  SELECT id INTO v_provider_wallet_id
  FROM public.wallets WHERE user_id = v_provider_profile_id;

  IF v_provider_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Provider wallet not found';
  END IF;

  v_shadow := public._booking_has_shadow_escrow(NEW.booking_id);
  v_legacy := public._booking_has_legacy_hold(NEW.booking_id);

  SELECT id INTO v_customer_wallet_id FROM public.wallets WHERE user_id = v_booking.customer_id;

  IF v_shadow THEN
    IF v_customer_wallet_id IS NULL THEN
      RAISE EXCEPTION 'Customer wallet not found';
    END IF;

    UPDATE public.wallets
    SET
      reserved_balance = reserved_balance - NEW.amount,
      balance = balance - v_final,
      updated_at = NOW()
    WHERE id = v_customer_wallet_id;

    IF (SELECT reserved_balance FROM public.wallets WHERE id = v_customer_wallet_id) < 0 THEN
      RAISE EXCEPTION 'Reservation underflow';
    END IF;

    INSERT INTO public.wallet_transactions (
      wallet_id, type, direction, amount, reference_id, description
    )
    VALUES (
      v_customer_wallet_id,
      'shadow_release',
      'credit',
      NEW.amount,
      NEW.booking_id,
      'Escrow settled — shadow reservation cleared; job amount deducted from wallet'
    );
  ELSIF v_legacy THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Payment has no matching escrow (shadow or legacy)';
  END IF;

  UPDATE public.wallets
  SET balance = balance + v_provider_credit, updated_at = NOW()
  WHERE id = v_provider_wallet_id;

  INSERT INTO public.wallet_transactions (
    wallet_id, type, direction, amount, reference_id, description
  )
  VALUES (
    v_provider_wallet_id,
    'payment_release',
    'credit',
    v_provider_credit,
    NEW.id,
    'Payment released (platform fee applied)'
  );

  NEW.status := 'released';
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Settlement RPCs: only after job marked completed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.payment_propose_settlement(
  p_payment_id UUID,
  p_amount NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p payments%ROWTYPE;
  v_b bookings%ROWTYPE;
  v_role TEXT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT * INTO v_p FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF v_p.status <> 'held' THEN
    RAISE EXCEPTION 'Settlement can only be proposed while payment is held in escrow';
  END IF;

  SELECT * INTO v_b FROM public.bookings WHERE id = v_p.booking_id;

  IF v_b.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'The job must be marked completed by both parties before negotiating settlement.';
  END IF;

  IF v_b.customer_id = auth.uid() THEN
    v_role := 'customer';
  ELSIF EXISTS (
    SELECT 1 FROM public.service_providers sp
    WHERE sp.id = v_b.provider_id AND sp.profile_id = auth.uid()
  ) THEN
    v_role := 'provider';
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_amount > v_p.amount THEN
    RAISE EXCEPTION 'Settlement cannot exceed the held amount (P%)',
      round(v_p.amount, 2);
  END IF;

  UPDATE public.payments
  SET
    settlement_proposed_amount = p_amount,
    settlement_proposed_by = v_role,
    settlement_customer_agreed = CASE WHEN v_role = 'customer' THEN TRUE ELSE FALSE END,
    settlement_provider_agreed = CASE WHEN v_role = 'provider' THEN TRUE ELSE FALSE END,
    updated_at = NOW()
  WHERE id = p_payment_id;

  RETURN json_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.payment_agree_to_settlement(p_payment_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p payments%ROWTYPE;
  v_b bookings%ROWTYPE;
  v_role TEXT;
BEGIN
  SELECT * INTO v_p FROM public.payments WHERE id = p_payment_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;

  IF v_p.settlement_proposed_amount IS NULL OR v_p.settlement_proposed_by IS NULL THEN
    RAISE EXCEPTION 'There is no pending settlement to accept';
  END IF;

  SELECT * INTO v_b FROM public.bookings WHERE id = v_p.booking_id;

  IF v_b.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'The job must be marked completed by both parties before agreeing to settlement.';
  END IF;

  IF v_b.customer_id = auth.uid() THEN
    v_role := 'customer';
  ELSIF EXISTS (
    SELECT 1 FROM public.service_providers sp
    WHERE sp.id = v_b.provider_id AND sp.profile_id = auth.uid()
  ) THEN
    v_role := 'provider';
  ELSE
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_role = v_p.settlement_proposed_by THEN
    RAISE EXCEPTION 'The other party must accept this settlement';
  END IF;

  UPDATE public.payments
  SET
    settlement_customer_agreed = CASE WHEN v_role = 'customer' THEN TRUE ELSE settlement_customer_agreed END,
    settlement_provider_agreed = CASE WHEN v_role = 'provider' THEN TRUE ELSE settlement_provider_agreed END,
    updated_at = NOW()
  WHERE id = p_payment_id;

  RETURN json_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Realtime: payments + wallets (live escrow / balances on My Bookings)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.wallets;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
