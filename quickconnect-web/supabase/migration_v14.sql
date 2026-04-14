-- Dispute statements (both sides), optional admin debit allowing negative customer balance.
-- Run after prior migrations.

-- ---------------------------------------------------------------------------
-- 1. Payments: both parties can describe their side; who opened the dispute
-- ---------------------------------------------------------------------------
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS dispute_customer_statement TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS dispute_provider_statement TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS dispute_initiated_by TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS dispute_opened_at TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_dispute_initiated_by_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.payments ADD CONSTRAINT payments_dispute_initiated_by_check
  CHECK (dispute_initiated_by IS NULL OR dispute_initiated_by IN ('customer', 'provider'));

-- ---------------------------------------------------------------------------
-- 2. Wallets: allow negative balance (dispute debt / admin recovery — fairness policy)
-- ---------------------------------------------------------------------------
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_balance_check;
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_check;

-- ---------------------------------------------------------------------------
-- 3. Wallet transaction type for dispute-related adjustments
-- ---------------------------------------------------------------------------
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type IN (
    'top_up',
    'payment_hold',
    'payment_release',
    'payment_refund',
    'withdrawal',
    'dispute_adjustment'
  ));

-- ---------------------------------------------------------------------------
-- 4. Admin: debit customer wallet (may go negative) — e.g. provider dispute where
--    funds were not available; use with care; admin reviews both statements + balances first.
-- ---------------------------------------------------------------------------
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
  v_customer_id UUID;
  v_wallet_id UUID;
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
END;
$$;

COMMENT ON FUNCTION public.admin_dispute_debit_customer(UUID, DECIMAL) IS
  'Admin-only: debits customer wallet for dispute resolution; balance may go negative per platform policy.';
