-- =============================================================================
-- QuickConnect Migration v5
-- Simulated Withdrawal System
-- Run this in the Supabase SQL Editor after migration_v4.sql
-- =============================================================================

-- =============================================================================
-- 1. RPC: withdraw_from_wallet — user withdraws funds to mobile money / bank
--    (simulated: deducts balance and records the transaction, no real transfer)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.withdraw_from_wallet(
  p_amount      DECIMAL,
  p_method      TEXT,
  p_destination TEXT
)
RETURNS JSON AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  IF p_amount < 20 THEN
    RAISE EXCEPTION 'Minimum withdrawal amount is P20';
  END IF;

  IF p_amount > 5000 THEN
    RAISE EXCEPTION 'Maximum withdrawal amount is P5,000 per transaction';
  END IF;

  IF p_method NOT IN ('orange_money', 'btc_myzaka', 'mascom_myzaka', 'bank_transfer') THEN
    RAISE EXCEPTION 'Invalid withdrawal method';
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  IF v_wallet.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: P%, Requested: P%',
      round(v_wallet.balance, 2), round(p_amount::numeric, 2);
  END IF;

  -- Deduct from wallet
  UPDATE public.wallets
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE id = v_wallet.id;

  -- Record withdrawal transaction (destination stored in description)
  INSERT INTO public.wallet_transactions (
    wallet_id, type, direction, amount, description
  )
  VALUES (
    v_wallet.id,
    'withdrawal',
    'debit',
    p_amount,
    'Withdrawal to ' || p_method || ' — ' || p_destination
  );

  RETURN json_build_object(
    'new_balance', round((v_wallet.balance - p_amount)::numeric, 2)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Done! Users can now simulate withdrawals from their wallet.
-- =============================================================================
