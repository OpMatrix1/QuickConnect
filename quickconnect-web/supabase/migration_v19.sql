-- Migration v19: Harden fund checks and settlement flow
-- Run after migration_v18.sql
--
-- 1) wallet_available_amount returns 0 when user has no wallet row (avoids NULL comparisons)
-- 2) Escrow cannot release until both parties agree on a proposed settlement (if any)
-- 3) Quote / Looking For response creation only via SECURITY DEFINER RPCs (fund checks enforced)
-- 4) Admins may update platform fee in app_settings

-- ---------------------------------------------------------------------------
-- 1. Wallet helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wallet_available_amount(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT COALESCE(w.balance, 0) - COALESCE(w.reserved_balance, 0)
      FROM public.wallets w
      WHERE w.user_id = p_user_id
    ),
    0::numeric
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. Auto-release: require settlement agreement if a settlement was proposed
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

  SELECT * INTO v_booking FROM public.bookings WHERE id = NEW.booking_id;

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
-- 3. Quotes: require RPC for insert and provider quote line (fund validation)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "customer_insert_quote" ON public.quotes;
DROP POLICY IF EXISTS "provider_update_quote" ON public.quotes;

-- ---------------------------------------------------------------------------
-- 4. Looking For responses: require RPC (customer fund check on quote)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "looking_for_responses_insert_provider" ON public.looking_for_responses;

-- ---------------------------------------------------------------------------
-- 5. App settings: admin may edit platform fee
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "app_settings_update_admin" ON public.app_settings;
CREATE POLICY "app_settings_update_admin" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
