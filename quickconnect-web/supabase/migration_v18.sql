-- Migration v18: Shadow reservations, platform fee, dual confirmation for in-progress & completion,
-- settlement negotiation, fund checks on quotes, withdrawable = balance - reserved.
-- Run after migration_v17.sql

-- ---------------------------------------------------------------------------
-- 1. Wallet: reserved (shadow) balance — cannot be withdrawn
-- ---------------------------------------------------------------------------
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS reserved_balance DECIMAL(12, 2) NOT NULL DEFAULT 0.00;

ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_reserved_balance_check;
-- reserved_balance is a sub-ledger of balance; allow any balance (including negative per v14)
ALTER TABLE public.wallets ADD CONSTRAINT wallets_reserved_balance_check
  CHECK (reserved_balance >= 0);

COMMENT ON COLUMN public.wallets.reserved_balance IS
  'Funds earmarked for accepted quotes/bookings; excluded from withdrawals until released or refunded.';

-- ---------------------------------------------------------------------------
-- 2. Wallet transaction types
-- ---------------------------------------------------------------------------
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type IN (
    'top_up',
    'payment_hold',
    'payment_release',
    'payment_refund',
    'withdrawal',
    'dispute_adjustment',
    'shadow_reserve',
    'shadow_release'
  ));

-- ---------------------------------------------------------------------------
-- 3. App settings (platform fee % taken from gross job value before crediting provider)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  platform_fee_percent NUMERIC(5, 2) NOT NULL DEFAULT 10.00
    CHECK (platform_fee_percent >= 0 AND platform_fee_percent <= 100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.app_settings (id, platform_fee_percent)
VALUES (1, 10.00)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_settings_select_authenticated" ON public.app_settings;
CREATE POLICY "app_settings_select_authenticated" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

-- ---------------------------------------------------------------------------
-- 4. Bookings: link to quote; dual confirmation before in_progress
-- ---------------------------------------------------------------------------
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_ready_in_progress BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS provider_ready_in_progress BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_bookings_quote_id ON public.bookings(quote_id);

-- ---------------------------------------------------------------------------
-- 5. Payments: negotiated settlement (both parties must agree before release uses it)
-- ---------------------------------------------------------------------------
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS settlement_proposed_amount DECIMAL(10, 2);

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS settlement_proposed_by TEXT
    CHECK (settlement_proposed_by IS NULL OR settlement_proposed_by IN ('customer', 'provider'));

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS settlement_customer_agreed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS settlement_provider_agreed BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- 6. Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wallet_available_amount(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(w.balance, 0) - COALESCE(w.reserved_balance, 0)
  FROM public.wallets w
  WHERE w.user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public._booking_has_shadow_escrow(p_booking_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.wallet_transactions wt
    WHERE wt.reference_id = p_booking_id
      AND wt.type = 'shadow_reserve'
      AND wt.direction = 'debit'
  );
$$;

CREATE OR REPLACE FUNCTION public._booking_has_legacy_hold(p_booking_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.wallet_transactions wt
    WHERE wt.reference_id = p_booking_id
      AND wt.type = 'payment_hold'
      AND wt.direction = 'debit'
  );
$$;

-- ---------------------------------------------------------------------------
-- 7. Withdrawals: only available (balance - reserved)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.withdraw_from_wallet(
  p_amount      DECIMAL,
  p_method      TEXT,
  p_destination TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_available NUMERIC;
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

  v_available := COALESCE(v_wallet.balance, 0) - COALESCE(v_wallet.reserved_balance, 0);

  IF v_available < p_amount THEN
    RAISE EXCEPTION 'Insufficient withdrawable balance. Available: P%, Requested: P% (funds reserved for accepted jobs cannot be withdrawn)',
      round(v_available, 2), round(p_amount::numeric, 2);
  END IF;

  UPDATE public.wallets
  SET balance = balance - p_amount, updated_at = NOW()
  WHERE id = v_wallet.id;

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
$$;

-- ---------------------------------------------------------------------------
-- 8. Customer: request a quote (validates budget vs available funds)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_request_provider_quote(
  p_provider_id UUID,
  p_service_description TEXT,
  p_budget_min NUMERIC,
  p_budget_max NUMERIC,
  p_customer_message TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_need NUMERIC;
  v_avail NUMERIC;
  v_quote_id UUID;
BEGIN
  IF p_service_description IS NULL OR trim(p_service_description) = '' THEN
    RAISE EXCEPTION 'Service description is required';
  END IF;

  v_need := COALESCE(p_budget_max, p_budget_min, 0);
  IF v_need > 0 THEN
    v_avail := public.wallet_available_amount(auth.uid());
    IF v_avail < v_need THEN
      RAISE EXCEPTION 'Insufficient wallet funds for this quote request. You need at least P% available (P% reserved for other jobs). Top up or wait until other bookings complete.',
        round(v_need, 2), round(COALESCE((SELECT reserved_balance FROM wallets WHERE user_id = auth.uid()), 0), 2);
    END IF;
  END IF;

  INSERT INTO public.quotes (
    customer_id, provider_id, service_description,
    budget_min, budget_max, customer_message, status
  )
  VALUES (
    auth.uid(), p_provider_id, trim(p_service_description),
    p_budget_min, p_budget_max, NULLIF(trim(p_customer_message), ''), 'requested'
  )
  RETURNING id INTO v_quote_id;

  RETURN json_build_object('quote_id', v_quote_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- 9. Provider: submit quote amount (customer must have funds)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provider_submit_quote_response(
  p_quote_id UUID,
  p_quoted_amount NUMERIC,
  p_provider_message TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote quotes%ROWTYPE;
  v_avail NUMERIC;
  v_sp_id UUID;
BEGIN
  IF p_quoted_amount IS NULL OR p_quoted_amount <= 0 THEN
    RAISE EXCEPTION 'Quoted amount must be positive';
  END IF;

  SELECT id INTO v_sp_id
  FROM public.service_providers
  WHERE profile_id = auth.uid();

  IF v_sp_id IS NULL THEN
    RAISE EXCEPTION 'Only a provider can submit a quote response';
  END IF;

  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  IF v_quote.provider_id <> v_sp_id THEN
    RAISE EXCEPTION 'This quote is not assigned to you';
  END IF;

  IF v_quote.status <> 'requested' THEN
    RAISE EXCEPTION 'Quote is not awaiting your response';
  END IF;

  v_avail := public.wallet_available_amount(v_quote.customer_id);

  IF v_avail < p_quoted_amount THEN
    RAISE EXCEPTION 'The customer does not have enough wallet funds for P%. They have P% available for new commitments. Ask them to top up or reduce the quote.',
      round(p_quoted_amount, 2), round(v_avail, 2);
  END IF;

  UPDATE public.quotes
  SET
    quoted_amount = p_quoted_amount,
    provider_message = NULLIF(trim(p_provider_message), ''),
    status = 'quoted',
    updated_at = NOW()
  WHERE id = p_quote_id;

  RETURN json_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 10. Customer: accept quoted quote — shadow reserve + booking + held payment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_accept_quote(p_quote_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote quotes%ROWTYPE;
  v_wallet_id UUID;
  v_booking_id UUID;
  v_payment_id UUID;
  v_amount NUMERIC;
BEGIN
  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  IF v_quote.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the customer can accept this quote';
  END IF;

  IF v_quote.status <> 'quoted' OR v_quote.quoted_amount IS NULL THEN
    RAISE EXCEPTION 'This quote cannot be accepted';
  END IF;

  v_amount := v_quote.quoted_amount;

  IF public.wallet_available_amount(auth.uid()) < v_amount THEN
    RAISE EXCEPTION 'Insufficient wallet funds to accept. You need P% available.',
      round(v_amount, 2);
  END IF;

  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = auth.uid();
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  INSERT INTO public.bookings (
    customer_id,
    provider_id,
    agreed_price,
    status,
    notes,
    quote_id
  )
  VALUES (
    v_quote.customer_id,
    v_quote.provider_id,
    v_amount,
    'pending',
    'From quote: ' || left(v_quote.service_description, 500),
    p_quote_id
  )
  RETURNING id INTO v_booking_id;

  INSERT INTO public.payments (booking_id, amount, method, status)
  VALUES (v_booking_id, v_amount, 'wallet', 'held')
  RETURNING id INTO v_payment_id;

  UPDATE public.wallets
  SET
    reserved_balance = reserved_balance + v_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;

  INSERT INTO public.wallet_transactions (
    wallet_id, type, direction, amount, reference_id, description
  )
  VALUES (
    v_wallet_id,
    'shadow_reserve',
    'debit',
    v_amount,
    v_booking_id,
    'Reserved for accepted quote (not withdrawable until job completes or booking is cancelled)'
  );

  UPDATE public.quotes
  SET
    status = 'accepted',
    booking_id = v_booking_id,
    updated_at = NOW()
  WHERE id = p_quote_id;

  RETURN json_build_object(
    'booking_id', v_booking_id,
    'payment_id', v_payment_id
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 11. Looking For: provider submits response (customer must afford quoted price)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provider_submit_looking_for_response(
  p_post_id UUID,
  p_quoted_price NUMERIC,
  p_message TEXT,
  p_estimated_duration TEXT,
  p_available_date DATE,
  p_available_time TIME
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_post RECORD;
  v_sp_id UUID;
  v_avail NUMERIC;
  v_resp_id UUID;
BEGIN
  IF p_quoted_price IS NULL OR p_quoted_price <= 0 THEN
    RAISE EXCEPTION 'Quoted price must be positive';
  END IF;

  SELECT id INTO v_sp_id
  FROM public.service_providers
  WHERE profile_id = auth.uid();

  IF v_sp_id IS NULL THEN
    RAISE EXCEPTION 'Only providers can submit a response';
  END IF;

  SELECT id, customer_id, status INTO v_post
  FROM public.looking_for_posts
  WHERE id = p_post_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  IF v_post.status <> 'active' THEN
    RAISE EXCEPTION 'This post is not accepting new quotes';
  END IF;

  v_avail := public.wallet_available_amount(v_post.customer_id);

  IF v_avail < p_quoted_price THEN
    RAISE EXCEPTION 'The customer does not have enough wallet funds for P%. They have P% available.',
      round(p_quoted_price, 2), round(v_avail, 2);
  END IF;

  INSERT INTO public.looking_for_responses (
    post_id, provider_id, quoted_price, message, estimated_duration,
    available_date, available_time, status
  )
  VALUES (
    p_post_id, v_sp_id, p_quoted_price, NULLIF(trim(p_message), ''),
    NULLIF(trim(p_estimated_duration), ''),
    p_available_date, p_available_time, 'pending'
  )
  RETURNING id INTO v_resp_id;

  RETURN json_build_object('response_id', v_resp_id);
END;
$$;

-- ---------------------------------------------------------------------------
-- 12. Customer: accept a Looking For response — shadow reserve + matched post
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_accept_looking_for_response(p_response_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resp RECORD;
  v_wallet_id UUID;
  v_booking_id UUID;
  v_payment_id UUID;
  v_amount NUMERIC;
BEGIN
  SELECT r.*, p.customer_id, p.location_address, p.id AS post_id
  INTO v_resp
  FROM public.looking_for_responses r
  JOIN public.looking_for_posts p ON p.id = r.post_id
  WHERE r.id = p_response_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Response not found';
  END IF;

  IF v_resp.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the post owner can accept this response';
  END IF;

  IF v_resp.status <> 'pending' THEN
    RAISE EXCEPTION 'This response cannot be accepted';
  END IF;

  v_amount := v_resp.quoted_price;

  IF public.wallet_available_amount(auth.uid()) < v_amount THEN
    RAISE EXCEPTION 'Insufficient wallet funds to accept. You need P% available.',
      round(v_amount, 2);
  END IF;

  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = auth.uid();
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  INSERT INTO public.bookings (
    customer_id,
    provider_id,
    looking_for_response_id,
    agreed_price,
    status,
    location_address,
    scheduled_date,
    scheduled_time
  )
  VALUES (
    v_resp.customer_id,
    v_resp.provider_id,
    p_response_id,
    v_amount,
    'pending',
    v_resp.location_address,
    v_resp.available_date,
    v_resp.available_time
  )
  RETURNING id INTO v_booking_id;

  INSERT INTO public.payments (booking_id, amount, method, status)
  VALUES (v_booking_id, v_amount, 'wallet', 'held')
  RETURNING id INTO v_payment_id;

  UPDATE public.wallets
  SET
    reserved_balance = reserved_balance + v_amount,
    updated_at = NOW()
  WHERE id = v_wallet_id;

  INSERT INTO public.wallet_transactions (
    wallet_id, type, direction, amount, reference_id, description
  )
  VALUES (
    v_wallet_id,
    'shadow_reserve',
    'debit',
    v_amount,
    v_booking_id,
    'Reserved for accepted Looking For response'
  );

  UPDATE public.looking_for_responses
  SET status = 'accepted'
  WHERE id = p_response_id;

  UPDATE public.looking_for_responses
  SET status = 'rejected'
  WHERE post_id = v_resp.post_id
    AND id <> p_response_id;

  UPDATE public.looking_for_posts
  SET status = 'matched', updated_at = NOW()
  WHERE id = v_resp.post_id;

  RETURN json_build_object(
    'booking_id', v_booking_id,
    'payment_id', v_payment_id,
    'post_id', v_resp.post_id
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 13. Both parties confirm they are ready → in_progress
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.booking_confirm_ready_for_work(p_booking_id UUID)
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

  IF v_b.status IN ('in_progress', 'completed', 'cancelled') THEN
    RAISE EXCEPTION 'Work has already started or this booking is closed';
  END IF;

  IF v_is_customer THEN
    UPDATE public.bookings
    SET customer_ready_in_progress = TRUE, updated_at = NOW()
    WHERE id = p_booking_id;
  ELSE
    UPDATE public.bookings
    SET provider_ready_in_progress = TRUE, updated_at = NOW()
    WHERE id = p_booking_id;
  END IF;

  SELECT * INTO v_b FROM public.bookings WHERE id = p_booking_id;

  IF v_b.customer_ready_in_progress AND v_b.provider_ready_in_progress THEN
    UPDATE public.bookings
    SET status = 'in_progress', updated_at = NOW()
    WHERE id = p_booking_id;
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 14. Settlement proposal / agreement (before satisfaction confirmation)
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
-- 15. Cancel booking (not in_progress): release shadow to withdrawable balance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.booking_cancel_before_work_started(p_booking_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_b bookings%ROWTYPE;
  v_p payments%ROWTYPE;
  v_wallet_id UUID;
  v_ok BOOLEAN;
BEGIN
  SELECT * INTO v_b FROM public.bookings WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found';
  END IF;

  v_ok := v_b.customer_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.service_providers sp
      WHERE sp.id = v_b.provider_id AND sp.profile_id = auth.uid()
    );

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_b.status = 'in_progress' THEN
    RAISE EXCEPTION 'This booking cannot be cancelled while work is in progress';
  END IF;

  IF v_b.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Booking is already finished';
  END IF;

  SELECT * INTO v_p FROM public.payments WHERE booking_id = p_booking_id;

  IF FOUND AND v_p.status = 'held' AND public._booking_has_shadow_escrow(p_booking_id) THEN
    SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_b.customer_id;

    UPDATE public.wallets
    SET
      reserved_balance = reserved_balance - v_p.amount,
      updated_at = NOW()
    WHERE id = v_wallet_id;

    IF (SELECT reserved_balance FROM public.wallets WHERE id = v_wallet_id) < 0 THEN
      RAISE EXCEPTION 'Wallet reservation inconsistency';
    END IF;

    INSERT INTO public.wallet_transactions (
      wallet_id, type, direction, amount, reference_id, description
    )
    VALUES (
      v_wallet_id,
      'shadow_release',
      'credit',
      v_p.amount,
      p_booking_id,
      'Booking cancelled — reservation released back to your wallet'
    );

    UPDATE public.payments
    SET status = 'refunded', updated_at = NOW()
    WHERE id = v_p.id;
  ELSIF FOUND AND v_p.status = 'held' THEN
    SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = v_b.customer_id;
    UPDATE public.wallets
    SET balance = balance + v_p.amount, updated_at = NOW()
    WHERE id = v_wallet_id;
    INSERT INTO public.wallet_transactions (
      wallet_id, type, direction, amount, reference_id, description
    )
    VALUES (
      v_wallet_id,
      'payment_refund',
      'credit',
      v_p.amount,
      v_p.id,
      'Booking cancelled — refunded to wallet'
    );
    UPDATE public.payments
    SET status = 'refunded', updated_at = NOW()
    WHERE id = v_p.id;
  END IF;

  UPDATE public.bookings
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_booking_id;

  -- Restore Looking For post visibility and re-open responses for new quotes
  IF v_b.looking_for_response_id IS NOT NULL THEN
    UPDATE public.looking_for_posts lp
    SET status = 'active', updated_at = NOW()
    FROM public.looking_for_responses r
    WHERE r.id = v_b.looking_for_response_id
      AND lp.id = r.post_id;

    UPDATE public.looking_for_responses r2
    SET status = 'pending'
    FROM public.looking_for_responses r0
    WHERE r0.id = v_b.looking_for_response_id
      AND r2.post_id = r0.post_id;
  END IF;

  -- Allow the same quote to be accepted again after cancellation
  IF v_b.quote_id IS NOT NULL THEN
    UPDATE public.quotes
    SET status = 'quoted', booking_id = NULL, updated_at = NOW()
    WHERE id = v_b.quote_id;
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.customer_cancel_booking(p_booking_id UUID)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.booking_cancel_before_work_started(p_booking_id);
$$;

-- ---------------------------------------------------------------------------
-- 16. Release escrow trigger — platform fee, shadow vs legacy hold, settlement
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
    -- Customer already debited full hold at pay time; pay provider net of fee
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
-- 17. After payment released → booking completed
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_booking_completed_on_payment_released()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'released' AND (TG_OP = 'UPDATE') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE public.bookings
    SET status = 'completed', updated_at = NOW()
    WHERE id = NEW.booking_id
      AND status <> 'cancelled';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_booking_completed_on_payment ON public.payments;
CREATE TRIGGER trg_sync_booking_completed_on_payment
  AFTER UPDATE OF status ON public.payments
  FOR EACH ROW
  WHEN (NEW.status = 'released')
  EXECUTE FUNCTION public.sync_booking_completed_on_payment_released();

-- ---------------------------------------------------------------------------
-- 18. Admin refund / release — recognize shadow_reserve as escrow
-- ---------------------------------------------------------------------------
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
  v_fee_pct NUMERIC;
  v_final NUMERIC;
  v_provider_credit NUMERIC;
  v_shadow BOOLEAN;
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
      AND wt.type IN ('payment_hold', 'shadow_reserve')
      AND wt.direction = 'debit'
  );

  IF v_payment.status = 'held' AND NOT v_has_escrow THEN
    RAISE EXCEPTION 'Cannot release: held payment has no matching wallet escrow (data inconsistency)';
  END IF;

  SELECT platform_fee_percent INTO v_fee_pct FROM public.app_settings WHERE id = 1;
  IF v_fee_pct IS NULL THEN v_fee_pct := 10; END IF;

  v_final := v_payment.amount;
  IF v_payment.settlement_customer_agreed AND v_payment.settlement_provider_agreed
     AND v_payment.settlement_proposed_amount IS NOT NULL THEN
    v_final := LEAST(v_payment.settlement_proposed_amount, v_payment.amount);
  END IF;
  v_provider_credit := round(v_final * (1 - v_fee_pct / 100.0), 2);

  v_shadow := public._booking_has_shadow_escrow(v_payment.booking_id);

  IF v_payment.status = 'held' AND v_shadow THEN
    SELECT id INTO v_customer_wallet_id FROM public.wallets WHERE user_id = v_booking.customer_id;
    UPDATE public.wallets
    SET
      reserved_balance = reserved_balance - v_payment.amount,
      balance = balance - v_final,
      updated_at = NOW()
    WHERE id = v_customer_wallet_id;

    INSERT INTO public.wallet_transactions (
      wallet_id, type, direction, amount, reference_id, description
    )
    VALUES (
      v_customer_wallet_id,
      'shadow_release',
      'credit',
      v_payment.amount,
      v_payment.booking_id,
      'Admin release — reservation cleared'
    );
  ELSIF v_payment.status = 'held' THEN
    -- legacy hold: funds already left balance
    NULL;
  ELSIF v_has_escrow THEN
    IF v_shadow THEN
      SELECT id INTO v_customer_wallet_id FROM public.wallets WHERE user_id = v_booking.customer_id;
      UPDATE public.wallets
      SET
        reserved_balance = reserved_balance - v_payment.amount,
        balance = balance - v_final,
        updated_at = NOW()
      WHERE id = v_customer_wallet_id;
    END IF;
  ELSE
    v_customer_id := v_booking.customer_id;
    SELECT id INTO v_customer_wallet_id FROM public.wallets WHERE user_id = v_customer_id;
    IF v_customer_wallet_id IS NULL THEN
      RAISE EXCEPTION 'Customer wallet not found';
    END IF;

    UPDATE public.wallets
    SET balance = balance - v_payment.amount, updated_at = NOW()
    WHERE id = v_customer_wallet_id;

    INSERT INTO public.wallet_transactions (
      wallet_id, type, direction, amount, reference_id, description
    )
    VALUES (
      v_customer_wallet_id,
      'dispute_adjustment',
      'debit',
      v_payment.amount,
      p_payment_id,
      'Non-escrow dispute — admin released to provider (customer debited)'
    );
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
    p_payment_id,
    'Released by admin'
  );

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
  v_shadow BOOLEAN;
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
      AND wt.type IN ('payment_hold', 'shadow_reserve')
      AND wt.direction = 'debit'
  );

  IF v_payment.status = 'held' AND NOT v_has_escrow THEN
    RAISE EXCEPTION 'Cannot refund: held payment has no matching wallet escrow (data inconsistency)';
  END IF;

  v_shadow := public._booking_has_shadow_escrow(v_payment.booking_id);

  IF v_has_escrow THEN
    SELECT customer_id INTO v_customer_id FROM public.bookings WHERE id = v_payment.booking_id;
    SELECT id INTO v_customer_wallet_id FROM public.wallets WHERE user_id = v_customer_id;

    IF v_shadow THEN
      UPDATE public.wallets
      SET
        reserved_balance = reserved_balance - v_payment.amount,
        updated_at = NOW()
      WHERE id = v_customer_wallet_id;

      INSERT INTO public.wallet_transactions (
        wallet_id, type, direction, amount, reference_id, description
      )
      VALUES (
        v_customer_wallet_id,
        'shadow_release',
        'credit',
        v_payment.amount,
        p_payment_id,
        'Refunded by admin — reservation released'
      );
    ELSE
      UPDATE public.wallets
      SET balance = balance + v_payment.amount, updated_at = NOW()
      WHERE id = v_customer_wallet_id;

      INSERT INTO public.wallet_transactions (
        wallet_id, type, direction, amount, reference_id, description
      )
      VALUES (v_customer_wallet_id, 'payment_refund', 'credit', v_payment.amount, p_payment_id, 'Refunded by admin');
    END IF;
  END IF;

  UPDATE public.payments
  SET status = 'refunded', updated_at = NOW()
  WHERE id = p_payment_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 19. Block provider-only completion: bookings cannot move to completed directly
--     (completion follows dual payment confirmation + trigger)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_booking_completed_without_escrow_release()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    IF EXISTS (
      SELECT 1 FROM public.payments p
      WHERE p.booking_id = NEW.id AND p.status = 'released'
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Booking can only be marked completed after both parties confirm satisfaction and payment is released.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_booking_guard_completed ON public.bookings;
CREATE TRIGGER trg_booking_guard_completed
  BEFORE UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_booking_completed_without_escrow_release();

COMMENT ON FUNCTION public.prevent_booking_completed_without_escrow_release IS
  'Ensures completed status aligns with released escrow (dual confirmation).';
