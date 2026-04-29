-- Migration v24: Fix quote submission flow so providers can always send a price.
--
-- Problem: provider_submit_quote_response threw an exception when the customer
-- lacked funds, leaving the quote stuck at 'requested' and the customer unaware.
-- The financial gate belongs only at customer_accept_quote time (which already
-- enforces the check).  This migration:
--   1. Removes the hard customer-funds block from provider_submit_quote_response.
--   2. Adds a trigger that notifies the customer whenever a quote reaches 'quoted',
--      including a top-up nudge when their balance is insufficient.
--
-- Run after migration_v23.sql

-- ---------------------------------------------------------------------------
-- 1. provider_submit_quote_response — allow quote regardless of customer balance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.provider_submit_quote_response(
  p_quote_id        UUID,
  p_quoted_amount   NUMERIC,
  p_provider_message TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote  quotes%ROWTYPE;
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

  -- NOTE: customer funds are intentionally NOT checked here.
  -- The customer is notified of the quoted price (see trigger below) and
  -- prompted to top up if needed.  The hard funds check still runs at
  -- customer_accept_quote time, which is the correct financial gate.

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

-- ---------------------------------------------------------------------------
-- 2. Trigger: notify customer when a quote reaches status = 'quoted'
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_customer_quote_received()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_name   TEXT;
  v_avail           NUMERIC;
  v_title           TEXT;
  v_body            TEXT;
  v_amount_fmt      TEXT;
  v_desc_short      TEXT;
BEGIN
  -- Only fire when the status transitions TO 'quoted'
  IF NEW.status IS DISTINCT FROM 'quoted' THEN
    RETURN NEW;
  END IF;
  IF OLD.status IS NOT DISTINCT FROM 'quoted' THEN
    RETURN NEW;
  END IF;

  -- Look up provider business name
  SELECT COALESCE(sp.business_name, p.full_name, 'Provider')
  INTO v_provider_name
  FROM public.service_providers sp
  JOIN public.profiles p ON p.id = sp.profile_id
  WHERE sp.id = NEW.provider_id;

  v_amount_fmt := 'P' || trim(to_char(NEW.quoted_amount, 'FM999,999,990.00'));
  v_desc_short := left(NEW.service_description, 80);

  -- Check whether the customer can currently afford it
  v_avail := public.wallet_available_amount(NEW.customer_id);

  v_title := 'Quote received — ' || v_amount_fmt;

  IF v_avail IS NOT NULL AND v_avail < NEW.quoted_amount THEN
    v_body := format(
      '%s quoted %s for "%s". Your available balance is P%s — top up your wallet to accept.',
      v_provider_name,
      v_amount_fmt,
      v_desc_short,
      trim(to_char(GREATEST(v_avail, 0), 'FM999,999,990.00'))
    );
  ELSE
    v_body := format(
      '%s quoted %s for "%s". Open My Quotes to accept or decline.',
      v_provider_name,
      v_amount_fmt,
      v_desc_short
    );
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    NEW.customer_id,
    'quote_received',
    v_title,
    v_body,
    jsonb_build_object(
      'quote_id',  NEW.id::text,
      'path',      '/quotes?quote=' || NEW.id::text
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotes_after_update_notify_customer ON public.quotes;
CREATE TRIGGER trg_quotes_after_update_notify_customer
  AFTER UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_customer_quote_received();
