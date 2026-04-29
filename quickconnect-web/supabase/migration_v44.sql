-- migration_v44.sql
-- Fix: "record v_quote has no field consultation_status"
-- The quotes table is missing the consultation_status (and consultation_fee) columns
-- that migration_v22 was supposed to add.  Add them safely here, then
-- re-declare the provider_submit_quote_response RPC so it works correctly.

-- ── 1. Add missing columns to quotes ─────────────────────────────────────────

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS consultation_fee    NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS consultation_status TEXT
    CHECK (consultation_status IS NULL
      OR consultation_status IN ('awaiting_payment', 'paid', 'assessed'));

-- ── 2. Add missing consultation_fee to service_providers (if absent) ─────────

ALTER TABLE public.service_providers
  ADD COLUMN IF NOT EXISTS consultation_fee NUMERIC(10,2);

-- ── 3. Recreate provider_submit_quote_response cleanly ───────────────────────

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

  -- Consultation gate: only enforce when a consultation was explicitly required
  IF v_quote.consultation_status IS NOT NULL AND v_quote.consultation_status <> 'assessed' THEN
    RAISE EXCEPTION 'Complete the consultation assessment before submitting a price. Current status: %',
      v_quote.consultation_status;
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
