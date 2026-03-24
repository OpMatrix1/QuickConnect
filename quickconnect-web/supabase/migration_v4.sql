-- =============================================================================
-- QuickConnect Migration v4
-- In-App Wallet System
-- Run this in the Supabase SQL Editor after migration_v3.sql
-- =============================================================================

-- 1. Allow 'wallet' as a payment method
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_method_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_method_check
  CHECK (method IN ('orange_money', 'btc_myzaka', 'mascom_myzaka', 'wallet'));

-- Make method nullable (wallet payments set it to 'wallet', existing rows keep their value)
ALTER TABLE public.payments ALTER COLUMN method DROP NOT NULL;

-- =============================================================================
-- 2. Wallets table (one per user)
-- =============================================================================
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wallets_user_id ON public.wallets(user_id);

-- =============================================================================
-- 3. Wallet transactions table
-- =============================================================================
CREATE TABLE public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('top_up', 'payment_hold', 'payment_release', 'payment_refund', 'withdrawal')),
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wallet_transactions_wallet_id ON public.wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_transactions_created_at ON public.wallet_transactions(created_at DESC);

-- =============================================================================
-- 4. updated_at trigger for wallets
-- =============================================================================
CREATE TRIGGER set_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 5. Auto-create wallet when a profile is created
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_wallet_for_new_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created_create_wallet
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.create_wallet_for_new_profile();

-- =============================================================================
-- 6. Backfill wallets for existing users
-- =============================================================================
INSERT INTO public.wallets (user_id)
SELECT id FROM public.profiles
WHERE id NOT IN (SELECT user_id FROM public.wallets);

-- =============================================================================
-- 7. RLS for wallets and wallet_transactions
-- =============================================================================
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Wallets: owner and admins can view; service role can update (for RPC functions)
CREATE POLICY "wallets_select_owner_or_admin" ON public.wallets
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- wallet_transactions: owner and admins can view
CREATE POLICY "wallet_transactions_select_owner_or_admin" ON public.wallet_transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.wallets WHERE id = wallet_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================================================
-- 8. RPC: top_up_wallet — user adds funds to their own wallet (simulated)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.top_up_wallet(p_amount DECIMAL)
RETURNS JSON AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  UPDATE public.wallets
  SET balance = balance + p_amount, updated_at = NOW()
  WHERE user_id = auth.uid();

  INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, description)
  VALUES (v_wallet.id, 'top_up', 'credit', p_amount, 'Wallet top-up');

  RETURN json_build_object('new_balance', v_wallet.balance + p_amount);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 9. RPC: initiate_wallet_payment — deduct from customer wallet, create payment
-- =============================================================================
CREATE OR REPLACE FUNCTION public.initiate_wallet_payment(
  p_booking_id UUID,
  p_amount DECIMAL
)
RETURNS JSON AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_wallet wallets%ROWTYPE;
  v_payment_id UUID;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  IF v_booking.customer_id != auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: only the customer can initiate payment';
  END IF;

  IF EXISTS (SELECT 1 FROM public.payments WHERE booking_id = p_booking_id) THEN
    RAISE EXCEPTION 'A payment already exists for this booking';
  END IF;

  SELECT * INTO v_wallet FROM public.wallets WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  IF v_wallet.balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance. Available: %, Required: %',
      round(v_wallet.balance, 2), round(p_amount::numeric, 2);
  END IF;

  -- Deduct from customer wallet
  UPDATE public.wallets
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE id = v_wallet.id;

  -- Record debit transaction
  INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description)
  VALUES (v_wallet.id, 'payment_hold', 'debit', p_amount, p_booking_id, 'Payment held in escrow');

  -- Create the payment record
  INSERT INTO public.payments (booking_id, amount, method, status)
  VALUES (p_booking_id, p_amount, 'wallet', 'held')
  RETURNING id INTO v_payment_id;

  RETURN json_build_object(
    'payment_id', v_payment_id,
    'new_balance', round((v_wallet.balance - p_amount)::numeric, 2)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 10. Trigger: auto-release payment to provider wallet when both parties confirm
-- =============================================================================
CREATE OR REPLACE FUNCTION public.auto_release_payment_on_both_confirmed()
RETURNS TRIGGER AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_provider_profile_id UUID;
  v_provider_wallet_id UUID;
BEGIN
  IF NEW.customer_confirmed = TRUE
     AND NEW.provider_confirmed = TRUE
     AND NEW.status = 'held' THEN

    SELECT * INTO v_booking FROM public.bookings WHERE id = NEW.booking_id;
    SELECT profile_id INTO v_provider_profile_id
      FROM public.service_providers WHERE id = v_booking.provider_id;
    SELECT id INTO v_provider_wallet_id
      FROM public.wallets WHERE user_id = v_provider_profile_id;

    -- Credit provider wallet
    UPDATE public.wallets
    SET balance = balance + NEW.amount, updated_at = NOW()
    WHERE id = v_provider_wallet_id;

    -- Record transaction
    INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description)
    VALUES (v_provider_wallet_id, 'payment_release', 'credit', NEW.amount, NEW.id, 'Payment released from escrow');

    NEW.status = 'released';
    NEW.updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_payment_both_confirmed
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.auto_release_payment_on_both_confirmed();

-- =============================================================================
-- 11. RPC: admin_refund_payment — admin refunds held/disputed payment to customer
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_refund_payment(p_payment_id UUID)
RETURNS VOID AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_customer_id UUID;
  v_customer_wallet_id UUID;
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

  SELECT customer_id INTO v_customer_id FROM public.bookings WHERE id = v_payment.booking_id;
  SELECT id INTO v_customer_wallet_id FROM public.wallets WHERE user_id = v_customer_id;

  UPDATE public.wallets
  SET balance = balance + v_payment.amount, updated_at = NOW()
  WHERE id = v_customer_wallet_id;

  INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description)
  VALUES (v_customer_wallet_id, 'payment_refund', 'credit', v_payment.amount, p_payment_id, 'Refunded by admin');

  UPDATE public.payments
  SET status = 'refunded', updated_at = NOW()
  WHERE id = p_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 12. RPC: admin_release_payment — admin releases held/disputed payment to provider
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_release_payment(p_payment_id UUID)
RETURNS VOID AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_booking bookings%ROWTYPE;
  v_provider_profile_id UUID;
  v_provider_wallet_id UUID;
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
  SELECT profile_id INTO v_provider_profile_id
    FROM public.service_providers WHERE id = v_booking.provider_id;
  SELECT id INTO v_provider_wallet_id
    FROM public.wallets WHERE user_id = v_provider_profile_id;

  UPDATE public.wallets
  SET balance = balance + v_payment.amount, updated_at = NOW()
  WHERE id = v_provider_wallet_id;

  INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description)
  VALUES (v_provider_wallet_id, 'payment_release', 'credit', v_payment.amount, p_payment_id, 'Released by admin');

  UPDATE public.payments
  SET status = 'released', updated_at = NOW()
  WHERE id = p_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Done! Run migration_v4.sql in the Supabase SQL Editor.
-- Every user now has a wallet. Payments use the wallet escrow system.
-- =============================================================================
