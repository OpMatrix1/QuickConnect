-- Migration v22: Provider consultation fees
-- Providers can charge an optional assessment fee before committing to a full quote.
-- Run after migration_v21.sql

-- ---------------------------------------------------------------------------
-- 1. service_providers: optional consultation fee per provider
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_providers
  ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC(10, 2)
    CHECK (consultation_fee IS NULL OR consultation_fee > 0);

COMMENT ON COLUMN public.service_providers.consultation_fee IS
  'If set, customers must pay this assessment fee before the provider commits to a full quoted price.';

-- ---------------------------------------------------------------------------
-- 2. quotes: consultation tracking
-- ---------------------------------------------------------------------------
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC(10, 2);

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS consultation_status TEXT
    CHECK (consultation_status IS NULL
      OR consultation_status IN ('awaiting_payment', 'paid', 'assessed'));

COMMENT ON COLUMN public.quotes.consultation_fee IS
  'Snapshot of the provider consultation_fee at the time the quote was requested (non-refundable).';

COMMENT ON COLUMN public.quotes.consultation_status IS
  'NULL = no consultation required; awaiting_payment = customer must pay fee; paid = fee received, awaiting assessment; assessed = provider assessed and can now submit full quote.';

-- ---------------------------------------------------------------------------
-- 3. Extend wallet_transaction types to include consultation_fee
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
    'shadow_release',
    'consultation_fee'
  ));

-- ---------------------------------------------------------------------------
-- 4. Update customer_request_provider_quote to capture provider consultation fee
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
  v_consult_fee NUMERIC;
  v_consult_status TEXT;
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

  -- Snapshot provider consultation fee (if any)
  SELECT sp.consultation_fee INTO v_consult_fee
  FROM public.service_providers sp
  WHERE sp.id = p_provider_id;

  IF v_consult_fee IS NOT NULL AND v_consult_fee > 0 THEN
    v_consult_status := 'awaiting_payment';
  ELSE
    v_consult_fee := NULL;
    v_consult_status := NULL;
  END IF;

  INSERT INTO public.quotes (
    customer_id, provider_id, service_description,
    budget_min, budget_max, customer_message, status,
    consultation_fee, consultation_status
  )
  VALUES (
    auth.uid(), p_provider_id, trim(p_service_description),
    p_budget_min, p_budget_max, NULLIF(trim(p_customer_message), ''), 'requested',
    v_consult_fee, v_consult_status
  )
  RETURNING id INTO v_quote_id;

  RETURN json_build_object(
    'quote_id', v_quote_id,
    'requires_consultation', v_consult_fee IS NOT NULL
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Customer pays consultation fee (non-refundable, direct debit → provider credit)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customer_pay_consultation_fee(p_quote_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote           quotes%ROWTYPE;
  v_cust_wallet     wallets%ROWTYPE;
  v_provider_pid    UUID;
  v_prov_wallet_id  UUID;
BEGIN
  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  IF v_quote.customer_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the customer can pay the consultation fee';
  END IF;

  IF v_quote.consultation_fee IS NULL OR v_quote.consultation_fee <= 0 THEN
    RAISE EXCEPTION 'This quote does not require a consultation fee';
  END IF;

  IF v_quote.consultation_status <> 'awaiting_payment' THEN
    RAISE EXCEPTION 'Consultation fee has already been paid or is not required at this stage';
  END IF;

  SELECT * INTO v_cust_wallet FROM public.wallets WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer wallet not found';
  END IF;

  IF (v_cust_wallet.balance - COALESCE(v_cust_wallet.reserved_balance, 0)) < v_quote.consultation_fee THEN
    RAISE EXCEPTION 'Insufficient wallet funds. You need P% available to pay the consultation fee.',
      round(v_quote.consultation_fee, 2);
  END IF;

  -- Deduct from customer wallet (non-refundable, no escrow)
  UPDATE public.wallets
  SET balance = balance - v_quote.consultation_fee, updated_at = NOW()
  WHERE id = v_cust_wallet.id;

  INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description)
  VALUES (
    v_cust_wallet.id,
    'consultation_fee',
    'debit',
    v_quote.consultation_fee,
    p_quote_id,
    'Consultation fee — assessment requested'
  );

  -- Credit provider wallet immediately
  SELECT sp.profile_id INTO v_provider_pid
  FROM public.service_providers sp
  WHERE sp.id = v_quote.provider_id;

  SELECT id INTO v_prov_wallet_id FROM public.wallets WHERE user_id = v_provider_pid;

  IF v_prov_wallet_id IS NOT NULL THEN
    UPDATE public.wallets
    SET balance = balance + v_quote.consultation_fee, updated_at = NOW()
    WHERE id = v_prov_wallet_id;

    INSERT INTO public.wallet_transactions (wallet_id, type, direction, amount, reference_id, description)
    VALUES (
      v_prov_wallet_id,
      'consultation_fee',
      'credit',
      v_quote.consultation_fee,
      p_quote_id,
      'Consultation fee received'
    );
  END IF;

  -- Advance consultation status
  UPDATE public.quotes
  SET consultation_status = 'paid', updated_at = NOW()
  WHERE id = p_quote_id;

  RETURN json_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Provider marks consultation/assessment complete → can now submit quote
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provider_mark_consultation_complete(p_quote_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote  quotes%ROWTYPE;
  v_sp_id  UUID;
BEGIN
  SELECT id INTO v_sp_id
  FROM public.service_providers
  WHERE profile_id = auth.uid();

  IF v_sp_id IS NULL THEN
    RAISE EXCEPTION 'Only a service provider can complete a consultation';
  END IF;

  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  IF v_quote.provider_id <> v_sp_id THEN
    RAISE EXCEPTION 'This quote is not assigned to you';
  END IF;

  IF v_quote.consultation_status <> 'paid' THEN
    RAISE EXCEPTION 'Consultation fee must be paid before you can mark the assessment as complete';
  END IF;

  UPDATE public.quotes
  SET consultation_status = 'assessed', updated_at = NOW()
  WHERE id = p_quote_id;

  RETURN json_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Update provider_submit_quote_response to enforce consultation gate
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provider_submit_quote_response(
  p_quote_id       UUID,
  p_quoted_amount  NUMERIC,
  p_provider_message TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote  quotes%ROWTYPE;
  v_avail  NUMERIC;
  v_sp_id  UUID;
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

  -- Consultation gate: if required, must be fully assessed before quoting
  IF v_quote.consultation_status IS NOT NULL AND v_quote.consultation_status <> 'assessed' THEN
    RAISE EXCEPTION 'Complete the consultation assessment before submitting a price. Current consultation status: %',
      v_quote.consultation_status;
  END IF;

  v_avail := public.wallet_available_amount(v_quote.customer_id);

  IF v_avail < p_quoted_amount THEN
    RAISE EXCEPTION 'The customer does not have enough wallet funds for P%. They have P% available for new commitments. Ask them to top up or reduce the quote.',
      round(p_quoted_amount, 2), round(v_avail, 2);
  END IF;

  UPDATE public.quotes
  SET
    quoted_amount    = p_quoted_amount,
    provider_message = NULLIF(trim(p_provider_message), ''),
    status           = 'quoted',
    updated_at       = NOW()
  WHERE id = p_quote_id;

  RETURN json_build_object('ok', true);
END;
$$;
